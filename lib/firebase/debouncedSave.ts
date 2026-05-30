import type { UserData } from '@/lib/types';
import type { TopicId } from '@/lib/topics';

import { getFirebaseAuth } from './app';
import { saveUserDocument } from './firestoreSync';

let timer: ReturnType<typeof setTimeout> | null = null;
let pending: {
  uid: string;
  displayUsername: string;
  data: UserData;
  profilePhotoURL?: string | null;
  topicId?: TopicId | null;
} | null = null;

function buildSaveArgs(
  uid: string,
  displayUsername: string,
  data: UserData,
  profilePhotoURL?: string | null,
  topicId?: TopicId | null
) {
  const email = getFirebaseAuth().currentUser?.email ?? '';
  const photoArg =
    typeof profilePhotoURL === 'string' && profilePhotoURL.length > 0 ? profilePhotoURL : undefined;
  return { uid, email, displayUsername, data, photoArg, topicId };
}

async function doSave(
  uid: string,
  displayUsername: string,
  data: UserData,
  profilePhotoURL?: string | null,
  topicId?: TopicId | null
): Promise<void> {
  const { email, photoArg } = buildSaveArgs(uid, displayUsername, data, profilePhotoURL, topicId);
  await saveUserDocument(uid, email, displayUsername, data, photoArg, topicId);
}

/** profilePhotoURL передаётся из store, чтобы не тянуть цикл trackerStore ↔ debouncedSave */
export function scheduleSaveUser(
  uid: string,
  displayUsername: string,
  data: UserData,
  profilePhotoURL?: string | null,
  topicId?: TopicId | null
): void {
  pending = { uid, displayUsername, data, profilePhotoURL, topicId };
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    const job = pending;
    pending = null;
    if (!job) return;
    void doSave(job.uid, job.displayUsername, job.data, job.profilePhotoURL, job.topicId).catch(
      (e) => console.warn('Firebase save user:', e)
    );
  }, 600);
}

/** Сразу записать профиль в Firestore (после пробежки и т.п.). */
export function flushSaveUser(
  uid: string,
  displayUsername: string,
  data: UserData,
  profilePhotoURL?: string | null,
  topicId?: TopicId | null
): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  pending = null;
  return doSave(uid, displayUsername, data, profilePhotoURL, topicId);
}
