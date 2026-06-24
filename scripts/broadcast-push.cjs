/**
 * Массовая push-рассылка всем пользователям (через Cloud Function broadcastPush).
 *
 *   node scripts/broadcast-push.cjs
 *   node scripts/broadcast-push.cjs "Заголовок" "Текст сообщения"
 */
const https = require('https');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'levelup-ff95c';
const REGION = process.env.FIREBASE_FUNCTIONS_REGION || 'us-central1';
const KEY =
  process.env.BROADCAST_KEY ||
  process.env.FUNCTIONS_BROADCAST_KEY ||
  'levelup-broadcast-2026';

const title = process.argv[2] || 'LevelUp';
const body = process.argv[3] || 'Проснись, пора работать';

const host = `${REGION}-${PROJECT_ID}.cloudfunctions.net`;
const fnName = 'broadcastPush';

function postJson(urlPath, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = https.request(
      {
        hostname: host,
        path: urlPath,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'x-broadcast-key': KEY,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => {
          raw += c;
        });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(raw || '{}') });
          } catch {
            resolve({ status: res.statusCode, body: raw });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log(`>> Рассылка: «${title}» — ${body}`);
  console.log(`>> ${host}/${fnName}`);

  const result = await postJson(`/${fnName}`, { title, body });
  console.log('>> HTTP', result.status);
  console.log(JSON.stringify(result.body, null, 2));

  if (result.status !== 200 || !result.body?.ok) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
