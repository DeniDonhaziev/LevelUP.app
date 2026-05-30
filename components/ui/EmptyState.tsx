import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useThemeColors';

type Props = {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle?: string;
};

export function EmptyState({ icon = 'albums-outline', title, subtitle }: Props) {
  const c = useThemeColors();

  return (
    <View style={styles.wrap}>
      <Ionicons name={icon} size={28} color={c.muted} />
      <Text style={[styles.title, { color: c.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.sub, { color: c.muted }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  sub: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
});
