import { updateProfile } from 'firebase/auth';
import { ref, uploadBytes, uploadString, getDownloadURL } from 'firebase/storage';

import { emptyUserData } from '@/lib/trackerLogic';
import { useTrackerStore } from '@/store/trackerStore';

import { getFirebaseAuth, getFirebaseStorage } from './app';
import { isFirebaseConfigured } from './config';
import {
  deleteUsernameMapping,
  loadUserDocument,
  loadUsernameMapping,
  normalizeUsernameKey,
  replaceTerritoryOwnersInFirestore,
  saveUserDocument,
  saveUsernameMapping,
} from './firestoreSync';

function validateName(raw: string): string | null {
  const name = raw.trim();
  if (name.length < 2) return 'Имя минимум 2 символа';
  if (name.length > 40) return 'Имя не длиннее 40 символов';
  return null;
}

/** Локальный режим: смена имени и владельцев территорий */
export function saveLocalDisplayName(newDisplay: string): string | null {
  const trimmed = newDisplay.trim();
  const err = validateName(trimmed);
  if (err) return err;
  const st = useTrackerStore.getState();
  const oldName = st.currentUser;
  if (!oldName) return 'Нет профиля';
  if (trimmed === oldName) return null;
  const nextTerr = st.territories.map((t) =>
    t.owner === oldName ? { ...t, owner: trimmed } : t
  );
  st.migrateProfileIdentity(oldName, trimmed, nextTerr);
  return null;
}

export async function saveFirebaseDisplayName(newDisplay: string): Promise<string | null> {
  if (!isFirebaseConfigured()) return 'Облако не настроено';
  const trimmed = newDisplay.trim();
  const err = validateName(trimmed);
  if (err) return err;
  const st = useTrackerStore.getState();
  const oldName = st.currentUser;
  const uid = st.firebaseUid;
  if (!oldName || !uid) return 'Нет профиля';
  if (trimmed === oldName) return null;

  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user?.email) return 'Сессия истекла';

  const oldKey = normalizeUsernameKey(oldName);
  const newKey = normalizeUsernameKey(trimmed);
  if (oldKey !== newKey) {
    const existing = await loadUsernameMapping(newKey);
    if (existing && existing.uid !== uid) return 'Это имя уже занято';
  }

  const nextTerr = await replaceTerritoryOwnersInFirestore(oldName, trimmed);

  await updateProfile(user, { displayName: trimmed });
  const doc = await loadUserDocument(uid);
  const data = doc?.userData ?? emptyUserData();
  const photo = st.profilePhotoURL;
  await saveUserDocument(
    uid,
    user.email,
    trimmed,
    data,
    typeof photo === 'string' && photo.length > 0 ? photo : undefined
  );

  if (oldKey !== newKey) {
    try {
      const oldMap = await loadUsernameMapping(oldKey);
      if (oldMap?.uid === uid) await deleteUsernameMapping(oldKey);
    } catch {
      /* нет документа usernames — ок */
    }
    await saveUsernameMapping(newKey, user.email, uid);
  }

  useTrackerStore.getState().migrateProfileIdentity(oldName, trimmed, nextTerr);
  return null;
}

export type UploadAvatarOptions = {
  /** Если есть — грузим в Storage без fetch(uri); на web fetch(blob:) часто зависает */
  base64?: string;
  mimeType?: string;
};

export async function uploadFirebaseAvatar(
  localUri: string,
  opts?: UploadAvatarOptions
): Promise<string | null> {
  if (!isFirebaseConfigured()) return 'Облако не настроено';
  const st = useTrackerStore.getState();
  const uid = st.firebaseUid;
  const name = st.currentUser;
  if (!uid || !name) return 'Нет профиля';
  const user = getFirebaseAuth().currentUser;
  if (!user?.email) return 'Сессия истекла';

  try {
    const mime = opts?.mimeType || 'image/jpeg';
    const storageRef = ref(getFirebaseStorage(), `avatars/${uid}/profile.jpg`);

    if (opts?.base64 && opts.base64.length > 0) {
      await uploadString(storageRef, opts.base64, 'base64', { contentType: mime });
    } else {
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), 45000);
      let blob: Blob;
      try {
        const response = await fetch(localUri, { signal: ctrl.signal });
        blob = await response.blob();
      } finally {
        clearTimeout(id);
      }
      await uploadBytes(storageRef, blob);
    }

    const url = await getDownloadURL(storageRef);
    /** Сразу показываем аватар; раньше setProfilePhotoURL был после Firestore и UI «висел» навсегда */
    useTrackerStore.getState().setProfilePhotoURL(url);

    const email = user.email;
    void (async () => {
      try {
        await updateProfile(user, { photoURL: url });
        const doc = await loadUserDocument(uid);
        const data = doc?.userData ?? emptyUserData();
        await saveUserDocument(uid, email, name, data, url);
      } catch (e) {
        console.warn('avatar: синхронизация профиля после Storage', e);
      }
    })();

    return null;
  } catch (e) {
    console.warn('upload avatar', e);
    return 'Не удалось загрузить фото. В Firebase Console включите Storage и правила доступа.';
  }
}

export async function removeFirebaseAvatar(): Promise<string | null> {
  const st = useTrackerStore.getState();
  const uid = st.firebaseUid;
  const name = st.currentUser;
  if (!uid || !name) return 'Нет профиля';
  const user = getFirebaseAuth().currentUser;
  if (!user?.email) return 'Сессия истекла';
  try {
    await updateProfile(user, { photoURL: null });
    const doc = await loadUserDocument(uid);
    const data = doc?.userData ?? emptyUserData();
    await saveUserDocument(uid, user.email, name, data, null);
    useTrackerStore.getState().setProfilePhotoURL(null);
    return null;
  } catch (e) {
    console.warn('remove avatar', e);
    return 'Не удалось убрать фото';
  }
}
