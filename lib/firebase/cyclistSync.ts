import { collection, deleteDoc, doc, getDocs, increment, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';

import type { CyclistStat } from '@/lib/types';
import { getDb } from './app';

const CYCLIST_STATS = 'cyclistStats';

/** Удалить участника из рейтинга велосипедистов (только админ). */
export async function deleteCyclistStat(uid: string): Promise<void> {
  await deleteDoc(doc(getDb(), CYCLIST_STATS, uid));
}

export async function saveCyclistStat(uid: string, username: string, deltaMeters: number): Promise<void> {
  const meters = Math.max(0, Math.round(deltaMeters));
  if (meters <= 0) return;
  const ref = doc(getDb(), CYCLIST_STATS, uid);
  try {
    await updateDoc(ref, {
      username,
      totalBikeMeters: increment(meters),
      totalRides: increment(1),
      updatedAt: Date.now(),
    });
  } catch {
    await setDoc(ref, {
      uid,
      username,
      totalBikeMeters: meters,
      totalRides: 1,
      updatedAt: Date.now(),
    });
  }
}

export async function loadCyclistLeaderboard(max = 50): Promise<CyclistStat[]> {
  const col = collection(getDb(), CYCLIST_STATS);
  const snap = await getDocs(col);
  const list: CyclistStat[] = [];
  snap.forEach((d) => {
    const data = d.data() as Omit<CyclistStat, 'uid'>;
    list.push({ uid: d.id, ...data });
  });
  list.sort((a, b) => (b.totalBikeMeters || 0) - (a.totalBikeMeters || 0));
  return list.slice(0, max);
}

export function subscribeCyclistLeaderboard(onUpdate: (list: CyclistStat[]) => void, max = 50): () => void {
  const col = collection(getDb(), CYCLIST_STATS);
  return onSnapshot(
    col,
    (snap) => {
      const list: CyclistStat[] = [];
      snap.forEach((d) => {
        const data = d.data() as Omit<CyclistStat, 'uid'>;
        list.push({ uid: d.id, ...data });
      });
      list.sort((a, b) => (b.totalBikeMeters || 0) - (a.totalBikeMeters || 0));
      onUpdate(list.slice(0, max));
    },
    (err) => console.warn('subscribeCyclistLeaderboard:', err)
  );
}
