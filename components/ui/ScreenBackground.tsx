import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { useThemeColors } from '@/hooks/useThemeColors';

type Props = ViewProps & {
  children: React.ReactNode;
};

export function ScreenBackground({ children, style, ...rest }: Props) {
  const c = useThemeColors();
  return (
    <View style={[styles.root, style]} {...rest}>
      <LinearGradient
        colors={c.screenGradient as unknown as string[]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
