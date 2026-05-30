import { doc, setDoc } from 'firebase/firestore';
import { getMessaging, getToken, isSupported, onMessage, type Messaging } from 'firebase/messaging';

import { showClanMessageNotification } from '@/lib/notifications/clanChat';

import { getFirebaseApp, getDb } from './app';
import { getFirebaseExtra } from './config';

let messagingInstance: Messaging | null = null;
let foregroundHooked = false;

function tokenDocId(token: string): string {
  return token.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

async function getMessagingSafe(): Promise<Messaging | null> {
  if (typeof window === 'undefined') return null;
  const ok = await isSupported();
  if (!ok) return null;
  if (!messagingInstance) messagingInstance = getMessaging(getFirebaseApp());
  return messagingInstance;
}

function hookForeground(messaging: Messaging): void {
  if (foregroundHooked) return;
  foregroundHooked = true;
  onMessage(messaging, (payload) => {
    const title = payload.notification?.title ?? 'Клан';
    const body = payload.notification?.body ?? 'Новое сообщение';
    const from = title.replace(/^Клан\s*·\s*/i, '').trim() || 'Клан';
    void showClanMessageNotification(from, body);
  });
}

/** FCM для PWA/браузера — push как в WhatsApp, даже когда вкладка свёрнута. */
export async function registerWebPushToken(uid: string): Promise<boolean> {
  if (typeof window === 'undefined' || !uid) return false;

  const extra = getFirebaseExtra();
  const vapidKey = extra?.firebaseVapidKey?.trim();
  if (!vapidKey) {
    console.warn(
      'Push: добавьте EXPO_PUBLIC_FIREBASE_VAPID_KEY в .env (Firebase Console → Cloud Messaging → Web Push certificates)'
    );
    return false;
  }

  if (!('Notification' in window)) return false;
  if (Notification.permission === 'denied') return false;
  if (Notification.permission !== 'granted') {
    const result = await Notification.requestPermission();
    if (result !== 'granted') return false;
  }

  if (!('serviceWorker' in navigator)) return false;

  try {
    let registration = await navigator.serviceWorker.getRegistration('/');
    if (!registration) {
      registration = await navigator.serviceWorker.register('/sw.js');
    }
    await navigator.serviceWorker.ready;

    const messaging = await getMessagingSafe();
    if (!messaging) return false;

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token) return false;

    await setDoc(doc(getDb(), 'users', uid, 'pushTokens', tokenDocId(token)), {
      token,
      platform: 'web',
      updatedAt: Date.now(),
    });

    hookForeground(messaging);
    return true;
  } catch (e) {
    console.warn('registerWebPushToken:', e);
    return false;
  }
}
