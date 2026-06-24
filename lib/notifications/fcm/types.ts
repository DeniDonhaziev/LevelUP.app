/** Типы push-уведомлений LevelUp */
export type NotificationType =
  | 'clan_chat'
  | 'goals_incomplete'
  | 'habit_reminder'
  | 'streak_warning'
  | 'run_reminder'
  | 'run_goal_near'
  | 'run_goal_achieved'
  | 'weekly_stats'
  | 'ai_recommendation'
  | 'club_new_member'
  | 'club_ranking_up'
  | 'club_achievement'
  | 'retention_2_days'
  | 'retention_no_goals'
  | 'retention_1_week'
  | 'broadcast';

export type NotificationScreen =
  | 'home'
  | 'activity'
  | 'run'
  | 'clans'
  | 'stats'
  | 'ai'
  | 'profile';

export type NotificationPayload = {
  type: NotificationType;
  screen?: NotificationScreen;
  clanId?: string;
  url?: string;
};

export type NotificationPrefs = {
  enabled: boolean;
  goals: boolean;
  habits: boolean;
  streaks: boolean;
  runs: boolean;
  ai: boolean;
  clubs: boolean;
  retention: boolean;
  /** Час начала тихого режима (0–23), необязательно */
  quietHoursStart?: number;
  /** Час конца тихого режима (0–23), необязательно */
  quietHoursEnd?: number;
};

export type NotificationState = {
  lastDailyGoals?: string;
  lastHabitReminder?: string;
  lastStreakWarning?: string;
  lastRunReminder?: string;
  lastWeeklyStats?: string;
  lastAiTip?: string;
  lastRetention2d?: number;
  lastRetentionWeek?: number;
  lastRetentionNoGoals?: number;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  enabled: true,
  goals: true,
  habits: true,
  streaks: true,
  runs: true,
  ai: true,
  clubs: true,
  retention: true,
};

export const NOTIFICATION_TYPE_TO_PREF: Partial<Record<NotificationType, keyof NotificationPrefs>> = {
  goals_incomplete: 'goals',
  habit_reminder: 'habits',
  streak_warning: 'streaks',
  run_reminder: 'runs',
  run_goal_near: 'runs',
  run_goal_achieved: 'runs',
  weekly_stats: 'runs',
  ai_recommendation: 'ai',
  club_new_member: 'clubs',
  club_ranking_up: 'clubs',
  club_achievement: 'clubs',
  clan_chat: 'clubs',
  retention_2_days: 'retention',
  retention_no_goals: 'retention',
  retention_1_week: 'retention',
};
