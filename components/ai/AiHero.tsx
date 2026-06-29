import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useThemeColors } from '@/hooks/useThemeColors';
import { WebTheme } from '@/lib/theme';

type Feature = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
  prompt: string;
};

const FEATURES: Feature[] = [
  {
    icon: 'barbell',
    title: 'План тренировок',
    desc: 'Программа под твою цель на неделю',
    prompt: 'Составь мне персональный план тренировок на неделю под мою цель.',
  },
  {
    icon: 'nutrition',
    title: 'Питание и КБЖУ',
    desc: 'Рацион и расчёт калорий на день',
    prompt: 'Составь план питания на день под мою цель с расчётом КБЖУ.',
  },
  {
    icon: 'trending-up',
    title: 'Мой прогресс',
    desc: 'Разбор анкеты и советы по результату',
    prompt: 'Проанализируй мой прогресс по анкете и дай конкретные советы.',
  },
];

/** Бейдж-логотип + приветствие (верх вкладки ИИ). */
export function AiHero({ name }: { name?: string }) {
  const c = useThemeColors();
  const { width } = useWindowDimensions();
  const compact = width < 420;
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [pulse]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + pulse.value * 0.32,
    transform: [{ scale: 0.9 + pulse.value * 0.18 }],
  }));

  const hello = name ? `С возвращением, ${name}!` : 'С возвращением!';

  return (
    <View style={styles.heroWrap}>
      <View style={styles.badgeWrap}>
        <Animated.View style={[styles.glow, { backgroundColor: c.accent }, glowStyle]} />
        <LinearGradient
          colors={[c.accent, '#9ECC00']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.badge,
            Platform.OS === 'web' ? ({ boxShadow: `0 8px 30px ${c.accent}55` } as object) : null,
          ]}>
          <Ionicons name="sparkles" size={30} color={c.onAccent} />
        </LinearGradient>
      </View>

      <Text style={[styles.hello, { color: c.text, fontSize: compact ? 24 : 28 }]}>{hello}</Text>
      <Text style={[styles.sub, { color: c.muted }]}>
        Чем помочь сегодня? Спроси или прикрепи фото еды — посчитаю калории
      </Text>
    </View>
  );
}

/** Карточки-подсказки: ряд на широком экране, вертикальный список на телефоне. */
export function AiFeatureCards({ onPickFeature }: { onPickFeature: (prompt: string) => void }) {
  const c = useThemeColors();
  const { width } = useWindowDimensions();
  const narrow = width < 560;

  return (
    <View style={[styles.features, narrow && styles.featuresCol]}>
      {FEATURES.map((f) => (
        <Pressable
          key={f.title}
          onPress={() => onPickFeature(f.prompt)}
          style={({ pressed }) => [
            narrow ? styles.featRow : styles.feat,
            { backgroundColor: c.cardElevated, borderColor: c.border, opacity: pressed ? 0.85 : 1 },
          ]}>
          <View style={[styles.featIcon, { backgroundColor: c.accentSoft }]}>
            <Ionicons name={f.icon} size={18} color={c.accent} />
          </View>
          <View style={narrow ? { flex: 1 } : undefined}>
            <Text style={[styles.featTitle, { color: c.text }]}>{f.title}</Text>
            <Text style={[styles.featDesc, { color: c.muted }]}>{f.desc}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  heroWrap: { alignItems: 'center', paddingTop: 12, paddingBottom: 16 },
  badgeWrap: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  glow: { position: 'absolute', width: 110, height: 110, borderRadius: 55 },
  badge: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hello: { fontFamily: 'Inter_700Bold', letterSpacing: -0.6, textAlign: 'center' },
  sub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 8, paddingHorizontal: 12 },

  features: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 14 },
  featuresCol: { flexDirection: 'column' },
  feat: { flex: 1, borderRadius: 18, borderWidth: 1, padding: 14, gap: 8 },
  featRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  featIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  featTitle: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  featDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 16, marginTop: 2 },
});
