/** Тёмная игровая палитра (lime accent) */
export const Dark = {
  bg: '#000000',
  bgSoft: '#050505',
  card: '#0C0C0C',
  cardElevated: '#121212',
  cardHover: '#1A1A1A',
  lime: '#C1FF00',
  limeSoft: 'rgba(193, 255, 0, 0.14)',
  limeGlow: 'rgba(193, 255, 0, 0.35)',
  text: '#FFFFFF',
  textMuted: '#8A8A8A',
  border: 'rgba(255, 255, 255, 0.08)',
  borderLime: 'rgba(193, 255, 0, 0.5)',
  tabBar: 'rgba(8, 8, 8, 0.96)',
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
