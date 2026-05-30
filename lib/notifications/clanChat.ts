import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type NotificationPermissionState = 'unsupported' | 'default' | 'granted' | 'denied';

export function getNotificationPermissionState(): NotificationPermissionState {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    const p = Notification.permission;
    if (p === 'granted') return 'granted';
    if (p === 'denied') return 'denied';
    return 'default';
  }
  return 'default';
}

/** Только проверка — без запроса (не тратит «один клик» браузера). */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return getNotificationPermissionState() === 'granted';
  }
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

/**
 * Запрос разрешения — вызывать только по нажатию кнопки (user gesture).
 * Иначе Chrome/Safari не покажут диалог повторно.
 */
export async function requestNotificationPermissionFromUser(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    try {
      const result = await Notification.requestPermission();
      return result === 'granted';
    } catch {
      return false;
    }
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function showClanMessageNotification(from: string, text: string): Promise<void> {
  const body = text.length > 120 ? text.slice(0, 117) + '…' : text;
  const title = `Клан · ${from}`;

  if (Platform.OS !== 'web') {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: 'clan-chat' },
        ...(Platform.OS === 'android' ? { channelId: 'clan-chat' } : {}),
      },
      trigger: null,
    });
    return;
  }

  if (typeof window === 'undefined') return;

  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const n = new Notification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'clan-chat',
        renotify: true,
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
      return;
    } catch {
      /* fall through to SW */
    }
  }

  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    if (reg) {
      await reg.showNotification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'clan-chat',
        data: { url: '/' },
      });
    }
  }
}
