import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useThemeColors } from '@/hooks/useThemeColors';
import { WebTheme } from '@/lib/theme';

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

  const bg = isGhost ? 'transparent' : isSecondary ? c.cardHover : c.cardElevated;
  const textColor = isGhost ? c.accent : c.text;
  const borderColor = isGhost ? 'transparent' : isSecondary ? c.border : c.accent;
  const borderWidth = isGhost ? 0 : 1;

  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.wrap,
        {
          backgroundColor: bg,
          borderColor,
          borderWidth: isSecondary ? StyleSheet.hairlineWidth : borderWidth,
          opacity: disabled ? 0.5 : pressed ? 0.9 : 1,
        },
      ]}>
      <View style={styles.btn}>
        {loading ? (
          <ActivityIndicator color={textColor} />
        ) : (
          <Text style={[styles.label, { color: textColor }]}>{label}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: WebTheme.radiusSm,
    overflow: 'hidden',
    minHeight: 48,
    justifyContent: 'center',
  },
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: -0.2,
  },
});
