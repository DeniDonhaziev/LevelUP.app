/** Глобальные UI-токены для всех экранов */
export const WebTheme = {
  bg: '#FFFFFF',
  bgAlt: '#F5F8FF',
  card: 'rgba(255,255,255,0.82)',
  cardElevated: 'rgba(255,255,255,0.95)',
  cardHover: 'rgba(246,248,252,0.92)',
  text: '#161822',
  textMuted: '#73798A',
  border: 'rgba(22,24,34,0.12)',
  lime: '#111111',
  limeDark: '#111111',
  green: '#111111',
  greenSoft: 'rgba(17,17,17,0.08)',
  accentLight: 'rgba(17,17,17,0.08)',
  chartBlue: '#111111',
  chartOrange: '#111111',
  chartTeal: '#111111',
  chartPurple: '#111111',
  chartRose: '#111111',
  radiusXl: 24,
  radiusLg: 20,
  radius: 16,
  radiusSm: 12,
  radiusXs: 8,
  navHeight: 82,
  shadowSoft: {
    shadowColor: '#7C8FB6',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 6,
  },
  shadowGlow: {
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 8,
  },
  glass: {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(22, 24, 34, 0.12)',
  },
} as const;

/** Имена шрифтов после useFonts(@expo-google-fonts/inter) */
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
  primary: ['#111111', '#2B2B2B'] as const,
  hero: ['rgba(255,255,255,0.96)', 'rgba(244,247,255,0.96)'] as const,
  screen: ['#FFFFFF', '#F5F8FF', '#FFFFFF'] as const,
  accentGlow: ['rgba(17,17,17,0.2)', 'rgba(17,17,17,0)'] as const,
} as const;
