import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { TodayProgress } from '@/components/home/TodayProgress';
import { useThemeColors } from '@/hooks/useThemeColors';
import { todayKey } from '@/lib/date';
import { WebTheme } from '@/lib/theme';
import type { UserData } from '@/lib/types';
import { selectAvatarDisplayUri, useTrackerStore } from '@/store/trackerStore';

type Props = {
  data: UserData | null;
  streak: number;
  momentum: number;
  monthProgressPct: number;
  doneToday: number;
  totalTasks: number;
  achievedDays: number;
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

function Chip({
  count,
  label,
  active,
  onPress,
}: {
  count: number;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? c.lime : c.cardElevated,
          borderColor: active ? c.lime : c.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      <View style={[styles.chipCount, { backgroundColor: active ? 'rgba(10,10,11,0.18)' : c.cardHover }]}>
        <Text style={[styles.chipCountText, { color: active ? '#0A0A0B' : c.text }]}>{count}</Text>
      </View>
      <Text style={[styles.chipLabel, { color: active ? '#0A0A0B' : c.muted }]}>{label}</Text>
    </Pressable>
  );
}

export function HomeHero({ data, doneToday, totalTasks }: Props) {
  const c = useThemeColors();
  const user = useTrackerStore((s) => s.currentUser);
  const avatarUri = useTrackerStore((s) => selectAvatarDisplayUri(s));

  const today = todayKey();
  const tasks = data?.tasks ?? [];
  const doneIds = data?.dailyDone[today] ?? [];
  const pendingTasks = tasks.filter((t) => !doneIds.includes(t.id));
  const todoCount = pendingTasks.length;
  const featured = pendingTasks[0] ?? null;

  const goActivity = () => router.push('/(tabs)/activity');

  return (
    <View style={styles.root}>
      {/* Шапка */}
      <View style={styles.header}>
        <Pressable onPress={() => router.push('/(tabs)/profile')} style={styles.headerLeft}>
          <View style={[styles.avatar, { backgroundColor: c.cardHover, borderColor: c.border }]}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
            ) : (
              <Text style={[styles.avatarLetter, { color: c.text }]}>
                {(user || '?').charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View>
            <Text style={[styles.greeting, { color: c.muted }]}>{greeting()} 👋</Text>
            <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
              {user || 'Гость'}
            </Text>
          </View>
        </Pressable>

        <View style={styles.headerActions}>
          <Pressable onPress={goActivity} style={[styles.addBtn, { backgroundColor: c.text }]}>
            <Ionicons name="add" size={22} color={c.background} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/(tabs)/profile')}
            style={[styles.iconBtn, { backgroundColor: c.cardElevated, borderColor: c.border }]}>
            <Ionicons name="notifications-outline" size={20} color={c.text} />
            <View style={[styles.bellDot, { backgroundColor: c.lime }]} />
          </Pressable>
        </View>
      </View>

      {/* Крупный заголовок */}
      <Text style={[styles.bigTitle, { color: c.text }]}>
        Сделаем день{'\n'}
        <Text style={{ color: c.lime }}>продуктивным</Text>
      </Text>

      {/* Карточка прогресса */}
      <TodayProgress totalTasks={totalTasks} doneToday={doneToday} />

      {/* Задачи на сегодня */}
      <View style={styles.tasksHead}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>Задачи на сегодня</Text>
        <Pressable onPress={goActivity}>
          <Text style={[styles.viewAll, { color: c.muted }]}>Смотреть все</Text>
        </Pressable>
      </View>

      <View style={styles.chipsRow}>
        <Chip count={todoCount} label="К выполнению" active onPress={goActivity} />
        <Chip count={doneToday} label="Готово" onPress={goActivity} />
        <Chip count={totalTasks} label="Всего" onPress={goActivity} />
      </View>

      {/* Выделенная задача */}
      {featured ? (
        <Pressable
          onPress={goActivity}
          style={({ pressed }) => [
            styles.featured,
            { backgroundColor: c.cardElevated, borderColor: c.border, opacity: pressed ? 0.9 : 1 },
          ]}>
          <View style={styles.featuredTop}>
            <View style={[styles.priorityBadge, { backgroundColor: c.cardHover }]}>
              <View style={[styles.priorityDot, { backgroundColor: c.danger }]} />
              <Text style={[styles.priorityText, { color: c.text }]}>Приоритет</Text>
            </View>
            <View style={[styles.arrowBtn, { backgroundColor: c.lime }]}>
              <Ionicons name="arrow-forward" size={16} color="#0A0A0B" />
            </View>
          </View>
          <Text style={[styles.featuredTitle, { color: c.text }]} numberOfLines={2}>
            {featured.name}
          </Text>
          <View style={styles.featuredFoot}>
            <Ionicons name="time-outline" size={15} color={c.muted} />
            <Text style={[styles.featuredTime, { color: c.muted }]}>Сегодня · ещё {todoCount} задач</Text>
          </View>
        </Pressable>
      ) : (
        <Pressable
          onPress={goActivity}
          style={({ pressed }) => [
            styles.emptyCard,
            { borderColor: c.border, backgroundColor: c.card, opacity: pressed ? 0.9 : 1 },
          ]}>
          <Ionicons name="checkmark-done-circle-outline" size={22} color={c.lime} />
          <Text style={[styles.emptyText, { color: c.text }]}>
            {totalTasks > 0 ? 'Все задачи на сегодня выполнены 🎉' : 'Добавить первую задачу'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 18, marginBottom: 6 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarLetter: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  greeting: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  name: { fontSize: 17, fontFamily: 'Inter_700Bold', letterSpacing: -0.3, maxWidth: 180 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addBtn: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: { position: 'absolute', top: 11, right: 12, width: 7, height: 7, borderRadius: 4 },
  bigTitle: { fontSize: 30, fontFamily: 'Inter_700Bold', letterSpacing: -0.8, lineHeight: 36 },
  tasksHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
  viewAll: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  chipsRow: { flexDirection: 'row', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipCount: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  chipCountText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  chipLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  featured: {
    borderRadius: WebTheme.radiusLg,
    borderWidth: 1,
    padding: 18,
    gap: 12,
    ...WebTheme.shadowSoft,
  },
  featuredTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priorityBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999 },
  priorityDot: { width: 7, height: 7, borderRadius: 4 },
  priorityText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  arrowBtn: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  featuredTitle: { fontSize: 19, fontFamily: 'Inter_700Bold', letterSpacing: -0.4, lineHeight: 24 },
  featuredFoot: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  featuredTime: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: WebTheme.radiusLg,
    borderWidth: 1,
    padding: 18,
  },
  emptyText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', flex: 1 },
});
