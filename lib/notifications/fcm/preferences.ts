import { doc, getDoc, setDoc } from 'firebase/firestore';

import { getDb } from '@/lib/firebase/app';
import { isFirebaseConfigured } from '@/lib/firebase/config';

import {
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationPrefs,
  type NotificationState,
} from './types';

export async function loadNotificationPrefs(uid: string): Promise<NotificationPrefs> {
  if (!isFirebaseConfigured() || !uid) return { ...DEFAULT_NOTIFICATION_PREFS };
  const snap = await getDoc(doc(getDb(), 'users', uid));
  if (!snap.exists()) return { ...DEFAULT_NOTIFICATION_PREFS };
  const raw = snap.data()?.notificationPrefs as Partial<NotificationPrefs> | undefined;
  return { ...DEFAULT_NOTIFICATION_PREFS, ...raw };
}

export async function saveNotificationPrefs(
  uid: string,
  prefs: NotificationPrefs
): Promise<void> {
  if (!isFirebaseConfigured() || !uid) return;
  await setDoc(doc(getDb(), 'users', uid), { notificationPrefs: prefs }, { merge: true });
}

export async function loadNotificationState(uid: string): Promise<NotificationState> {
  if (!isFirebaseConfigured() || !uid) return {};
  const snap = await getDoc(doc(getDb(), 'users', uid));
  if (!snap.exists()) return {};
  return (snap.data()?.notificationState as NotificationState) || {};
}

export async function patchNotificationState(
  uid: string,
  patch: Partial<NotificationState>
): Promise<void> {
  if (!isFirebaseConfigured() || !uid) return;
  const prev = await loadNotificationState(uid);
  await setDoc(
    doc(getDb(), 'users', uid),
    { notificationState: { ...prev, ...patch } },
    { merge: true }
  );
}
