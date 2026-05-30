import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { doc, setDoc } from 'firebase/firestore';

import { updateClanMemberExpoPushToken } from '@/lib/firebase/clanSync';
import { Platform } from 'react-native';

import { getDb } from '@/lib/firebase/app';
import { getFirebaseExtra, isFirebaseConfigured } from '@/lib/firebase/config';

const DEFAULT_VAPID_PUBLIC_KEY =
  'BGI0Onj5Jm8R6PG7EOUn9fJLwCab0oBVEnbQxfQrDKbg976Te5bGkxla0qK7TuMl1-fizQlT7qN2NeUzMfotDrI';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type PushRegisterResult =
  | { ok: true; mode: 'fcm' | 'expo' | 'native' }
  | { ok: false; reason: 'permission' | 'no_token' | 'unsupported' };

function tokenDocId(token: string): string {
  return token.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

async function saveToken(
  uid: string,
  token: string,
  platform: string,
  clanId?: string | null
): Promise<void> {
  await setDoc(doc(getDb(), 'users', uid, 'pushTokens', tokenDocId(token)), {
    token,
    platform,
    updatedAt: Date.now(),
  });
  if (clanId && token.startsWith('ExponentPushToken[')) {
    try {
      await updateClanMemberExpoPushToken(clanId, uid, token);
    } catch (e) {
      console.warn('sync expo token to clan member:', e);
    }
  }
}

async function registerWebExpoToken(
  uid: string,
  clanId?: string | null,
  vapidKey?: string
): Promise<boolean> {
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId) return false;
    const result = await Notifications.getExpoPushTokenAsync({
      projectId,
      ...(vapidKey ? { web: { vapidPublicKey: vapidKey } } : {}),
    });
    const token = result.data;
    if (!token) return false;
    await saveToken(uid, token, 'web-expo', clanId);
    return true;
  } catch (e) {
    console.warn('registerWebExpoToken:', e);
    return false;
  }
}

/**
 * Регистрация push для фона (как WhatsApp).
 * Без сохранённого токена в Firestore сервер не сможет прислать push при закрытом приложении.
 */
export async function registerPushToken(
  uid: string,
  clanId?: string | null
): Promise<PushRegisterResult> {
  if (!isFirebaseConfigured() || !uid) {
    return { ok: false, reason: 'unsupported' };
  }

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') {
      return { ok: false, reason: 'unsupported' };
    }
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      return { ok: false, reason: 'unsupported' };
    }
    if (Notification.permission !== 'granted') {
      return { ok: false, reason: 'permission' };
    }

    const vapidKey = getFirebaseExtra()?.firebaseVapidKey?.trim() || DEFAULT_VAPID_PUBLIC_KEY;

    if (await registerWebExpoToken(uid, clanId, vapidKey)) {
      return { ok: true, mode: 'expo' };
    }
    if (vapidKey && (await registerWebExpoToken(uid, clanId))) {
      return { ok: true, mode: 'expo' };
    }

    if (vapidKey) {
      try {
        const { registerWebPushToken } = await import('@/lib/firebase/messaging.web');
        if (await registerWebPushToken(uid)) return { ok: true, mode: 'fcm' };
      } catch (e) {
        console.warn('registerWebPushToken:', e);
      }
    }

    return { ok: false, reason: 'no_token' };
  }

  if (!Device.isDevice) {
    return { ok: false, reason: 'unsupported' };
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return { ok: false, reason: 'permission' };
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('clan-chat', {
      name: 'Чат клана',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 120, 250],
    });
  }

  try {
    const tokenResult = await Notifications.getDevicePushTokenAsync();
    const token = tokenResult.data;
    if (!token) return { ok: false, reason: 'no_token' };
    await saveToken(uid, token, Platform.OS, clanId);
    return { ok: true, mode: 'native' };
  } catch (e) {
    console.warn('registerPushToken native:', e);
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
      if (!projectId) return { ok: false, reason: 'no_token' };
      const result = await Notifications.getExpoPushTokenAsync({ projectId });
      if (!result.data) return { ok: false, reason: 'no_token' };
      await saveToken(uid, result.data, Platform.OS + '-expo', clanId);
      return { ok: true, mode: 'expo' };
    } catch (e2) {
      console.warn('registerPushToken expo fallback:', e2);
      return { ok: false, reason: 'no_token' };
    }
  }
}

export function hasVapidKey(): boolean {
  return Boolean(getFirebaseExtra()?.firebaseVapidKey?.trim());
}

export function isPushConfigured(): boolean {
  return isFirebaseConfigured();
}
