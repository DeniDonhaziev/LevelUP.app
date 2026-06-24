import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  updateProfile,
} from 'firebase/auth';

import { DEFAULT_TOPIC_ID, type TopicId } from '@/lib/topics';
import { emptyUserData } from '@/lib/trackerLogic';
import { mergeUserData } from '@/lib/userDataMerge';
import { useTrackerStore, waitForStoreHydration } from '@/store/trackerStore';

import { ensureNotificationPermission } from '@/lib/notifications/clanChat';
import { refreshFcmTokenIfPermitted } from '@/lib/notifications/fcm';
import { clearPushTokensOnLogout } from '@/lib/notifications/fcm/logout';
import { syncMotivationSchedule } from '@/lib/notifications/runMotivation';

import { pullClansFromCloud, stopClanListeners } from './clanListeners';
import { startRunnerLeaderboardListener, stopRunnerLeaderboardListener } from './runnerListeners';
import { getFirebaseAuth } from './app';
import { isFirebaseConfigured } from './config';
import {
  loadTerritoriesCollection,
  loadUserDocument,
  loadUserEmailByUsernameKey,
  normalizeUsernameKey,
  saveUserDocument,
  saveUsernameMapping,
  subscribeTerritoriesCollection,
  type UserDoc,
  usernameMappingExists,
} from './firestoreSync';

let detachTerritoriesListener: (() => void) | null = null;

function stopTerritoriesListener() {
  if (detachTerritoriesListener) {
    detachTerritoriesListener();
    detachTerritoriesListener = null;
  }
}

function startTerritoriesListener() {
  stopTerritoriesListener();
  detachTerritoriesListener = subscribeTerritoriesCollection((list) => {
    useTrackerStore.getState().setTerritories(list);
  });
}

async function startSportListeners(uid: string): Promise<void> {
  startRunnerLeaderboardListener();
  await pullClansFromCloud();
  if (await ensureNotificationPermission()) {
    const clanId = useTrackerStore.getState().getClanId();
    await refreshFcmTokenIfPermitted(uid, clanId);
  }
}

function displayUsernameFromDoc(
  doc: UserDoc | null,
  email: string,
  authDisplayName?: string | null
): string {
  const u = doc?.username?.trim();
  if (u) return u;
  const fromAuth = authDisplayName?.trim();
  if (fromAuth) return fromAuth;
  const local = email.split('@')[0];
  return local && local.length > 0 ? local : 'user';
}

function profilePhotoFromDoc(doc: UserDoc | null, authPhotoURL: string | null | undefined): string | null {
  const fromDoc = doc?.photoURL?.trim();
  if (fromDoc) return fromDoc;
  const fromAuth = authPhotoURL?.trim();
  return fromAuth && fromAuth.length > 0 ? fromAuth : null;
}

function topicIdFromDoc(_doc: UserDoc | null): TopicId {
  return DEFAULT_TOPIC_ID;
}

export function subscribeToAuthChanges(): () => void {
  if (!isFirebaseConfigured()) {
    useTrackerStore.getState().setAuthReady(true);
    return () => {};
  }

  const auth = getFirebaseAuth();
  const unsubAuth = onAuthStateChanged(auth, async (user) => {
    await waitForStoreHydration();
    const store = useTrackerStore.getState();
    stopTerritoriesListener();
    stopClanListeners();
    stopRunnerLeaderboardListener();
    try {
      if (user?.email) {
        const [doc, terr] = await Promise.all([loadUserDocument(user.uid), loadTerritoriesCollection()]);
        const data = doc?.userData ?? emptyUserData();
        const displayName = displayUsernameFromDoc(doc, user.email, user.displayName);
        const photo = profilePhotoFromDoc(doc, user.photoURL);
        const topicId = topicIdFromDoc(doc);
        store.applyFirebaseSession(user.email, user.uid, data, displayName, photo, topicId);
        store.setTerritories(terr);
        startTerritoriesListener();
        await startSportListeners(user.uid);
        if (doc?.username) {
          const key = normalizeUsernameKey(doc.username);
          try {
            await saveUsernameMapping(key, user.email, user.uid);
          } catch (e) {
            console.warn('username mapping sync:', e);
          }
        }
      } else {
        store.clearFirebaseSession();
      }
    } catch (e) {
      console.warn('Firebase auth state:', e);
      if (user?.email) {
        const displayName = displayUsernameFromDoc(null, user.email, user.displayName);
        const photo = profilePhotoFromDoc(null, user.photoURL);
        const localKey = store.currentUser ?? displayName;
        const localData = localKey ? store.getUserData(localKey) : emptyUserData();
        const data = mergeUserData(localData, emptyUserData());
        store.applyFirebaseSession(user.email, user.uid, data, displayName, photo, DEFAULT_TOPIC_ID);
        try {
          store.setTerritories(await loadTerritoriesCollection());
        } catch {
          store.setTerritories([]);
        }
        startTerritoriesListener();
        await startSportListeners(user.uid);
      } else {
        store.clearFirebaseSession();
      }
    } finally {
      store.setAuthReady(true);
    }
  });

  return () => {
    stopTerritoriesListener();
    stopClanListeners();
    stopRunnerLeaderboardListener();
    unsubAuth();
  };
}

function validateDisplayUsername(raw: string): string | null {
  const name = raw.trim();
  if (name.length < 2) return 'Имя пользователя минимум 2 символа';
  if (name.length > 40) return 'Имя пользователя не длиннее 40 символов';
  return null;
}

export async function firebaseRegister(
  email: string,
  password: string,
  displayUsername: string,
  topicId: TopicId = DEFAULT_TOPIC_ID
): Promise<string | null> {
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length < 3) return 'Введите корректный email';
  if (password.length < 6) return 'Пароль минимум 6 символов (Firebase)';
  const nameErr = validateDisplayUsername(displayUsername);
  if (nameErr) return nameErr;
  const name = displayUsername.trim();
  const nameKey = normalizeUsernameKey(name);
  try {
    const taken = await usernameMappingExists(nameKey);
    if (taken) return 'Это имя пользователя уже занято';
    const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), trimmed, password);
    await updateProfile(cred.user, { displayName: name });
    const data = emptyUserData();
    await saveUserDocument(cred.user.uid, cred.user.email!, name, data, null, topicId);
    await saveUsernameMapping(nameKey, cred.user.email!, cred.user.uid);
    useTrackerStore.getState().applyFirebaseSession(cred.user.email!, cred.user.uid, data, name, null, topicId);
    return null;
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === 'auth/email-already-in-use') {
      const loginErr = await firebaseLogin(trimmed, password);
      if (loginErr === null) return null;
      return 'Этот email уже занят. Если это ваш аккаунт — откройте вкладку «Вход» и введите тот же email и пароль.';
    }
    if (code === 'auth/invalid-email') return 'Некорректный email';
    if (code === 'auth/weak-password') return 'Слабый пароль';
    return (e as Error)?.message ?? 'Ошибка регистрации';
  }
}

export async function firebaseLogin(identifier: string, password: string): Promise<string | null> {
  const raw = identifier.trim();
  if (raw.length < 1) return 'Введите логин или email';
  let emailForAuth = raw.toLowerCase();
  if (!raw.includes('@')) {
    const key = normalizeUsernameKey(raw);
    const resolved = await loadUserEmailByUsernameKey(key);
    if (!resolved) return 'Неверный логин или пароль';
    emailForAuth = resolved.trim().toLowerCase();
  }
  try {
    const cred = await signInWithEmailAndPassword(getFirebaseAuth(), emailForAuth, password);
    try {
      const doc = await loadUserDocument(cred.user.uid);
      const data = doc?.userData ?? emptyUserData();
      const displayName = displayUsernameFromDoc(doc, cred.user.email!, cred.user.displayName);
      const photo = profilePhotoFromDoc(doc, cred.user.photoURL);
      const topicId = topicIdFromDoc(doc);
      useTrackerStore.getState().applyFirebaseSession(
        cred.user.email!,
        cred.user.uid,
        data,
        displayName,
        photo,
        topicId
      );
    } catch (loadErr) {
      console.warn('Firebase login: не удалось загрузить профиль из Firestore', loadErr);
      const st = useTrackerStore.getState();
      const displayName = displayUsernameFromDoc(null, cred.user.email!, cred.user.displayName);
      const photo = profilePhotoFromDoc(null, cred.user.photoURL);
      const localKey = st.currentUser ?? displayName;
      const localData = localKey ? st.getUserData(localKey) : emptyUserData();
      const data = mergeUserData(localData, emptyUserData());
      useTrackerStore.getState().applyFirebaseSession(
        cred.user.email!,
        cred.user.uid,
        data,
        displayName,
        photo,
        DEFAULT_TOPIC_ID
      );
    }
    try {
      const terr = await loadTerritoriesCollection();
      useTrackerStore.getState().setTerritories(terr);
    } catch (terrErr) {
      console.warn('Firebase login: территории', terrErr);
    }
    return null;
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      return 'Неверный логин или пароль';
    }
    if (code === 'auth/invalid-email') return 'Некорректный email';
    if (code === 'auth/too-many-requests') return 'Слишком много попыток. Подождите минуту.';
    return (e as Error)?.message ?? 'Ошибка входа';
  }
}

export async function firebaseLogout(): Promise<void> {
  stopTerritoriesListener();
  const st = useTrackerStore.getState();
  const uid = st.firebaseUid;
  const clanId = st.getClanId();
  if (uid) {
    try {
      await clearPushTokensOnLogout(uid, clanId);
    } catch (e) {
      console.warn('clearPushTokensOnLogout:', e);
    }
  }
  await signOut(getFirebaseAuth());
  st.clearFirebaseSession();
}

async function resolveEmailForAuth(identifier: string): Promise<string | null> {
  const raw = identifier.trim();
  if (raw.length < 1) return null;
  if (raw.includes('@')) return raw.toLowerCase();
  const key = normalizeUsernameKey(raw);
  const resolved = await loadUserEmailByUsernameKey(key);
  return resolved ? resolved.trim().toLowerCase() : null;
}

/** Отправляет письмо для сброса пароля. Не раскрывает, существует ли аккаунт. */
export async function firebaseSendPasswordReset(identifier: string): Promise<string | null> {
  const raw = identifier.trim();
  if (raw.length < 1) return 'Введите email или логин';
  if (raw.includes('@') && (raw.length < 5 || !raw.includes('.'))) {
    return 'Введите корректный email';
  }

  const emailForReset = await resolveEmailForAuth(raw);
  if (!emailForReset) return null;

  try {
    await sendPasswordResetEmail(getFirebaseAuth(), emailForReset);
    return null;
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === 'auth/user-not-found' || code === 'auth/invalid-email') return null;
    if (code === 'auth/too-many-requests') return 'Слишком много попыток. Подождите минуту.';
    return (e as Error)?.message ?? 'Не удалось отправить письмо';
  }
}

export async function firebaseChangePassword(
  currentPassword: string,
  newPassword: string
): Promise<string | null> {
  if (newPassword.length < 6) return 'Новый пароль минимум 6 символов';
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user?.email) return 'Войдите в аккаунт';

  try {
    const cred = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, cred);
    await updatePassword(user, newPassword);
    return null;
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      return 'Неверный текущий пароль';
    }
    if (code === 'auth/weak-password') return 'Слабый пароль';
    if (code === 'auth/too-many-requests') return 'Слишком много попыток. Подождите минуту.';
    if (code === 'auth/requires-recent-login') {
      return 'Сессия устарела. Выйдите и войдите снова, затем повторите смену пароля.';
    }
    return (e as Error)?.message ?? 'Не удалось сменить пароль';
  }
}
