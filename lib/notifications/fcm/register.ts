import { Platform } from 'react-native';

import { isFirebaseConfigured } from '@/lib/firebase/config';
import {
  ensureNotificationPermission,
  requestNotificationPermissionFromUser,
} from '@/lib/notifications/clanChat';
import { registerPushToken, type PushRegisterResult } from '@/lib/notifications/pushTokens';

import { ensureAndroidNotificationChannels } from './channels';
import { saveNotificationPrefs } from './preferences';
import { DEFAULT_NOTIFICATION_PREFS } from './types';

export type FcmRegisterResult = PushRegisterResult & { permission: 'granted' | 'denied' | 'skipped' };

/**
 * Запрос разрешения + регистрация FCM/Expo токена в Firestore.
 * Вызывать по user gesture (кнопка) или если разрешение уже granted.
 */
export async function registerFcmForUser(
  uid: string,
  clanId?: string | null,
  options?: { requestPermission?: boolean }
): Promise<FcmRegisterResult> {
  if (!isFirebaseConfigured() || !uid) {
    return { ok: false, reason: 'unsupported', permission: 'skipped' };
  }

  await ensureAndroidNotificationChannels();

  let granted = await ensureNotificationPermission();
  if (!granted && options?.requestPermission) {
    granted = await requestNotificationPermissionFromUser();
  }
  if (!granted) {
    return { ok: false, reason: 'permission', permission: 'denied' };
  }

  const result = await registerPushToken(uid, clanId);
  if (result.ok) {
    await saveNotificationPrefs(uid, DEFAULT_NOTIFICATION_PREFS);
  }

  return { ...result, permission: 'granted' };
}

/** Тихая перерегистрация при входе (без запроса разрешения). */
export async function refreshFcmTokenIfPermitted(
  uid: string,
  clanId?: string | null
): Promise<FcmRegisterResult> {
  return registerFcmForUser(uid, clanId, { requestPermission: false });
}

export { ensureNotificationPermission, requestNotificationPermissionFromUser };
