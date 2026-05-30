import { useTrackerStore } from '@/store/trackerStore';

import { isFirebaseConfigured } from './config';
import { subscribeRunnerLeaderboard } from './runnerSync';

let detachRunner: (() => void) | null = null;

export function startRunnerLeaderboardListener(): void {
  stopRunnerLeaderboardListener();
  if (!isFirebaseConfigured()) return;
  detachRunner = subscribeRunnerLeaderboard((list) => {
    useTrackerStore.getState().setRunnerLeaderboard(list);
  });
}

export function stopRunnerLeaderboardListener(): void {
  if (detachRunner) {
    detachRunner();
    detachRunner = null;
  }
}
