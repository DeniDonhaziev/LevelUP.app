import { Pressable, StyleSheet, View, type ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useThemeColors } from '@/hooks/useThemeColors';
import { Gradients, WebTheme } from '@/lib/theme';

type Props = ViewProps & {
  children: React.ReactNode;
  elevated?: boolean;
  onPress?: () => void;
};

/** Тонкий верхний блик — премиум-полировка карточек */
function Sheen() {
  return (
    <LinearGradient
      colors={Gradients.cardSheen}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.sheen}
      pointerEvents="none"
    />
  );
}

export function AppCard({ children, elevated, onPress, style, ...rest }: Props) {
  const c = useThemeColors();
  const inner = (
    <View
      style={[
        styles.card,
        { backgroundColor: elevated ? c.cardElevated : c.card, borderColor: c.border },
        style,
      ]}
      {...rest}>
      <Sheen />
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.995 : 1 }] }]}>
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
      style={[styles.hero, { borderColor: c.border, backgroundColor: c.cardElevated }, style]}
      {...rest}>
      <Sheen />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: WebTheme.radiusLg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    overflow: 'hidden',
    ...WebTheme.shadowSoft,
  },
  hero: {
    borderRadius: WebTheme.radiusLg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    marginBottom: 4,
    overflow: 'hidden',
    ...WebTheme.shadowSoft,
  },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: 56 },
});
