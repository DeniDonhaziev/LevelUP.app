import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { RingProgress } from '@/components/RingProgress';
import { useThemeColors } from '@/hooks/useThemeColors';
import { WebTheme } from '@/lib/theme';

type Props = {
  totalTasks: number;
  doneToday: number;
};

function StatRow({ icon, value, label, color }: { icon: keyof typeof Ionicons.glyphMap; value: number; label: string; color: string }) {
  return (
    <View style={styles.statRow}>
      <View style={[styles.statIcon, { backgroundColor: 'rgba(255,255,255,0.07)' }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** Карточка «Прогресс за сегодня» — кольцо + счётчики (в духе таск-менеджера). */
export function TodayProgress({ totalTasks, doneToday }: Props) {
  const c = useThemeColors();
  const pending = Math.max(0, totalTasks - doneToday);
  const pct = totalTasks > 0 ? Math.round((doneToday / totalTasks) * 100) : 0;

  return (
    <View style={[styles.card, WebTheme.shadowSoft]}>
      <LinearGradient
        colors={['#1C1C1F', '#141416', '#0A0A0B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Text style={styles.title}>Прогресс за сегодня</Text>

      <View style={styles.body}>
        <View style={styles.ringWrap}>
          <RingProgress
            progress={pct / 100}
            size={104}
            strokeWidth={10}
            color={c.lime}
            trackColor="rgba(255,255,255,0.12)"
            centerColor="transparent"
          />
          <View style={styles.ringCenter} pointerEvents="none">
            <Text style={styles.ringPct}>{pct}%</Text>
          </View>
        </View>

        <View style={styles.stats}>
          <StatRow icon="list-outline" value={totalTasks} label="Всего задач" color="#FFFFFF" />
          <StatRow icon="checkmark-done-outline" value={doneToday} label="Выполнено" color={c.lime} />
          <StatRow icon="time-outline" value={pending} label="Осталось" color="#FFD60A" />
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  title: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold', letterSpacing: -0.2, marginBottom: 16 },
  body: { flexDirection: 'row', alignItems: 'center', gap: 22 },
  ringWrap: { width: 104, height: 104, position: 'relative' },
  ringCenter: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 104,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPct: { color: '#fff', fontSize: 26, fontFamily: 'Inter_700Bold', letterSpacing: -0.8 },
  stats: { flex: 1, gap: 12 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  statValue: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold', minWidth: 26 },
  statLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontFamily: 'Inter_500Medium' },
});
