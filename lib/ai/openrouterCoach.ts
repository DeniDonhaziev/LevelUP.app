import Constants from 'expo-constants';

import type { BodyGoal, ChatMessage, FoodAnalysisResult } from '@/lib/ai/types';
import {
  buildCoachSystemPrompt,
  buildFoodDescriptionPrompt,
  buildFoodImagePrompt,
  foodDescriptionMinLengthError,
} from '@/lib/ai/topicPrompts';
import type { TopicId } from '@/lib/topics';

/**
 * OpenRouter через fetch (без @openrouter/sdk — иначе ломается Metro).
 * Переопределение: EXPO_PUBLIC_OPENROUTER_MODEL_MAIN / _VISION
 */
export const OPENROUTER_MODEL_MAIN = 'deepseek/deepseek-chat';
export const OPENROUTER_MODEL_VISION = 'nvidia/nemotron-nano-12b-v2-vl:free';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const TIMEOUT_MS = 120_000;

function readExtra(): Record<string, string | undefined> {
  return (Constants.expoConfig?.extra as Record<string, string | undefined>) ?? {};
}

/** Ключ: https://openrouter.ai/keys */
export function getOpenRouterApiKey(): string | null {
  const fromEnv = typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_OPENROUTER_API_KEY ?? '' : '';
  const t = fromEnv.trim();
  if (t) return t;
  return readExtra().openrouterApiKey?.trim() || null;
}

export function isOpenRouterConfigured(): boolean {
  return getOpenRouterApiKey() !== null;
}

function getChatModelId(): string {
  const fromEnv =
    typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_OPENROUTER_MODEL_MAIN?.trim() ?? '' : '';
  const fromExtra = readExtra().openrouterModelMain?.trim() ?? '';
  return fromEnv || fromExtra || OPENROUTER_MODEL_MAIN;
}

function getVisionModelId(): string {
  const fromEnv =
    typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_OPENROUTER_MODEL_VISION?.trim() ?? '' : '';
  const fromExtra = readExtra().openrouterModelVision?.trim() ?? '';
  return fromEnv || fromExtra || OPENROUTER_MODEL_VISION;
}

function isAbortOrTimeout(e: unknown): boolean {
  if (e == null) return false;
  const name = e instanceof Error ? e.name : '';
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return name === 'AbortError' || msg.includes('abort') || msg.includes('timed out');
}

function isRateLimitError(status: number, message: string): boolean {
  const m = message.toLowerCase();
  if (status === 429) return true;
  return (
    m.includes('rate limit') ||
    m.includes('rate_limit') ||
    m.includes('too many requests') ||
    m.includes('quota exceeded') ||
    m.includes('throttl') ||
    m.includes('over capacity')
  );
}

function mapOpenRouterError(status: number, body: string): Error {
  try {
    const j = JSON.parse(body) as { error?: { message?: string; code?: number } };
    const rawMsg = j.error?.message ?? '';
    const msg = rawMsg.toLowerCase();
    if (isRateLimitError(status, rawMsg)) {
      return new Error(
        'Лимит запросов OpenRouter (429). Автоповторы уже выполнены, попробуйте снова через 1–5 минут. Если ошибка повторяется часто, пополните баланс на openrouter.ai или смените модель.'
      );
    }
    if (status === 401 || status === 403) {
      return new Error('Неверный ключ OpenRouter. Проверьте EXPO_PUBLIC_OPENROUTER_API_KEY.');
    }
    if (status === 404 || msg.includes('no endpoints') || msg.includes('not found')) {
      return new Error(
        'Модель не найдена или нет свободных эндпоинтов. Проверьте EXPO_PUBLIC_OPENROUTER_MODEL_MAIN / VISION на openrouter.ai/models'
      );
    }
  } catch {
    // ignore
  }
  return new Error(`OpenRouter ${status}: ${body.slice(0, 220)}`);
}

function mapNetwork(e: unknown): Error {
  if (isAbortOrTimeout(e)) {
    return new Error('Превышено время ожидания. Проверьте интернет или VPN.');
  }
  return e instanceof Error ? e : new Error(String(e));
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function chatCompletions(apiKey: string, body: Record<string, unknown>): Promise<Response> {
  try {
    return await fetchWithTimeout(
      OPENROUTER_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://levelup-tracker.app',
          'X-Title': 'LevelUp Tracker',
        },
        body: JSON.stringify(body),
      },
      TIMEOUT_MS
    );
  } catch (e) {
    throw mapNetwork(e);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function chatCompletionsWithRetry(apiKey: string, body: Record<string, unknown>): Promise<Response> {
  const maxAttempts = 3;
  let last: Response | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await chatCompletions(apiKey, body);
    last = res;

    if (res.ok) return res;
    if (res.status !== 429) return res;

    let errorMessage = '';
    try {
      const t = await res.clone().text();
      const j = JSON.parse(t) as { error?: { message?: string } };
      errorMessage = j.error?.message ?? '';
    } catch {
      // ignore
    }
    if (!isRateLimitError(res.status, errorMessage)) {
      return res;
    }
    if (attempt === maxAttempts - 1) {
      return res;
    }

    const ra = res.headers.get('Retry-After');
    let delayMs = 700 * 2 ** attempt;
    if (ra) {
      const sec = parseInt(ra, 10);
      if (!Number.isNaN(sec) && sec >= 0) {
        delayMs = Math.min(sec * 1000, 8_000);
      }
    }
    delayMs = Math.min(Math.max(delayMs, 300), 8_000);
    await sleep(delayMs);
  }

  return last!;
}

function assistantContentToString(content: unknown): string {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const part of content) {
      if (part && typeof part === 'object' && 'text' in part && typeof (part as { text?: unknown }).text === 'string') {
        parts.push((part as { text: string }).text);
      }
    }
    return parts.join('\n').trim();
  }
  return '';
}

function normalizeCoachText(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Текст ответа ассистента из сырого JSON OpenRouter/OpenAI. */
function parseMessageContent(raw: string): string {
  let data: {
    choices?: { message?: { content?: string | null | unknown; reasoning?: string | null } }[];
    error?: { message?: string };
  };
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('Некорректный ответ OpenRouter');
  }
  if (data.error?.message) {
    throw new Error(data.error.message);
  }
  const msg = data.choices?.[0]?.message;
  const c = msg?.content;
  if (typeof c === 'string' && c.trim()) return c.trim();
  if (c !== null && c !== undefined && typeof c !== 'string') {
    const s = assistantContentToString(c);
    if (s) return s;
  }
  const r = msg?.reasoning;
  if (typeof r === 'string' && r.trim()) return r.trim();
  return '';
}

function extractJsonObject<T extends object>(text: string): T | null {
  const trimmed = text.trim();
  const tryParse = (s: string): T | null => {
    try {
      return JSON.parse(s) as T;
    } catch {
      return null;
    }
  };
  let v = tryParse(trimmed);
  if (v) return v;
  const block = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (block) {
    v = tryParse(block[1].trim());
    if (v) return v;
  }
  const brace = trimmed.match(/\{[\s\S]*\}/);
  if (brace) return tryParse(brace[0]);
  return null;
}

function toApiMessages(thread: ChatMessage[]): { role: 'user' | 'assistant'; content: string }[] {
  return thread.map((m) =>
    m.role === 'user'
      ? { role: 'user' as const, content: m.content }
      : { role: 'assistant' as const, content: m.content }
  );
}

export async function coachChat(
  messages: ChatMessage[],
  goal: BodyGoal,
  topicId: TopicId = 'sport'
): Promise<string> {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) throw new Error('NO_API_KEY');

  const system = buildCoachSystemPrompt(topicId, goal);

  const res = await chatCompletionsWithRetry(apiKey, {
    model: getChatModelId(),
    messages: [{ role: 'system', content: system }, ...toApiMessages(messages)],
    max_tokens: 900,
    temperature: 0.45,
  });

  const rawText = await res.text();
  if (!res.ok) {
    throw mapOpenRouterError(res.status, rawText);
  }
  const text = normalizeCoachText(parseMessageContent(rawText));
  return text || 'Нет ответа.';
}

export async function analyzeFoodDescription(
  description: string,
  goal: BodyGoal,
  topicId: TopicId = 'sport'
): Promise<{ parsed: FoodAnalysisResult | null; raw: string }> {
  const trimmed = description.trim();
  if (trimmed.length < 3) throw new Error(foodDescriptionMinLengthError());

  const apiKey = getOpenRouterApiKey();
  if (!apiKey) throw new Error('NO_API_KEY');

  const prompt = buildFoodDescriptionPrompt(topicId, trimmed, goal);

  const res = await chatCompletionsWithRetry(apiKey, {
    model: getChatModelId(),
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 800,
    temperature: 0.3,
  });

  const rawText = await res.text();
  if (!res.ok) {
    throw mapOpenRouterError(res.status, rawText);
  }
  const content = parseMessageContent(rawText);
  const parsed = extractJsonObject<FoodAnalysisResult>(content);
  return { parsed, raw: content };
}

export async function analyzeFoodImage(
  base64Image: string,
  mimeType: string,
  goal: BodyGoal,
  topicId: TopicId = 'sport'
): Promise<{ parsed: FoodAnalysisResult | null; raw: string }> {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) throw new Error('NO_API_KEY');

  const prompt = buildFoodImagePrompt(topicId, goal);

  const dataUrl = `data:${mimeType || 'image/jpeg'};base64,${base64Image}`;

  const res = await chatCompletionsWithRetry(apiKey, {
    model: getVisionModelId(),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    max_tokens: 800,
    temperature: 0.3,
  });

  const rawText = await res.text();
  if (!res.ok) {
    throw mapOpenRouterError(res.status, rawText);
  }
  const content = parseMessageContent(rawText);
  const parsed = extractJsonObject<FoodAnalysisResult>(content);
  return { parsed, raw: content };
}
