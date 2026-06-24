import { deleteField, doc, getDoc, updateDoc, collection, deleteDoc, getDocs } from 'firebase/firestore';

import { getDb } from '@/lib/firebase/app';
import { isFirebaseConfigured } from '@/lib/firebase/config';

/** Удалить push-токены при выходе из аккаунта. */
export async function clearPushTokensOnLogout(uid: string, clanId?: string | null): Promise<void> {
  if (!isFirebaseConfigured() || !uid) return;

  const col = collection(getDb(), 'users', uid, 'pushTokens');
  const snap = await getDocs(col);
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));

  if (clanId) {
    const memberRef = doc(getDb(), 'clans', clanId, 'members', uid);
    const memberSnap = await getDoc(memberRef);
    if (memberSnap.exists()) {
      await updateDoc(memberRef, {
        expoPushToken: deleteField(),
        fcmPushToken: deleteField(),
      });
    }
  }
}
