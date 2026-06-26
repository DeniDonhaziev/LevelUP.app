import { useEffect } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { GroupedSection } from '@/components/ui/GroupedSection';
import { ScreenScroll } from '@/components/ui/ScreenScroll';
import { TabScreenHeader } from '@/components/ui/TabScreenHeader';
import { useThemeColors } from '@/hooks/useThemeColors';
import { buildRunnerRanking, formatLength } from '@/lib/trackerLogic';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { loadRunnerLeaderboard, deleteRunnerStat } from '@/lib/firebase/runnerSync';
import { loadCyclistLeaderboard, deleteCyclistStat } from '@/lib/firebase/cyclistSync';
import { isCurrentUserAdmin } from '@/lib/admin';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useState } from 'react';
import { useTrackerStore } from '@/store/trackerStore';

function confirmDelete(name: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' ? window.confirm(`Удалить ${name} из рейтинга?`) : false);
  }
  return new Promise((resolve) => {
    Alert.alert('Удалить из рейтинга?', name, [
      { text: 'Отмена', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Удалить', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

export default function StatsScreen() {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 1100;
  const c = useThemeColors();
  const user = useTrackerStore((s) => s.currentUser);
  const territories = useTrackerStore((s) => s.territories);
  const runnerLeaderboard = useTrackerStore((s) => s.runnerLeaderboard);
  const cyclistLeaderboard = useTrackerStore((s) => s.cyclistLeaderboard);
  const userDataMap = useTrackerStore((s) => s.userData);
  const setRunnerLeaderboard = useTrackerStore((s) => s.setRunnerLeaderboard);
  const setCyclistLeaderboard = useTrackerStore((s) => s.setCyclistLeaderboard);
  const admin = isCurrentUserAdmin(user);

  const [mode, setMode] = useState<'run' | 'bike'>('run');

  async function onDeleteRunner(uid: string, name: string) {
    if (!(await confirmDelete(name))) return;
    setRunnerLeaderboard(runnerLeaderboard.filter((r) => r.uid !== uid));
    try {
      await deleteRunnerStat(uid);
    } catch (e) {
      Alert.alert('Ошибка', (e as Error).message ?? 'Не удалось удалить');
    }
  }

  async function onDeleteCyclist(uid: string, name: string) {
    if (!(await confirmDelete(name))) return;
    setCyclistLeaderboard(cyclistLeaderboard.filter((r) => r.uid !== uid));
    try {
      await deleteCyclistStat(uid);
    } catch (e) {
      Alert.alert('Ошибка', (e as Error).message ?? 'Не удалось удалить');
    }
  }

  function DeleteBtn({ onPress }: { onPress: () => void }) {
    return (
      <Pressable
        onPress={onPress}
        hitSlop={8}
        style={({ pressed }) => [styles.delBtn, { borderColor: c.danger, opacity: pressed ? 0.6 : 1 }]}>
        <Ionicons name="trash-outline" size={14} color={c.danger} />
      </Pressable>
    );
  }

  // Подгружаем общие рейтинги при открытии экрана (на случай, если слушатель ещё не успел)
  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    let cancelled = false;
    void loadRunnerLeaderboard().then((list) => {
      if (!cancelled && list.length) setRunnerLeaderboard(list);
    });
    void loadCyclistLeaderboard().then((list) => {
      if (!cancelled && list.length) setCyclistLeaderboard(list);
    });
    return () => {
      cancelled = true;
    };
  }, [setRunnerLeaderboard, setCyclistLeaderboard]);

  // Рейтинг велосипедистов
  const cyclistRows = [...cyclistLeaderboard]
    .sort((a, b) => (b.totalBikeMeters || 0) - (a.totalBikeMeters || 0))
    .map((s, idx) => ({
      id: s.uid,
      rank: idx + 1,
      name: s.username || s.uid,
      distance: formatLength(s.totalBikeMeters || 0),
      rides: s.totalRides || 0,
    }));

  const ranking = buildRunnerRanking(runnerLeaderboard, userDataMap, territories);
  const runLeader = ranking[0]?.username;
  const roadsLeader = [...ranking].sort((a, b) => b.roads - a.roads)[0]?.username;

  const tableRows = ranking.map((item, idx) => {
    const data = userDataMap[item.username];
    const totalSteps = data ? Object.values(data.dailySteps || {}).reduce((sum, n) => sum + (n || 0), 0) : 0;
    const avgQuality =
      item.roads > 0 ? Math.min(100, Math.round(item.totalRunMeters / item.roads / 50)) : 0;
    return {
      id: item.key,
      rank: idx + 1,
      name: item.username,
      role: idx === 0 ? 'Top Runner' : idx <= 2 ? 'Pro Runner' : 'Runner',
      roads: item.roads,
      distance: formatLength(item.totalRunMeters),
      runs: item.totalRuns,
      avgQuality,
      steps: totalSteps,
      tags: [
        item.username === runLeader ? '🏃 Лидер по пробегу' : null,
        item.username === roadsLeader ? '🏆 Больше дорог' : null,
      ].filter(Boolean) as string[],
    };
  });

  return (
    <ScreenScroll>
      <TabScreenHeader
        title={mode === 'bike' ? 'Рейтинг велосипедистов' : 'Рейтинг бегунов'}
        subtitle="Таблица лидеров GPS"
      />
      <View style={{ marginBottom: 14 }}>
        <SegmentedControl
          value={mode}
          onChange={(k) => setMode(k as 'run' | 'bike')}
          options={[
            { key: 'run', label: '🏃 Бег' },
            { key: 'bike', label: '🚴 Велосипед' },
          ]}
        />
      </View>
      {mode === 'bike' ? (
        <GroupedSection title="Велолидеры">
          <View style={styles.mobileList}>
            <View style={styles.tableHeadRow}>
              <Text style={[styles.tableTitle, { color: c.text }]}>Таблица велосипедистов</Text>
              <View style={[styles.monthChip, { backgroundColor: c.accentSoft }]}>
                <Text style={{ color: c.accent, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>Велозаезды GPS</Text>
              </View>
            </View>
            {cyclistRows.length === 0 ? (
              <Text style={{ color: c.muted, paddingVertical: 6 }}>Пока нет данных по велозаездам.</Text>
            ) : (
              cyclistRows.map((row) => (
                <View key={row.id} style={[styles.mobileRow, { borderColor: c.border }]}>
                  <View style={styles.mobileRowHead}>
                    <View style={styles.userCell}>
                      <View style={[styles.avatarDot, { backgroundColor: c.accentSoft, borderWidth: 1, borderColor: c.border }]}>
                        <Text style={[styles.avatarLetter, { color: c.text }]}>{row.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={[styles.userName, { color: c.text }]} numberOfLines={1}>
                        {row.rank}. {row.name}
                        {row.name === user ? ' (вы)' : ''}
                      </Text>
                    </View>
                    <Text style={[styles.tdNum, { color: c.text }]}>{row.distance}</Text>
                    {admin ? <DeleteBtn onPress={() => void onDeleteCyclist(row.id, row.name)} /> : null}
                  </View>
                  <Text style={{ color: c.muted, fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 4 }}>
                    Заездов: {row.rides}
                  </Text>
                </View>
              ))
            )}
          </View>
        </GroupedSection>
      ) : isDesktopWeb ? (
        <View style={[styles.tableWrap, { backgroundColor: c.cardElevated, borderColor: c.border }]}>
          <View style={styles.tableHeadRow}>
            <Text style={[styles.tableTitle, { color: c.text }]}>Таблица лидеров</Text>
              <View style={[styles.monthChip, { backgroundColor: c.accentSoft }]}>
              <Text style={{ color: c.accent, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>Пробеги GPS</Text>
            </View>
          </View>

          <View style={[styles.tableHeader, { borderColor: c.border }]}>
            <Text style={[styles.thName, { color: c.muted }]}>Пользователь</Text>
            <Text style={[styles.thRole, { color: c.muted }]}>Роль</Text>
            <Text style={[styles.thNum, { color: c.muted }]}>Дороги</Text>
            <Text style={[styles.thNum, { color: c.muted }]}>Дистанция</Text>
            <Text style={[styles.thNum, { color: c.muted }]}>Качество</Text>
            <Text style={[styles.thNum, { color: c.muted }]}>Шаги</Text>
            <Text style={[styles.thTags, { color: c.muted }]}>Категории</Text>
          </View>

          {tableRows.length === 0 ? (
            <Text style={{ color: c.muted, paddingVertical: 16 }}>Пока нет данных по пробежкам.</Text>
          ) : (
            tableRows.map((row) => (
              <View key={row.id} style={[styles.tableRow, { borderColor: c.border }]}>
                <View style={styles.userCell}>
                  <View style={[styles.avatarDot, { backgroundColor: c.accentSoft, borderWidth: 1, borderColor: c.border }]}>
                    <Text style={[styles.avatarLetter, { color: c.text }]}>{row.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={[styles.userName, { color: c.text }]} numberOfLines={1}>
                    {row.rank}. {row.name}
                    {row.name === user ? ' (вы)' : ''}
                  </Text>
                </View>
                <Text style={[styles.tdRole, { color: c.muted }]} numberOfLines={1}>
                  {row.role}
                </Text>
                <Text style={[styles.tdNum, { color: c.text }]}>{row.roads}</Text>
                <Text style={[styles.tdNum, { color: c.text }]}>{row.distance}</Text>
                <Text style={[styles.tdNum, { color: c.text }]}>{row.avgQuality}%</Text>
                <Text style={[styles.tdNum, { color: c.text }]}>{row.steps.toLocaleString('ru')}</Text>
                <Text style={[styles.tdTags, { color: c.muted }]} numberOfLines={2}>
                  {row.tags.length ? row.tags.join(' · ') : '—'}
                </Text>
                {admin && !row.id.startsWith('local:') ? (
                  <DeleteBtn onPress={() => void onDeleteRunner(row.id, row.name)} />
                ) : null}
              </View>
            ))
          )}
        </View>
      ) : (
        <GroupedSection title="Лидеры">
        <View style={styles.mobileList}>
          <View style={styles.tableHeadRow}>
            <Text style={[styles.tableTitle, { color: c.text }]}>Таблица лидеров</Text>
            <View style={[styles.monthChip, { backgroundColor: c.accentSoft }]}>
              <Text style={{ color: c.accent, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>Пробеги GPS</Text>
            </View>
          </View>
          {tableRows.length === 0 ? (
            <Text style={{ color: c.muted, paddingVertical: 6 }}>Пока нет данных по пробежкам.</Text>
          ) : (
            tableRows.slice(0, 8).map((row) => (
              <View key={row.id} style={[styles.mobileRow, { borderColor: c.border }]}>
                <View style={styles.mobileRowHead}>
                  <View style={styles.userCell}>
                    <View style={[styles.avatarDot, { backgroundColor: c.accentSoft, borderWidth: 1, borderColor: c.border }]}>
                      <Text style={[styles.avatarLetter, { color: c.text }]}>{row.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={[styles.userName, { color: c.text }]} numberOfLines={1}>
                      {row.rank}. {row.name}
                      {row.name === user ? ' (вы)' : ''}
                    </Text>
                  </View>
                  {admin && !row.id.startsWith('local:') ? (
                    <DeleteBtn onPress={() => void onDeleteRunner(row.id, row.name)} />
                  ) : null}
                </View>
                <View style={styles.mobileStats}>
                  <Text style={[styles.mobileStat, { color: c.muted }]}>Дороги: <Text style={{ color: c.text }}>{row.roads}</Text></Text>
                  <Text style={[styles.mobileStat, { color: c.muted }]}>Дистанция: <Text style={{ color: c.text }}>{row.distance}</Text></Text>
                  <Text style={[styles.mobileStat, { color: c.muted }]}>Качество: <Text style={{ color: c.text }}>{row.avgQuality}%</Text></Text>
                  <Text style={[styles.mobileStat, { color: c.muted }]}>Шаги: <Text style={{ color: c.text }}>{row.steps.toLocaleString('ru')}</Text></Text>
                </View>
                <Text style={[styles.mobileTags, { color: c.muted }]} numberOfLines={2}>
                  {row.tags.length ? row.tags.join(' · ') : '—'}
                </Text>
              </View>
            ))
          )}
        </View>
        </GroupedSection>
      )}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 120, gap: 12 },
  scrollDesktop: {
    width: '100%',
    maxWidth: 1220,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  heroCard: { borderRadius: 24, borderWidth: 1, padding: 16, shadowColor: '#111111', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 4 },
  tableWrap: { borderRadius: 24, borderWidth: 1, padding: 14, shadowColor: '#111111', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 4 },
  tableHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  tableTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  monthChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  mobileList: { padding: 8, gap: 0 },
  mobileRow: { borderBottomWidth: StyleSheet.hairlineWidth, padding: 12, marginBottom: 0 },
  mobileRowHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  mobileStats: { gap: 2 },
  mobileStat: { fontSize: 13 },
  mobileTags: { fontSize: 12, marginTop: 6, lineHeight: 17 },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingBottom: 8,
    marginBottom: 4,
  },
  tableRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, paddingVertical: 12 },
  userCell: { flex: 2.1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 8 },
  thName: { flex: 2.1, fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  thRole: { flex: 1.3, fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  thNum: { flex: 1, fontSize: 12, fontFamily: 'Inter_600SemiBold', textAlign: 'right' },
  thTags: { flex: 2.2, fontSize: 12, fontFamily: 'Inter_600SemiBold', textAlign: 'left', paddingLeft: 12 },
  tdRole: { flex: 1.3, fontSize: 13 },
  tdNum: { flex: 1, textAlign: 'right', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  tdTags: { flex: 2.2, fontSize: 12, lineHeight: 17, paddingLeft: 12 },
  avatarDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  userName: { flex: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  heroTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', marginBottom: 8 },
  delBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
