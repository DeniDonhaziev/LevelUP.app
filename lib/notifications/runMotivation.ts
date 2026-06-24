import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { formatLength } from '@/lib/trackerLogic';
import { ensureNotificationPermission } from '@/lib/notifications/clanChat';

const CHANNEL_ID = 'run-motivation';
const SCHEDULE_PREFIX = 'run-motivation-';

export type RunHistoryItem = {
  user: string;
  finishedAt: number;
  distanceMeters: number;
};

export function getBestRunDistance(runs: RunHistoryItem[], username: string): number {
  let best = 0;
  for (const run of runs) {
    if (run.user !== username) continue;
    if (run.distanceMeters > best) best = run.distanceMeters;
  }
  return best;
}

async function ensureMotivationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Мотивация к бегу',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 180, 80, 180],
  });
}

export async function showRunMotivationNotification(title: string, body: string): Promise<void> {
  if (!(await ensureNotificationPermission())) return;
  await ensureMotivationChannel();

  if (Platform.OS !== 'web') {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: 'run-motivation' },
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
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
        tag: 'run-motivation',
        renotify: true,
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
      return;
    } catch {
      /* fall through */
    }
  }

  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    if (reg) {
      await reg.showNotification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'run-motivation',
        data: { url: '/run' },
      });
    }
  }
}

function buildScheduledBody(bestMeters: number, slot: 'morning' | 'evening'): string {
  if (bestMeters <= 0) {
    return slot === 'morning'
      ? 'Сделай первую пробежку и установи свой рекорд!'
      : 'Сегодня ещё можно выйти на пробежку — начни с первого рекорда.';
  }
  const best = formatLength(bestMeters);
  if (slot === 'morning') {
    const variants = [
      `Твой рекорд — ${best}. Сегодня самое время его побить!`,
      `Доброе утро! Побей свой рекорд ${best} на пробежке.`,
      `Рекорд ${best} ждёт. Надень кроссовки и улучши результат!`,
    ];
    return variants[new Date().getDay() % variants.length];
  }
  const variants = [
    `Сегодня ещё не поздно побить рекорд ${best}!`,
    `Вечерняя пробежка — шанс улучшить ${best}.`,
    `Осталось немного времени, чтобы превзойти ${best}.`,
  ];
  return variants[new Date().getDay() % variants.length];
}

async function cancelMotivationSchedule(): Promise<void> {
  if (Platform.OS === 'web') return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier?.startsWith(SCHEDULE_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier!))
  );
}

/** Ежедневные напоминания «побей рекорд» (утро и вечер). */
export async function syncMotivationSchedule(
  username: string,
  runHistory: RunHistoryItem[]
): Promise<void> {
  if (!username || !(await ensureNotificationPermission())) return;
  if (Platform.OS === 'web') return;

  await ensureMotivationChannel();
  await cancelMotivationSchedule();

  const best = getBestRunDistance(runHistory, username);
  const morningBody = buildScheduledBody(best, 'morning');
  const eveningBody = buildScheduledBody(best, 'evening');

  await Notifications.scheduleNotificationAsync({
    identifier: `${SCHEDULE_PREFIX}morning`,
    content: {
      title: '🏃 Побей свой рекорд',
      body: morningBody,
      data: { type: 'run-motivation', screen: 'run' },
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 9,
      minute: 0,
    },
  });

  await Notifications.scheduleNotificationAsync({
    identifier: `${SCHEDULE_PREFIX}evening`,
    content: {
      title: '🔥 Время для пробежки',
      body: eveningBody,
      data: { type: 'run-motivation', screen: 'run' },
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 18,
      minute: 30,
    },
  });
}

/** Уведомление сразу после завершения пробежки. */
export async function notifyRunFinished(
  username: string,
  distanceMeters: number,
  previousBestMeters: number
): Promise<void> {
  if (!username || distanceMeters <= 0) return;

  const dist = formatLength(distanceMeters);

  if (previousBestMeters <= 0 || distanceMeters > previousBestMeters) {
    await showRunMotivationNotification(
      '🏆 Новый рекорд!',
      distanceMeters > previousBestMeters && previousBestMeters > 0
        ? `Поздравляем! ${dist} — новый личный максимум (было ${formatLength(previousBestMeters)}).`
        : `Отличный старт! ${dist} — твой первый рекорд. Побей его в следующий раз!`
    );
    return;
  }

  if (previousBestMeters > 0 && distanceMeters >= previousBestMeters * 0.85) {
    const gap = previousBestMeters - distanceMeters;
    await showRunMotivationNotification(
      '💪 Почти рекорд!',
      `Пробежка ${dist}. До рекорда ${formatLength(previousBestMeters)} осталось ${formatLength(gap)} — в следующий раз точно получится!`
    );
    return;
  }

  if (previousBestMeters > 0) {
    await showRunMotivationNotification(
      '✅ Пробежка записана',
      `Дистанция ${dist}. Твой рекорд — ${formatLength(previousBestMeters)}. Побей его!`
    );
  }
}
