import { Pressable, StyleSheet, View, type ViewProps } from 'react-native';

import { useThemeColors } from '@/hooks/useThemeColors';
import { WebTheme } from '@/lib/theme';

type Props = ViewProps & {
  children: React.ReactNode;
  elevated?: boolean;
  onPress?: () => void;
};

export function AppCard({ children, elevated, onPress, style, ...rest }: Props) {
  const c = useThemeColors();
  const inner = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: elevated ? c.cardElevated : c.card,
          borderColor: c.border,
        },
        style,
      ]}
      {...rest}>
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }]}>
        {inner}
      </Pressable>
    );
  }

  return inner;
}

/** Hero block for dashboard metrics */
export function HeroCard({ children, style, ...rest }: ViewProps & { children: React.ReactNode }) {
  const c = useThemeColors();
  return (
    <View
      style={[
        styles.hero,
        { borderColor: c.border, backgroundColor: c.cardElevated },
        style,
      ]}
      {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: WebTheme.radius,
    borderWidth: 1,
    padding: 16,
    overflow: 'hidden',
    ...WebTheme.shadowSoft,
  },
  hero: {
    borderRadius: WebTheme.radiusLg,
    borderWidth: 1,
    padding: 16,
    marginBottom: 4,
    overflow: 'hidden',
    ...WebTheme.shadowSoft,
  },
});
