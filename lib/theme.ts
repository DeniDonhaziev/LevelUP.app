import { Dark } from '@/lib/darkTheme';

/** Глобальные UI-токены */
export const WebTheme = {
  bg: Dark.bgSoft,
  bgAlt: Dark.bg,
  card: Dark.card,
  cardElevated: Dark.cardElevated,
  cardHover: Dark.cardHover,
  text: Dark.text,
  textMuted: Dark.textMuted,
  border: Dark.border,
  lime: Dark.lime,
  limeDark: '#9ECC00',
  green: Dark.lime,
  greenSoft: Dark.limeSoft,
  accentLight: Dark.limeSoft,
  chartBlue: Dark.info,
  chartOrange: '#FF9F0A',
  chartTeal: Dark.lime,
  chartPurple: '#BF5AF2',
  chartRose: Dark.danger,
  radiusXl: 30,
  radiusLg: 24,
  radius: 20,
  radiusSm: 16,
  radiusXs: 12,
  navHeight: 82,
  shadowSoft: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.32,
    shadowRadius: 28,
    elevation: 10,
  },
  shadowGlow: {
    shadowColor: Dark.lime,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  glass: {
    backgroundColor: 'rgba(22, 22, 24, 0.88)',
    borderWidth: 1,
    borderColor: Dark.border,
  },
} as const;

export const Fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Gradients = {
  primary: [Dark.lime, '#A6E000'] as const,
  hero: [Dark.cardElevated, Dark.bg] as const,
  screen: [Dark.bgSoft, Dark.bg, Dark.bgSoft] as const,
  accentGlow: [Dark.limeGlow, 'rgba(193, 255, 0, 0)'] as const,
  /** Лёгкий верхний блик для карточек (премиум-полировка) */
  cardSheen: ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0)'] as const,
} as const;
