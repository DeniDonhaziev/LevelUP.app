import { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ActivityTaskRow } from '@/components/ActivityTaskRow';
import { MiniSparkline } from '@/components/MiniSparkline';
import { EmptyState } from '@/components/ui/EmptyState';
import { GroupedSection } from '@/components/ui/GroupedSection';
import { HeroCard } from '@/components/ui/AppCard';
import { ScreenScroll } from '@/components/ui/ScreenScroll';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { StatTile } from '@/components/ui/StatTile';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useAppTopic } from '@/hooks/useAppTopic';
import { confirmDelete } from '@/lib/confirmAction';
import { todayKey } from '@/lib/date';
import {
  calculateStreak,
  getDayProgress,
  getMomentumPercent,
  getTaskProgressInMonth,
} from '@/lib/trackerLogic';
import { useTrackerStore, useUserData } from '@/store/trackerStore';

export default function ActivityScreen() {
  const c = useThemeColors();
  const topic = useAppTopic();
  const data = useUserData();
  const toggleTask = useTrackerStore((s) => s.toggleTask);
  const deleteTask = useTrackerStore((s) => s.deleteTask);
  const today = todayKey();

  const streak = data ? calculateStreak(data) : 0;
  const momentum = data ? getMomentumPercent(data) : 0;
  const tasks = data?.tasks || [];
  const totalTasks = tasks.length || 1;
  const doneToday = data ? (data.dailyDone[today] || []).length : 0;
  const dailyPct = Math.round((doneToday / totalTasks) * 100);

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  let weekAchievements = 0;
  for (let w = 0; w < 7; w++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + w);
    const mk = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const daysArr = (data?.monthAchievements || {})[mk] || [];
    if (daysArr.indexOf(d.getDate()) >= 0) weekAchievements++;
  }
  const weeklyPct = Math.round((weekAchievements / 7) * 100);

  const monthKeyCur = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const achievedDays = data ? (data.monthAchievements[monthKeyCur] || []).length : 0;
  const daysSoFar = now.getDate();
  let monthlyPct = daysSoFar ? Math.round((achievedDays / daysSoFar) * 100) : 0;
  monthlyPct = Math.min(100, monthlyPct);

  const spark = useMemo(() => {
    const vals: number[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      const ds =
        d.getFullYear() +
        '-' +
        String(d.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(d.getDate()).padStart(2, '0');
      vals.push(data ? getDayProgress(data, ds) : 0);
    }
    return vals;
  }, [data]);

  const habits = useMemo(() => {
    if (!data) return [];
    return tasks.map((t) => ({ id: t.id, name: t.name, pct: getTaskProgressInMonth(data, t.id) }));
  }, [data, tasks]);

  const taskRowPalette = {
    text: c.text,
    muted: c.muted,
    border: c.border,
    cardBg: c.card,
    accentDone: topic.tabActive,
  };

  const top = useMemo(() => [...habits].sort((a, b) => b.pct - a.pct).slice(0, 5), [habits]);
  const chartColors = [c.success, c.info, c.accent, c.warning, c.teal];

  return (
    <ScreenScroll>
      <SectionTitle title="Прогресс" subtitle={`Momentum ${momentum}% · серия ${streak} дн.`} />

      <HeroCard>
        <Text style={{ color: c.muted, fontSize: 13, fontFamily: 'Inter_500Medium' }}>Текущая серия</Text>
        <Text style={[styles.streakNum, { color: c.accent }]}>{streak} дней</Text>
        <View style={[styles.heroSpark, { backgroundColor: c.cardHover }]}>
          <MiniSparkline values={spark} color={c.accent} />
        </View>
        <Text style={{ color: c.muted, marginTop: 4, fontSize: 13 }}>Momentum: {momentum}%</Text>
      </HeroCard>

      <View style={styles.statRow}>
        <StatTile label="Momentum" value={`${momentum}%`} icon="flash-outline" />
        <StatTile label="Сегодня" value={`${dailyPct}%`} icon="today-outline" />
      </View>
      <View style={styles.statRow}>
        <StatTile label="Неделя" value={`${weeklyPct}%`} icon="calendar-outline" />
        <StatTile label="Месяц" value={`${monthlyPct}%`} icon="stats-chart-outline" />
      </View>

      <GroupedSection title="Динамика">
        <View style={styles.groupPad}>
          <Text style={{ color: c.text, fontFamily: 'Inter_600SemiBold', marginBottom: 8 }}>
            14 дней — % задач
          </Text>
          <MiniSparkline values={spark} color={c.accent} />
        </View>
      </GroupedSection>

      <GroupedSection title="Активности" footer="Отметки синхронизируются с главной">
        <View style={styles.groupPad}>
          {tasks.length === 0 ? (
            <EmptyState title="Нет активностей" subtitle="Добавьте их на главной" icon="list-outline" />
          ) : (
            tasks.map((t) => (
              <ActivityTaskRow
                key={t.id}
                taskId={t.id}
                name={t.name}
                done={(data?.dailyDone[today] || []).includes(t.id)}
                palette={taskRowPalette}
                onToggle={toggleTask}
                onDelete={deleteTask}
              />
            ))
          )}
        </View>
      </GroupedSection>

      <GroupedSection title="Привычки за месяц">
        <View style={styles.groupPad}>
          {habits.length === 0 ? (
            <EmptyState title="Нет привычек" subtitle="Добавьте задачи на главной" />
          ) : (
            habits.map((h) => (
              <View key={h.id} style={styles.habitRow}>
                <Text style={{ color: c.text, flex: 1, fontFamily: 'Inter_500Medium' }} numberOfLines={1}>
                  {h.name}
                </Text>
                <View style={[styles.barBg, { backgroundColor: c.cardHover }]}>
                  <View style={[styles.barFill, { width: `${h.pct}%`, backgroundColor: topic.tabActive }]} />
                </View>
                <Text style={{ color: c.muted, width: 40, textAlign: 'right', fontSize: 13 }}>{h.pct}%</Text>
                <Pressable
                  onPress={() => confirmDelete('Удалить активность?', h.name, () => deleteTask(h.id))}
                  hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={c.danger} />
                </Pressable>
              </View>
            ))
          )}
        </View>
      </GroupedSection>

      <GroupedSection title="Топ привычек">
        <View style={styles.groupPad}>
          {top.length === 0 ? (
            <EmptyState title="Нет данных" subtitle="За этот месяц пока пусто" icon="podium-outline" />
          ) : (
            top.map((h, i) => (
              <View key={h.id} style={styles.habitRow}>
                <Text style={{ color: c.text, flex: 1 }} numberOfLines={1}>
                  {h.name}
                </Text>
                <View style={[styles.barBg, { backgroundColor: c.cardHover }]}>
                  <View
                    style={[styles.barFill, { width: `${h.pct}%`, backgroundColor: chartColors[i % chartColors.length] }]}
                  />
                </View>
                <Text style={{ color: c.muted, width: 40, textAlign: 'right' }}>{h.pct}%</Text>
              </View>
            ))
          )}
        </View>
      </GroupedSection>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  streakNum: { fontSize: 34, fontFamily: 'Inter_700Bold', marginTop: 4, letterSpacing: -0.8 },
  heroSpark: { marginTop: 10, borderRadius: 12, padding: 8 },
  statRow: { flexDirection: 'row', gap: 10 },
  groupPad: { padding: 14, gap: 4 },
  habitRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  barBg: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
});
