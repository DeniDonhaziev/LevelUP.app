import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useThemeColors } from '@/hooks/useThemeColors';
import { WebTheme } from '@/lib/theme';

type Props = {
  level: number;
  xp: number;
  /** 0..1 прогресс до следующего уровня */
  progress: number;
  /** Сколько XP осталось до следующего уровня */
  remaining: number;
};

/** Полоса прогресса уровня — видно, сколько XP до следующего уровня. */
export function LevelProgress({ level, xp, progress, remaining }: Props) {
  const c = useThemeColors();
  const w = useSharedValue(0);
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);

  useEffect(() => {
    w.value = withTiming(Math.max(0, Math.min(1, progress)), {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, w]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));

  return (
    <View style={[styles.card, { backgroundColor: c.cardElevated, borderColor: c.border }]}>
      <View style={styles.head}>
        <View style={styles.lvlRow}>
          <View style={[styles.badge, { backgroundColor: c.accentSoft }]}>
            <Ionicons name="flash" size={15} color={c.accent} />
          </View>
          <Text style={[styles.lvlText, { color: c.text }]}>Уровень {level}</Text>
        </View>
        <Text style={[styles.nextText, { color: c.muted }]}>
          до ур. {level + 1}: <Text style={{ color: c.text, fontFamily: 'Inter_700Bold' }}>{remaining.toLocaleString('ru-RU')} XP</Text>
        </Text>
      </View>

      <View style={[styles.track, { backgroundColor: c.cardHover }]}>
        <Animated.View style={[styles.fillWrap, fillStyle]}>
          <LinearGradient
            colors={[c.accent, '#9ECC00']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.fill}
          />
        </Animated.View>
      </View>

      <Text style={[styles.foot, { color: c.muted }]}>
        {xp.toLocaleString('ru-RU')} XP всего · {pct}% до следующего уровня
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: WebTheme.radiusLg,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    ...WebTheme.shadowSoft,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lvlRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  lvlText: { fontSize: 16, fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
  nextText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  track: { height: 12, borderRadius: 6, overflow: 'hidden' },
  fillWrap: { height: 12 },
  fill: { flex: 1, borderRadius: 6 },
  foot: { fontSize: 12, fontFamily: 'Inter_400Regular' },
});
