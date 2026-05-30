import type { DevStage } from '@/lib/types';

export const DEV_STAGE_ORDER: DevStage[] = ['idea', 'design', 'dev', 'qa', 'release'];

export const DEV_STAGE_LABEL: Record<DevStage, string> = {
  idea: 'Идея',
  design: 'Дизайн',
  dev: 'Разработка',
  qa: 'Тестирование',
  release: 'Релиз',
};

export const DEV_STAGE_COLOR: Record<DevStage, string> = {
  idea: '#8B5CF6',
  design: '#EC4899',
  dev: '#2563EB',
  qa: '#FF9F0A',
  release: '#34C759',
};

export function normalizeDevStage(stage: DevStage | undefined): DevStage {
  if (stage && DEV_STAGE_ORDER.includes(stage)) return stage;
  return 'idea';
}

export function nextDevStage(stage: DevStage | undefined): DevStage {
  const current = normalizeDevStage(stage);
  const idx = DEV_STAGE_ORDER.indexOf(current);
  return DEV_STAGE_ORDER[(idx + 1) % DEV_STAGE_ORDER.length];
}
