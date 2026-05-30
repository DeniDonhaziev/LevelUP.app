import {
  collection,
  doc,
  getDocs,
  increment,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import type { RunnerStat } from '@/lib/types';
import { getDb } from './app';

const RUNNER_STATS = 'runnerStats';

export async function saveRunnerStat(
  uid: string,
  username: string,
  deltaMeters: number
): Promise<void> {
  const meters = Math.max(0, Math.round(deltaMeters));
  if (meters <= 0) return;
  const ref = doc(getDb(), RUNNER_STATS, uid);
  try {
    await updateDoc(ref, {
      username,
      totalRunMeters: increment(meters),
      totalRuns: increment(1),
      updatedAt: Date.now(),
    });
  } catch {
    await setDoc(ref, {
      uid,
      username,
      totalRunMeters: meters,
      totalRuns: 1,
      updatedAt: Date.now(),
    });
  }
}

export async function loadRunnerLeaderboard(max = 50): Promise<RunnerStat[]> {
  const col = collection(getDb(), RUNNER_STATS);
  const snap = await getDocs(col);
  const list: RunnerStat[] = [];
  snap.forEach((d) => {
    const data = d.data() as Omit<RunnerStat, 'uid'>;
    list.push({ uid: d.id, ...data });
  });
  list.sort((a, b) => (b.totalRunMeters || 0) - (a.totalRunMeters || 0));
  return list.slice(0, max);
}

export function subscribeRunnerLeaderboard(
  onUpdate: (list: RunnerStat[]) => void,
  max = 50
): () => void {
  const col = collection(getDb(), RUNNER_STATS);
  return onSnapshot(
    col,
    (snap) => {
      const list: RunnerStat[] = [];
      snap.forEach((d) => {
        const data = d.data() as Omit<RunnerStat, 'uid'>;
        list.push({ uid: d.id, ...data });
      });
      list.sort((a, b) => (b.totalRunMeters || 0) - (a.totalRunMeters || 0));
      onUpdate(list.slice(0, max));
    },
    (err) => console.warn('subscribeRunnerLeaderboard:', err)
  );
}
