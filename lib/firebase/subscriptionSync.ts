import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, setDoc } from 'firebase/firestore';

import { addMonths, PLAN_BY_ID, type PlanId, type SubscriptionDoc } from '@/lib/subscription';
import { getDb } from './app';

const SUBSCRIPTIONS = 'subscriptions';

/** Пользователь отправляет заявку на подписку (статус pending). */
export async function requestSubscription(
  uid: string,
  username: string,
  email: string,
  plan: PlanId
): Promise<SubscriptionDoc> {
  const price = PLAN_BY_ID[plan].price;
  const payload: SubscriptionDoc = {
    uid,
    username,
    email,
    plan,
    status: 'pending',
    price,
    requestedAt: Date.now(),
  };
  await setDoc(doc(getDb(), SUBSCRIPTIONS, uid), payload, { merge: true });
  return payload;
}

export async function loadMySubscription(uid: string): Promise<SubscriptionDoc | null> {
  const snap = await getDoc(doc(getDb(), SUBSCRIPTIONS, uid));
  return snap.exists() ? (snap.data() as SubscriptionDoc) : null;
}

/** Слежение за своей подпиской — доступ к ИИ открывается сразу после подтверждения. */
export function subscribeMySubscription(
  uid: string,
  onUpdate: (sub: SubscriptionDoc | null) => void
): () => void {
  return onSnapshot(
    doc(getDb(), SUBSCRIPTIONS, uid),
    (snap) => onUpdate(snap.exists() ? (snap.data() as SubscriptionDoc) : null),
    (err) => console.warn('subscribeMySubscription:', err)
  );
}

/** Все заявки/подписки — только для админа. */
export async function loadAllSubscriptions(): Promise<SubscriptionDoc[]> {
  const snap = await getDocs(collection(getDb(), SUBSCRIPTIONS));
  const list: SubscriptionDoc[] = [];
  snap.forEach((d) => list.push(d.data() as SubscriptionDoc));
  list.sort((a, b) => (b.requestedAt || 0) - (a.requestedAt || 0));
  return list;
}

/** Админ подтверждает заявку — активирует подписку на срок плана. */
export async function approveSubscription(sub: SubscriptionDoc): Promise<SubscriptionDoc> {
  const months = PLAN_BY_ID[sub.plan].months;
  const now = Date.now();
  const base = sub.status === 'active' && sub.expiresAt && sub.expiresAt > now ? sub.expiresAt : now;
  const updated: SubscriptionDoc = {
    ...sub,
    status: 'active',
    activatedAt: now,
    expiresAt: addMonths(base, months),
  };
  await setDoc(doc(getDb(), SUBSCRIPTIONS, sub.uid), updated, { merge: true });
  return updated;
}

/** Админ отклоняет заявку. */
export async function rejectSubscription(sub: SubscriptionDoc): Promise<SubscriptionDoc> {
  const updated: SubscriptionDoc = { ...sub, status: 'rejected' };
  await setDoc(doc(getDb(), SUBSCRIPTIONS, sub.uid), updated, { merge: true });
  return updated;
}

/** Админ удаляет запись о подписке. */
export async function deleteSubscription(uid: string): Promise<void> {
  await deleteDoc(doc(getDb(), SUBSCRIPTIONS, uid));
}
