import { StyleSheet, View, type ViewProps } from 'react-native';

import { useThemeColors } from '@/hooks/useThemeColors';

type Props = ViewProps & {
  children: React.ReactNode;
};

/** Плоский тёмный фон как на макете */
export function ScreenBackground({ children, style, ...rest }: Props) {
  const c = useThemeColors();
  return (
    <View style={[styles.root, { backgroundColor: c.backgroundAlt }, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
