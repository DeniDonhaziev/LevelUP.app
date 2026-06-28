import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ActivityTaskRow } from '@/components/ActivityTaskRow';
import { HomeHero } from '@/components/home/HomeHero';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useAppTopic } from '@/hooks/useAppTopic';
import { MONTHS_RU, MONTHS_SHORT_RU, todayKey } from '@/lib/date';
import { buildCalendarCells, monthAchievementStats } from '@/lib/calendarUi';
import {
  allTasksDoneToday,
  calculateStreak,
  getMomentumPercent,
  isDayMarkedAchievement,
} from '@/lib/trackerLogic';
import { useTrackerStore, useUserData } from '@/store/trackerStore';
import { WebTheme } from '@/lib/theme';
import { ScreenScroll } from '@/components/ui/ScreenScroll';
import { SectionTitle } from '@/components/ui/SectionTitle';

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 1100;
  const c = useThemeColors();
  const topic = useAppTopic();
  const data = useUserData();
  const syncNewDay = useTrackerStore((s) => s.syncNewDay);
  const addTaskByName = useTrackerStore((s) => s.addTaskByName);
  const addTask = useTrackerStore((s) => s.addTask);
  const toggleTask = useTrackerStore((s) => s.toggleTask);
  const deleteTask = useTrackerStore((s) => s.deleteTask);
  const markDayAsAchievement = useTrackerStore((s) => s.markDayAsAchievement);
  const markAllTasksToday = useTrackerStore((s) => s.markAllTasksToday);
  const getStepsToday = useTrackerStore((s) => s.getStepsToday);

  const [newTask, setNewTask] = useState('');
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const entrance = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      syncNewDay();
    }, [syncNewDay])
  );

  const streak = data ? calculateStreak(data) : 0;
  const momentum = data ? getMomentumPercent(data) : 0;
  const today = todayKey();
  const now = new Date();
  const monthKeyCur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const achievedDays = data ? (data.monthAchievements[monthKeyCur] || []).length : 0;
  const daysInCurMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const ringPct = daysInCurMonth ? achievedDays / daysInCurMonth : 0;
  const monthProgressPct = Math.round(ringPct * 100);

  const doneToday = data ? (data.dailyDone[today] || []).length : 0;
  const totalTasks = data?.tasks?.length ?? 0;

  const todayBadge = `${now.getDate()} ${MONTHS_SHORT_RU[now.getMonth()]} ${now.getFullYear()}`;
  const allTasks = data?.tasks || [];
  const border = c.border;
  const hoverBg = c.cardHover;
  const taskRowPalette = {
    text: c.text,
    muted: c.muted,
    border,
    cardBg: c.card,
    accentDone: c.accent,
  };

  const calendarCells = useMemo(() => {
    const t = todayKey();
    return buildCalendarCells(viewYear, viewMonth, data, t);
  }, [viewYear, viewMonth, data]);

  const { achieved: calAchieved, daysInMonth: calDays } = monthAchievementStats(data, viewYear, viewMonth);

  const dayMarked = data ? isDayMarkedAchievement(data, today) : false;
  const allDone = data ? allTasksDoneToday(data) : true;

  // Просмотр целей за выбранный день
  const tasksById = new Map((data?.tasks || []).map((t) => [t.id, t.name]));
  const selectedDoneIds = selectedDay ? data?.dailyDone[selectedDay] || [] : [];
  const selectedDoneNames = selectedDoneIds.map((id) => tasksById.get(id) || 'Удалённая цель');
  const selectedMarked = selectedDay && data ? isDayMarkedAchievement(data, selectedDay) : false;
  function fmtDay(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    return `${d} ${MONTHS_RU[(m || 1) - 1]} ${y}`;
  }
  function yesterdayKey(): string {
    const dt = new Date();
    dt.setDate(dt.getDate() - 1);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }

  function dayStatusText() {
    if (!data) return '';
    if (dayMarked) return 'Сегодня вы уже отметили день — он засчитан в достижениях.';
    if (totalTasks === 0)
      return 'Нажмите кнопку, когда день прошёл удачно — он засчитается в достижениях.';
    if (allDone) return 'Все задачи выполнены. День можно отметить как прошедший удачно.';
    return `Сделано: ${doneToday} из ${totalTasks}. Можете отметить день как прошедший удачно.`;
  }

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 480,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  return (
    <ScreenScroll nestedScrollEnabled withMobileGrowFix={!isDesktopWeb}>
      <Animated.View
        style={{
          opacity: entrance,
          transform: [
            {
              translateY: entrance.interpolate({
                inputRange: [0, 1],
                outputRange: [16, 0],
              }),
            },
          ],
        }}>
      <HomeHero
        data={data}
        streak={streak}
        momentum={momentum}
        monthProgressPct={monthProgressPct}
        doneToday={doneToday}
        totalTasks={totalTasks}
        achievedDays={achievedDays}
      />

      </Animated.View>

      <SectionTitle title="Активности" subtitle={todayBadge} />

      {!totalTasks ? (
        <View style={styles.quickRow}>
          {topic.defaultTasks.map((name) => (
            <Pressable
              key={name}
              onPress={() => addTaskByName(name)}
              style={[styles.quickBtn, { borderColor: c.accent + '44', backgroundColor: c.card }]}>
              <Text style={{ color: c.text, fontSize: 13, fontFamily: 'Inter_500Medium' }}>+ {name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <TextInput
        style={[
          styles.input,
          {
            color: c.text,
            borderColor: border,
            backgroundColor: c.card,
            fontFamily: 'Inter_400Regular',
          },
        ]}
        placeholder="+ Добавить активность"
        placeholderTextColor={c.muted}
        value={newTask}
        onChangeText={setNewTask}
        onSubmitEditing={() => {
          addTask(newTask);
          setNewTask('');
        }}
        maxLength={80}
      />

      {allTasks.map((task) => (
        <ActivityTaskRow
          key={task.id}
          taskId={task.id}
          name={task.name}
          done={(data?.dailyDone[today] || []).includes(task.id)}
          palette={taskRowPalette}
          onToggle={toggleTask}
          onDelete={deleteTask}
        />
      ))}

      <SectionTitle title="Достижения за месяц" subtitle={`Дней с достижениями: ${calAchieved} из ${calDays}`} />
      <View style={styles.monthNav}>
        <Pressable
          onPress={() => {
            let m = viewMonth - 1;
            let y = viewYear;
            if (m < 0) {
              m = 11;
              y--;
            }
            setViewMonth(m);
            setViewYear(y);
          }}
          style={[styles.monthBtn, { backgroundColor: hoverBg, borderColor: border }]}>
          <Text style={{ color: c.text, fontSize: 20 }}>‹</Text>
        </Pressable>
        <Text style={{ color: c.text, fontFamily: 'Inter_600SemiBold', fontSize: 17 }}>
          {MONTHS_RU[viewMonth]} {viewYear}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Pressable
            onPress={() => {
              const n = new Date();
              setViewMonth(n.getMonth());
              setViewYear(n.getFullYear());
            }}
            style={[styles.todayBtn, { borderColor: border, backgroundColor: hoverBg }]}>
            <Text style={{ color: c.text, fontSize: 13 }}>Сегодня</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              let m = viewMonth + 1;
              let y = viewYear;
              if (m > 11) {
                m = 0;
                y++;
              }
              setViewMonth(m);
              setViewYear(y);
            }}
            style={[styles.monthBtn, { backgroundColor: hoverBg, borderColor: border }]}>
            <Text style={{ color: c.text, fontSize: 20 }}>›</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.weekdayRow}>
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((w) => (
          <Text key={w} style={[styles.wd, { color: c.muted }]}>
            {w}
          </Text>
        ))}
      </View>
      <View style={styles.calGrid}>
        {calendarCells.map((cell) => (
          <Pressable
            key={cell.dateStr + '-' + cell.day + (cell.otherMonth ? '-o' : '')}
            onPress={() => setSelectedDay(cell.dateStr)}
            style={({ pressed }) => [
              styles.calCell,
              {
                borderColor: border,
                backgroundColor: cell.achievement
                  ? c.accentSoft
                  : cell.missed
                    ? 'rgba(248, 113, 113, 0.12)'
                    : c.cardElevated,
                opacity: cell.otherMonth ? 0.4 : pressed ? 0.7 : 1,
              },
              cell.isToday && { borderColor: c.accent, borderWidth: 2 },
              cell.dateStr === selectedDay && { borderColor: c.text, borderWidth: 2 },
            ]}>
            <Text
              style={{
                color: c.text,
                fontSize: 13,
                fontFamily: cell.isToday || cell.achievement ? 'Inter_600SemiBold' : 'Inter_400Regular',
              }}>
              {cell.day}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Цели за выбранный день */}
      <View style={[styles.dayGoals, { borderColor: border, backgroundColor: c.cardElevated }]}>
        <View style={styles.dayGoalsHead}>
          <Text style={{ color: c.text, fontFamily: 'Inter_700Bold', fontSize: 15 }}>
            {selectedDay ? `Цели за ${fmtDay(selectedDay)}` : 'Цели за день'}
          </Text>
          <Pressable
            onPress={() => setSelectedDay(yesterdayKey())}
            style={[styles.yBtn, { borderColor: c.border, backgroundColor: c.cardHover }]}>
            <Text style={{ color: c.text, fontSize: 13, fontFamily: 'Inter_500Medium' }}>Вчера</Text>
          </Pressable>
        </View>
        {!selectedDay ? (
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19 }}>
            Нажмите на день в календаре (или «Вчера»), чтобы увидеть выполненные цели.
          </Text>
        ) : selectedDoneNames.length === 0 ? (
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19 }}>
            В этот день выполненных целей нет{selectedMarked ? ', но день отмечен как удачный ✓' : '.'}
          </Text>
        ) : (
          <>
            <Text style={{ color: c.muted, fontSize: 12, marginBottom: 8 }}>
              Выполнено: {selectedDoneNames.length}
              {selectedMarked ? ' · день отмечен ✓' : ''}
            </Text>
            {selectedDoneNames.map((name, i) => (
              <View key={i} style={styles.dayGoalRow}>
                <Ionicons name="checkmark-circle" size={18} color={c.accent} />
                <Text style={{ color: c.text, fontSize: 14, flex: 1 }} numberOfLines={2}>
                  {name}
                </Text>
              </View>
            ))}
          </>
        )}
      </View>

      <View style={[styles.markBlock, { borderColor: border, backgroundColor: c.cardElevated }]}>
        <Text style={{ color: c.muted, marginBottom: 12, lineHeight: 20 }}>{dayStatusText()}</Text>
        {!dayMarked && totalTasks > 0 && !allDone ? (
          <Pressable
            onPress={() => markAllTasksToday()}
            style={[styles.markDayBtn, { backgroundColor: c.cardElevated, borderWidth: 1, borderColor: c.border, marginBottom: 10 }]}>
            <Text style={[styles.markDayBtnText, { color: c.text }]}>Отметить все задачи ✓</Text>
          </Pressable>
        ) : null}
        <Pressable
          disabled={dayMarked}
          onPress={() => markDayAsAchievement()}
          style={[
            styles.markDayBtn,
            {
              backgroundColor: dayMarked ? c.cardElevated : c.accent,
              borderWidth: dayMarked ? 1 : 0,
              borderColor: c.border,
              opacity: dayMarked ? 0.85 : 1,
            },
          ]}>
          <Text style={[styles.markDayBtnText, { color: dayMarked ? c.muted : c.onAccent }]}>
            {dayMarked ? 'День отмечен ✓' : 'День прошёл удачно ✓'}
          </Text>
        </Pressable>
    </View>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 120 },
  /** Без flexGrow вертикальный ScrollView на телефоне не раздувает контент на высоту экрана «пустотой». */
  scrollMobile: { flexGrow: 0 },
  scrollDesktop: {
    width: '100%',
    maxWidth: 1220,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  overviewRow: { width: '100%' },
  overviewRowDesktop: { flexDirection: 'row', gap: 14, alignItems: 'stretch' },
  overviewMain: { width: '100%' },
  overviewMainDesktop: { flex: 1.6 },
  overviewSide: { width: '100%' },
  overviewSideDesktop: { flex: 1 },
  desktopBoard: { width: '100%' },
  desktopBoardOn: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  desktopBoardMobile: { flexShrink: 0 },
  /** На телефоне не задаём flex:1 — внутри ScrollView это раздувает блок и «съедает» экран под пустоту. */
  desktopCenter: { width: '100%' },
  desktopCenterOn: { flex: 1, minWidth: 0 },
  desktopAside: { width: 240, gap: 12 },
  sideCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 12,
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  sideTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', marginBottom: 8 },
  sideRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  helloCard: {
    borderRadius: 26,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    ...WebTheme.shadowSoft,
  },
  helloTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  helloCaption: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  helloTitle: { fontSize: 36, lineHeight: 40, fontFamily: 'Inter_700Bold', letterSpacing: -1.2, marginTop: 3 },
  helloSub: { marginTop: 4, fontSize: 18, lineHeight: 23, fontFamily: 'Inter_500Medium' },
  helloPillsRow: { marginTop: 14, flexDirection: 'row', gap: 8 },
  helloPill: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  helloPillLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  helloPillValue: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  progressCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    backgroundColor: '#D8FF2D',
    ...WebTheme.shadowSoft,
  },
  progressHead: { marginBottom: 10 },
  progressPct: { color: '#111827', fontSize: 42, lineHeight: 44, fontFamily: 'Inter_700Bold', letterSpacing: -1.1 },
  progressHint: { marginTop: 2, fontSize: 13, fontFamily: 'Inter_500Medium' },
  progressRow: { flexDirection: 'row', gap: 8 },
  progressMini: { flex: 1, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 10 },
  progressMiniLabel: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  progressMiniValue: { marginTop: 3, fontSize: 15, fontFamily: 'Inter_700Bold' },
  activityBlueCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
    backgroundColor: '#125BFF',
    ...WebTheme.shadowSoft,
  },
  activityBlueHead: { marginBottom: 10 },
  activityBlueTitle: { color: 'rgba(255,255,255,0.82)', fontSize: 13, fontFamily: 'Inter_500Medium' },
  activityBlueCount: { color: '#FFFFFF', fontSize: 28, lineHeight: 32, fontFamily: 'Inter_700Bold', marginTop: 2 },
  activityBars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', minHeight: 64, paddingHorizontal: 2 },
  activityBar: { width: 16, borderRadius: 10 },
  headerRow: { alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  topActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...WebTheme.shadowSoft,
  },
  brandTitle: { fontSize: 34, lineHeight: 38, fontFamily: 'Inter_700Bold', letterSpacing: -1.2 },
  brandSub: { fontSize: 14, fontFamily: 'Inter_500Medium', textAlign: 'center', marginTop: 4, lineHeight: 20, opacity: 0.8 },
  titleWrap: { gap: 2, justifyContent: 'center' },
  todayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  todayChipText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  greetingLine: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  usernameLine: { fontSize: 20, fontFamily: 'Inter_700Bold', marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  streakBadgeIcon: { fontSize: 13 },
  streakBadgeText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(60,60,67,0.12)',
  },
  avatarImage: { width: 46, height: 46, borderRadius: 23 },
  avatarText: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  pillsRow: { marginBottom: 20 },
  pillsContent: { paddingVertical: 4, gap: 8 },
  /** На телефоне не вкладываем второй ScrollView — только ряд с переносом. */
  pillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 4 },
  pill: {
    minWidth: 56,
    height: 64,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  pillActive: { transform: [{ scale: 1.02 }] },
  pillDay: { fontSize: 19, fontFamily: 'Inter_700Bold' },
  cardEyebrow: { fontSize: 23, fontFamily: 'Inter_700Bold' },
  heroCard: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(60,60,67,0.12)',
    padding: 16,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
  },
  heroHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  goalHint: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  /** Кольцо по центру карточки; текст под ним */
  ringSection: {
    marginTop: 8,
    width: '100%',
    alignItems: 'stretch',
    writingDirection: 'ltr',
  },
  /** Ряд на всю ширину: шкала строго по центру */
  ringCenterRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  /** Фиксированный квадрат — кольцо не «плывёт» по верстке */
  ringWrap: {
    width: 156,
    height: 156,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  heroStats: {
    width: '100%',
    marginTop: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  macroRow: { flexDirection: 'row', gap: 8, marginTop: 14, alignItems: 'stretch' },
  macroCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 76,
  },
  macroLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  macroValue: { fontSize: 16, fontFamily: 'Inter_700Bold', marginTop: 2, textAlign: 'center' },
  grid3: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  actCard: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    minHeight: 120,
    shadowColor: '#1C1C1E',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 4,
  },
  actEmoji: { fontSize: 22, marginBottom: 4 },
  actVal: { fontSize: 18, fontFamily: 'Inter_700Bold', marginTop: 4 },
  pedoBtn: { marginTop: 8, paddingHorizontal: 8, paddingVertical: 6, borderRadius: WebTheme.radiusSm, borderWidth: 1 },
  sectionTitle: { fontSize: 29, fontFamily: 'Inter_700Bold', marginBottom: 10 },
  todayBadge: { fontSize: 13, fontFamily: 'Inter_500Medium', marginBottom: 8 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  quickBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  progressChip: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 14,
  },
  progressChipHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    minWidth: 6,
  },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 12, fontSize: 15 },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#1C1C1E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: '#000', fontFamily: 'Inter_700Bold', fontSize: 14 },
  taskName: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  taskNameDone: { textDecorationLine: 'line-through', opacity: 0.5 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  monthBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: WebTheme.radiusSm,
    borderWidth: 1,
  },
  todayBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: WebTheme.radiusSm, borderWidth: 1 },
  weekdayRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 6 },
  wd: { width: 36, textAlign: 'center', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: {
    width: '14.285%',
    aspectRatio: 1,
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markBlock: { marginTop: 16, padding: 20, borderRadius: 22, borderWidth: 1 },
  markDayBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  markDayBtnText: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  dayGoals: { marginTop: 12, padding: 16, borderRadius: 18, borderWidth: 1, gap: 4 },
  dayGoalsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  yBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  dayGoalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
});
