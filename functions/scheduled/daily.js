const { getFirestore } = require('firebase-admin/firestore');
const { sendNotificationToUser } = require('../push/send');
const { TEMPLATES } = require('../push/templates');
const {
  todayKey,
  weekKey,
  calculateStreak,
  incompleteTasksToday,
  lowestProgressHabit,
  weeklyRunProgress,
} = require('../push/metrics');

async function runDailyNotifications() {
  const db = getFirestore();
  const usersSnap = await db.collection('users').get();
  const today = todayKey();
  const week = weekKey();
  const hour = new Date().getHours();
  let sent = 0;

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const data = userDoc.data();
    const userData = data.userData || {};
    const state = data.notificationState || {};
    const patch = {};

    const incomplete = incompleteTasksToday(userData);

    // ── Утро (8–10): приветствие + цели на день ──
    if (
      hour >= 8 &&
      hour < 11 &&
      incomplete.total > 0 &&
      state.lastMorningGreeting !== today
    ) {
      const r = await sendNotificationToUser(
        uid,
        TEMPLATES.morning_greeting(incomplete.total),
        data,
        hour
      );
      if (!r.skipped) {
        patch.lastMorningGreeting = today;
        sent++;
      }
    }

    // ── День (13–16): прогресс «X из Y целей» ──
    if (
      hour >= 13 &&
      hour < 17 &&
      incomplete.done > 0 &&
      incomplete.incomplete.length > 0 &&
      state.lastGoalsProgress !== today
    ) {
      const r = await sendNotificationToUser(
        uid,
        TEMPLATES.goals_progress(incomplete.done, incomplete.total),
        data,
        hour
      );
      if (!r.skipped) {
        patch.lastGoalsProgress = today;
        sent++;
      }
    }

    // ── Вечер (18+): сколько целей осталось ──
    if (
      hour >= 18 &&
      incomplete.incomplete.length > 0 &&
      state.lastDailyGoals !== today
    ) {
      const r = await sendNotificationToUser(
        uid,
        TEMPLATES.goals_incomplete(incomplete.incomplete.length),
        data,
        hour
      );
      if (!r.skipped) {
        patch.lastDailyGoals = today;
        sent++;
      }
    }

    const habit = lowestProgressHabit(userData);
    if (habit && hour >= 12 && state.lastHabitReminder !== today) {
      const r = await sendNotificationToUser(
        uid,
        TEMPLATES.habit_reminder(habit.name),
        data,
        hour
      );
      if (!r.skipped) {
        patch.lastHabitReminder = today;
        sent++;
      }
    }

    const streak = calculateStreak(userData);

    // ── Юбилеи серии (7, 14, 30, 50, 100…) — отправляем один раз на каждый рубеж ──
    const STREAK_MILESTONES = [7, 14, 30, 50, 100, 150, 200, 365];
    let milestoneSent = false;
    if (hour >= 19 && STREAK_MILESTONES.includes(streak) && state.lastStreakMilestone !== String(streak)) {
      const r = await sendNotificationToUser(uid, TEMPLATES.streak_milestone(streak), data, hour);
      if (!r.skipped) {
        patch.lastStreakMilestone = String(streak);
        milestoneSent = true;
        sent++;
      }
    }

    if (!milestoneSent && streak >= 3 && hour >= 20 && state.lastStreakWarning !== today) {
      const todayDone = incomplete.total === 0 || incomplete.incomplete.length === 0;
      if (!todayDone) {
        const r = await sendNotificationToUser(
          uid,
          TEMPLATES.streak_warning(streak),
          data,
          hour
        );
        if (!r.skipped) {
          patch.lastStreakWarning = today;
          sent++;
        }
      }
    }

    if (hour >= 17 && state.lastRunReminder !== today && (userData.totalRuns || 0) > 0) {
      const r = await sendNotificationToUser(uid, TEMPLATES.run_reminder(), data, hour);
      if (!r.skipped) {
        patch.lastRunReminder = today;
        sent++;
      }
    }

    const runProgress = weeklyRunProgress(userData);
    if (runProgress.left > 0 && runProgress.left <= 3000 && hour >= 10) {
      const kmLeft =
        runProgress.left >= 1000
          ? `${(runProgress.left / 1000).toFixed(1)} км`
          : `${runProgress.left} м`;
      await sendNotificationToUser(uid, TEMPLATES.run_goal_near(kmLeft), data, hour);
    }

    if (hour === 9 && state.lastWeeklyStats !== week && (userData.totalRuns || 0) > 0) {
      const km = ((userData.totalRunMeters || 0) / 1000).toFixed(1);
      const r = await sendNotificationToUser(
        uid,
        TEMPLATES.weekly_stats(km, userData.totalRuns || 0),
        data,
        hour
      );
      if (!r.skipped) {
        patch.lastWeeklyStats = week;
        sent++;
      }
    }

    if (hour === 10 && state.lastAiTip !== today) {
      const r = await sendNotificationToUser(
        uid,
        TEMPLATES.ai_recommendation(),
        data,
        hour
      );
      if (!r.skipped) {
        patch.lastAiTip = today;
        sent++;
      }
    }

    if (Object.keys(patch).length) {
      await db.collection('users').doc(uid).set(
        { notificationState: { ...state, ...patch } },
        { merge: true }
      );
    }
  }

  console.log('dailyNotifications sent:', sent);
  return { sent };
}

module.exports = { runDailyNotifications };
