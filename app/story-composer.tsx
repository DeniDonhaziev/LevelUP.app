import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { WebTheme } from '@/lib/theme';
import { todayKey } from '@/lib/date';
import { calculateStreak } from '@/lib/trackerLogic';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { publishStory, STORY_TTL_MS } from '@/lib/firebase/storiesSync';
import { useTrackerStore } from '@/store/trackerStore';
import type { Story } from '@/lib/types';

export default function StoryComposerScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const user = useTrackerStore((s) => s.currentUser);
  const firebaseUid = useTrackerStore((s) => s.firebaseUid);
  const getUserData = useTrackerStore((s) => s.getUserData);
  const getStepsToday = useTrackerStore((s) => s.getStepsToday);

  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const progress = useMemo(() => {
    if (!user) return { steps: 0, tasksDone: 0, tasksTotal: 0, streak: 0 };
    const data = getUserData(user);
    const tasksDone = (data.dailyDone[todayKey()] || []).length;
    return {
      steps: getStepsToday(),
      tasksDone,
      tasksTotal: data.tasks.length,
      streak: calculateStreak(data),
    };
  }, [user, getUserData, getStepsToday]);

  async function onPublish() {
    if (!user) return;
    if (!isFirebaseConfigured()) {
      setError('Истории доступны при облачном входе.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const now = Date.now();
      const uid = firebaseUid ?? `local:${user}`;
      const story: Story = {
        id: `${uid}-${now}`,
        uid,
        username: user,
        createdAt: now,
        expiresAt: now + STORY_TTL_MS,
        kind: 'progress',
        text: caption.trim() || undefined,
        steps: progress.steps,
        tasksDone: progress.tasksDone,
        tasksTotal: progress.tasksTotal,
        streak: progress.streak,
        accent: '#C1FF00',
      };
      await publishStory(story);
      router.back();
    } catch (e) {
      setError((e as Error).message ?? 'Не удалось опубликовать');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenBackground>
      <View style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={({ pressed }) => [styles.backBtn, { borderColor: c.border, opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="close" size={22} color={c.text} />
          </Pressable>
          <Text style={[styles.title, { color: c.text }]}>Новая история</Text>
          <View style={{ width: 38 }} />
        </View>

        {/* Превью карточки прогресса дня */}
        <LinearGradient
          colors={['#1C1C1F', '#0F0F11']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.card, { borderColor: 'rgba(193,255,0,0.35)' }]}>
          <View style={styles.cardTop}>
            <View style={[styles.badge, { backgroundColor: c.pastelMint }]}>
              <Ionicons name="flash" size={18} color={c.lime} />
            </View>
            <Text style={[styles.cardName, { color: '#fff' }]}>{user}</Text>
          </View>
          <Text style={styles.cardTitle}>Прогресс дня 🔥</Text>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{progress.steps.toLocaleString('ru-RU')}</Text>
              <Text style={styles.statLabel}>шагов</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {progress.tasksDone}/{progress.tasksTotal}
              </Text>
              <Text style={styles.statLabel}>целей</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{progress.streak}</Text>
              <Text style={styles.statLabel}>дней серия</Text>
            </View>
          </View>

          {caption.trim() ? <Text style={styles.cardCaption}>{caption.trim()}</Text> : null}
        </LinearGradient>

        <Text style={[styles.fieldLabel, { color: c.muted }]}>Подпись (необязательно)</Text>
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder="Например: «Закрыл все цели сегодня 💪»"
          placeholderTextColor={c.muted}
          maxLength={120}
          multiline
          style={[styles.input, { color: c.text, backgroundColor: c.card, borderColor: c.border }]}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={{ flex: 1 }} />

        <PrimaryButton label="Опубликовать историю" loading={busy} onPress={() => void onPublish()} />
        <Text style={[styles.hint, { color: c.muted }]}>История видна всем 24 часа, затем исчезает.</Text>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, width: '100%', maxWidth: 560, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  card: { borderRadius: WebTheme.radiusXl, borderWidth: 1, padding: 22, marginBottom: 20 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  badge: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  cardTitle: { color: '#fff', fontSize: 22, fontFamily: 'Inter_700Bold', letterSpacing: -0.5, marginBottom: 20 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { color: '#C1FF00', fontSize: 24, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  statLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 4 },
  cardCaption: { color: '#fff', fontSize: 15, fontFamily: 'Inter_500Medium', marginTop: 18, lineHeight: 21 },
  fieldLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: WebTheme.radiusSm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    minHeight: 70,
    textAlignVertical: 'top',
  },
  error: { color: '#FF6961', fontSize: 14, fontFamily: 'Inter_500Medium', marginTop: 10 },
  hint: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 10 },
});
