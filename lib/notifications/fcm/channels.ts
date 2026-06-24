import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const FCM_CHANNELS = {
  default: 'levelup-default',
  clan: 'clan-chat',
  goals: 'levelup-goals',
  runs: 'levelup-runs',
  retention: 'levelup-retention',
} as const;

const CHANNEL_DEFS: { id: string; name: string; importance: Notifications.AndroidImportance }[] = [
  { id: FCM_CHANNELS.clan, name: 'Чат клана', importance: Notifications.AndroidImportance.HIGH },
  { id: FCM_CHANNELS.goals, name: 'Цели и привычки', importance: Notifications.AndroidImportance.DEFAULT },
  { id: FCM_CHANNELS.runs, name: 'Пробежки', importance: Notifications.AndroidImportance.DEFAULT },
  { id: FCM_CHANNELS.retention, name: 'Мотивация', importance: Notifications.AndroidImportance.DEFAULT },
  { id: FCM_CHANNELS.default, name: 'LevelUp', importance: Notifications.AndroidImportance.DEFAULT },
];

export async function ensureAndroidNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  for (const ch of CHANNEL_DEFS) {
    await Notifications.setNotificationChannelAsync(ch.id, {
      name: ch.name,
      importance: ch.importance,
      vibrationPattern: [0, 200, 100, 200],
    });
  }
}

export function channelForNotificationType(type: string): string {
  if (type === 'clan_chat') return FCM_CHANNELS.clan;
  if (type.startsWith('run_') || type === 'weekly_stats') return FCM_CHANNELS.runs;
  if (type.startsWith('retention_')) return FCM_CHANNELS.retention;
  if (type === 'goals_incomplete' || type === 'habit_reminder' || type === 'streak_warning') {
    return FCM_CHANNELS.goals;
  }
  return FCM_CHANNELS.default;
}
