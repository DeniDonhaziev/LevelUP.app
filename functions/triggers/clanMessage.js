const { getFirestore } = require('firebase-admin/firestore');
const { collectClanMemberTokens } = require('../push/tokens');
const { sendNotificationToTokens } = require('../push/send');
const { TEMPLATES } = require('../push/templates');

async function onClanMessageCreatedHandler(snap, context) {
  const msg = snap.data();
  const clanId = context.params.clanId;
  const senderUid = msg.uid;
  const senderName = msg.username || 'Участник';
  const text = (msg.text || '').slice(0, 180);

  const notification = TEMPLATES.clan_chat(senderName, text, clanId);
  const tokens = await collectClanMemberTokens(clanId, senderUid);

  if (!tokens.fcmTokens.length && !tokens.expoTokens.length) {
    console.warn('onClanMessageCreated: no tokens for clan', clanId);
    return;
  }

  const result = await sendNotificationToTokens(tokens, notification);
  console.log('onClanMessageCreated:', clanId, result);
}

module.exports = { onClanMessageCreatedHandler };
