import { View, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';

import { GroupedSection } from '@/components/ui/GroupedSection';
import { ScreenScroll } from '@/components/ui/ScreenScroll';
import { TabScreenHeader } from '@/components/ui/TabScreenHeader';
import { useThemeColors } from '@/hooks/useThemeColors';
import { buildRunnerRanking, formatLength } from '@/lib/trackerLogic';
import { useTrackerStore } from '@/store/trackerStore';

export default function StatsScreen() {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 1100;
  const c = useThemeColors();
  const user = useTrackerStore((s) => s.currentUser);
  const territories = useTrackerStore((s) => s.territories);
  const runnerLeaderboard = useTrackerStore((s) => s.runnerLeaderboard);
  const userDataMap = useTrackerStore((s) => s.userData);

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
      <TabScreenHeader title="Рейтинг бегунов" subtitle="Таблица лидеров GPS" />
      {isDesktopWeb ? (
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
});
