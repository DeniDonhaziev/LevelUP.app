/**
 * Рассылка через Firestore REST + Expo/FCM (без Cloud Functions / Blaze).
 * Требует: firebase login на этом ПК.
 *
 *   node scripts/broadcast-push-cli.cjs
 *   node scripts/broadcast-push-cli.cjs "LevelUp" "Проснись, пора работать"
 */
const https = require('https');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'levelup-ff95c';
const PRODUCTION_URL = 'https://leveluptracker.web.app/';
// --dry / DRY=1 — только посчитать аудиторию, ничего не отправляя
const DRY = process.argv.includes('--dry') || process.env.DRY === '1';
const positional = process.argv.slice(2).filter((a) => a !== '--dry');
const title = positional[0] || 'LevelUp';
const body = positional[1] || 'Проснись, пора работать';

function log(msg) {
  console.log(`>> ${msg}`);
}

async function getFirebaseAccessToken() {
  const auth = require('firebase-tools/lib/auth');
  const apiv2 = require('firebase-tools/lib/apiv2');
  const projectDir = path.join(__dirname, '..');
  const account = auth.getProjectDefaultAccount(projectDir) || auth.getGlobalDefaultAccount();
  if (!account?.tokens?.refresh_token) {
    throw new Error('Нужен firebase login. Выполните: npx firebase login');
  }
  try {
    const token = await auth.getAccessToken(account.tokens.refresh_token, []);
    return token.access_token;
  } catch {
    const token = await apiv2.getAccessToken();
    if (token) return token;
    throw new Error('Firebase auth failed. Выполните: npx firebase login --reauth');
  }
}

function httpsJson(method, url, token, payload) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = payload ? JSON.stringify(payload) : null;
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(data
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
            : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => {
          raw += c;
        });
        res.on('end', () => {
          let parsed = raw;
          try {
            parsed = raw ? JSON.parse(raw) : {};
          } catch {
            /* keep string */
          }
          resolve({ status: res.statusCode || 0, body: parsed, raw });
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function listAllPushTokens(token) {
  const fcmTokens = [];
  const expoTokens = [];
  const seen = new Set();
  let pageToken = '';

  do {
    const url =
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users` +
      (pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : '');
    const res = await httpsJson('GET', url, token);
    if (res.status !== 200) {
      throw new Error(`Firestore users list failed (${res.status}): ${res.raw?.slice(0, 300)}`);
    }
    const docs = res.body.documents || [];
    for (const doc of docs) {
      const uid = doc.name.split('/').pop();
      const tokUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}/pushTokens`;
      const tokRes = await httpsJson('GET', tokUrl, token);
      if (tokRes.status !== 200) continue;
      for (const tdoc of tokRes.body.documents || []) {
        const val = tdoc.fields?.token?.stringValue;
        if (!val || seen.has(val)) continue;
        seen.add(val);
        if (val.startsWith('ExponentPushToken[')) expoTokens.push(val);
        else fcmTokens.push(val);
      }
    }
    pageToken = res.body.nextPageToken || '';
  } while (pageToken);

  return { fcmTokens, expoTokens };
}

async function sendExpoPush(tokens) {
  if (!tokens.length) return 0;
  let sent = 0;
  for (let i = 0; i < tokens.length; i += 100) {
    const chunk = tokens.slice(i, i + 100).map((to) => ({
      to,
      title,
      body,
      sound: 'default',
      priority: 'high',
      channelId: 'clan-chat',
    }));
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(chunk),
    });
    if (res.ok) sent += chunk.length;
    else log(`Expo chunk error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return sent;
}

async function sendFcmPush(accessToken, fcmToken) {
  const payload = {
    message: {
      token: fcmToken,
      notification: { title, body },
      data: { type: 'broadcast', url: PRODUCTION_URL },
      webpush: {
        notification: {
          title,
          body,
          icon: `${PRODUCTION_URL}icon-192.png`,
          badge: `${PRODUCTION_URL}icon-192.png`,
          tag: 'levelup-broadcast',
        },
        fcmOptions: { link: PRODUCTION_URL },
      },
      android: {
        priority: 'HIGH',
        notification: { channelId: 'clan-chat', sound: 'default' },
      },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    },
  };
  const res = await httpsJson(
    'POST',
    `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`,
    accessToken,
    payload
  );
  return res.status === 200;
}

async function main() {
  log(`Рассылка: «${title}» — ${body}`);
  const accessToken = await getFirebaseAccessToken();
  log('Firebase auth OK');

  const { fcmTokens, expoTokens } = await listAllPushTokens(accessToken);
  log(`Токенов: FCM ${fcmTokens.length}, Expo ${expoTokens.length}`);

  if (!fcmTokens.length && !expoTokens.length) {
    log('Нет сохранённых push-токенов. Пользователи должны включить уведомления в приложении.');
    process.exit(0);
  }

  if (DRY) {
    log('DRY-RUN: рассылка НЕ отправлена (только подсчёт аудитории).');
    console.log(
      JSON.stringify(
        { dryRun: true, fcmTokens: fcmTokens.length, expoTokens: expoTokens.length, totalTargets: fcmTokens.length + expoTokens.length },
        null,
        2
      )
    );
    return;
  }

  const expoSent = await sendExpoPush(expoTokens);
  let fcmOk = 0;
  for (const t of fcmTokens) {
    if (await sendFcmPush(accessToken, t)) fcmOk++;
  }

  const result = {
    ok: true,
    title,
    body,
    fcmTokens: fcmTokens.length,
    fcmOk,
    expoTokens: expoTokens.length,
    expoSent,
    totalTargets: fcmTokens.length + expoTokens.length,
  };
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
