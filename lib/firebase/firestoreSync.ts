import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  deleteField,
  collection,
  getDocs,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';

import type { Project, Territory, UserData } from '@/lib/types';
import type { TopicId } from '@/lib/topics';
import { DEFAULT_TOPIC_ID } from '@/lib/topics';

import { getDb } from './app';

const USERS = 'users';
const USERNAMES = 'usernames';
const TERRITORIES = 'territories';
const TEAM_PROJECTS = 'teamProjects';

export type TeamProjectsTopic = 'it' | 'manager' | 'creative';

export type TeamProjectsDoc = {
  projects: Project[];
  updatedAt: number;
};

/** Ключ документа: trim + lowerCase (латиница и кириллица) */
export function normalizeUsernameKey(displayUsername: string): string {
  return displayUsername.trim().toLowerCase();
}

export type UsernameMappingDoc = {
  email: string;
  uid: string;
};

/** Публичный lookup: логин → email (для входа с другого устройства по имени) */
export async function loadUserEmailByUsernameKey(key: string): Promise<string | null> {
  const ref = doc(getDb(), USERNAMES, key);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const d = snap.data() as UsernameMappingDoc;
  return typeof d.email === 'string' ? d.email : null;
}

export async function saveUsernameMapping(key: string, email: string, uid: string): Promise<void> {
  const ref = doc(getDb(), USERNAMES, key);
  const payload: UsernameMappingDoc = { email, uid };
  await setDoc(ref, payload, { merge: true });
}

export async function usernameMappingExists(key: string): Promise<boolean> {
  const ref = doc(getDb(), USERNAMES, key);
  const snap = await getDoc(ref);
  return snap.exists();
}

export async function loadUsernameMapping(key: string): Promise<UsernameMappingDoc | null> {
  const ref = doc(getDb(), USERNAMES, key);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as UsernameMappingDoc;
}

export async function deleteUsernameMapping(key: string): Promise<void> {
  const ref = doc(getDb(), USERNAMES, key);
  await deleteDoc(ref);
}

/** Переименование владельца территорий в Firestore и возврат нового массива */
export async function replaceTerritoryOwnersInFirestore(oldOwner: string, newOwner: string): Promise<Territory[]> {
  const terr = await loadTerritoriesCollection();
  const next = terr.map((t) => (t.owner === oldOwner ? { ...t, owner: newOwner } : t));
  await saveTerritoriesCollection(next);
  return next;
}

export type UserDoc = {
  email: string;
  username?: string;
  photoURL?: string;
  topicId?: TopicId;
  userData: UserData;
  updatedAt: number;
  notificationPrefs?: import('@/lib/notifications/fcm/types').NotificationPrefs;
  notificationState?: import('@/lib/notifications/fcm/types').NotificationState;
};

export async function loadUserDocument(uid: string): Promise<UserDoc | null> {
  const ref = doc(getDb(), USERS, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as UserDoc;
}

export async function saveUserDocument(
  uid: string,
  email: string,
  displayUsername: string,
  userData: UserData,
  photoURL?: string | null,
  topicId?: TopicId | null
): Promise<void> {
  const ref = doc(getDb(), USERS, uid);
  const payload: Record<string, unknown> = {
    email,
    username: displayUsername,
    topicId: topicId ?? DEFAULT_TOPIC_ID,
    userData,
    updatedAt: Date.now(),
  };
  if (photoURL !== undefined) {
    payload.photoURL = photoURL === null ? deleteField() : photoURL;
  }
  await setDoc(ref, payload as UserDoc, { merge: true });
}

export async function loadTerritoriesCollection(): Promise<Territory[]> {
  const col = collection(getDb(), TERRITORIES);
  const snap = await getDocs(col);
  const list: Territory[] = [];
  snap.forEach((d) => {
    list.push(d.data() as Territory);
  });
  return list;
}

/**
 * Живое обновление территорий (общий рейтинг для всех, кто вошёл через Firebase).
 * Правила Firestore: чтение только при request.auth != null.
 */
export function subscribeTerritoriesCollection(
  onUpdate: (territories: Territory[]) => void
): () => void {
  const col = collection(getDb(), TERRITORIES);
  return onSnapshot(
    col,
    (snap) => {
      const list: Territory[] = [];
      snap.forEach((d) => {
        list.push(d.data() as Territory);
      });
      onUpdate(list);
    },
    (err) => {
      console.warn('Firestore territories listener:', err);
    }
  );
}

export async function loadTeamProjectsDoc(topic: TeamProjectsTopic): Promise<TeamProjectsDoc> {
  const ref = doc(getDb(), TEAM_PROJECTS, topic);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { projects: [], updatedAt: 0 };
  const data = snap.data() as TeamProjectsDoc;
  return {
    projects: Array.isArray(data.projects) ? data.projects : [],
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0,
  };
}

export async function loadTeamProjects(topic: TeamProjectsTopic): Promise<Project[]> {
  const docData = await loadTeamProjectsDoc(topic);
  return docData.projects;
}

export async function saveTeamProjects(topic: TeamProjectsTopic, projects: Project[]): Promise<void> {
  const ref = doc(getDb(), TEAM_PROJECTS, topic);
  const payload: TeamProjectsDoc = { projects, updatedAt: Date.now() };
  await setDoc(ref, payload, { merge: true });
}

/** Общие проекты IT / менеджмент — видны всем авторизованным пользователям. */
export function subscribeTeamProjects(
  topic: TeamProjectsTopic,
  onUpdate: (projects: Project[], updatedAt: number) => void
): () => void {
  const ref = doc(getDb(), TEAM_PROJECTS, topic);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onUpdate([], 0);
        return;
      }
      const data = snap.data() as TeamProjectsDoc;
      onUpdate(
        Array.isArray(data.projects) ? data.projects : [],
        typeof data.updatedAt === 'number' ? data.updatedAt : 0
      );
    },
    (err) => console.warn(`Firestore teamProjects/${topic}:`, err)
  );
}

export async function saveTerritoriesCollection(territories: Territory[]): Promise<void> {
  const db = getDb();
  const batch = writeBatch(db);
  const col = collection(db, TERRITORIES);
  territories.forEach((t) => {
    batch.set(doc(col, t.id), t, { merge: true });
  });
  await batch.commit();
}
