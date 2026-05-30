import type { BodyGoal } from '@/lib/ai/types';

export type TopicId = 'sport';

export type TopicGoalChip = {
  id: BodyGoal;
  label: string;
  hint: string;
};

export type TopicConfig = {
  id: TopicId;
  label: string;
  brandTitle: string;
  brandSubtitle: string;
  accent: string;
  accentMuted: string;
  tabActive: string;
  defaultTasks: string[];
  aiTitle: string;
  aiSubtitle: string;
  aiPlaceholder: string;
  goals: TopicGoalChip[];
  photoSectionTitle: string;
  photoLoadingText: string;
  aiCoachSectionTitle: string;
};

const SPORT_TOPIC: TopicConfig = {
  id: 'sport',
  label: 'Спорт',
  brandTitle: 'LevelUp',
  brandSubtitle: 'Ваш ритм, энергия и прогресс каждый день',
  accent: '#111111',
  accentMuted: 'rgba(17, 17, 17, 0.08)',
  tabActive: '#111111',
  defaultTasks: [
    'Пробежка или ходьба',
    'Вода 1,5–2 л',
    'Зарядка 10 мин',
    'Сон до 23:00',
    'Чтение 20 мин',
  ],
  aiTitle: 'AI — советы и калории',
  aiSubtitle:
    'Задавайте вопросы коучу, оценивайте калории по описанию или по фото. Оценки приблизительные; ИИ не заменяет врача.',
  aiPlaceholder: 'Например: сколько белка в день при похудении?',
  goals: [
    { id: 'lose', label: 'Похудеть', hint: 'дефицит, сытость, белок' },
    { id: 'gain', label: 'Масса', hint: 'набор мышц, калории+' },
    { id: 'maintain', label: 'Баланс', hint: 'поддержание веса' },
  ],
  photoSectionTitle: 'Еда по фото',
  photoLoadingText: 'Считаю калории…',
  aiCoachSectionTitle: 'Вопрос коучу',
};

export const TOPICS: Record<TopicId, TopicConfig> = {
  sport: SPORT_TOPIC,
};

export const TOPIC_LIST: TopicConfig[] = [SPORT_TOPIC];

export function getTopicConfig(_topicId?: TopicId | string | null): TopicConfig {
  return SPORT_TOPIC;
}

export const DEMO_SPORT_ACCOUNTS = [
  { username: 'runner', password: 'run123', label: 'Бегун' },
  { username: 'sprinter', password: 'run123', label: 'Спринтер' },
] as const;

export const DEMO_ACCOUNTS: { username: string; password: string; label: string; topicId: TopicId }[] =
  DEMO_SPORT_ACCOUNTS.map((d) => ({ ...d, topicId: 'sport' as const }));

export const DEFAULT_TOPIC_ID: TopicId = 'sport';
