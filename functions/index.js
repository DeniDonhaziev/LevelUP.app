const functions = require('firebase-functions/v1');
const { initializeApp } = require('firebase-admin/app');
const { DEFAULT_TIMEZONE } = require('./push/config');
const { broadcastPushToAll } = require('./push/send');
const { onClanMessageCreatedHandler } = require('./triggers/clanMessage');
const { onClanMemberCreatedHandler } = require('./triggers/clanMember');
const { onRunnerStatWrittenHandler } = require('./triggers/runnerStat');
const { runDailyNotifications } = require('./scheduled/daily');
const {
  runRetentionNotifications,
  runClanRankingNotifications,
} = require('./scheduled/retention');

initializeApp();

/** Чат клана → FCM + Expo (WhatsApp-режим, сервер шлёт push). */
exports.onClanMessageCreated = functions.firestore
  .document('clans/{clanId}/messages/{messageId}')
  .onCreate(onClanMessageCreatedHandler);

/** Новый участник клуба. */
exports.onClanMemberCreated = functions.firestore
  .document('clans/{clanId}/members/{memberId}')
  .onCreate(onClanMemberCreatedHandler);

/** Спортивные цели и достижения клуба. */
exports.onRunnerStatUpdated = functions.firestore
  .document('runnerStats/{uid}')
  .onWrite(onRunnerStatWrittenHandler);

/** Ежедневные: цели, привычки, серия, пробежки, AI, статистика. */
exports.dailyNotifications = functions.pubsub
  .schedule('0 * * * *')
  .timeZone(DEFAULT_TIMEZONE)
  .onRun(async () => {
    await runDailyNotifications();
  });

/** Удержание: 2 дня, неделя без активности, невыполненные цели. */
exports.retentionNotifications = functions.pubsub
  .schedule('0 11 * * *')
  .timeZone(DEFAULT_TIMEZONE)
  .onRun(async () => {
    await runRetentionNotifications();
  });

/** Рейтинг клубов (ТОП-10). */
exports.clanRankingNotifications = functions.pubsub
  .schedule('0 12 * * 1')
  .timeZone(DEFAULT_TIMEZONE)
  .onRun(async () => {
    await runClanRankingNotifications();
  });

/** Массовая рассылка (admin). */
exports.broadcastPush = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST, GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type, x-broadcast-key');
    res.status(204).send('');
    return;
  }

  const key = req.headers['x-broadcast-key'] || req.query.key;
  const expected =
    process.env.BROADCAST_KEY ||
    process.env.FUNCTIONS_BROADCAST_KEY ||
    'levelup-broadcast-2026';
  if (key !== expected) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }

  const title = (req.body?.title || req.query.title || 'LevelUp').slice(0, 120);
  const body = (req.body?.body || req.query.body || '').slice(0, 240);

  try {
    const result = await broadcastPushToAll(title, body);
    res.json({ ok: true, title, body, ...result });
  } catch (e) {
    console.error('broadcastPush:', e);
    res.status(500).json({ error: e.message || String(e) });
  }
});
