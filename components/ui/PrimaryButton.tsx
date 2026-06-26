import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useThemeColors } from '@/hooks/useThemeColors';
import { Gradients, WebTheme } from '@/lib/theme';

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
};

export function PrimaryButton({ label, onPress, loading, disabled, variant = 'primary' }: Props) {
  const c = useThemeColors();
  const isGhost = variant === 'ghost';
  const isSecondary = variant === 'secondary';
  const isPrimary = variant === 'primary';

  const textColor = isPrimary ? c.onAccent : isGhost ? c.accent : c.text;
  const bg = isGhost ? 'transparent' : isSecondary ? c.cardHover : c.card;
  const borderColor = isGhost ? 'transparent' : c.border;

  const content = loading ? (
    <ActivityIndicator color={textColor} />
  ) : (
    <Text style={[styles.label, { color: textColor }]}>{label}</Text>
  );

  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.wrap,
        isPrimary && !disabled ? WebTheme.shadowGlow : null,
        {
          opacity: disabled ? 0.5 : 1,
          transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
        },
      ]}>
      {isPrimary ? (
        <LinearGradient colors={Gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
          {content}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.btn,
            { backgroundColor: bg, borderColor, borderWidth: isGhost ? 0 : StyleSheet.hairlineWidth },
          ]}>
          {content}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: WebTheme.radiusLg,
    overflow: 'hidden',
    minHeight: 52,
    justifyContent: 'center',
  },
  btn: {
    paddingVertical: 15,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  label: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: -0.2,
  },
});
