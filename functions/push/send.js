const { getMessaging } = require('firebase-admin/messaging');
const { getFirestore } = require('firebase-admin/firestore');

const { PRODUCTION_URL } = require('./config');
const { collectUserPushTokens } = require('./tokens');
const { shouldSendNotification } = require('./prefs');

async function sendExpoPush(tokens, notification) {
  if (!tokens.length) return { sent: 0 };
  const messages = tokens.map((to) => ({
    to,
    title: notification.title,
    body: notification.body,
    sound: 'default',
    priority: 'high',
    channelId: notification.channelId || 'levelup-default',
    data: notification.data,
  }));

  let sent = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(chunk),
    });
    if (res.ok) sent += chunk.length;
    else console.warn('Expo push:', res.status, await res.text());
  }
  return { sent };
}

async function sendFcmMulticast(fcmTokens, notification) {
  if (!fcmTokens.length) return { ok: 0, fail: 0, invalidTokens: [] };

  const invalidTokens = [];
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < fcmTokens.length; i += 500) {
    const chunk = fcmTokens.slice(i, i + 500);
    const res = await getMessaging().sendEachForMulticast({
      tokens: chunk,
      notification: { title: notification.title, body: notification.body },
      data: Object.fromEntries(
        Object.entries(notification.data || {}).map(([k, v]) => [k, String(v)])
      ),
      webpush: {
        notification: {
          title: notification.title,
          body: notification.body,
          icon: `${PRODUCTION_URL}icon-192.png`,
          badge: `${PRODUCTION_URL}icon-192.png`,
          tag: notification.type || 'levelup',
        },
        fcmOptions: { link: notification.url || PRODUCTION_URL },
      },
      android: {
        priority: 'high',
        notification: {
          channelId: notification.channelId || 'levelup-default',
          sound: 'default',
        },
      },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    });

    ok += res.successCount;
    fail += res.failureCount;
    res.responses.forEach((r, idx) => {
      if (
        !r.success &&
        r.error?.code === 'messaging/registration-token-not-registered'
      ) {
        invalidTokens.push(chunk[idx]);
      }
    });
  }

  return { ok, fail, invalidTokens };
}

async function pruneInvalidTokens(uid, invalidTokens) {
  if (!uid || !invalidTokens.length) return;
  const db = getFirestore();
  const col = db.collection('users').doc(uid).collection('pushTokens');
  const snap = await col.get();
  const batch = db.batch();
  snap.forEach((docSnap) => {
    if (invalidTokens.includes(docSnap.data().token)) {
      batch.delete(docSnap.ref);
    }
  });
  await batch.commit();
}

async function sendNotificationToTokens({ fcmTokens, expoTokens }, notification, uidForPrune) {
  const fcmResult = await sendFcmMulticast(fcmTokens, notification);
  const expoResult = await sendExpoPush(expoTokens, notification);
  if (uidForPrune && fcmResult.invalidTokens.length) {
    await pruneInvalidTokens(uidForPrune, fcmResult.invalidTokens);
  }
  return {
    fcmOk: fcmResult.ok,
    fcmFail: fcmResult.fail,
    expoSent: expoResult.sent,
  };
}

async function sendNotificationToUser(uid, notification, userDoc, localHour) {
  if (userDoc && !shouldSendNotification(userDoc, notification.type, localHour)) {
    return { skipped: true };
  }
  const tokens = await collectUserPushTokens(uid);
  if (!tokens.fcmTokens.length && !tokens.expoTokens.length) {
    return { skipped: true, reason: 'no_tokens' };
  }
  const result = await sendNotificationToTokens(tokens, notification, uid);
  return { skipped: false, ...result };
}

async function broadcastPushToAll(title, body) {
  const { collectAllPushTokens } = require('./tokens');
  const { buildNotification } = require('./templates');
  const { fcmTokens, expoTokens, users } = await collectAllPushTokens();
  const notification = buildNotification('broadcast', title, body);
  const result = await sendNotificationToTokens({ fcmTokens, expoTokens }, notification);
  return { usersScanned: users, ...result, totalTargets: fcmTokens.length + expoTokens.length };
}

module.exports = {
  sendNotificationToUser,
  sendNotificationToTokens,
  sendExpoPush,
  sendFcmMulticast,
  broadcastPushToAll,
  pruneInvalidTokens,
};
