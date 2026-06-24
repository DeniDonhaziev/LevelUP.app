const { getFirestore } = require('firebase-admin/firestore');

async function collectUserPushTokens(uid) {
  const db = getFirestore();
  const fcmTokens = [];
  const expoTokens = [];
  const seenFcm = new Set();
  const seenExpo = new Set();

  const tokSnap = await db.collection('users').doc(uid).collection('pushTokens').get();
  tokSnap.forEach((t) => {
    const token = t.data().token;
    if (!token) return;
    if (token.startsWith('ExponentPushToken[')) {
      if (!seenExpo.has(token)) {
        seenExpo.add(token);
        expoTokens.push(token);
      }
    } else if (!seenFcm.has(token)) {
      seenFcm.add(token);
      fcmTokens.push(token);
    }
  });

  return { fcmTokens, expoTokens };
}

async function collectClanMemberTokens(clanId, excludeUid) {
  const db = getFirestore();
  const fcmTokens = [];
  const expoTokens = [];
  const seenFcm = new Set();
  const seenExpo = new Set();

  const membersSnap = await db.collection('clans').doc(clanId).collection('members').get();
  for (const memberDoc of membersSnap.docs) {
    const uid = memberDoc.id;
    if (uid === excludeUid) continue;
    const member = memberDoc.data() || {};

    const memberExpo = member.expoPushToken;
    if (typeof memberExpo === 'string' && memberExpo.startsWith('ExponentPushToken[') && !seenExpo.has(memberExpo)) {
      seenExpo.add(memberExpo);
      expoTokens.push(memberExpo);
    }
    const memberFcm = member.fcmPushToken;
    if (typeof memberFcm === 'string' && memberFcm.length > 20 && !memberFcm.startsWith('ExponentPushToken[') && !seenFcm.has(memberFcm)) {
      seenFcm.add(memberFcm);
      fcmTokens.push(memberFcm);
    }

    const tokSnap = await db.collection('users').doc(uid).collection('pushTokens').get();
    tokSnap.forEach((t) => {
      const token = t.data().token;
      if (!token) return;
      if (token.startsWith('ExponentPushToken[')) {
        if (!seenExpo.has(token)) {
          seenExpo.add(token);
          expoTokens.push(token);
        }
      } else if (!seenFcm.has(token)) {
        seenFcm.add(token);
        fcmTokens.push(token);
      }
    });
  }

  return { fcmTokens, expoTokens };
}

async function collectAllPushTokens() {
  const db = getFirestore();
  const usersSnap = await db.collection('users').get();
  const fcmTokens = [];
  const expoTokens = [];
  const seen = new Set();

  for (const userDoc of usersSnap.docs) {
    const tokSnap = await userDoc.ref.collection('pushTokens').get();
    tokSnap.forEach((t) => {
      const token = t.data().token;
      if (!token || seen.has(token)) return;
      seen.add(token);
      if (token.startsWith('ExponentPushToken[')) expoTokens.push(token);
      else fcmTokens.push(token);
    });
  }

  return { fcmTokens, expoTokens, users: usersSnap.size };
}

module.exports = { collectUserPushTokens, collectClanMemberTokens, collectAllPushTokens };
