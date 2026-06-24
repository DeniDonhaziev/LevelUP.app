const { getFirestore } = require('firebase-admin/firestore');
const { collectClanMemberTokens } = require('../push/tokens');
const { sendNotificationToTokens } = require('../push/send');
const { TEMPLATES } = require('../push/templates');
const { shouldSendNotification } = require('../push/prefs');

async function onClanMemberCreatedHandler(snap, context) {
  const member = snap.data();
  const clanId = context.params.clanId;
  const newUid = context.params.memberId;
  const username = member.username || 'Новый участник';

  const db = getFirestore();
  const membersSnap = await db.collection('clans').doc(clanId).collection('members').get();
  const tokens = { fcmTokens: [], expoTokens: [] };
  const seenFcm = new Set();
  const seenExpo = new Set();

  for (const memberDoc of membersSnap.docs) {
    if (memberDoc.id === newUid) continue;
    const uid = memberDoc.id;
    const userSnap = await db.collection('users').doc(uid).get();
    if (!userSnap.exists()) continue;
    if (!shouldSendNotification(userSnap.data(), 'club_new_member')) continue;

    const userTokens = await require('../push/tokens').collectUserPushTokens(uid);
    for (const t of userTokens.fcmTokens) {
      if (!seenFcm.has(t)) {
        seenFcm.add(t);
        tokens.fcmTokens.push(t);
      }
    }
    for (const t of userTokens.expoTokens) {
      if (!seenExpo.has(t)) {
        seenExpo.add(t);
        tokens.expoTokens.push(t);
      }
    }
  }

  if (!tokens.fcmTokens.length && !tokens.expoTokens.length) return;

  const notification = TEMPLATES.club_new_member(username);
  await sendNotificationToTokens(tokens, notification);
  console.log('onClanMemberCreated:', clanId, username);
}

module.exports = { onClanMemberCreatedHandler };
