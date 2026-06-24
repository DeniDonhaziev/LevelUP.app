/**
 * Локальная рассылка через firebase-admin (если Cloud Function недоступна).
 * Нужен ключ сервисного аккаунта: GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json
 */
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const admin = require('firebase-admin');
const { broadcastPushToAll } = require('../functions/pushBroadcast');

const title = process.argv[2] || 'LevelUp';
const body = process.argv[3] || 'Проснись, пора работать';

async function main() {
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'levelup-ff95c',
    });
  }
  console.log(`>> Локальная рассылка: «${title}» — ${body}`);
  const result = await broadcastPushToAll(title, body);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
