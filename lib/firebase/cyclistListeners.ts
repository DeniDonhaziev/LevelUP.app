import { useTrackerStore } from '@/store/trackerStore';

import { isFirebaseConfigured } from './config';
import { subscribeCyclistLeaderboard } from './cyclistSync';

let detachCyclist: (() => void) | null = null;

export function startCyclistLeaderboardListener(): void {
  stopCyclistLeaderboardListener();
  if (!isFirebaseConfigured()) return;
  detachCyclist = subscribeCyclistLeaderboard((list) => {
    useTrackerStore.getState().setCyclistLeaderboard(list);
  });
}

export function stopCyclistLeaderboardListener(): void {
  if (detachCyclist) {
    detachCyclist();
    detachCyclist = null;
  }
}
