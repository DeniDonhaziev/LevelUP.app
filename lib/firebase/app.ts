import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

import { getFirebaseExtra } from './config';

let app: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (app) return app;
  const extra = getFirebaseExtra();
  if (!extra) {
    throw new Error('Firebase не настроен: задайте EXPO_PUBLIC_FIREBASE_* в .env');
  }
  if (getApps().length > 0) {
    app = getApps()[0]!;
    return app;
  }
  app = initializeApp({
    apiKey: extra.firebaseApiKey,
    authDomain: extra.firebaseAuthDomain,
    projectId: extra.firebaseProjectId,
    storageBucket: extra.firebaseStorageBucket,
    messagingSenderId: extra.firebaseMessagingSenderId,
    appId: extra.firebaseAppId,
  });
  return app;
}

let authInstance: ReturnType<typeof getAuth> | null = null;

export function getFirebaseAuth() {
  if (authInstance) return authInstance;
  authInstance = getAuth(getFirebaseApp());
  return authInstance;
}

export function getDb() {
  return getFirestore(getFirebaseApp());
}

let storageInstance: ReturnType<typeof getStorage> | null = null;

export function getFirebaseStorage() {
  if (storageInstance) return storageInstance;
  storageInstance = getStorage(getFirebaseApp());
  return storageInstance;
}
