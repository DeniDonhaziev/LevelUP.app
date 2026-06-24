import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useThemeColors';
import { WebTheme } from '@/lib/theme';

type Props = {
  label: string;
  value: string | number;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  accent?: string;
};

export function StatTile({ label, value, icon, accent }: Props) {
  const c = useThemeColors();
  const tone = accent ?? c.accent;

  return (
    <View style={[styles.tile, { backgroundColor: c.card, borderColor: c.border }]}>
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: c.accentSoft }]}>
          <Ionicons name={icon} size={16} color={tone} />
        </View>
      ) : null}
      <Text style={[styles.value, { color: c.text }]}>{value}</Text>
      <Text style={[styles.label, { color: c.muted }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 0,
    borderRadius: WebTheme.radiusLg,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 4,
    ...WebTheme.shadowSoft,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  value: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.4,
  },
  label: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
