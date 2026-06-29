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
    desc: 'Составлю программу под твою цель',
    prompt: 'Составь мне персональный план тренировок на неделю под мою цель.',
  },
  {
    icon: 'nutrition',
    title: 'Питание',
    desc: 'Рацион и КБЖУ на день',
    prompt: 'Составь план питания на день под мою цель с расчётом КБЖУ.',
  },
  {
    icon: 'trending-up',
    title: 'Мой прогресс',
    desc: 'Разбор анкеты и советы',
    prompt: 'Проанализируй мой прогресс по анкете и дай конкретные советы.',
  },
];

type Props = {
  name?: string;
  onPickFeature: (prompt: string) => void;
};

/** Современный герой вкладки ИИ: светящаяся сфера, приветствие, карточки-подсказки. */
export function AiHero({ name, onPickFeature }: Props) {
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
    <View style={styles.wrap}>
      {/* Сфера со свечением */}
      <View style={styles.orbWrap}>
        <Animated.View style={[styles.glow, { backgroundColor: c.accent }, glowStyle]} />
        <Animated.View style={orbStyle}>
          <LinearGradient
            colors={[c.accent, '#A6D800', '#37500A']}
            start={{ x: 0.2, y: 0.1 }}
            end={{ x: 0.8, y: 1 }}
            style={[styles.orb, Platform.OS === 'web' ? ({ boxShadow: `0 0 48px ${c.accent}66` } as object) : null]}>
            <View style={styles.orbHi} />
          </LinearGradient>
        </Animated.View>
      </View>

      <Text style={[styles.hello, { color: c.text }]}>{hello}</Text>
      <Text style={[styles.sub, { color: c.muted }]}>Чем помочь сегодня? Спроси или выбери подсказку</Text>

      {/* Карточки-подсказки */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 8, paddingBottom: 18 },
  orbWrap: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  glow: { position: 'absolute', width: 150, height: 150, borderRadius: 75 },
  orb: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  orbHi: {
    width: 40,
    height: 24,
    borderRadius: 20,
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.55)',
    opacity: 0.9,
  },
  hello: { fontSize: 26, fontFamily: 'Inter_700Bold', letterSpacing: -0.6, textAlign: 'center' },
  sub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 6, marginBottom: 18 },
  features: { flexDirection: 'row', gap: 10, width: '100%' },
  feat: { flex: 1, borderRadius: 18, borderWidth: 1, padding: 14, gap: 6 },
  featIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  featTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  featDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 15 },
});
