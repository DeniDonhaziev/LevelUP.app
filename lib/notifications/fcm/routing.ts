import { router } from 'expo-router';

import type { NotificationPayload, NotificationScreen } from './types';

const SCREEN_PATH: Record<NotificationScreen, string> = {
  home: '/(tabs)',
  activity: '/(tabs)/activity',
  run: '/(tabs)/run',
  clans: '/(tabs)/clans',
  stats: '/(tabs)/stats',
  ai: '/(tabs)/ai',
  profile: '/(tabs)/profile',
};

export function pathForNotification(data: Partial<NotificationPayload>): string {
  if (data.url) return data.url;
  if (data.screen && SCREEN_PATH[data.screen]) return SCREEN_PATH[data.screen];
  switch (data.type) {
    case 'clan_chat':
    case 'club_new_member':
    case 'club_ranking_up':
    case 'club_achievement':
      return '/(tabs)/clans';
    case 'run_reminder':
    case 'run_goal_near':
    case 'run_goal_achieved':
    case 'weekly_stats':
      return '/(tabs)/run';
    case 'ai_recommendation':
      return '/(tabs)/ai';
    case 'goals_incomplete':
    case 'habit_reminder':
    case 'streak_warning':
      return '/(tabs)/activity';
    default:
      return '/(tabs)';
  }
}

export function navigateFromNotification(data: Partial<NotificationPayload>): void {
  try {
    router.push(pathForNotification(data) as never);
  } catch (e) {
    console.warn('navigateFromNotification:', e);
  }
}

export function parseNotificationData(raw: Record<string, unknown> | undefined): NotificationPayload {
  const type = (raw?.type as NotificationPayload['type']) || 'broadcast';
  return {
    type,
    screen: raw?.screen as NotificationScreen | undefined,
    clanId: typeof raw?.clanId === 'string' ? raw.clanId : undefined,
    url: typeof raw?.url === 'string' ? raw.url : undefined,
  };
}
