/**
 * Дублирует app.json и добавляет extra для Firebase (EXPO_PUBLIC_* из .env).
 * Скопируйте .env.example в .env и вставьте ключи из Firebase Console.
 */
const path = require('path');
// Дублирует загрузку Expo; quiet — без лога "injecting env (0)", если переменные уже в process.env
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

const appJson = require('./app.json');

/** Публичный VAPID из Firebase (Web Push) — вшит в сборку, чтобы push работал на expo.app */
const DEFAULT_VAPID =
  'BGI0Onj5Jm8R6PG7EOUn9fJLwCab0oBVEnbQxfQrDKbg976Te5bGkxla0qK7TuMl1-fizQlT7qN2NeUzMfotDrI';
const vapidKey = (process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY || DEFAULT_VAPID).trim();
const androidWidgetPlugin = [
  'react-native-android-widget',
  {
    widgets: [
      {
        name: 'TrackerSummary',
        label: 'Tracker — прогресс',
        description: 'Шаги и серия дней',
        minWidth: '180dp',
        minHeight: '110dp',
        targetCellWidth: 3,
        targetCellHeight: 2,
        updatePeriodMillis: 1800000,
        previewImage: './assets/images/app-icon.png',
      },
    ],
  },
];

const plugins = [...(appJson.expo.plugins || [])];
if (!plugins.some((p) => (Array.isArray(p) ? p[0] : p) === 'react-native-android-widget')) {
  plugins.push(androidWidgetPlugin);
}

module.exports = {
  expo: {
    ...appJson.expo,
    notification: {
      icon: './assets/images/app-icon.png',
      color: '#ffffff',
      ...(vapidKey ? { vapidPublicKey: vapidKey } : {}),
    },
    updates: {
      url: 'https://u.expo.dev/79d9a52a-8d0e-4284-b8a8-a608e52ef0a7',
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    extra: {
      ...(appJson.expo.extra || {}),
      eas: {
        ...(appJson.expo.extra?.eas || {}),
        projectId:
          appJson.expo.extra?.eas?.projectId ?? '79d9a52a-8d0e-4284-b8a8-a608e52ef0a7',
      },
      firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
      firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
      firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
      firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
      firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
      firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
      firebaseVapidKey: vapidKey,
      /** Вкладка AI — openrouter.ai/keys */
      openrouterApiKey: process.env.EXPO_PUBLIC_OPENROUTER_API_KEY ?? '',
      openrouterModelMain: process.env.EXPO_PUBLIC_OPENROUTER_MODEL_MAIN ?? '',
      openrouterModelVision: process.env.EXPO_PUBLIC_OPENROUTER_MODEL_VISION ?? '',
    },
    plugins,
  },
};
