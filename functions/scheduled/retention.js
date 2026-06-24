const { getFirestore } = require('firebase-admin/firestore');
const { sendNotificationToUser } = require('../push/send');
const { TEMPLATES } = require('../push/templates');
const { daysSinceLastVisit, incompleteTasksToday } = require('../push/metrics');

async function runRetentionNotifications() {
  const db = getFirestore();
  const usersSnap = await db.collection('users').get();
  const now = Date.now();
  let sent = 0;

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const data = userDoc.data();
    const userData = data.userData || {};
    const state = data.notificationState || {};
    const inactiveDays = daysSinceLastVisit(userData);
    const patch = {};

    if (inactiveDays >= 2 && inactiveDays < 7) {
      const last = state.lastRetention2d || 0;
      if (now - last > 86400000) {
        const r = await sendNotificationToUser(uid, TEMPLATES.retention_2_days(), data);
        if (!r.skipped) {
          patch.lastRetention2d = now;
          sent++;
        }
      }
    }

    if (inactiveDays >= 7) {
      const last = state.lastRetentionWeek || 0;
      if (now - last > 3 * 86400000) {
        const r = await sendNotificationToUser(uid, TEMPLATES.retention_1_week(), data);
        if (!r.skipped) {
          patch.lastRetentionWeek = now;
          sent++;
        }
      }
    }

    const incomplete = incompleteTasksToday(userData);
    if (
      inactiveDays >= 1 &&
      incomplete.incomplete.length > 0 &&
      incomplete.incomplete.length === incomplete.total
    ) {
      const last = state.lastRetentionNoGoals || 0;
      if (now - last > 86400000) {
        const r = await sendNotificationToUser(uid, TEMPLATES.retention_no_goals(), data);
        if (!r.skipped) {
          patch.lastRetentionNoGoals = now;
          sent++;
        }
      }
    }

    if (Object.keys(patch).length) {
      await db.collection('users').doc(uid).set(
        { notificationState: { ...state, ...patch } },
        { merge: true }
      );
    }
  }

  console.log('retentionNotifications sent:', sent);
  return { sent };
}

async function runClanRankingNotifications() {
  const db = getFirestore();
  const allClans = await db.collection('clans').get();
  const ranked = allClans.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.totalDistanceMeters || 0) - (a.totalDistanceMeters || 0));

  for (let i = 0; i < Math.min(ranked.length, 10); i++) {
    const clan = ranked[i];
    const rank = i + 1;
    const prevRank = clan.lastNotifiedRank;
    if (prevRank != null && rank >= prevRank) continue;

    const membersSnap = await db.collection('clans').doc(clan.id).collection('members').get();
    for (const memberDoc of membersSnap.docs) {
      const userSnap = await db.collection('users').doc(memberDoc.id).get();
      if (!userSnap.exists()) continue;
      await sendNotificationToUser(
        memberDoc.id,
        TEMPLATES.club_ranking_up(rank),
        userSnap.data()
      );
    }

    await db.collection('clans').doc(clan.id).set({ lastNotifiedRank: rank }, { merge: true });
  }
}

module.exports = { runRetentionNotifications, runClanRankingNotifications };
