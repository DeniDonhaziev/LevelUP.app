import type { Ionicons } from '@expo/vector-icons';

import type { BodyGoal } from '@/lib/ai/types';
import type {
  ActivityLevel,
  Gender,
  HealthCondition,
  OnboardingGoal,
  OnboardingProfile,
  RunVolume,
  StepGoal,
  UserData,
} from '@/lib/types';

type IconName = keyof typeof Ionicons.glyphMap;

export type Choice<T extends string | number> = {
  value: T;
  label: string;
  hint?: string;
  icon?: IconName;
};

/** Всего шагов в анкете */
export const ONBOARDING_STEPS = 7;

export const GENDER_OPTIONS: Choice<Gender>[] = [
  { value: 'male', label: 'Мужской', icon: 'male-outline' },
  { value: 'female', label: 'Женский', icon: 'female-outline' },
  { value: 'other', label: 'Не указывать', icon: 'ellipse-outline' },
];

export const ACTIVITY_OPTIONS: Choice<ActivityLevel>[] = [
  { value: 'none', label: 'Не занимаюсь спортом', hint: 'Начинаем с нуля', icon: 'bed-outline' },
  { value: 'sometimes', label: 'Иногда тренируюсь', hint: 'Без графика', icon: 'walk-outline' },
  { value: 'light', label: '1–3 тренировки в неделю', hint: 'Лёгкий режим', icon: 'bicycle-outline' },
  { value: 'regular', label: '4–6 тренировок в неделю', hint: 'Регулярно', icon: 'barbell-outline' },
  { value: 'pro', label: 'Профессионально', hint: 'Спорт — часть жизни', icon: 'trophy-outline' },
];

export const GOAL_OPTIONS: Choice<OnboardingGoal>[] = [
  { value: 'discipline', label: 'Развитие дисциплины', icon: 'shield-checkmark-outline' },
  { value: 'habits', label: 'Формирование привычек', icon: 'repeat-outline' },
  { value: 'weight_loss', label: 'Похудение', icon: 'flame-outline' },
  { value: 'muscle', label: 'Набор мышечной массы', icon: 'barbell-outline' },
  { value: 'health', label: 'Улучшение здоровья', icon: 'heart-outline' },
  { value: 'activity', label: 'Повышение активности', icon: 'pulse-outline' },
  { value: 'competition', label: 'Подготовка к соревнованиям', icon: 'trophy-outline' },
  { value: 'self_growth', label: 'Личностное развитие', icon: 'sparkles-outline' },
];

export const HEALTH_OPTIONS: Choice<HealthCondition>[] = [
  { value: 'none', label: 'Нет ограничений', icon: 'checkmark-circle-outline' },
  { value: 'heart', label: 'Заболевания сердца', icon: 'heart-dislike-outline' },
  { value: 'pressure', label: 'Повышенное давление', icon: 'thermometer-outline' },
  { value: 'joints', label: 'Заболевания суставов', icon: 'body-outline' },
  { value: 'respiratory', label: 'Дыхательная система', icon: 'cloud-outline' },
  { value: 'diabetes', label: 'Диабет', icon: 'water-outline' },
  { value: 'other', label: 'Другие ограничения', icon: 'ellipsis-horizontal-circle-outline' },
];

export const RUN_VOLUME_OPTIONS: Choice<RunVolume>[] = [
  { value: 'none', label: 'Не бегаю', icon: 'close-circle-outline' },
  { value: 'lt3', label: 'До 3 км', icon: 'walk-outline' },
  { value: '3-5', label: '3–5 км', icon: 'footsteps-outline' },
  { value: '5-10', label: '5–10 км', icon: 'trail-sign-outline' },
  { value: 'gt10', label: 'Более 10 км', icon: 'rocket-outline' },
];

export const STEP_GOAL_OPTIONS: Choice<StepGoal>[] = [
  { value: 5000, label: '5 000 шагов', hint: 'Спокойный старт' },
  { value: 8000, label: '8 000 шагов', hint: 'Хороший баланс' },
  { value: 10000, label: '10 000 шагов', hint: 'Классическая цель' },
  { value: 15000, label: '15 000 шагов', hint: 'Высокая активность' },
];

/** Заболевания, требующие ограничения нагрузок */
export const RESTRICTED_HEALTH: HealthCondition[] = ['heart', 'pressure'];

export function requiresSafetyLimit(health: HealthCondition[]): boolean {
  return health.some((h) => RESTRICTED_HEALTH.includes(h));
}

export const SAFETY_WARNING =
  'Для вашей безопасности LevelUp будет ограничивать высокоинтенсивные рекомендации и нагрузки.';

/** Пустой черновик анкеты */
export function emptyOnboardingDraft(name = ''): OnboardingProfile {
  return {
    completed: false,
    name,
    age: 0,
    gender: 'other',
    heightCm: 0,
    weightKg: 0,
    activityLevel: 'none',
    goals: [],
    health: [],
    runVolume: 'none',
    stepGoal: 8000,
    consentAiInformational: false,
    consentConsultSpecialist: false,
  };
}

export function getOnboarding(data?: UserData | null): OnboardingProfile | undefined {
  return data?.onboarding;
}

export function isOnboardingComplete(data?: UserData | null): boolean {
  return Boolean(data?.onboarding?.completed);
}

/** ── Валидация шага 1 (основная информация) ── */
export type BasicsErrors = Partial<Record<'name' | 'age' | 'heightCm' | 'weightKg', string>>;

export function validateBasics(p: Pick<OnboardingProfile, 'name' | 'age' | 'heightCm' | 'weightKg'>): BasicsErrors {
  const errors: BasicsErrors = {};
  if (p.name.trim().length < 2) errors.name = 'Минимум 2 символа';
  if (!Number.isFinite(p.age) || p.age < 10 || p.age > 120) errors.age = 'Возраст от 10 до 120';
  if (!Number.isFinite(p.heightCm) || p.heightCm < 80 || p.heightCm > 250) errors.heightCm = 'Рост от 80 до 250 см';
  if (!Number.isFinite(p.weightKg) || p.weightKg < 20 || p.weightKg > 400) errors.weightKg = 'Вес от 20 до 400 кг';
  return errors;
}

/** Можно ли уйти со шага дальше */
export function isStepValid(step: number, p: OnboardingProfile): boolean {
  switch (step) {
    case 0:
      return Object.keys(validateBasics(p)).length === 0;
    case 1:
      return !!p.activityLevel;
    case 2:
      return p.goals.length >= 1;
    case 3:
      return p.health.length >= 1;
    case 4:
      return !!p.runVolume;
    case 5:
      return !!p.stepGoal;
    case 6:
      return p.consentAiInformational && p.consentConsultSpecialist;
    default:
      return true;
  }
}

/** Тоггл значения в множественном выборе с эксклюзивным «Нет ограничений» */
export function toggleHealth(current: HealthCondition[], value: HealthCondition): HealthCondition[] {
  if (value === 'none') return current.includes('none') ? [] : ['none'];
  const next = current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current.filter((v) => v !== 'none'), value];
  return next;
}

export function toggleGoal(current: OnboardingGoal[], value: OnboardingGoal): OnboardingGoal[] {
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

/** Маппинг целей анкеты в цель ИИ-коуча (BodyGoal) */
export function mapToBodyGoal(goals: OnboardingGoal[]): BodyGoal {
  if (goals.includes('weight_loss')) return 'lose';
  if (goals.includes('muscle')) return 'gain';
  return 'maintain';
}

const ACTIVITY_RU: Record<ActivityLevel, string> = {
  none: 'не занимается спортом',
  sometimes: 'тренируется время от времени',
  light: '1–3 тренировки в неделю',
  regular: '4–6 тренировок в неделю',
  pro: 'занимается профессионально',
};

const GOAL_RU: Record<OnboardingGoal, string> = {
  discipline: 'дисциплина',
  habits: 'привычки',
  weight_loss: 'похудение',
  muscle: 'набор массы',
  health: 'здоровье',
  activity: 'активность',
  competition: 'соревнования',
  self_growth: 'саморазвитие',
};

const HEALTH_RU: Record<HealthCondition, string> = {
  none: 'нет ограничений',
  heart: 'заболевания сердца',
  pressure: 'повышенное давление',
  joints: 'заболевания суставов',
  respiratory: 'заболевания дыхательной системы',
  diabetes: 'диабет',
  other: 'другие ограничения',
};

const RUN_RU: Record<RunVolume, string> = {
  none: 'не бегает',
  lt3: 'до 3 км за тренировку',
  '3-5': '3–5 км за тренировку',
  '5-10': '5–10 км за тренировку',
  gt10: 'более 10 км за тренировку',
};

/**
 * Строит текстовый контекст профиля для ИИ-коуча — персонализация + безопасность.
 * Возвращает '' если анкеты нет.
 */
export function buildAiProfileContext(profile?: OnboardingProfile | null): string {
  if (!profile?.completed) return '';
  const lines: string[] = [];
  lines.push(`Имя: ${profile.name}.`);
  const genderRu = profile.gender === 'male' ? 'мужской' : profile.gender === 'female' ? 'женский' : 'не указан';
  lines.push(`Пол: ${genderRu}, возраст: ${profile.age}, рост: ${profile.heightCm} см, вес: ${profile.weightKg} кг.`);
  // Прогресс по весу из истории анкеты
  const wh = profile.weightHistory ?? [];
  if (wh.length >= 2) {
    const first = wh[0].kg;
    const prev = wh[wh.length - 2].kg;
    const curr = profile.weightKg;
    const dTotal = Math.round((curr - first) * 10) / 10;
    const dLast = Math.round((curr - prev) * 10) / 10;
    const word = (d: number) => (d > 0 ? `набрал ${Math.abs(d)} кг` : d < 0 ? `сбросил ${Math.abs(d)} кг` : 'без изменений');
    lines.push(
      `ПРОГРЕСС ПО ВЕСУ (есть результат — обязательно отметь его в начале ответа, поддержи): ` +
        `с первого заполнения ${first} → ${curr} кг (${word(dTotal)}); ` +
        `с прошлого раза ${prev} → ${curr} кг (${word(dLast)}). ` +
        `Скажи это пользователю простыми словами, например «Вижу, у вас есть результат — вы ${word(dLast)}».`
    );
  }
  lines.push(`Уровень активности: ${ACTIVITY_RU[profile.activityLevel]}.`);
  if (profile.goals.length) lines.push(`Цели: ${profile.goals.map((g) => GOAL_RU[g]).join(', ')}.`);
  lines.push(`Беговой объём: ${RUN_RU[profile.runVolume]}.`);
  lines.push(`Цель по шагам: ${profile.stepGoal} в день.`);
  const realHealth = profile.health.filter((h) => h !== 'none');
  if (realHealth.length) lines.push(`Ограничения по здоровью: ${realHealth.map((h) => HEALTH_RU[h]).join(', ')}.`);
  else lines.push('Ограничений по здоровью нет.');
  if (requiresSafetyLimit(profile.health)) {
    lines.push(
      'ВАЖНО ПО БЕЗОПАСНОСТИ: у пользователя есть сердечно-сосудистые ограничения. ' +
        'Категорически избегай рекомендаций по высокоинтенсивным нагрузкам (HIIT, спринты, максимальные веса). ' +
        'Предлагай только низкую и умеренную интенсивность и напоминай о консультации с врачом.'
    );
  }
  return lines.join('\n');
}

/** Короткая сводка для отображения в профиле */
export function onboardingSummaryLine(profile?: OnboardingProfile | null): string {
  if (!profile?.completed) return 'Анкета не заполнена';
  return `${profile.age} лет · ${profile.heightCm} см · ${profile.weightKg} кг · ${ACTIVITY_RU[profile.activityLevel]}`;
}
