const TYPE_TO_PREF = {
  morning_greeting: 'goals',
  goals_progress: 'goals',
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

const DEFAULT_PREFS = {
  enabled: true,
  goals: true,
  habits: true,
  streaks: true,
  runs: true,
  ai: true,
  clubs: true,
  retention: true,
};

function mergePrefs(raw) {
  return { ...DEFAULT_PREFS, ...(raw || {}) };
}

function isQuietHours(prefs, hour) {
  const start = prefs.quietHoursStart;
  const end = prefs.quietHoursEnd;
  if (start == null || end == null) return false;
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

function shouldSendNotification(userDoc, type, localHour) {
  const prefs = mergePrefs(userDoc?.notificationPrefs);
  if (!prefs.enabled) return false;
  const prefKey = TYPE_TO_PREF[type];
  if (prefKey && prefs[prefKey] === false) return false;
  if (localHour != null && isQuietHours(prefs, localHour)) return false;
  return true;
}

module.exports = { shouldSendNotification, mergePrefs, DEFAULT_PREFS };
