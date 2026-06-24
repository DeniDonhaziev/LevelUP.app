const { getFirestore } = require('firebase-admin/firestore');
const { sendNotificationToUser } = require('../push/send');
const { TEMPLATES } = require('../push/templates');
const { weeklyRunProgress } = require('../push/metrics');

async function onRunnerStatWrittenHandler(change, context) {
  const uid = context.params.uid;
  const after = change.after.exists ? change.after.data() : null;
  const before = change.before.exists ? change.before.data() : null;
  if (!after) return;

  const prevMeters = before?.totalRunMeters || 0;
  const nextMeters = after.totalRunMeters || 0;
  if (nextMeters <= prevMeters) return;

  const db = getFirestore();
  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists()) return;

  const userData = userSnap.data()?.userData || {};
  const progress = weeklyRunProgress({ ...userData, totalRunMeters: nextMeters });

  if (progress.left > 0 && progress.left <= 2000) {
    const kmLeft =
      progress.left >= 1000
        ? `${(progress.left / 1000).toFixed(1)} км`
        : `${progress.left} м`;
    await sendNotificationToUser(uid, TEMPLATES.run_goal_near(kmLeft), userSnap.data());
    return;
  }

  const goal = progress.goal;
  const crossedGoal =
    Math.floor(prevMeters / goal) < Math.floor(nextMeters / goal) && nextMeters >= goal;
  if (crossedGoal) {
    await sendNotificationToUser(uid, TEMPLATES.run_goal_achieved(), userSnap.data());
  }

  const clanId = userData.clanId;
  if (clanId && nextMeters - prevMeters >= 15000) {
    const membersSnap = await db.collection('clans').doc(clanId).collection('members').get();
    const runKm = ((nextMeters - prevMeters) / 1000).toFixed(1);
    const name = after.username || userSnap.data()?.username || 'Участник';
    const notification = TEMPLATES.club_achievement(
      `Участник ${name} пробежал ${runKm} км 🔥`
    );

    for (const memberDoc of membersSnap.docs) {
      if (memberDoc.id === uid) continue;
      const memberUser = await db.collection('users').doc(memberDoc.id).get();
      if (memberUser.exists()) {
        await sendNotificationToUser(memberDoc.id, notification, memberUser.data());
      }
    }
  }
}

module.exports = { onRunnerStatWrittenHandler };
