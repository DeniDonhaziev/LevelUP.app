import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { RingProgress } from '@/components/RingProgress';
import { LevelCard } from '@/components/home/LevelCard';
import { useThemeColors } from '@/hooks/useThemeColors';
import { todayKey } from '@/lib/date';
import { WebTheme } from '@/lib/theme';
import { isDayMarkedAchievement } from '@/lib/trackerLogic';
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

const WEEK_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function dayActivityLevel(data: UserData | null, iso: string): number {
  if (!data) return 0;
  if (isDayMarkedAchievement(data, iso)) return 3;
  const done = (data.dailyDone[iso] || []).length;
  if (done >= 2) return 3;
  if (done >= 1) return 1;
  return 0;
}

function DashCard({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: object;
  onPress?: () => void;
}) {
  const c = useThemeColors();
  const inner = (
    <View style={[styles.dashCard, { backgroundColor: c.card, borderColor: c.border }, style]}>
      {children}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1, flex: 1 }]}>
        {inner}
      </Pressable>
    );
  }
  return inner;
}

export function HomeHero({
  data,
  streak,
  momentum,
  monthProgressPct,
  doneToday,
  totalTasks,
  achievedDays,
}: Props) {
  const c = useThemeColors();
  const user = useTrackerStore((s) => s.currentUser);
  const avatarUri = useTrackerStore((s) => selectAvatarDisplayUri(s));
  const clanId = useTrackerStore((s) =>
    s.currentUser ? s.userData[s.currentUser]?.clanId ?? null : null
  );
  const clanMembers = useTrackerStore((s) =>
    clanId ? s.clanMembersByClanId[clanId]?.length ?? 0 : 0
  );

  const today = todayKey();
  const level = Math.max(1, Math.floor(streak / 5) + Math.floor(achievedDays / 8));
  const points = (streak * 273 + achievedDays * 150 + doneToday * 50).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const handle = user
    ? `@${user.toLowerCase().replace(/\s+/g, '.').slice(0, 22)}`
    : '@guest';
  const distanceKm = ((data?.totalRunMeters ?? 0) / 1000).toFixed(1);

  const weekDays = useMemo(() => {
    const now = new Date();
    const offset = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - offset);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso =
        d.getFullYear() +
        '-' +
        String(d.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(d.getDate()).padStart(2, '0');
      return {
        label: WEEK_EN[i],
        day: d.getDate(),
        iso,
        isToday: iso === today,
        activity: dayActivityLevel(data, iso),
      };
    });
  }, [data, today]);

  const streakMarks = Math.min(streak, 5);

  return (
    <View style={styles.root}>
      {/* Toolbar как на макете */}
      <View style={styles.toolbar}>
        <View style={styles.toolbarLeft}>
          <Pressable
            onPress={() => router.push('/(tabs)/profile')}
            style={[styles.toolBtn, { backgroundColor: c.card, borderColor: c.border }]}>
            <Ionicons name="settings-outline" size={20} color={c.text} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/(tabs)/profile')}
            style={[styles.toolBtn, { backgroundColor: c.card, borderColor: c.border }]}>
            <Ionicons name="notifications-outline" size={20} color={c.text} />
            <View style={[styles.bellDot, { backgroundColor: c.accent }]} />
          </Pressable>
        </View>
        <View style={[styles.pointsBar, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={[styles.pointsIcon, { backgroundColor: c.accentSoft }]}>
            <Ionicons name="logo-bitcoin" size={16} color={c.accent} />
          </View>
          <Text style={[styles.pointsValue, { color: c.text }]}>{points}</Text>
          <Pressable style={[styles.pointsAdd, { backgroundColor: c.accent }]}>
            <Ionicons name="add" size={18} color={c.onAccent} />
          </Pressable>
        </View>
      </View>

      {/* Карта пользователя — как на финанс-дизайне */}
      <LevelCard user={user || 'Гость'} level={level} points={points} streak={streak} distanceKm={distanceKm} />

      {/* Профиль по центру */}
      <View style={styles.profile}>
        <View style={[styles.avatarRing, { borderColor: c.accent }]}>
          <View style={[styles.avatarInner, { backgroundColor: c.cardHover }]}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
            ) : (
              <Text style={[styles.avatarLetter, { color: c.text }]}>
                {(user || '?').charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
        </View>
        <Text style={[styles.profileName, { color: c.text }]}>{user || 'Гость'}</Text>
        <Text style={[styles.profileHandle, { color: c.muted }]}>{handle}</Text>
      </View>

      {/* Win/Lose · Level · Days */}
      <View style={styles.metrics}>
        <View style={styles.metric}>
          <View style={[styles.metricIcon, { backgroundColor: c.card }]}>
            <RingProgress
              progress={momentum / 100}
              size={26}
              strokeWidth={3}
              color={c.accent}
              trackColor="rgba(255,255,255,0.15)"
              centerColor="transparent"
            />
          </View>
          <Text style={[styles.metricValue, { color: c.text }]}>{momentum}%</Text>
          <Text style={[styles.metricLabel, { color: c.muted }]}>Win/Lose</Text>
        </View>
        <View style={styles.metric}>
          <View style={[styles.metricIcon, { backgroundColor: c.card }]}>
            <Ionicons name="shield-checkmark" size={20} color={c.accent} />
          </View>
          <Text style={[styles.metricValue, { color: c.text }]}>{level}</Text>
          <Text style={[styles.metricLabel, { color: c.muted }]}>Level</Text>
        </View>
        <View style={styles.metric}>
          <View style={[styles.metricIcon, { backgroundColor: c.card }]}>
            <Ionicons name="calendar-outline" size={20} color={c.accent} />
          </View>
          <Text style={[styles.metricValue, { color: c.text }]}>{streak}</Text>
          <Text style={[styles.metricLabel, { color: c.muted }]}>Days</Text>
        </View>
      </View>

      {/* Неделя — горизонтальные пill-карточки */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.weekScroll}>
        {weekDays.map((d) => (
          <View
            key={d.iso}
            style={[
              styles.weekPill,
              { backgroundColor: c.card, borderColor: d.isToday ? c.accent : c.border },
              d.isToday && styles.weekPillActive,
            ]}>
            <View style={styles.weekDotsRow}>
              {(d.isToday ? [0, 1, 2] : [0]).map((i) => (
                <View
                  key={i}
                  style={[
                    styles.weekDot,
                    {
                      backgroundColor:
                        d.isToday && i < d.activity
                          ? c.accent
                          : d.isToday
                            ? 'rgba(255,255,255,0.2)'
                            : d.activity
                              ? c.muted
                              : 'rgba(255,255,255,0.15)',
                    },
                  ]}
                />
              ))}
            </View>
            <Text style={[styles.weekPillDay, { color: c.muted }]}>{d.label}</Text>
            <Text style={[styles.weekPillNum, { color: c.text }]}>{d.day}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Friends + Keep it up */}
      <View style={styles.row2}>
        <DashCard onPress={() => router.push('/(tabs)/clans')}>
          <View style={styles.friendsStack}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[
                  styles.friendAvatar,
                  {
                    backgroundColor: c.cardHover,
                    borderColor: c.background,
                    marginLeft: i ? -10 : 0,
                    zIndex: 3 - i,
                  },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.cardHeading, { color: c.text }]}>Friends</Text>
          <Text style={[styles.cardCaption, { color: c.muted }]}>
            {clanMembers > 0 ? `${clanMembers} online` : 'Join clan'}
          </Text>
        </DashCard>

        <DashCard>
          <Text style={[styles.cardHeading, { color: c.text }]}>Keep it up!</Text>
          <Text style={[styles.cardCaption, { color: c.muted }]}>
            {streak > 0
              ? `${streak} days in a row you are here!`
              : 'Start your streak today'}
          </Text>
          <View style={styles.keepRow}>
            <View style={styles.keepDots}>
              {[0, 1, 2, 3, 4].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.keepDot,
                    { backgroundColor: i < streakMarks ? c.accent : 'rgba(255,255,255,0.12)' },
                  ]}>
                  {i === streakMarks - 1 && streakMarks > 0 ? (
                    <Ionicons name="checkmark" size={8} color={c.onAccent} />
                  ) : null}
                </View>
              ))}
            </View>
            <Ionicons name="trophy" size={36} color={c.accent} />
          </View>
        </DashCard>
      </View>

      {/* Широкий баннер задач */}
      <DashCard style={styles.taskWide}>
        <View style={styles.taskWideInner}>
          <View style={styles.taskArt}>
            <View style={[styles.coinStack, { backgroundColor: c.accentSoft }]}>
              <Ionicons name="layers" size={28} color={c.accent} />
            </View>
          </View>
          <View style={styles.taskCopy}>
            <Text style={[styles.taskTitle, { color: c.text }]}>Complete new tasks</Text>
            <Text style={[styles.taskDesc, { color: c.muted }]}>
              {doneToday}/{totalTasks || 0} today · {monthProgressPct}% of month. Bonuses for daily
              goals.
            </Text>
          </View>
        </View>
      </DashCard>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 18, marginBottom: 6 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  toolbarLeft: { flexDirection: 'row', gap: 8 },
  toolBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  pointsBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingLeft: 6,
    paddingRight: 5,
    paddingVertical: 5,
    gap: 8,
    maxWidth: 220,
  },
  pointsIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointsValue: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.2,
  },
  pointsAdd: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profile: { alignItems: 'center', gap: 6 },
  avatarRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    width: 94,
    height: 94,
    borderRadius: 47,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarLetter: { fontSize: 36, fontFamily: 'Inter_700Bold' },
  profileName: { fontSize: 22, fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
  profileHandle: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  metrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  metric: { flex: 1, alignItems: 'center', gap: 6 },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  metricLabel: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  weekScroll: { gap: 8, paddingVertical: 2 },
  weekPill: {
    width: 56,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 4,
  },
  weekPillActive: { borderWidth: 1.5 },
  weekDotsRow: { flexDirection: 'row', gap: 3, height: 6, alignItems: 'center' },
  weekDot: { width: 4, height: 4, borderRadius: 2 },
  weekPillDay: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  weekPillNum: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  row2: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  dashCard: {
    flex: 1,
    borderRadius: WebTheme.radiusLg,
    borderWidth: 1,
    padding: 14,
    minHeight: 130,
  },
  friendsStack: { flexDirection: 'row', marginBottom: 12 },
  friendAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
  },
  cardHeading: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  cardCaption: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 4, lineHeight: 16 },
  keepRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  keepDots: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  keepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskWide: { flex: undefined, minHeight: undefined, padding: 0 },
  taskWideInner: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  taskArt: { width: 72, alignItems: 'center' },
  coinStack: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskCopy: { flex: 1 },
  taskTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', letterSpacing: -0.2 },
  taskDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 6, lineHeight: 17 },
});
