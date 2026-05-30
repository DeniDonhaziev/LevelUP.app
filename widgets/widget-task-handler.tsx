import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { TrackerSummaryWidget } from './TrackerSummaryWidget';

type PersistState = {
  currentUser?: string | null;
  userData?: Record<string, { dailySteps?: Record<string, number>; dailyDone?: Record<string, string[]> }>;
};

function todayKey() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function calcStreakFromDailyDone(dailyDone: Record<string, string[]> | undefined): number {
  if (!dailyDone) return 0;
  let streak = 0;
  const cur = new Date();
  while (true) {
    const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(
      cur.getDate()
    ).padStart(2, '0')}`;
    if ((dailyDone[key] || []).length === 0) break;
    streak += 1;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

async function readWidgetData() {
  const raw = await AsyncStorage.getItem('tracker-storage');
  if (!raw) return { stepsToday: 0, streak: 0, userName: 'спортсмен' };
  try {
    const parsed = JSON.parse(raw) as { state?: PersistState };
    const state = parsed?.state;
    const userName = state?.currentUser || 'спортсмен';
    const data = (state?.userData && state.userData[userName]) || {};
    const stepsToday = data.dailySteps?.[todayKey()] || 0;
    const streak = calcStreakFromDailyDone(data.dailyDone);
    return { stepsToday, streak, userName };
  } catch {
    return { stepsToday: 0, streak: 0, userName: 'спортсмен' };
  }
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const render = async () => {
    const { stepsToday, streak, userName } = await readWidgetData();
    props.renderWidget(
      <TrackerSummaryWidget stepsToday={stepsToday} streak={streak} userName={userName} />
    );
  };

  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      await render();
      break;
    case 'WIDGET_CLICK':
    case 'WIDGET_DELETED':
    default:
      break;
  }
}
