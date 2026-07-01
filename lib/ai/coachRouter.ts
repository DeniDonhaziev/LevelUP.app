import type { BodyGoal, ChatMessage, FoodAnalysisResult } from '@/lib/ai/types';
import type { TopicId } from '@/lib/topics';

export type { BodyGoal, ChatMessage, FoodAnalysisResult } from '@/lib/ai/types';
import {
  analyzeFoodDescription as openrouterAnalyzeFoodDescription,
  analyzeFoodImage as openrouterAnalyzeFoodImage,
  coachChat as openrouterCoachChat,
  isOpenRouterConfigured,
} from '@/lib/ai/openrouterCoach';

function requireOpenRouter(): void {
  if (!isOpenRouterConfigured()) {
    throw new Error(
      'Добавьте в .env EXPO_PUBLIC_OPENROUTER_API_KEY (https://openrouter.ai/keys) и перезапустите с npx expo start --clear'
    );
  }
}

/** Настроен ли AI (OpenRouter). */
export function isAiConfigured(): boolean {
  return isOpenRouterConfigured();
}

/** Подпись для UI. */
export function getAiProviderLabel(): string {
  return isOpenRouterConfigured() ? 'OpenRouter' : '';
}

/** Анализ фото еды через vision-модель на OpenRouter. */
export function canAnalyzeFoodPhoto(): boolean {
  return isOpenRouterConfigured();
}

export async function coachChat(
  messages: ChatMessage[],
  goal: BodyGoal,
  topicId: TopicId = 'sport',
  profileContext?: string,
  userName?: string
): Promise<string> {
  requireOpenRouter();
  return openrouterCoachChat(messages, goal, topicId, profileContext, userName);
}

export async function analyzeFoodDescription(
  description: string,
  goal: BodyGoal,
  topicId: TopicId = 'sport'
): Promise<{ parsed: FoodAnalysisResult | null; raw: string }> {
  requireOpenRouter();
  return openrouterAnalyzeFoodDescription(description, goal, topicId);
}

export async function analyzeFoodImage(
  base64Image: string,
  mimeType: string,
  goal: BodyGoal,
  topicId: TopicId = 'sport'
): Promise<{ parsed: FoodAnalysisResult | null; raw: string }> {
  requireOpenRouter();
  return openrouterAnalyzeFoodImage(base64Image, mimeType, goal, topicId);
}
