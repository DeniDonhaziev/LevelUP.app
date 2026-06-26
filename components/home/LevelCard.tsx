import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useThemeColors } from '@/hooks/useThemeColors';
import { WebTheme } from '@/lib/theme';

type Props = {
  user: string;
  level: number;
  points: string;
  streak: number;
  distanceKm: string;
};

/** «Карта» пользователя на главной — в духе банковской, но про прогресс. */
export function LevelCard({ user, level, points, streak, distanceKm }: Props) {
  const c = useThemeColors();
  const streakTag = String(streak).padStart(2, '0');

  return (
    <View style={[styles.card, WebTheme.shadowSoft]}>
      <LinearGradient
        colors={['#1C1C1F', '#121214', '#0A0A0B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* мягкое лаймовое свечение в углу */}
      <LinearGradient
        colors={['rgba(193,255,0,0.18)', 'rgba(193,255,0,0)']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.3, y: 0.8 }}
        style={styles.glow}
      />

      {/* Лаймовая «контактная» панель справа */}
      <View style={[styles.limePanel, { backgroundColor: c.lime }]}>
        <Ionicons name="sparkles" size={16} color="#0A0A0B" style={{ opacity: 0.85 }} />
        <Ionicons name="wifi" size={22} color="#0A0A0B" style={styles.contactless} />
      </View>

      {/* Шапка */}
      <View style={styles.topRow}>
        <View style={styles.brandRow}>
          <Text style={styles.brand}>Level</Text>
          <Text style={[styles.brand, { color: c.lime }]}>Up</Text>
        </View>
        <View style={[styles.lvlPill, { backgroundColor: 'rgba(193,255,0,0.16)', borderColor: 'rgba(193,255,0,0.4)' }]}>
          <Ionicons name="flash" size={12} color={c.lime} />
          <Text style={[styles.lvlText, { color: c.lime }]}>Ур. {level}</Text>
        </View>
      </View>

      {/* Баланс очков */}
      <Text style={styles.balanceLabel}>Очки прогресса</Text>
      <Text style={styles.balance}>{points}</Text>

      {/* Маскированный «номер» */}
      <View style={styles.numberRow}>
        <Text style={styles.dots}>••••</Text>
        <Text style={styles.dots}>••••</Text>
        <Text style={styles.dots}>••••</Text>
        <Text style={styles.tag}>{streakTag}🔥</Text>
      </View>

      {/* Низ: имя + дистанция */}
      <View style={styles.bottomRow}>
        <View>
          <Text style={styles.footLabel}>Владелец</Text>
          <Text style={styles.footName} numberOfLines={1}>
            {user || 'Гость'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.footLabel}>Пробег</Text>
          <Text style={styles.footName}>{distanceKm} км</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: WebTheme.radiusXl,
    overflow: 'hidden',
    padding: 20,
    minHeight: 196,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'space-between',
  },
  glow: { position: 'absolute', top: 0, right: 0, width: 200, height: 160 },
  limePanel: {
    position: 'absolute',
    right: 0,
    top: '32%',
    width: 46,
    height: 86,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  contactless: { transform: [{ rotate: '90deg' }] },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row' },
  brand: { color: '#fff', fontSize: 18, fontFamily: 'Inter_700Bold', letterSpacing: -0.4 },
  lvlPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  lvlText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  balanceLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 14 },
  balance: { color: '#fff', fontSize: 30, fontFamily: 'Inter_700Bold', letterSpacing: -0.8, marginTop: 2 },
  numberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  dots: { color: 'rgba(255,255,255,0.5)', fontSize: 15, letterSpacing: 1, fontFamily: 'Inter_700Bold' },
  tag: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  bottomRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14 },
  footLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: 'Inter_500Medium' },
  footName: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold', letterSpacing: -0.2, marginTop: 2, maxWidth: 160 },
});
