const { WEEKLY_RUN_GOAL_METERS } = require('./config');

function todayKey(date = new Date()) {
  return (
    date.getFullYear() +
    '-' +
    String(date.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(date.getDate()).padStart(2, '0')
  );
}

function weekKey(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${weekNo}`;
}

function isDayMarkedAchievement(userData, dateStr) {
  const [y, m, d] = dateStr.split('-');
  const key = `${y}-${String(parseInt(m, 10)).padStart(2, '0')}`;
  const monthKey = `${y}-${m}`;
  const days = (userData.monthAchievements || {})[monthKey] || [];
  return days.includes(parseInt(d, 10));
}

function calculateStreak(userData) {
  let count = 0;
  const d = new Date();
  for (let i = 0; i < 366; i++) {
    const dateStr = todayKey(d);
    if (!isDayMarkedAchievement(userData, dateStr)) break;
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

function incompleteTasksToday(userData) {
  const tasks = userData.tasks || [];
  if (!tasks.length) return { total: 0, done: 0, incomplete: [] };
  const today = todayKey();
  const done = userData.dailyDone?.[today] || [];
  const incomplete = tasks.filter((t) => !done.includes(t.id));
  return { total: tasks.length, done: done.length, incomplete };
}

function daysSinceLastVisit(userData) {
  const last = userData.lastVisit;
  if (!last) return 999;
  const lastDate = new Date(last);
  const now = new Date();
  return Math.floor((now - lastDate) / 86400000);
}

function weeklyRunMeters(userData) {
  const steps = userData.dailySteps || {};
  let total = 0;
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = todayKey(d);
    // approximate from totalRunMeters weekly slice — use totalRunMeters / runs as fallback
    void steps[key];
  }
  return userData.totalRunMeters || 0;
}

function weeklyRunProgress(userData) {
  const total = userData.totalRunMeters || 0;
  const goal = WEEKLY_RUN_GOAL_METERS;
  const left = Math.max(0, goal - (total % goal || 0));
  return { total, goal, left, achieved: total > 0 && left <= 0 };
}

function lowestProgressHabit(userData) {
  const tasks = userData.tasks || [];
  if (!tasks.length) return null;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let worst = null;
  let worstPct = 101;

  for (const task of tasks) {
    let count = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr =
        year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
      if ((userData.dailyDone?.[dateStr] || []).includes(task.id)) count++;
    }
    const pct = daysInMonth ? Math.round((count / daysInMonth) * 100) : 0;
    if (pct < worstPct) {
      worstPct = pct;
      worst = task;
    }
  }
  return worst && worstPct < 50 ? worst : null;
}

module.exports = {
  todayKey,
  weekKey,
  calculateStreak,
  incompleteTasksToday,
  daysSinceLastVisit,
  weeklyRunProgress,
  lowestProgressHabit,
  isDayMarkedAchievement,
};
