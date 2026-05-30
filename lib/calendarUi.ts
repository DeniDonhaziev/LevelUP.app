import type { UserData } from './types';
import { monthKey, todayKey } from './date';
import { isDayMarkedAchievement } from './trackerLogic';

export type CalendarCell = {
  day: number;
  dateStr: string;
  otherMonth: boolean;
  isToday: boolean;
  achievement: boolean;
  missed: boolean;
};

export function buildCalendarCells(
  viewYear: number,
  viewMonth: number,
  data: UserData | null,
  todayStr: string
): CalendarCell[] {
  const first = new Date(viewYear, viewMonth, 1);
  let start = first.getDay() - 1;
  if (start < 0) start += 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
  const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
  const prevDays = new Date(prevYear, prevMonth + 1, 0).getDate();
  const cells: CalendarCell[] = [];

  for (let i = 0; i < start; i++) {
    const d = prevDays - start + i + 1;
    const dateStr =
      prevYear +
      '-' +
      String(prevMonth + 1).padStart(2, '0') +
      '-' +
      String(d).padStart(2, '0');
    cells.push({
      day: d,
      dateStr,
      otherMonth: true,
      isToday: false,
      achievement: data ? isDayMarkedAchievement(data, dateStr) : false,
      missed: false,
    });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr =
      viewYear +
      '-' +
      String(viewMonth + 1).padStart(2, '0') +
      '-' +
      String(d).padStart(2, '0');
    let missed = false;
    if (data) {
      const cellDate = new Date(dateStr);
      const nowDate = new Date(todayStr);
      const dayDone = data.dailyDone[dateStr];
      if (
        cellDate < nowDate &&
        dayDone &&
        dayDone.length === 0 &&
        !isDayMarkedAchievement(data, dateStr)
      ) {
        missed = true;
      }
    }
    cells.push({
      day: d,
      dateStr,
      otherMonth: false,
      isToday: dateStr === todayStr,
      achievement: data ? isDayMarkedAchievement(data, dateStr) : false,
      missed,
    });
  }

  const total = start + daysInMonth;
  const nextCells = total % 7 === 0 ? 0 : 7 - (total % 7);
  const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
  const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
  for (let i = 0; i < nextCells; i++) {
    const d = i + 1;
    const dateStr =
      nextY +
      '-' +
      String(nextM + 1).padStart(2, '0') +
      '-' +
      String(d).padStart(2, '0');
    cells.push({
      day: d,
      dateStr,
      otherMonth: true,
      isToday: false,
      achievement: data ? isDayMarkedAchievement(data, dateStr) : false,
      missed: false,
    });
  }

  return cells;
}

export function monthAchievementStats(data: UserData | null, viewYear: number, viewMonth: number) {
  if (!data) return { achieved: 0, daysInMonth: 30 };
  const key = monthKey(viewYear, viewMonth + 1);
  const achieved = (data.monthAchievements[key] || []).length;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  return { achieved, daysInMonth };
}
