const { PRODUCTION_URL } = require('./config');

function channelForType(type) {
  if (type === 'clan_chat') return 'clan-chat';
  if (type && type.startsWith('run_')) return 'levelup-runs';
  if (type && type.startsWith('retention_')) return 'levelup-retention';
  if (type === 'goals_incomplete' || type === 'habit_reminder' || type === 'streak_warning') {
    return 'levelup-goals';
  }
  return 'levelup-default';
}

function screenForType(type) {
  switch (type) {
    case 'clan_chat':
    case 'club_new_member':
    case 'club_ranking_up':
    case 'club_achievement':
      return 'clans';
    case 'run_reminder':
    case 'run_goal_near':
    case 'run_goal_achieved':
    case 'weekly_stats':
      return 'run';
    case 'ai_recommendation':
      return 'ai';
    case 'goals_incomplete':
    case 'habit_reminder':
    case 'streak_warning':
      return 'activity';
    default:
      return 'home';
  }
}

function buildNotification(type, title, body, extra = {}) {
  const screen = extra.screen || screenForType(type);
  const url = extra.url || `${PRODUCTION_URL}${screen === 'home' ? '' : screen}`;
  return {
    type,
    title,
    body: (body || '').slice(0, 240),
    screen,
    url,
    data: {
      type,
      screen,
      url,
      ...(extra.clanId ? { clanId: extra.clanId } : {}),
    },
    channelId: channelForType(type),
  };
}

/** Склонение слова «цель» по числу: 1 цель, 2 цели, 5 целей */
function goalWord(n) {
  const a = Math.abs(n) % 100;
  const b = n % 10;
  if (a >= 11 && a <= 14) return 'целей';
  if (b === 1) return 'цель';
  if (b >= 2 && b <= 4) return 'цели';
  return 'целей';
}

/** Склонение «день»: 1 день, 2 дня, 5 дней */
function dayWord(n) {
  const a = Math.abs(n) % 100;
  const b = n % 10;
  if (a >= 11 && a <= 14) return 'дней';
  if (b === 1) return 'день';
  if (b >= 2 && b <= 4) return 'дня';
  return 'дней';
}

const TEMPLATES = {
  // ── Утро: приветствие + цели на день ──
  morning_greeting: (total) =>
    buildNotification(
      'morning_greeting',
      'Доброе утро 🌅',
      total > 0
        ? `Сегодня у тебя ${total} ${goalWord(total)} на день 🚀\nНовый день — новый прогресс. Начинаем? 🔥`
        : 'Новый день — новый прогресс. Поставь цель и вперёд 🚀',
      { screen: 'activity' }
    ),
  // ── День: прогресс по целям ──
  goals_progress: (done, total) =>
    buildNotification(
      'goals_progress',
      'LevelUp',
      `Ты уже выполнил ${done} из ${total} ${goalWord(total)}. Продолжай! 💪`,
      { screen: 'activity' }
    ),
  // ── Вечер: сколько осталось ──
  goals_incomplete: (count) =>
    buildNotification(
      'goals_incomplete',
      'LevelUp',
      count > 0
        ? `До конца дня осталось ${count} невыполненны${count === 1 ? 'я' : 'х'} ${goalWord(count)} 🎯\nЗакрой день на 100% и сохрани серию 🔥`
        : 'Закрой день на 100% и сохрани серию 🔥'
    ),
  habit_reminder: (name) =>
    buildNotification('habit_reminder', 'LevelUp', `Не забудь отметить привычку «${name}» ✅`),
  streak_warning: (days) =>
    buildNotification(
      'streak_warning',
      'LevelUp',
      `Твоя серия — ${days} ${dayWord(days)} подряд. Не прерывай её! 🔥`
    ),
  streak_milestone: (days) =>
    buildNotification(
      'streak_warning',
      'LevelUp',
      `Серия ${days} ${dayWord(days)}! Это серьёзное достижение 🏆`
    ),
  run_reminder: () =>
    buildNotification('run_reminder', 'LevelUp', 'Сегодня отличная возможность выйти на пробежку 🏃'),
  run_goal_near: (kmLeft) =>
    buildNotification(
      'run_goal_near',
      'LevelUp',
      `До недельной цели осталось всего ${kmLeft} 🏃`
    ),
  run_goal_achieved: () =>
    buildNotification('run_goal_achieved', 'LevelUp', 'Новый личный рекорд! Поздравляем 🎉'),
  weekly_stats: (km, runs) =>
    buildNotification('weekly_stats', 'LevelUp', `Ты пробежал уже ${km} км на этой неделе 🔥`),
  ai_recommendation: () =>
    buildNotification(
      'ai_recommendation',
      'LevelUp',
      'Твой ИИ подготовил рекомендации на сегодня 🚀'
    ),
  club_new_member: (name) =>
    buildNotification('club_new_member', 'LevelUp', `В клубе новый участник: ${name} 👋`),
  club_ranking_up: (rank) =>
    buildNotification('club_ranking_up', 'LevelUp', `Ваш клуб вошёл в ТОП-${rank} недели 🚀`),
  club_achievement: (detail) =>
    buildNotification('club_achievement', 'LevelUp', detail || 'Новое достижение клуба 🔥'),
  retention_2_days: () =>
    buildNotification('retention_2_days', 'LevelUp', 'Мы тебя потеряли 👀'),
  retention_no_goals: () =>
    buildNotification('retention_no_goals', 'LevelUp', 'Твои цели всё ещё ждут тебя 🎯'),
  retention_1_week: () =>
    buildNotification(
      'retention_1_week',
      'LevelUp',
      'Вернись и продолжи свой прогресс. Ты уже проделал большой путь 🚀'
    ),
  clan_chat: (senderName, text, clanId) =>
    buildNotification(
      'clan_chat',
      `Клан · ${senderName}`,
      text || 'Новое сообщение',
      { clanId, url: `${PRODUCTION_URL}clans` }
    ),
};

module.exports = { buildNotification, TEMPLATES, channelForType, screenForType };
