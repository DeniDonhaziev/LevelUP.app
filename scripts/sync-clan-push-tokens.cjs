/**
 * Синхронизирует push-токены из users/{uid}/pushTokens в clans/{id}/members/{uid}.
 * Нужно один раз после обновления — чтобы чат мог слать push участникам клана.
 *
 *   node scripts/sync-clan-push-tokens.cjs
 */
const https = require('https');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'levelup-ff95c';

function log(msg) {
  console.log(`>> ${msg}`);
}

async function getFirebaseAccessToken() {
  const auth = require('firebase-tools/lib/auth');
  const apiv2 = require('firebase-tools/lib/apiv2');
  const projectDir = path.join(__dirname, '..');
  const account = auth.getProjectDefaultAccount(projectDir) || auth.getGlobalDefaultAccount();
  if (!account?.tokens?.refresh_token) {
    throw new Error('Нужен firebase login');
  }
  try {
    const token = await auth.getAccessToken(account.tokens.refresh_token, []);
    return token.access_token;
  } catch {
    const token = await apiv2.getAccessToken();
    if (token) return token;
    throw new Error('firebase login --reauth');
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
          let body = raw;
          try {
            body = raw ? JSON.parse(raw) : {};
          } catch {
            /* string */
          }
          resolve({ status: res.statusCode || 0, body, raw });
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function fieldString(value) {
  return { stringValue: value };
}

function fieldInt(value) {
  return { integerValue: String(value) };
}

async function main() {
  const token = await getFirebaseAccessToken();
  log('Firebase auth OK');

  const clansRes = await httpsJson(
    'GET',
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/clans`,
    token
  );
  if (clansRes.status !== 200) throw new Error(`clans list: ${clansRes.status}`);

  let updated = 0;
  for (const clanDoc of clansRes.body.documents || []) {
    const clanId = clanDoc.name.split('/').pop();
    const membersRes = await httpsJson(
      'GET',
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/clans/${clanId}/members`,
      token
    );
    if (membersRes.status !== 200) continue;

    for (const memberDoc of membersRes.body.documents || []) {
      const uid = memberDoc.name.split('/').pop();
      const tokRes = await httpsJson(
        'GET',
        `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}/pushTokens`,
        token
      );
      if (tokRes.status !== 200) continue;

      let expoPushToken;
      let fcmPushToken;
      for (const tdoc of tokRes.body.documents || []) {
        const val = tdoc.fields?.token?.stringValue;
        if (!val) continue;
        if (val.startsWith('ExponentPushToken[')) expoPushToken = val;
        else fcmPushToken = val;
      }
      if (!expoPushToken && !fcmPushToken) continue;

      const fields = {
        pushUpdatedAt: fieldInt(Date.now()),
      };
      if (expoPushToken) fields.expoPushToken = fieldString(expoPushToken);
      if (fcmPushToken) fields.fcmPushToken = fieldString(fcmPushToken);

      const patchRes = await httpsJson(
        'PATCH',
        `https://firestore.googleapis.com/v1/${memberDoc.name}?updateMask.fieldPaths=expoPushToken&updateMask.fieldPaths=fcmPushToken&updateMask.fieldPaths=pushUpdatedAt`,
        token,
        { fields }
      );
      if (patchRes.status === 200) {
        updated++;
        log(`✓ ${clanId}/${uid}`);
      }
    }
  }

  log(`Готово. Обновлено участников: ${updated}`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
