import { StyleSheet, Text, View, type ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useThemeColors } from '@/hooks/useThemeColors';
import { screenLayout } from '@/lib/screenLayout';
import { Gradients, WebTheme } from '@/lib/theme';

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
      <View style={[styles.group, { backgroundColor: c.cardElevated, borderColor: c.border }]}>
        <LinearGradient
          colors={Gradients.cardSheen}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.sheen}
          pointerEvents="none"
        />
        {children}
      </View>
      {footer ? <Text style={[styles.footer, { color: c.muted }]}>{footer}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 0 },
  group: {
    borderRadius: WebTheme.radiusLg,
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
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: 56 },
});
