import { collection, deleteDoc, doc, getDocs, onSnapshot, setDoc } from 'firebase/firestore';

import type { Story } from '@/lib/types';
import { getDb } from './app';

const STORIES = 'stories';
export const STORY_TTL_MS = 24 * 60 * 60 * 1000;

function activeFromSnap(docs: { id: string; data: () => Record<string, unknown> }[]): Story[] {
  const now = Date.now();
  const list: Story[] = [];
  docs.forEach((d) => {
    const data = d.data() as Omit<Story, 'id'>;
    if ((data.expiresAt ?? 0) > now) list.push({ id: d.id, ...data });
  });
  list.sort((a, b) => b.createdAt - a.createdAt);
  return list;
}

export async function publishStory(story: Story): Promise<void> {
  await setDoc(doc(getDb(), STORIES, story.id), story);
}

export async function loadActiveStories(): Promise<Story[]> {
  const snap = await getDocs(collection(getDb(), STORIES));
  return activeFromSnap(snap.docs);
}

export function subscribeStories(onUpdate: (list: Story[]) => void): () => void {
  return onSnapshot(
    collection(getDb(), STORIES),
    (snap) => onUpdate(activeFromSnap(snap.docs)),
    (err) => console.warn('subscribeStories:', err)
  );
}

export async function deleteStory(storyId: string): Promise<void> {
  await deleteDoc(doc(getDb(), STORIES, storyId));
}
