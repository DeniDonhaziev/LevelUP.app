import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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

/** Орб + приветствие (верх вкладки ИИ). */
export function AiHero({ name }: { name?: string }) {
  const c = useThemeColors();
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [pulse]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + pulse.value * 0.4,
    transform: [{ scale: 0.85 + pulse.value * 0.2 }],
  }));
  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.98 + pulse.value * 0.04 }],
  }));

  const hello = name ? `С возвращением, ${name}!` : 'С возвращением!';

  return (
    <View style={styles.heroWrap}>
      <View style={styles.orbWrap}>
        <Animated.View style={[styles.glow, { backgroundColor: c.accent }, glowStyle]} />
        <Animated.View style={orbStyle}>
          <LinearGradient
            colors={[c.accent, '#A6D800', '#37500A']}
            start={{ x: 0.2, y: 0.1 }}
            end={{ x: 0.8, y: 1 }}
            style={[
              styles.orb,
              Platform.OS === 'web' ? ({ boxShadow: `0 0 52px ${c.accent}66` } as object) : null,
            ]}>
            <View style={styles.orbRim} />
            <View style={styles.orbHi} />
          </LinearGradient>
        </Animated.View>
      </View>

      <Text style={[styles.hello, { color: c.text }]}>{hello}</Text>
      <Text style={[styles.sub, { color: c.muted }]}>
        Чем помочь сегодня? Спроси или прикрепи фото еды — посчитаю калории
      </Text>
    </View>
  );
}

/** 3 карточки-подсказки (низ, под ask box — как на референсе). */
export function AiFeatureCards({ onPickFeature }: { onPickFeature: (prompt: string) => void }) {
  const c = useThemeColors();
  return (
    <View style={styles.features}>
      {FEATURES.map((f) => (
        <Pressable
          key={f.title}
          onPress={() => onPickFeature(f.prompt)}
          style={({ pressed }) => [
            styles.feat,
            { backgroundColor: c.cardElevated, borderColor: c.border, opacity: pressed ? 0.85 : 1 },
          ]}>
          <View style={[styles.featIcon, { backgroundColor: c.accentSoft }]}>
            <Ionicons name={f.icon} size={18} color={c.accent} />
          </View>
          <Text style={[styles.featTitle, { color: c.text }]}>{f.title}</Text>
          <Text style={[styles.featDesc, { color: c.muted }]}>{f.desc}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  heroWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 16 },
  orbWrap: { width: 150, height: 150, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  glow: { position: 'absolute', width: 160, height: 160, borderRadius: 80 },
  orb: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  orbRim: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 6,
    borderColor: 'rgba(0,0,0,0.18)',
  },
  orbHi: {
    width: 42,
    height: 26,
    borderRadius: 21,
    marginTop: 18,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  hello: { fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: -0.6, textAlign: 'center' },
  sub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 8, paddingHorizontal: 12 },
  features: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 14 },
  feat: { flex: 1, borderRadius: 18, borderWidth: 1, padding: 14, gap: 8 },
  featIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  featTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  featDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 15 },
});
