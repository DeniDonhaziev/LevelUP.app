import type { OnboardingProfile, UserData } from '@/lib/types';
import { emptyUserData } from '@/lib/trackerLogic';

/** Сохраняем анкету при слиянии: приоритет заполненной и более свежей версии */
function pickOnboarding(
  a?: OnboardingProfile,
  b?: OnboardingProfile
): OnboardingProfile | undefined {
  if (!a) return b;
  if (!b) return a;
  if (a.completed && !b.completed) return a;
  if (b.completed && !a.completed) return b;
  const at = a.updatedAt ?? a.completedAt ?? 0;
  const bt = b.updatedAt ?? b.completedAt ?? 0;
  return bt > at ? b : a;
}

function mergeStringArrays(a: string[] = [], b: string[] = []): string[] {
  return [...new Set([...a, ...b])];
}

function mergeNumberArrays(a: number[] = [], b: number[] = []): number[] {
  return [...new Set([...a, ...b])].sort((x, y) => x - y);
}

function mergeRecordOfStringArrays(
  a: Record<string, string[]> = {},
  b: Record<string, string[]> = {}
): Record<string, string[]> {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: Record<string, string[]> = {};
  for (const k of keys) {
    out[k] = mergeStringArrays(a[k], b[k]);
  }
  return out;
}

function mergeRecordOfNumberArrays(
  a: Record<string, number[]> = {},
  b: Record<string, number[]> = {}
): Record<string, number[]> {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: Record<string, number[]> = {};
  for (const k of keys) {
    out[k] = mergeNumberArrays(a[k], b[k]);
  }
  return out;
}

function mergeDailySteps(
  a: Record<string, number> = {},
  b: Record<string, number> = {}
): Record<string, number> {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: Record<string, number> = {};
  for (const k of keys) {
    out[k] = Math.max(a[k] ?? 0, b[k] ?? 0);
  }
  return out;
}

function mergeById<T extends { id: string }>(a: T[] = [], b: T[] = [], pick: (left: T, right: T) => T): T[] {
  const map = new Map<string, T>();
  for (const item of a) map.set(item.id, item);
  for (const item of b) {
    const prev = map.get(item.id);
    map.set(item.id, prev ? pick(prev, item) : item);
  }
  return [...map.values()];
}

/** Объединяет локальные и облачные данные — ничего не теряем после обновления PWA. */
export function mergeUserData(local: UserData, cloud: UserData): UserData {
  const base = emptyUserData();
  const l = local ?? base;
  const c = cloud ?? base;

  const tasks = mergeById(l.tasks, c.tasks, (left, right) =>
    (left.name?.length ?? 0) >= (right.name?.length ?? 0) ? left : right
  );

  const projects = mergeById(l.projects ?? [], c.projects ?? [], (left, right) => ({
    ...right,
    ...left,
    progress: Math.max(left.progress ?? 0, right.progress ?? 0),
  }));

  const clanId = l.clanId ?? c.clanId ?? null;

  return {
    tasks,
    projects,
    clanId,
    onboarding: pickOnboarding(l.onboarding, c.onboarding),
    teamSyncAt: Math.max(l.teamSyncAt ?? 0, c.teamSyncAt ?? 0) || undefined,
    accountingEntries: mergeById(l.accountingEntries ?? [], c.accountingEntries ?? [], (a, b) => ({
      ...b,
      ...a,
    })),
    hrEmployees: mergeById(l.hrEmployees ?? [], c.hrEmployees ?? [], (a, b) => ({ ...b, ...a })),
    warehouseItems: mergeById(l.warehouseItems ?? [], c.warehouseItems ?? [], (a, b) => ({ ...b, ...a })),
    dailyDone: mergeRecordOfStringArrays(l.dailyDone, c.dailyDone),
    monthAchievements: mergeRecordOfNumberArrays(l.monthAchievements, c.monthAchievements),
    dailySteps: mergeDailySteps(l.dailySteps, c.dailySteps),
    lastVisit: [l.lastVisit, c.lastVisit].filter(Boolean).sort().pop() || l.lastVisit || c.lastVisit,
    totalRunMeters: Math.max(l.totalRunMeters ?? 0, c.totalRunMeters ?? 0) || undefined,
    totalRuns: Math.max(l.totalRuns ?? 0, c.totalRuns ?? 0) || undefined,
  };
}

export function collectLocalUserDataSnapshots(
  userData: Record<string, UserData>,
  keys: Iterable<string>
): UserData {
  let merged = emptyUserData();
  for (const key of keys) {
    const raw = userData[key];
    if (!raw) continue;
    merged = mergeUserData(merged, raw);
  }
  return merged;
}
