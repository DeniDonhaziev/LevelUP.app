import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { useThemeColors } from '@/hooks/useThemeColors';
import { WebTheme } from '@/lib/theme';

type Props = ViewProps & {
  children: React.ReactNode;
  highlight?: boolean;
  glow?: boolean;
  onPress?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
};

export function GlassCard({
  children,
  highlight,
  glow,
  onPress,
  style,
  contentStyle,
  ...rest
}: Props) {
  const c = useThemeColors();

  const inner = (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: c.card,
          borderColor: highlight ? 'rgba(193, 255, 0, 0.35)' : c.border,
        },
        glow && WebTheme.shadowGlow,
        !glow && WebTheme.shadowSoft,
        style,
      ]}
      {...rest}>
      <LinearGradient
        colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.01)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {highlight ? (
        <LinearGradient
          colors={['rgba(193, 255, 0, 0.22)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.highlightGlow}
          pointerEvents="none"
        />
      ) : null}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}>
        {inner}
      </Pressable>
    );
  }

  return inner;
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: WebTheme.radiusLg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  highlightGlow: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.55,
  },
  content: {
    padding: 16,
  },
});
