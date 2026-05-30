import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Image,
  Platform,
  useWindowDimensions,
} from 'react-native';

import { ActivityTaskRow } from '@/components/ActivityTaskRow';
import { RingProgress } from '@/components/RingProgress';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useAppTopic } from '@/hooks/useAppTopic';
import { confirmDelete } from '@/lib/confirmAction';
import { MONTHS_RU, MONTHS_SHORT_RU, todayKey } from '@/lib/date';
import { buildCalendarCells, monthAchievementStats } from '@/lib/calendarUi';
import {
  allTasksDoneToday,
  calculateStreak,
  getMomentumPercent,
  isDayMarkedAchievement,
} from '@/lib/trackerLogic';
import { selectAvatarDisplayUri, useTrackerStore, useUserData } from '@/store/trackerStore';
import { useDevicePedometer } from '@/hooks/useDevicePedometer';
import { WebTheme } from '@/lib/theme';
import { HeroCard } from '@/components/ui/AppCard';
import { ScreenScroll } from '@/components/ui/ScreenScroll';
import { SectionTitle } from '@/components/ui/SectionTitle';

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 1100;
  const c = useThemeColors();
  const topic = useAppTopic();
  const user = useTrackerStore((s) => s.currentUser);
  const avatarDisplayUri = useTrackerStore((s) => selectAvatarDisplayUri(s));
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
  const entrance = useRef(new Animated.Value(0)).current;

  const { active: pedoActive, toggle: togglePedo } = useDevicePedometer();

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
  const statLeft = Math.max(0, totalTasks - doneToday);

  const todayBadge = `${now.getDate()} ${MONTHS_SHORT_RU[now.getMonth()]} ${now.getFullYear()}`;
  const allTasks = data?.tasks || [];
  const border = c.border;
  const cardBg = c.card;
  const hoverBg = c.cardHover;
  const taskRowPalette = {
    text: c.text,
    muted: c.muted,
    border,
    cardBg,
    accentDone: topic.tabActive,
  };

  const calendarCells = useMemo(() => {
    const t = todayKey();
    return buildCalendarCells(viewYear, viewMonth, data, t);
  }, [viewYear, viewMonth, data]);

  const { achieved: calAchieved, daysInMonth: calDays } = monthAchievementStats(data, viewYear, viewMonth);

  const dayMarked = data ? isDayMarkedAchievement(data, today) : false;
  const allDone = data ? allTasksDoneToday(data) : true;

  function dayStatusText() {
    if (!data) return '';
    if (dayMarked) return 'Сегодня вы уже отметили день — он засчитан в достижениях.';
    if (totalTasks === 0)
      return 'Нажмите кнопку, когда день прошёл удачно — он засчитается в достижениях.';
    if (allDone) return 'Все задачи выполнены. День можно отметить как прошедший удачно.';
    return `Сделано: ${doneToday} из ${totalTasks}. Можете отметить день как прошедший удачно.`;
  }

  const datePills = useMemo(() => {
    const out: { label: string; sub: string; iso: string }[] = [];
    const base = new Date();
    const weekdays = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    for (let i = 0; i <= 6; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const iso =
        d.getFullYear() +
        '-' +
        String(d.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(d.getDate()).padStart(2, '0');
      out.push({
        label: String(d.getDate()),
        sub: weekdays[d.getDay()],
        iso,
      });
    }
    return out;
  }, []);

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
      <SectionTitle
        title="LevelUp"
        subtitle={`Синхронизация ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`}
      />
      <View style={[styles.topActionsRow, { backgroundColor: c.cardElevated, borderColor: c.border }]}>
        <View style={[styles.todayChip, { backgroundColor: c.accentSoft, borderColor: c.border }]}>
          <Ionicons name="calendar-outline" size={16} color={c.text} />
          <Text style={[styles.todayChipText, { color: c.text }]}>Сегодня</Text>
          <Ionicons name="chevron-down" size={14} color={c.muted} />
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.streakBadge, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={styles.streakBadgeIcon}>🔥</Text>
            <Text style={[styles.streakBadgeText, { color: c.text }]}>{streak}</Text>
          </View>
          <View style={[styles.avatar, { backgroundColor: c.cardElevated, borderColor: c.border }]}>
            {avatarDisplayUri ? (
              <Image source={{ uri: avatarDisplayUri }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <Text style={[styles.avatarText, { color: c.text }]}>{(user || '?').charAt(0).toUpperCase()}</Text>
            )}
          </View>
        </View>
      </View>

      <View
        style={[
          styles.desktopBoard,
          isDesktopWeb && styles.desktopBoardOn,
          !isDesktopWeb && styles.desktopBoardMobile,
        ]}>
        <View style={[styles.desktopCenter, isDesktopWeb && styles.desktopCenterOn]}>
          {isDesktopWeb ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsRow} contentContainerStyle={styles.pillsContent}>
              {datePills.map((p, i) => {
                const active = i === 0;
                return (
                  <View
                    key={p.iso}
                    style={[
                      styles.pill,
                      active
                        ? { backgroundColor: c.accentSoft, borderColor: c.accent, borderWidth: 2 }
                        : { backgroundColor: c.cardElevated, borderColor: border },
                      active && styles.pillActive,
                    ]}>
                    <Text style={[styles.pillDay, { color: c.text }]}>{p.label}</Text>
                    <Text style={{ color: c.muted, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>
                      {p.sub}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <View style={[styles.pillsRow, styles.pillsWrap]}>
              {datePills.map((p, i) => {
                const active = i === 0;
                return (
                  <View
                    key={p.iso}
                    style={[
                      styles.pill,
                      active
                        ? { backgroundColor: c.accentSoft, borderColor: c.accent, borderWidth: 2 }
                        : { backgroundColor: c.cardElevated, borderColor: border },
                      active && styles.pillActive,
                    ]}>
                    <Text style={[styles.pillDay, { color: c.text }]}>{p.label}</Text>
                    <Text style={{ color: c.muted, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>
                      {p.sub}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          <View style={[styles.overviewRow, isDesktopWeb && styles.overviewRowDesktop]}>
            <View style={[styles.overviewMain, isDesktopWeb && styles.overviewMainDesktop]}>
              <HeroCard>
                <View style={styles.heroHeader}>
                  <Text style={[styles.cardEyebrow, { color: c.text }]}>Прогресс месяца</Text>
                  <View style={[styles.liveDot, { backgroundColor: c.accent }]} />
                </View>
                <View style={styles.ringSection}>
                  <View style={styles.ringCenterRow}>
                    <View style={styles.ringWrap}>
                      <RingProgress
                        progress={ringPct}
                        startAngleDeg={0}
                        size={152}
                        strokeWidth={16}
                        trackColor="rgba(148,163,184,0.18)"
                        centerColor="transparent"
                        color={c.accent}
                        centerTitle={String(monthProgressPct)}
                        centerSubtitle="%"
                      />
                    </View>
                  </View>
                  <View style={styles.heroStats}>
                    <Text style={{ color: c.muted, fontSize: 14, fontFamily: 'Inter_600SemiBold', textAlign: 'center' }}>
                      Выполнено сегодня
                    </Text>
                    <Text style={{ color: c.text, marginTop: 8, fontSize: 14, textAlign: 'center', fontFamily: 'Inter_600SemiBold' }}>
                      {doneToday}/{totalTasks || 0} задач
                    </Text>
                  </View>
                </View>
                <View style={styles.macroRow}>
                  <View style={[styles.macroCard, { borderColor: c.border, backgroundColor: c.cardElevated }]}>
                    <Text style={[styles.macroLabel, { color: c.muted }]}>Фокус</Text>
                    <Text style={[styles.macroValue, { color: c.accent }]}>{momentum}%</Text>
                  </View>
                  <View style={[styles.macroCard, { borderColor: c.border, backgroundColor: c.cardElevated }]}>
                    <Text style={[styles.macroLabel, { color: c.muted }]}>Серия</Text>
                    <Text style={[styles.macroValue, { color: c.text }]}>{streak}</Text>
                  </View>
                  <View style={[styles.macroCard, { borderColor: c.border, backgroundColor: c.cardElevated }]}>
                    <Text style={[styles.macroLabel, { color: c.muted }]}>Шаги</Text>
                    <Text style={[styles.macroValue, { color: c.text }]}>{getStepsToday().toLocaleString('ru')}</Text>
                  </View>
                </View>
              </HeroCard>
            </View>
          </View>
        </View>

        {isDesktopWeb ? (
          <View style={styles.desktopAside}>
            <View style={[styles.sideCard, { backgroundColor: cardBg, borderColor: border }]}>
              <Text style={[styles.sideTitle, { color: c.text }]}>Активности</Text>
              {allTasks.length === 0 ? (
                <Text style={{ color: c.muted, fontSize: 13 }}>Добавьте активность ниже</Text>
              ) : (
                allTasks.map((t) => (
                  <View key={t.id} style={styles.sideRow}>
                    <Ionicons name="ellipse" size={8} color={topic.tabActive} />
                    <Text style={{ color: c.text, fontSize: 13, flex: 1 }} numberOfLines={1}>
                      {t.name}
                    </Text>
                    <Pressable
                      onPress={() =>
                        confirmDelete('Удалить активность?', t.name, () => deleteTask(t.id))
                      }
                      hitSlop={8}
                      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}>
                      <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
                    </Pressable>
                  </View>
                ))
              )}
            </View>
            <View style={[styles.sideCard, { backgroundColor: cardBg, borderColor: border }]}>
              <Text style={[styles.sideTitle, { color: c.text }]}>Live map</Text>
              <Text style={{ color: c.muted, fontSize: 13 }}>{todayBadge}</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.overviewSide, isDesktopWeb && styles.overviewSideDesktop]}>
            <View style={styles.grid3}>
              <View style={[styles.actCard, { backgroundColor: cardBg, borderColor: border }]}>
                <Text style={styles.actEmoji}>👟</Text>
                <Text style={{ color: c.muted, fontSize: 12 }}>Шаги</Text>
                <Text style={[styles.actVal, { color: c.text }]}>{getStepsToday().toLocaleString('ru')}</Text>
                <Pressable onPress={togglePedo} style={[styles.pedoBtn, { borderColor: border, backgroundColor: hoverBg }]}>
                  <Text style={{ color: '#1c1c1e', fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>
                    {pedoActive ? 'Выключить' : 'Включить шагомер'}
                  </Text>
                </Pressable>
              </View>
              <View style={[styles.actCard, { backgroundColor: cardBg, borderColor: border }]}>
                <Text style={styles.actEmoji}>⏱️</Text>
                <Text style={{ color: c.muted, fontSize: 12 }}>Momentum</Text>
                <Text style={[styles.actVal, { color: c.text }]}>{momentum}%</Text>
              </View>
              <View style={[styles.actCard, { backgroundColor: cardBg, borderColor: border }]}>
                <Text style={styles.actEmoji}>🔥</Text>
                <Text style={{ color: c.muted, fontSize: 12 }}>Серия</Text>
                <Text style={[styles.actVal, { color: c.text }]}>{streak}</Text>
              </View>
            </View>
          </View>
        )}
      </View>
      </Animated.View>

      <SectionTitle title="Активности" subtitle={todayBadge} />
      <Text style={{ color: c.muted, marginBottom: 8 }}>
        Сделано: <Text style={{ color: c.accent, fontFamily: 'Inter_700Bold' }}>{doneToday}</Text> · Осталось:{' '}
        <Text style={{ fontFamily: 'Inter_700Bold', color: c.text }}>{statLeft}</Text>
      </Text>

      {!totalTasks ? (
        <View style={styles.quickRow}>
          {topic.defaultTasks.map((name) => (
            <Pressable
              key={name}
              onPress={() => addTaskByName(name)}
              style={[styles.quickBtn, { borderColor: border, backgroundColor: hoverBg }]}>
              <Text style={{ color: c.muted, fontSize: 13 }}>+ {name}</Text>
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
            backgroundColor: hoverBg,
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
          <View
            key={cell.dateStr + '-' + cell.day + (cell.otherMonth ? '-o' : '')}
            style={[
              styles.calCell,
              {
                borderColor: border,
                backgroundColor: cell.achievement
                  ? c.accentSoft
                  : cell.missed
                    ? 'rgba(248, 113, 113, 0.12)'
                    : c.cardElevated,
                opacity: cell.otherMonth ? 0.4 : 1,
              },
              cell.isToday && { borderColor: c.accent, borderWidth: 2 },
            ]}>
            <Text
              style={{
                color: c.text,
                fontSize: 13,
                fontFamily: cell.isToday || cell.achievement ? 'Inter_600SemiBold' : 'Inter_400Regular',
              }}>
              {cell.day}
            </Text>
          </View>
        ))}
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
            { backgroundColor: dayMarked ? c.cardElevated : c.accentSoft, borderWidth: dayMarked ? 0 : 1, borderColor: c.accent, opacity: dayMarked ? 0.85 : 1 },
          ]}>
          <Text style={[styles.markDayBtnText, { color: dayMarked ? c.muted : c.text }]}>
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
    borderWidth: 1,
  },
  brandTitle: { fontSize: 34, lineHeight: 38, fontFamily: 'Inter_700Bold', letterSpacing: -1.2 },
  brandSub: { fontSize: 14, fontFamily: 'Inter_500Medium', textAlign: 'center', marginTop: 4, lineHeight: 20, opacity: 0.8 },
  titleWrap: { gap: 2, justifyContent: 'center' },
  todayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
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
    borderWidth: 1,
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
    borderRadius: 16,
    borderWidth: 1,
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
  input: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 12, fontSize: 16 },
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
});
