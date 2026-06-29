import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useThemeColors } from '@/hooks/useThemeColors';
import { WebTheme } from '@/lib/theme';

export type PodiumEntry = { name: string; value: string; sub?: string; you?: boolean };

/** Пьедестал топ-3 для таблицы лидеров. */
export function Podium({ entries }: { entries: PodiumEntry[] }) {
  const c = useThemeColors();
  if (!entries.length) return null;

  const slots = [
    { e: entries[1], place: 2, h: 70, medal: '🥈' },
    { e: entries[0], place: 1, h: 96, medal: '🥇' },
    { e: entries[2], place: 3, h: 54, medal: '🥉' },
  ];

  return (
    <View style={[styles.wrap, { backgroundColor: c.cardElevated, borderColor: c.border }]}>
      <View style={styles.row}>
        {slots.map((s) => {
          if (!s.e) return <View key={s.place} style={{ flex: 1 }} />;
          const first = s.place === 1;
          const initial = (s.e.name || '?').slice(0, 1).toUpperCase();
          return (
            <View key={s.place} style={styles.col}>
              <Text style={styles.medal}>{s.medal}</Text>
              <View
                style={[
                  styles.avatar,
                  first && styles.avatarFirst,
                  { backgroundColor: c.card, borderColor: first ? c.accent : c.border },
                ]}>
                <Text style={[styles.avatarLetter, { color: c.text, fontSize: first ? 22 : 18 }]}>{initial}</Text>
              </View>
              <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
                {s.e.name}
                {s.e.you ? ' (вы)' : ''}
              </Text>
              <Text style={[styles.value, { color: c.accent }]} numberOfLines={1}>
                {s.e.value}
              </Text>
              {s.e.sub ? (
                <Text style={[styles.sub, { color: c.muted }]} numberOfLines={1}>
                  {s.e.sub}
                </Text>
              ) : null}

              {first ? (
                <LinearGradient
                  colors={[c.accent, '#9ECC00']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={[styles.pedestal, { height: s.h }]}>
                  <Text style={[styles.rank, { color: c.onAccent }]}>1</Text>
                </LinearGradient>
              ) : (
                <View style={[styles.pedestal, { height: s.h, backgroundColor: c.card, borderColor: c.border, borderWidth: 1 }]}>
                  <Text style={[styles.rank, { color: c.muted }]}>{s.place}</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: WebTheme.radiusLg,
    borderWidth: 1,
    paddingTop: 14,
    paddingHorizontal: 12,
    marginBottom: 14,
    overflow: 'hidden',
    ...WebTheme.shadowSoft,
  },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  col: { flex: 1, alignItems: 'center' },
  medal: { fontSize: 20, marginBottom: 4 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFirst: { width: 60, height: 60, borderRadius: 30, borderWidth: 2 },
  avatarLetter: { fontFamily: 'Inter_700Bold' },
  name: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginTop: 6, maxWidth: '100%' },
  value: { fontSize: 14, fontFamily: 'Inter_700Bold', marginTop: 2 },
  sub: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },
  pedestal: {
    width: '100%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 8,
  },
  rank: { fontSize: 22, fontFamily: 'Inter_700Bold' },
});
