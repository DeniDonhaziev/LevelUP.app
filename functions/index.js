const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

const PRODUCTION_URL = 'https://tracker-mobile.expo.app/';

async function sendExpoPush(tokens, title, body) {
  const messages = tokens.map((to) => ({
    to,
    title,
    body,
    sound: 'default',
    priority: 'high',
    channelId: 'clan-chat',
  }));
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });
  if (!res.ok) {
    const text = await res.text();
    console.warn('Expo push failed:', res.status, text);
  }
}

/** Push when a new clan chat message is created (FCM + Expo push tokens in users/{uid}/pushTokens). */
exports.onClanMessageCreated = onDocumentCreated(
  'clans/{clanId}/messages/{messageId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const msg = snap.data();
    const clanId = event.params.clanId;
    const senderUid = msg.uid;
    const senderName = msg.username || 'Участник';
    const text = (msg.text || '').slice(0, 180);

    const db = getFirestore();
    const membersSnap = await db.collection('clans').doc(clanId).collection('members').get();
    const fcmTokens = [];
    const expoTokens = [];

    for (const memberDoc of membersSnap.docs) {
      const uid = memberDoc.id;
      if (uid === senderUid) continue;
      const tokSnap = await db.collection('users').doc(uid).collection('pushTokens').get();
      tokSnap.forEach((t) => {
        const token = t.data().token;
        if (!token) return;
        if (token.startsWith('ExponentPushToken[')) expoTokens.push(token);
        else fcmTokens.push(token);
      });
    }

    const title = `Клан · ${senderName}`;
    const body = text || 'Новое сообщение';

    if (!fcmTokens.length && !expoTokens.length) {
      console.warn('onClanMessageCreated: нет push-токенов у участников клана', clanId);
      return;
    }

    if (fcmTokens.length) {
      const res = await getMessaging().sendEachForMulticast({
        tokens: fcmTokens,
        notification: { title, body },
        data: {
          type: 'clan-chat',
          clanId,
          senderUid: senderUid || '',
        },
        webpush: {
          notification: {
            title,
            body,
            icon: `${PRODUCTION_URL}icon-192.png`,
            badge: `${PRODUCTION_URL}icon-192.png`,
            tag: 'clan-chat',
          },
          fcmOptions: { link: PRODUCTION_URL },
        },
        android: {
          priority: 'high',
          notification: { channelId: 'clan-chat', sound: 'default' },
        },
        apns: {
          payload: { aps: { sound: 'default', badge: 1 } },
        },
      });
      console.log(
        'FCM push:',
        res.successCount,
        'ok,',
        res.failureCount,
        'fail, tokens:',
        fcmTokens.length
      );
    }

    if (expoTokens.length) {
      await sendExpoPush(expoTokens, title, body);
      console.log('Expo push sent to', expoTokens.length, 'devices');
    }
  }
);
