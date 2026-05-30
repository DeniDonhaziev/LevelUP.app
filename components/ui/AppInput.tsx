import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { useThemeColors } from '@/hooks/useThemeColors';
import { WebTheme } from '@/lib/theme';

type Props = TextInputProps;

export function AppInput({ style, placeholderTextColor, ...rest }: Props) {
  const c = useThemeColors();

  return (
    <TextInput
      placeholderTextColor={placeholderTextColor ?? c.muted}
      style={[
        styles.input,
        {
          color: c.text,
          backgroundColor: c.card,
          borderColor: c.border,
        },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: WebTheme.radiusSm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
  },
});
