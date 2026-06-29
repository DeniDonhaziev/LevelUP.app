import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useThemeColors } from '@/hooks/useThemeColors';
import { useTrackerStore } from '@/store/trackerStore';
import { monthKey } from '@/lib/date';
import { WebTheme } from '@/lib/theme';

type Props = { name: string; photoURL: string | null; isAdmin: boolean };

/** Эффектная шапка профиля: аватар, имя, роль и плитки статистики. */
export function ProfileHeader({ name, photoURL, isAdmin }: Props) {
  const c = useThemeColors();
  const data = useTrackerStore((s) => (s.currentUser ? s.userData[s.currentUser] : undefined));

  const mk = monthKey(new Date().getFullYear(), new Date().getMonth() + 1);
  const achievements = data?.monthAchievements?.[mk]?.length ?? 0;
  const runs = data?.totalRuns ?? 0;
  const km = (data?.totalRunMeters ?? 0) / 1000;

  const initial = (name || '?').slice(0, 1).toUpperCase();

  const tiles: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }[] = [
    { icon: 'flame', label: 'Достижения', value: String(achievements) },
    { icon: 'walk', label: 'Пробежки', value: String(runs) },
    { icon: 'navigate', label: 'Км всего', value: km.toFixed(1) },
  ];

  return (
    <View style={[styles.card, { borderColor: c.border }]}>
      <LinearGradient
        colors={[c.accentSoft, c.cardElevated]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.top}>
        {photoURL ? (
          <Image source={{ uri: photoURL }} style={styles.avatar} resizeMode="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarPh, { backgroundColor: c.cardHover, borderColor: c.border }]}>
            <Text style={[styles.avatarLetter, { color: c.text }]}>{initial}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
            {name}
          </Text>
          <View style={[styles.roleChip, { backgroundColor: c.card, borderColor: c.border }]}>
            <Ionicons
              name={isAdmin ? 'shield-checkmark' : 'fitness'}
              size={13}
              color={c.accent}
            />
            <Text style={[styles.roleText, { color: c.text }]}>{isAdmin ? 'Администратор' : 'Спортсмен'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.tiles}>
        {tiles.map((t, i) => (
          <View
            key={t.label}
            style={[styles.tile, { backgroundColor: c.card, borderColor: c.border }, i < 2 && { marginRight: 10 }]}>
            <Ionicons name={t.icon} size={16} color={c.accent} />
            <Text style={[styles.tileValue, { color: c.text }]}>{t.value}</Text>
            <Text style={[styles.tileLabel, { color: c.muted }]}>{t.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: WebTheme.radiusLg,
    borderWidth: 1,
    padding: 18,
    marginBottom: 14,
    overflow: 'hidden',
    ...WebTheme.shadowSoft,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 68, height: 68, borderRadius: 34 },
  avatarPh: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  name: { fontSize: 22, fontFamily: 'Inter_700Bold', letterSpacing: -0.4 },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  roleText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  tiles: { flexDirection: 'row', marginTop: 16 },
  tile: { flex: 1, borderRadius: 16, borderWidth: 1, paddingVertical: 14, alignItems: 'center', gap: 4 },
  tileValue: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  tileLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
});
