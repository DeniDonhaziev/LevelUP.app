import type { Clan, ClanMessage } from '@/lib/types';
import { showClanMessageNotification } from '@/lib/notifications/clanChat';
import { useTrackerStore } from '@/store/trackerStore';

import { isFirebaseConfigured } from './config';
import {
  joinClanInFirestore,
  loadClan,
  loadClanLeaderboard,
  loadClanMembers,
  loadClanMessages,
  subscribeClan,
  subscribeClanLeaderboard,
  subscribeClanMessages,
} from './clanSync';
import type { Unsubscribe } from 'firebase/firestore';

let detachChat: Unsubscribe | null = null;
let detachLeaderboard: Unsubscribe | null = null;
let detachMyClan: Unsubscribe | null = null;
let myClanListenerId: string | null = null;
let lastChatIds = new Set<string>();
let chatListenerClanId: string | null = null;

/** Следим за своим кланом: если его удалили — мгновенно убираем у участника. */
export function startMyClanListener(clanId: string): void {
  if (myClanListenerId === clanId && detachMyClan) return;
  stopMyClanListener();
  if (!isFirebaseConfigured()) return;
  myClanListenerId = clanId;
  detachMyClan = subscribeClan(clanId, (clan) => {
    const store = useTrackerStore.getState();
    if (clan === null) {
      // Клан удалён — очищаем у этого пользователя
      const user = store.currentUser;
      store.setActiveClan(null);
      useTrackerStore.setState((s) => {
        const clansById = { ...s.clansById };
        delete clansById[clanId];
        const clanMembersByClanId = { ...s.clanMembersByClanId };
        delete clanMembersByClanId[clanId];
        const clanMessagesByClanId = { ...s.clanMessagesByClanId };
        delete clanMessagesByClanId[clanId];
        return { clansById, clanMembersByClanId, clanMessagesByClanId };
      });
      if (user) {
        const data = store.getUserData(user);
        if (data.clanId === clanId) store.setUserData(user, { ...data, clanId: null });
      }
      stopClanChatListener();
      stopMyClanListener();
      store.refreshClanState();
      return;
    }
    // Клан жив — обновляем данные
    store.setActiveClan(clan);
    useTrackerStore.setState((s) => ({ clansById: { ...s.clansById, [clan.id]: clan } }));
  });
}

export function stopMyClanListener(): void {
  if (detachMyClan) {
    detachMyClan();
    detachMyClan = null;
  }
  myClanListenerId = null;
}

function restoreClanIdFromLocalCache(firebaseUid: string, username: string): string | null {
  const store = useTrackerStore.getState();
  for (const [cid, members] of Object.entries(store.clanMembersByClanId)) {
    const isMember = members.some((m) => m.uid === firebaseUid || m.username === username);
    if (!isMember) continue;
    const data = store.getUserData(username);
    store.setUserData(username, { ...data, clanId: cid });
    return cid;
  }
  return null;
}

function mergeClansIntoStore(clans: Clan[]) {
  useTrackerStore.setState((s) => {
    let changed = false;
    const merged = { ...s.clansById };
    for (const c of clans) {
      const prev = merged[c.id];
      if (
        !prev ||
        prev.totalDistanceMeters !== c.totalDistanceMeters ||
        prev.memberCount !== c.memberCount ||
        prev.name !== c.name ||
        prev.inviteCode !== c.inviteCode
      ) {
        merged[c.id] = c;
        changed = true;
      }
    }
    return changed ? { clansById: merged } : s;
  });
}

/** Загрузка кланов из Firestore: топ для всех + ваш клан после входа. */
export async function pullClansFromCloud(): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const store = useTrackerStore.getState();
  const firebaseUid = store.firebaseUid;
  const username = store.currentUser;
  if (!firebaseUid || !username) return;

  let cloudClans: Clan[] = [];
  try {
    cloudClans = await loadClanLeaderboard();
    store.setClanLeaderboard(cloudClans);
    mergeClansIntoStore(cloudClans);
  } catch (e) {
    console.warn('pullClansFromCloud leaderboard:', e);
  }

  startClanLeaderboardListener();

  let clanId = store.getClanId();
  if (!clanId) {
    clanId = restoreClanIdFromLocalCache(firebaseUid, username);
  }
  if (!clanId) {
    store.refreshClanState();
    return;
  }

  try {
    let clan = await loadClan(clanId);

    // Клан удалён в облаке — не перевступаем, очищаем локальное состояние
    if (!clan) {
      store.setActiveClan(null);
      useTrackerStore.setState((s) => {
        const clansById = { ...s.clansById };
        delete clansById[clanId];
        const clanMembersByClanId = { ...s.clanMembersByClanId };
        delete clanMembersByClanId[clanId];
        const clanMessagesByClanId = { ...s.clanMessagesByClanId };
        delete clanMessagesByClanId[clanId];
        return { clansById, clanMembersByClanId, clanMessagesByClanId };
      });
      const data = store.getUserData(username);
      if (data.clanId === clanId) store.setUserData(username, { ...data, clanId: null });
      store.refreshClanState();
      return;
    }

    let members = await loadClanMembers(clanId);
    const inClan = members.some((m) => m.uid === firebaseUid);

    if (!inClan) {
      try {
        await joinClanInFirestore(clanId, firebaseUid, username);
        members = await loadClanMembers(clanId);
      } catch (e) {
        console.warn('restore clan membership:', e);
      }
    }

    const messages = await loadClanMessages(clanId);
    const st = useTrackerStore.getState();

    if (clan) {
      st.setActiveClan(clan);
      useTrackerStore.setState((s) => {
        const prev = s.clansById[clan!.id];
        if (
          prev &&
          prev.totalDistanceMeters === clan!.totalDistanceMeters &&
          prev.name === clan!.name &&
          prev.inviteCode === clan!.inviteCode
        ) {
          return s;
        }
        return { clansById: { ...s.clansById, [clan!.id]: clan! } };
      });
    }

    if (members.length) st.setClanMembers(clanId, members);
    if (messages.length) {
      st.setClanMessages(clanId, messages);
      lastChatIds = new Set(messages.map((m) => m.id));
    }
    st.refreshClanState();
    startClanChatListener(clanId);
    startMyClanListener(clanId);
  } catch (e) {
    console.warn('pullClansFromCloud clan:', e);
  }
}

function notifyNewClanMessages(messages: ClanMessage[], myUid: string | null): void {
  if (!myUid) return;
  for (const m of messages) {
    if (m.uid === myUid) continue;
    void showClanMessageNotification(m.username, m.text);
  }
}

/** Живой чат клана + уведомления о новых сообщениях. */
export function startClanChatListener(clanId: string): void {
  if (chatListenerClanId === clanId && detachChat) return;
  stopClanChatListener();
  if (!isFirebaseConfigured()) return;
  chatListenerClanId = clanId;
  lastChatIds = new Set();

  detachChat = subscribeClanMessages(clanId, (messages) => {
    const store = useTrackerStore.getState();
    const myUid = store.firebaseUid;
    if (lastChatIds.size > 0) {
      const fresh = messages.filter((m) => !lastChatIds.has(m.id));
      notifyNewClanMessages(fresh, myUid);
    }
    lastChatIds = new Set(messages.map((m) => m.id));
    store.setClanMessages(clanId, messages);
  });
}

export function stopClanChatListener(): void {
  if (detachChat) {
    detachChat();
    detachChat = null;
  }
  chatListenerClanId = null;
  lastChatIds = new Set();
}

/** Рейтинг кланов в реальном времени. */
export function startClanLeaderboardListener(): void {
  stopClanLeaderboardListener();
  if (!isFirebaseConfigured()) return;
  detachLeaderboard = subscribeClanLeaderboard((clans) => {
    useTrackerStore.getState().setClanLeaderboard(clans);
    mergeClansIntoStore(clans);
  });
}

export function stopClanLeaderboardListener(): void {
  if (detachLeaderboard) {
    detachLeaderboard();
    detachLeaderboard = null;
  }
}

/** @deprecated */
export function stopClanListeners(): void {
  stopClanChatListener();
  stopClanLeaderboardListener();
  stopMyClanListener();
}

/** @deprecated */
export async function startClanListeners(_clanId?: string | null): Promise<void> {
  await pullClansFromCloud();
}

/** @deprecated */
export async function restartClanListeners(): Promise<void> {
  await pullClansFromCloud();
}
