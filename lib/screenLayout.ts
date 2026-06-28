import { Platform, StyleSheet } from 'react-native';

import { Spacing } from '@/lib/theme';

export const screenLayout = {
  scroll: {
    padding: Spacing.lg,
    paddingBottom: 120,
    gap: Spacing.lg,
  },
  scrollMobile: {
    flexGrow: 0,
  },
  scrollDesktop: {
    width: '100%' as const,
    maxWidth: 1220,
    alignSelf: 'center' as const,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  pageTitle: {
    fontSize: 34,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.8,
    marginBottom: Spacing.xs,
  },
  pageSubtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  sectionCaption: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.sm,
  },
};

export const layoutStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  gapSm: { gap: Spacing.sm },
  gapMd: { gap: Spacing.md },
});

export function isDesktopWebLayout(width: number) {
  return Platform.OS === 'web' && width >= 1100;
}
