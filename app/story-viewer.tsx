import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { WebTheme } from '@/lib/theme';
import { loadActiveStories, deleteStory } from '@/lib/firebase/storiesSync';
import { useTrackerStore } from '@/store/trackerStore';
import type { Story } from '@/lib/types';

const DURATION = 6000;

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const h = Math.floor(diff / 3600000);
  if (h >= 1) return `${h} ч назад`;
  const m = Math.floor(diff / 60000);
  return m >= 1 ? `${m} мин назад` : 'только что';
}

export default function StoryViewerScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { uid } = useLocalSearchParams<{ uid?: string }>();
  const user = useTrackerStore((s) => s.currentUser);
  const firebaseUid = useTrackerStore((s) => s.firebaseUid);
  const myUid = firebaseUid ?? (user ? `local:${user}` : '');

  const [stories, setStories] = useState<Story[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const progress = useSharedValue(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadActiveStories().then((all) => {
      if (cancelled) return;
      const mine = all.filter((s) => s.uid === uid).sort((a, b) => a.createdAt - b.createdAt);
      setStories(mine);
      setLoading(false);
      if (mine.length === 0) router.back();
    });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  // Авто-перелистывание + анимация полосы
  useEffect(() => {
    if (!stories.length) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: DURATION, easing: Easing.linear });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (index < stories.length - 1) setIndex((i) => i + 1);
      else router.back();
    }, DURATION);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [index, stories.length, progress]);

  const story = stories[index];

  async function onDelete() {
    if (!story) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    try {
      await deleteStory(story.id);
    } catch {
      /* ignore */
    }
    const next = stories.filter((s) => s.id !== story.id);
    if (next.length === 0) {
      router.back();
      return;
    }
    setStories(next);
    setIndex((i) => Math.min(i, next.length - 1));
  }

  if (loading || !story) {
    return <View style={[styles.root, { backgroundColor: '#000' }]} />;
  }

  const isMine = story.uid === myUid;

  return (
    <View style={[styles.root, { backgroundColor: '#000', paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
      {/* Полосы прогресса */}
      <View style={styles.bars}>
        {stories.map((s, i) => (
          <View key={s.id} style={styles.barTrack}>
            {i < index ? (
              <View style={styles.barFull} />
            ) : i === index ? (
              <ProgressBar progress={progress} />
            ) : null}
          </View>
        ))}
      </View>

      {/* Шапка */}
      <View style={styles.head}>
        <View style={[styles.avatar, { backgroundColor: c.cardHover }]}>
          <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold' }}>{story.username.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headName}>{story.username}</Text>
          <Text style={styles.headTime}>{timeAgo(story.createdAt)}</Text>
        </View>
        {isMine ? (
          <Pressable onPress={() => void onDelete()} hitSlop={10} style={styles.headBtn}>
            <Ionicons name="trash-outline" size={20} color="#fff" />
          </Pressable>
        ) : null}
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.headBtn}>
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
      </View>

      {/* Контент истории */}
      <View style={styles.content}>
        <LinearGradient
          colors={['#1C1C1F', '#0F0F11']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.card, { borderColor: 'rgba(193,255,0,0.35)' }]}>
          <Text style={styles.cardTitle}>Прогресс дня 🔥</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{(story.steps ?? 0).toLocaleString('ru-RU')}</Text>
              <Text style={styles.statLabel}>шагов</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {story.tasksDone ?? 0}/{story.tasksTotal ?? 0}
              </Text>
              <Text style={styles.statLabel}>целей</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{story.streak ?? 0}</Text>
              <Text style={styles.statLabel}>дней серия</Text>
            </View>
          </View>
          {story.text ? <Text style={styles.caption}>{story.text}</Text> : null}
        </LinearGradient>
      </View>

      {/* Зоны нажатия: лево — назад, право — вперёд */}
      <View style={styles.tapZones} pointerEvents="box-none">
        <Pressable
          style={styles.tapLeft}
          onPress={() => (index > 0 ? setIndex((i) => i - 1) : null)}
        />
        <Pressable
          style={styles.tapRight}
          onPress={() => (index < stories.length - 1 ? setIndex((i) => i + 1) : router.back())}
        />
      </View>
    </View>
  );
}

function ProgressBar({ progress }: { progress: { value: number } }) {
  const style = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  return <Animated.View style={[styles.barFull, style]} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 12 },
  bars: { flexDirection: 'row', gap: 4, marginBottom: 12 },
  barTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  barFull: { height: 3, borderRadius: 2, backgroundColor: '#fff', width: '100%' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, zIndex: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headName: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  headTime: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  headBtn: { padding: 6 },
  content: { flex: 1, justifyContent: 'center' },
  card: { borderRadius: WebTheme.radiusXl, borderWidth: 1, padding: 26 },
  cardTitle: { color: '#fff', fontSize: 24, fontFamily: 'Inter_700Bold', letterSpacing: -0.5, marginBottom: 24 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { color: '#C1FF00', fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  statLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 4 },
  caption: { color: '#fff', fontSize: 16, fontFamily: 'Inter_500Medium', marginTop: 22, lineHeight: 22 },
  tapZones: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  tapLeft: { width: '33%', height: '100%' },
  tapRight: { flex: 1, height: '100%' },
});
