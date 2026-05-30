import {
  collection,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  increment,
  orderBy,
  limit,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import type { Clan, ClanMember, ClanMessage } from '@/lib/types';
import { generateInviteCode } from '@/lib/clanLogic';

import { getDb } from './app';

const CLANS = 'clans';
const CLAN_INVITES = 'clanInvites';

export type ClanDoc = Clan;

export type ClanMemberDoc = ClanMember;

export type ClanMessageDoc = ClanMessage;

export async function findClanIdByInviteCode(code: string): Promise<string | null> {
  const key = code.trim().toUpperCase();
  if (key.length < 4) return null;
  const ref = doc(getDb(), CLAN_INVITES, key);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const clanId = (snap.data() as { clanId?: string }).clanId;
  return typeof clanId === 'string' ? clanId : null;
}

export async function loadClan(clanId: string): Promise<Clan | null> {
  const ref = doc(getDb(), CLANS, clanId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Clan, 'id'>) };
}

export async function loadClanMembers(clanId: string): Promise<ClanMember[]> {
  const col = collection(getDb(), CLANS, clanId, 'members');
  const snap = await getDocs(col);
  const list: ClanMember[] = [];
  snap.forEach((d) => list.push(d.data() as ClanMember));
  return list;
}

export async function loadClanMessages(clanId: string, max = 80): Promise<ClanMessage[]> {
  const col = collection(getDb(), CLANS, clanId, 'messages');
  const q = query(col, orderBy('createdAt', 'desc'), limit(max));
  const snap = await getDocs(q);
  const list: ClanMessage[] = [];
  snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<ClanMessage, 'id'>) }));
  return list.reverse();
}

export async function loadClanLeaderboard(max = 30): Promise<Clan[]> {
  const col = collection(getDb(), CLANS);
  try {
    const q = query(col, orderBy('totalDistanceMeters', 'desc'), limit(max));
    const snap = await getDocs(q);
    const list: Clan[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<Clan, 'id'>) }));
    return list;
  } catch (e) {
    console.warn('loadClanLeaderboard orderBy, fallback:', e);
    const snap = await getDocs(col);
    const list: Clan[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<Clan, 'id'>) }));
    list.sort((a, b) => (b.totalDistanceMeters || 0) - (a.totalDistanceMeters || 0));
    return list.slice(0, max);
  }
}

export async function createClanInFirestore(
  name: string,
  ownerUid: string,
  ownerUsername: string
): Promise<Clan> {
  const clanId = 'clan_' + Date.now();
  const inviteCode = generateInviteCode();
  const now = Date.now();
  const clan: Clan = {
    id: clanId,
    name: name.trim(),
    inviteCode,
    ownerUid,
    ownerUsername,
    totalDistanceMeters: 0,
    memberCount: 1,
    createdAt: now,
  };
  const member: ClanMember = {
    uid: ownerUid,
    username: ownerUsername,
    role: 'owner',
    distanceMeters: 0,
    joinedAt: now,
  };
  await setDoc(doc(getDb(), CLANS, clanId), {
    name: clan.name,
    inviteCode: clan.inviteCode,
    ownerUid: clan.ownerUid,
    ownerUsername: clan.ownerUsername,
    totalDistanceMeters: 0,
    memberCount: 1,
    createdAt: clan.createdAt,
  });
  await setDoc(doc(getDb(), CLAN_INVITES, inviteCode), { clanId });
  await setDoc(doc(getDb(), CLANS, clanId, 'members', ownerUid), member);
  return clan;
}

export async function joinClanInFirestore(
  clanId: string,
  uid: string,
  username: string
): Promise<void> {
  const clanRef = doc(getDb(), CLANS, clanId);
  const memberRef = doc(getDb(), CLANS, clanId, 'members', uid);
  const memberSnap = await getDoc(memberRef);
  if (memberSnap.exists()) return;
  const now = Date.now();
  const member: ClanMember = {
    uid,
    username,
    role: 'member',
    distanceMeters: 0,
    joinedAt: now,
  };
  await setDoc(memberRef, member);
  await updateDoc(clanRef, { memberCount: increment(1) });
}

export async function leaveClanInFirestore(clanId: string, uid: string, isOwner: boolean): Promise<void> {
  const memberRef = doc(getDb(), CLANS, clanId, 'members', uid);
  const memberSnap = await getDoc(memberRef);
  if (!memberSnap.exists()) return;
  const dist = (memberSnap.data() as ClanMember).distanceMeters || 0;
  let nextOwner: ClanMember | null = null;
  if (isOwner) {
    const members = await loadClanMembers(clanId);
    nextOwner = members.find((m) => m.uid !== uid) ?? null;
  }
  await deleteDoc(memberRef);
  const clanRef = doc(getDb(), CLANS, clanId);
  const updates: Record<string, unknown> = { memberCount: increment(-1) };
  if (dist > 0) updates.totalDistanceMeters = increment(-dist);
  if (nextOwner) {
    updates.ownerUid = nextOwner.uid;
    updates.ownerUsername = nextOwner.username;
  }
  await updateDoc(clanRef, updates);
  if (nextOwner) {
    await updateDoc(doc(getDb(), CLANS, clanId, 'members', nextOwner.uid), { role: 'owner' });
  }
}

/** Expo-токены участников клана (для push с телефона отправителя, без Cloud Functions). */
export async function loadClanExpoPushTokens(
  clanId: string,
  excludeUid: string
): Promise<string[]> {
  const members = await loadClanMembers(clanId);
  const tokens = new Set<string>();
  for (const m of members) {
    if (m.uid === excludeUid) continue;
    const t = m.expoPushToken;
    if (typeof t === 'string' && t.startsWith('ExponentPushToken[')) {
      tokens.add(t);
    }
  }
  return [...tokens];
}

export async function updateClanMemberExpoPushToken(
  clanId: string,
  uid: string,
  expoPushToken: string
): Promise<void> {
  if (!expoPushToken.startsWith('ExponentPushToken[')) return;
  const memberRef = doc(getDb(), CLANS, clanId, 'members', uid);
  const snap = await getDoc(memberRef);
  if (!snap.exists()) return;
  await updateDoc(memberRef, { expoPushToken, pushUpdatedAt: Date.now() });
}

export async function sendClanMessageInFirestore(
  clanId: string,
  uid: string,
  username: string,
  text: string,
  msgId?: string,
  createdAt?: number
): Promise<ClanMessage> {
  const id = msgId ?? 'm' + Date.now();
  const at = createdAt ?? Date.now();
  const msg: ClanMessage = {
    id,
    uid,
    username,
    text: text.trim(),
    createdAt: at,
  };
  await setDoc(doc(getDb(), CLANS, clanId, 'messages', id), {
    uid: msg.uid,
    username: msg.username,
    text: msg.text,
    createdAt: msg.createdAt,
  });
  return msg;
}

export async function addClanRunDistance(
  clanId: string,
  uid: string,
  username: string,
  deltaMeters: number
): Promise<void> {
  if (deltaMeters <= 0) return;
  const memberRef = doc(getDb(), CLANS, clanId, 'members', uid);
  const memberSnap = await getDoc(memberRef);
  if (!memberSnap.exists()) {
    await joinClanInFirestore(clanId, uid, username);
  }
  await updateDoc(memberRef, { distanceMeters: increment(Math.round(deltaMeters)) });
  await updateDoc(doc(getDb(), CLANS, clanId), {
    totalDistanceMeters: increment(Math.round(deltaMeters)),
  });
}

export function subscribeClan(
  clanId: string,
  onUpdate: (clan: Clan | null) => void
): Unsubscribe {
  const ref = doc(getDb(), CLANS, clanId);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
        return;
      }
      onUpdate({ id: snap.id, ...(snap.data() as Omit<Clan, 'id'>) });
    },
    (err) => console.warn('subscribeClan:', err)
  );
}

export function subscribeClanMembers(
  clanId: string,
  onUpdate: (members: ClanMember[]) => void
): Unsubscribe {
  const col = collection(getDb(), CLANS, clanId, 'members');
  return onSnapshot(
    col,
    (snap) => {
      const list: ClanMember[] = [];
      snap.forEach((d) => list.push(d.data() as ClanMember));
      onUpdate(list);
    },
    (err) => console.warn('subscribeClanMembers:', err)
  );
}

export function subscribeClanMessages(
  clanId: string,
  onUpdate: (messages: ClanMessage[]) => void
): Unsubscribe {
  const col = collection(getDb(), CLANS, clanId, 'messages');
  const q = query(col, orderBy('createdAt', 'asc'), limit(120));
  return onSnapshot(
    q,
    (snap) => {
      const list: ClanMessage[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<ClanMessage, 'id'>) }));
      onUpdate(list);
    },
    (err) => console.warn('subscribeClanMessages:', err)
  );
}

export function subscribeClanLeaderboard(onUpdate: (clans: Clan[]) => void): Unsubscribe {
  const col = collection(getDb(), CLANS);
  const q = query(col, orderBy('totalDistanceMeters', 'desc'), limit(30));
  return onSnapshot(
    q,
    (snap) => {
      const list: Clan[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<Clan, 'id'>) }));
      onUpdate(list);
    },
    async (err) => {
      console.warn('subscribeClanLeaderboard orderBy failed, fallback:', err);
      try {
        const snap = await getDocs(col);
        const list: Clan[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<Clan, 'id'>) }));
        list.sort((a, b) => (b.totalDistanceMeters || 0) - (a.totalDistanceMeters || 0));
        onUpdate(list.slice(0, 30));
      } catch (e) {
        console.warn('clan leaderboard fallback:', e);
      }
    }
  );
}

/** Поиск клана по коду через query (если нет doc в clanInvites) */
export async function findClanByInviteQuery(code: string): Promise<Clan | null> {
  const key = code.trim().toUpperCase();
  const col = collection(getDb(), CLANS);
  const q = query(col, where('inviteCode', '==', key), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<Clan, 'id'>) };
}
