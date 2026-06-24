/** Тёмная игровая палитра (lime accent) */
export const Dark = {
  bg: '#0A0A0B',
  bgSoft: '#0F0F11',
  card: '#161618',
  cardElevated: '#1C1C1F',
  cardHover: '#252528',
  lime: '#C1FF00',
  limeSoft: 'rgba(193, 255, 0, 0.14)',
  limeGlow: 'rgba(193, 255, 0, 0.35)',
  text: '#FFFFFF',
  textMuted: '#8E8E93',
  border: 'rgba(255, 255, 255, 0.08)',
  borderLime: 'rgba(193, 255, 0, 0.5)',
  tabBar: 'rgba(22, 22, 24, 0.96)',
  danger: '#FF453A',
  success: '#C1FF00',
  warning: '#FFD60A',
  info: '#64D2FF',
} as const;

export type CardVariant = 'default' | 'lime' | 'muted';

export function cardVariantStyle(variant: CardVariant): { bg: string; border: string } {
  switch (variant) {
    case 'lime':
      return { bg: Dark.cardElevated, border: Dark.borderLime };
    case 'muted':
      return { bg: Dark.card, border: Dark.border };
    default:
      return { bg: Dark.cardElevated, border: Dark.border };
  }
}
