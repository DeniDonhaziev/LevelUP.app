import type { BodyGoal } from '@/lib/ai/types';

function goalRuSport(goal: BodyGoal): string {
  switch (goal) {
    case 'lose':
      return 'пользователь хочет похудеть (дефицит калорий, белок, сытость)';
    case 'gain':
      return 'пользователь хочет набрать мышечную массу (профицит калорий, белок, силовые)';
    default:
      return 'пользователь хочет поддерживать вес и здоровье';
  }
}

const COACH_FORMAT = `
Формат ответа:
1) короткая поддержка в 1 предложении;
2) подробное объяснение причины и логики рекомендаций;
3) пошаговый план действий (минимум 5 шагов);
4) частые ошибки и как их избежать;
5) 1 простой следующий шаг на сегодня.
Правила оформления:
- не используй markdown и спецсимволы форматирования (запрещены двойные звездочки, подчеркивания, решетки и т.п.);
- используй обычный текст, нумерацию и короткие строки;
- пиши структурно и читаемо.
Отвечай сразу по делу, без лишних вступлений.
Детализация высокая: объясняй максимально понятно, но без повторов и воды.`;

export function buildCoachSystemPrompt(_topicId: string, goal: BodyGoal, profileContext?: string): string {
  const ctx = goalRuSport(goal);
  const profileBlock = profileContext
    ? `\nПрофиль пользователя (из анкеты, учитывай при рекомендациях):\n${profileContext}\n`
    : '';
  return `Ты дружелюбный коуч по питанию, тренировкам и привычкам. Язык: русский.
Контекст цели пользователя: ${ctx}.${profileBlock}
${COACH_FORMAT}
Советы должны быть безопасными, конкретными и реалистичными.
Не ставь медицинские диагнозы. Если вопрос про лекарства или болезни — порекомендуй обратиться к врачу.`;
}

export function buildFoodDescriptionPrompt(
  _topicId: string,
  description: string,
  goal: BodyGoal
): string {
  const ctx = goalRuSport(goal);
  return `Ты нутрициолог. Пользователь описал приём пищи: «${description}».
Контекст цели: ${ctx}.
Оцени примерную калорийность порции (ккал) и БЖУ в граммах.
Ответь СТРОГО одним JSON-объектом без markdown:
{"calories": число или null, "protein_g": число или null, "fat_g": число или null, "carbs_g": число или null, "foods_ru": "кратко что съели", "advice_ru": "1-3 предложения совета с учётом цели"}`;
}

export function buildFoodImagePrompt(_topicId: string, goal: BodyGoal): string {
  const ctx = goalRuSport(goal);
  return `Ты нутрициолог. На фото еда. Контекст цели: ${ctx}.
Оцени примерный размер порции и калорийность (ккал), БЖУ в граммах если возможно.
Ответь СТРОГО одним JSON-объектом без markdown:
{"calories": число или null, "protein_g": число или null, "fat_g": число или null, "carbs_g": число или null, "foods_ru": "кратко что на фото по-русски", "advice_ru": "1-3 предложения совета с учётом цели"}`;
}

export function foodDescriptionMinLengthError(): string {
  return 'Опишите блюдо чуть подробнее (минимум пара слов).';
}
