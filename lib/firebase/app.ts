import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

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
  const fbApp = getFirebaseApp();

  if (Platform.OS === 'web') {
    // Web/PWA: явно храним сессию (IndexedDB → localStorage), чтобы вход был один раз
    try {
      authInstance = initializeAuth(fbApp, {
        persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      });
    } catch {
      authInstance = getAuth(fbApp);
    }
    return authInstance;
  }

  // Native (Expo): сессия в AsyncStorage, иначе теряется при перезапуске
  try {
    const authMod = require('firebase/auth') as typeof import('firebase/auth') & {
      getReactNativePersistence?: (storage: unknown) => unknown;
    };
    const rnPersistence = authMod.getReactNativePersistence;
    if (rnPersistence) {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      authInstance = initializeAuth(fbApp, {
        persistence: rnPersistence(AsyncStorage) as never,
      });
      return authInstance;
    }
  } catch {
    /* fallback ниже */
  }
  authInstance = getAuth(fbApp);
  return authInstance;
}

let dbInstance: Firestore | null = null;

export function getDb(): Firestore {
  if (dbInstance) return dbInstance;
  const fbApp = getFirebaseApp();
  try {
    // ignoreUndefinedProperties: Firestore молча отбрасывает undefined-поля
    // (например необязательные userData.teamSyncAt / поля анкеты), иначе setDoc падает
    dbInstance = initializeFirestore(fbApp, { ignoreUndefinedProperties: true });
  } catch {
    // Уже инициализирован (hot-reload / повторный вызов) — берём существующий инстанс
    dbInstance = getFirestore(fbApp);
  }
  return dbInstance;
}

let storageInstance: ReturnType<typeof getStorage> | null = null;

export function getFirebaseStorage() {
  if (storageInstance) return storageInstance;
  storageInstance = getStorage(getFirebaseApp());
  return storageInstance;
}
