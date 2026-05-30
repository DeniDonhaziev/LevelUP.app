import type { RunnerStat, Territory, UserData } from './types';
import { monthKey, todayKey } from './date';

export function emptyUserData(): UserData {
  return {
    tasks: [],
    dailyDone: {},
    monthAchievements: {},
    dailySteps: {},
    lastVisit: todayKey(),
  };
}

export function isDayMarkedAchievement(data: UserData, dateStr: string): boolean {
  const [y, m, d] = dateStr.split('-');
  const key = monthKey(parseInt(y, 10), parseInt(m, 10));
  const days = data.monthAchievements[key] || [];
  return days.indexOf(parseInt(d, 10)) >= 0;
}

export function calculateStreak(data: UserData): number {
  let count = 0;
  const d = new Date();
  for (let i = 0; i < 366; i++) {
    const dateStr =
      d.getFullYear() +
      '-' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getDate()).padStart(2, '0');
    if (!isDayMarkedAchievement(data, dateStr)) break;
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

export function allTasksDoneToday(data: UserData): boolean {
  const tasks = data.tasks || [];
  if (tasks.length === 0) return true;
  const today = todayKey();
  const done = data.dailyDone[today] || [];
  return tasks.every((t) => done.includes(t.id));
}

export function getMomentumPercent(data: UserData): number {
  const tasks = data.tasks || [];
  const totalTasks = tasks.length || 1;
  const today = todayKey();
  const doneToday = (data.dailyDone[today] || []).length;
  const dailyPct = Math.round((doneToday / totalTasks) * 100);

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  let weekAchievements = 0;
  for (let w = 0; w < 7; w++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + w);
    const mk = monthKey(d.getFullYear(), d.getMonth() + 1);
    const daysArr = (data.monthAchievements || {})[mk] || [];
    if (daysArr.indexOf(d.getDate()) >= 0) weekAchievements++;
  }
  const weeklyPct = Math.round((weekAchievements / 7) * 100);

  const monthKeyCur = monthKey(now.getFullYear(), now.getMonth() + 1);
  const achievedDays = (data.monthAchievements || {})[monthKeyCur] || [];
  const daysSoFar = now.getDate();
  let monthlyPct = daysSoFar ? Math.round((achievedDays.length / daysSoFar) * 100) : 0;
  monthlyPct = Math.min(100, monthlyPct);

  return Math.round((dailyPct + weeklyPct + monthlyPct) / 3);
}

export function getDayProgress(data: UserData, dateStr: string): number {
  const tasks = data.tasks || [];
  if (tasks.length === 0) return 0;
  const done = (data.dailyDone[dateStr] || []).length;
  return Math.round((done / tasks.length) * 100);
}

export function getTaskProgressInMonth(data: UserData, taskId: string): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr =
      year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    if ((data.dailyDone[dateStr] || []).indexOf(taskId) >= 0) count++;
  }
  return daysInMonth ? Math.round((count / daysInMonth) * 100) : 0;
}

export type RankingUserAgg = { user: string; roads: number; length: number };

export function aggregateByUser(territories: Territory[]): Record<string, RankingUserAgg> {
  const byUser: Record<string, RankingUserAgg> = {};
  territories.forEach((t) => {
    const u = t.owner || '?';
    if (!byUser[u]) byUser[u] = { user: u, roads: 0, length: 0 };
    byUser[u].roads++;
    byUser[u].length += t.lengthMeters || 0;
  });
  return byUser;
}

export function formatLength(m: number): string {
  return m >= 1000 ? (m / 1000).toFixed(1) + ' км' : Math.round(m) + ' м';
}

export type RunnerRankingRow = {
  key: string;
  username: string;
  totalRunMeters: number;
  totalRuns: number;
  roads: number;
  territoryMeters: number;
};

/** Рейтинг бегунов: дистанция пробежек + дороги с карты. */
export function buildRunnerRanking(
  cloudStats: RunnerStat[],
  userDataMap: Record<string, UserData>,
  territories: Territory[]
): RunnerRankingRow[] {
  const territoryAgg = aggregateByUser(territories);
  const byKey: Record<string, RunnerRankingRow> = {};

  for (const stat of cloudStats) {
    const name = stat.username || stat.uid;
    byKey[stat.uid] = {
      key: stat.uid,
      username: name,
      totalRunMeters: stat.totalRunMeters || 0,
      totalRuns: stat.totalRuns || 0,
      roads: territoryAgg[name]?.roads ?? 0,
      territoryMeters: territoryAgg[name]?.length ?? 0,
    };
  }

  for (const [username, data] of Object.entries(userDataMap)) {
    if (username.startsWith('__')) continue;
    const runM = data.totalRunMeters || 0;
    const runs = data.totalRuns || 0;
    if (runM <= 0 && runs <= 0 && !territoryAgg[username]) continue;
    const existing = Object.values(byKey).find((r) => r.username === username);
    if (existing) {
      if (runM > existing.totalRunMeters) {
        existing.totalRunMeters = runM;
        existing.totalRuns = runs;
      }
      existing.roads = territoryAgg[username]?.roads ?? existing.roads;
      existing.territoryMeters = territoryAgg[username]?.length ?? existing.territoryMeters;
    } else {
      byKey['local:' + username] = {
        key: 'local:' + username,
        username,
        totalRunMeters: runM,
        totalRuns: runs,
        roads: territoryAgg[username]?.roads ?? 0,
        territoryMeters: territoryAgg[username]?.length ?? 0,
      };
    }
  }

  return Object.values(byKey).sort(
    (a, b) =>
      b.totalRunMeters - a.totalRunMeters ||
      b.roads - a.roads ||
      b.territoryMeters - a.territoryMeters
  );
}

export function checkNewDay(userData: UserData): UserData {
  const today = todayKey();
  const data = { ...userData, dailyDone: { ...userData.dailyDone } };
  if (data.lastVisit && data.lastVisit !== today) {
    const lastDate = new Date(data.lastVisit);
    const currentDate = new Date(today);
    const daysDiff = Math.floor((+currentDate - +lastDate) / (1000 * 60 * 60 * 24));
    if (daysDiff > 0) {
      for (let i = 1; i < daysDiff; i++) {
        const missedDate = new Date(lastDate);
        missedDate.setDate(missedDate.getDate() + i);
        const missedKey =
          missedDate.getFullYear() +
          '-' +
          String(missedDate.getMonth() + 1).padStart(2, '0') +
          '-' +
          String(missedDate.getDate()).padStart(2, '0');
        if (!data.dailyDone[missedKey]) data.dailyDone[missedKey] = [];
      }
    }
  }
  data.lastVisit = today;
  return data;
}
