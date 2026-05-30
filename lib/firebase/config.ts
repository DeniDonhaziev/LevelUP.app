import Constants from 'expo-constants';

export type FirebaseExtra = {
  firebaseApiKey: string;
  firebaseAuthDomain: string;
  firebaseProjectId: string;
  firebaseStorageBucket: string;
  firebaseMessagingSenderId: string;
  firebaseAppId: string;
  /** Web Push VAPID — Firebase Console → Cloud Messaging → Web Push certificates */
  firebaseVapidKey?: string;
};

export function getFirebaseExtra(): FirebaseExtra | null {
  const extra = Constants.expoConfig?.extra as FirebaseExtra | undefined;
  if (!extra?.firebaseApiKey || !extra.firebaseProjectId || !extra.firebaseAppId) {
    return null;
  }
  return extra;
}

export function isFirebaseConfigured(): boolean {
  return getFirebaseExtra() !== null;
}
