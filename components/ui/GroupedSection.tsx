import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { useThemeColors } from '@/hooks/useThemeColors';
import { screenLayout } from '@/lib/screenLayout';
import { WebTheme } from '@/lib/theme';

type Props = ViewProps & {
  title?: string;
  footer?: string;
  children: React.ReactNode;
};

export function GroupedSection({ title, footer, children, style, ...rest }: Props) {
  const c = useThemeColors();

  return (
    <View style={[styles.wrap, style]} {...rest}>
      {title ? (
        <Text style={[screenLayout.sectionCaption, { color: c.muted }]}>{title}</Text>
      ) : null}
      <View style={[styles.group, { backgroundColor: c.cardElevated, borderColor: c.border }]}>{children}</View>
      {footer ? <Text style={[styles.footer, { color: c.muted }]}>{footer}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 0 },
  group: {
    borderRadius: WebTheme.radius,
    borderWidth: 1,
    overflow: 'hidden',
    ...WebTheme.shadowSoft,
  },
  footer: {
    marginTop: 6,
    marginLeft: 12,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
});
