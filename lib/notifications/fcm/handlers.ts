import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { showClanMessageNotification } from '@/lib/notifications/clanChat';

import { navigateFromNotification, parseNotificationData } from './routing';

let hooked = false;

export function setupFcmNotificationHandlers(): () => void {
  if (hooked || Platform.OS === 'web') return () => undefined;
  hooked = true;

  const receivedSub = Notifications.addNotificationReceivedListener((n) => {
    const data = parseNotificationData(n.request.content.data as Record<string, unknown>);
    if (data.type === 'clan_chat') return;
    // Foreground: expo-notifications already shows banner via setNotificationHandler
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = parseNotificationData(
      response.notification.request.content.data as Record<string, unknown>
    );
    navigateFromNotification(data);
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
    hooked = false;
  };
}

/** Foreground FCM (web) → локальное уведомление */
export function handleWebForegroundMessage(
  title: string,
  body: string,
  data: Record<string, unknown>
): void {
  const parsed = parseNotificationData(data);
  if (parsed.type === 'clan_chat') {
    const from = title.replace(/^Клан\s*·\s*/i, '').trim() || 'Клан';
    void showClanMessageNotification(from, body);
    return;
  }
  void showClanMessageNotification(title, body);
}
