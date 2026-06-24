import { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Pressable,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  TextInput,
  type TextInputProps,
} from 'react-native';
import { Redirect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { firebaseLogin, firebaseRegister } from '@/lib/firebase/authFlow';
import { AppInput } from '@/components/ui/AppInput';
import { GroupedSection } from '@/components/ui/GroupedSection';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { screenLayout } from '@/lib/screenLayout';
import { DEMO_ACCOUNTS, getTopicConfig, DEFAULT_TOPIC_ID } from '@/lib/topics';
import { useTrackerStore } from '@/store/trackerStore';
import { isOnboardingComplete } from '@/lib/onboarding';
import { WebTheme } from '@/lib/theme';

type ThemeColors = (typeof Colors)['dark'];

const REGISTER_PERKS = [
  { icon: 'footsteps-outline' as const, label: 'Бег и карта' },
  { icon: 'people-outline' as const, label: 'Кланы' },
  { icon: 'stats-chart-outline' as const, label: 'Статистика' },
];

type FieldRowProps = TextInputProps & {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  colors: ThemeColors;
  divider?: boolean;
};

/** Строка формы в стиле сгруппированного списка приложения: иконка + лейбл + инпут */
function FieldRow({ icon, label, colors, divider, style, onFocus, onBlur, ...rest }: FieldRowProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        styles.fieldRow,
        divider && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}>
      <View style={[styles.fieldAccent, { backgroundColor: focused ? colors.lime : 'transparent' }]} />
      <View style={[styles.fieldIcon, { backgroundColor: focused ? colors.pastelMint : colors.card }]}>
        <Ionicons name={icon} size={18} color={focused ? colors.lime : colors.muted} />
      </View>
      <View style={styles.fieldBody}>
        <Text style={[styles.fieldLabel, { color: focused ? colors.lime : colors.muted }]}>{label}</Text>
        <TextInput
          placeholderTextColor={colors.muted}
          style={[styles.fieldInput, { color: colors.text }, style]}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
      </View>
    </View>
  );
}

function PasswordStrength({ password, colors }: { password: string; colors: ThemeColors }) {
  if (!password) return null;
  const len = password.length;
  const level = len >= 8 ? 3 : len >= 5 ? 2 : 1;
  const labels = ['Слабый', 'Средний', 'Надёжный'];
  const barColors = [colors.danger, colors.warning, colors.lime];

  return (
    <View style={styles.strengthWrap}>
      <View style={styles.strengthBars}>
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.strengthBar,
              { backgroundColor: i <= level ? barColors[level - 1] : colors.cardHover },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.strengthLabel, { color: barColors[level - 1] }]}>{labels[level - 1]}</Text>
    </View>
  );
}

/** Геймификационная XP-полоса в hero-баннере */
function XpBar({ colors }: { colors: ThemeColors }) {
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = withTiming(0.08, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [fill]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  return (
    <View style={styles.xpWrap}>
      <View style={styles.xpHeader}>
        <Text style={[styles.xpLevel, { color: colors.text }]}>Уровень 1</Text>
        <Text style={[styles.xpHint, { color: colors.muted }]}>0 / 100 XP до Ур. 2</Text>
      </View>
      <View style={[styles.xpTrack, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
        <Animated.View style={fillStyle}>
          <LinearGradient
            colors={[colors.lime, '#9ECC00']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.xpFill}
          />
        </Animated.View>
      </View>
    </View>
  );
}

/** Пульсирующий бейдж уровня */
function LevelBadge({ colors }: { colors: ThemeColors }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulse]);
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + pulse.value * 0.5,
    transform: [{ scale: 0.9 + pulse.value * 0.2 }],
  }));

  return (
    <View style={styles.badgeWrap}>
      <Animated.View style={[styles.badgePulse, { backgroundColor: colors.glow }, glowStyle]} />
      <View style={[styles.badge, { backgroundColor: colors.lime }]}>
        <Ionicons name="flash" size={26} color="#0A0A0B" />
      </View>
    </View>
  );
}

export default function SignInScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const currentUser = useTrackerStore((s) => s.currentUser);
  const currentUserData = useTrackerStore((s) => (s.currentUser ? s.userData[s.currentUser] : null));
  const login = useTrackerStore((s) => s.login);
  const register = useTrackerStore((s) => s.register);
  const ensureDemoAccounts = useTrackerStore((s) => s.ensureDemoAccounts);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [loginId, setLoginId] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const firebaseOn = isFirebaseConfigured();
  const topicPreview = getTopicConfig();

  const registerReady = useMemo(() => {
    if (firebaseOn) {
      return email.trim().length > 0 && displayName.trim().length >= 2 && password.length >= 4;
    }
    return username.trim().length >= 2 && password.length >= 4;
  }, [firebaseOn, email, displayName, username, password]);

  useEffect(() => {
    if (!firebaseOn) ensureDemoAccounts();
  }, [firebaseOn, ensureDemoAccounts]);

  if (currentUser) {
    // Гейт анкеты: без заполненного онбординга ведём в анкету, иначе на вкладки
    return <Redirect href={isOnboardingComplete(currentUserData) ? '/(tabs)' : '/onboarding'} />;
  }

  function switchMode(next: 'login' | 'register') {
    setMode(next);
    setError('');
    if (next === 'login' && email.trim()) setLoginId(email.trim());
    if (next === 'register' && loginId.trim().includes('@')) setEmail(loginId.trim());
  }

  async function onSubmit() {
    setError('');
    if (firebaseOn) {
      setLoading(true);
      try {
        if (mode === 'login') {
          const err = await firebaseLogin(loginId, password);
          if (err) {
            setError(err);
            return;
          }
        } else {
          const err = await firebaseRegister(email, password, displayName, DEFAULT_TOPIC_ID);
          if (err) {
            setError(err);
            return;
          }
        }
        // Навигация выполнится Redirect-гейтом после обновления currentUser
      } finally {
        setLoading(false);
      }
      return;
    }
    if (mode === 'login') {
      const ok = login(username.trim(), password);
      if (!ok) {
        setError('Неверный логин или пароль');
        return;
      }
      return;
    }
    const err = register(username.trim(), password, DEFAULT_TOPIC_ID);
    if (err) setError(err);
  }

  if (mode === 'register') {
    return (
      <ScreenBackground>
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.registerScroll} keyboardShouldPersistTaps="handled">
            {/* ── Full-bleed игровой hero-баннер ── */}
            <Animated.View entering={FadeIn.duration(400)} style={styles.hero}>
              <LinearGradient
                colors={[c.cardElevated, c.card, c.backgroundAlt]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                colors={['rgba(193, 255, 0, 0.22)', 'transparent']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.heroGlow}
              />

              <Pressable
                onPress={() => switchMode('login')}
                hitSlop={10}
                style={({ pressed }) => [styles.backBtn, { borderColor: c.border, opacity: pressed ? 0.7 : 1 }]}>
                <Ionicons name="chevron-back" size={20} color={c.text} />
              </Pressable>

              <LevelBadge colors={c} />

              <View style={styles.brandRow}>
                <Text style={[styles.brandWord, { color: c.text }]}>Level</Text>
                <Text style={[styles.brandWord, { color: c.lime }]}>Up</Text>
              </View>
              <Text style={[styles.heroTitle, { color: c.text }]}>Создай аккаунт</Text>
              <Text style={[styles.heroSubtitle, { color: c.muted }]}>
                Старт с первого уровня — прокачивай форму и поднимайся в рейтинге клана
              </Text>

              <XpBar colors={c} />
            </Animated.View>

            <View style={styles.formArea}>
              {error ? (
                <Animated.View entering={FadeIn} style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={18} color={c.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </Animated.View>
              ) : null}

              {/* ── Форма как сгруппированный список ── */}
              <Animated.View entering={FadeInDown.duration(450).delay(100)}>
                <Text style={[screenLayout.sectionCaption, { color: c.muted }]}>Данные аккаунта</Text>
                <View style={[styles.formCard, { backgroundColor: c.cardElevated, borderColor: c.border }]}>
                  {firebaseOn ? (
                    <>
                      <FieldRow
                        icon="mail-outline"
                        label="EMAIL"
                        colors={c}
                        divider
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        autoComplete="email"
                        placeholder="you@email.com"
                      />
                      <FieldRow
                        icon="person-outline"
                        label="ИМЯ ПОЛЬЗОВАТЕЛЯ"
                        colors={c}
                        divider
                        value={displayName}
                        onChangeText={setDisplayName}
                        autoCapitalize="words"
                        autoCorrect={false}
                        autoComplete="username"
                        placeholder="Как вас называть"
                      />
                    </>
                  ) : (
                    <FieldRow
                      icon="person-outline"
                      label="ИМЯ ПОЛЬЗОВАТЕЛЯ"
                      colors={c}
                      divider
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholder="Минимум 2 символа"
                    />
                  )}

                  <FieldRow
                    icon="lock-closed-outline"
                    label="ПАРОЛЬ"
                    colors={c}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    placeholder="Минимум 4 символа"
                  />
                  <PasswordStrength password={password} colors={c} />
                </View>
              </Animated.View>

              {/* ── Перки: что получишь ── */}
              <Animated.View entering={FadeInDown.duration(450).delay(180)}>
                <Text style={[screenLayout.sectionCaption, { color: c.muted, marginTop: 20 }]}>Что внутри</Text>
                <View style={styles.perksRow}>
                  {REGISTER_PERKS.map((perk) => (
                    <View
                      key={perk.label}
                      style={[styles.perkChip, { backgroundColor: c.cardElevated, borderColor: c.border }]}>
                      <View style={[styles.perkIcon, { backgroundColor: c.pastelMint }]}>
                        <Ionicons name={perk.icon} size={16} color={c.lime} />
                      </View>
                      <Text style={[styles.perkLabel, { color: c.text }]}>{perk.label}</Text>
                    </View>
                  ))}
                </View>
              </Animated.View>

              {/* ── CTA ── */}
              <Animated.View entering={FadeInDown.duration(450).delay(260)} style={styles.ctaWrap}>
                <PrimaryButton
                  label="Создать аккаунт →"
                  loading={loading}
                  disabled={!registerReady}
                  onPress={() => void onSubmit()}
                />
                <Text style={[styles.registerHint, { color: c.muted }]}>
                  Регистрация сохраняется на устройстве — потом входите тем же логином
                </Text>
                <Pressable
                  onPress={() => switchMode('login')}
                  style={({ pressed }) => [styles.switchLink, { opacity: pressed ? 0.7 : 1 }]}>
                  <Text style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 15 }}>
                    Уже есть аккаунт?{' '}
                    <Text style={{ color: c.lime, fontFamily: 'Inter_600SemiBold' }}>Войти</Text>
                  </Text>
                </Pressable>
              </Animated.View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.topTitleWrap}>
            <Text style={[screenLayout.pageTitle, { color: c.text }]}>{topicPreview.brandTitle}</Text>
            <Text style={[screenLayout.pageSubtitle, { color: c.muted }]}>{topicPreview.brandSubtitle}</Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {!firebaseOn ? (
            <View style={[styles.demoCard, { borderColor: c.border, backgroundColor: c.cardElevated }]}>
              <Text style={{ color: c.text, fontFamily: 'Inter_600SemiBold', marginBottom: 8 }}>Демо-учётки</Text>
              {DEMO_ACCOUNTS.map((demo) => (
                <Pressable
                  key={demo.username}
                  onPress={() => {
                    setUsername(demo.username);
                    setPassword(demo.password);
                    setError('');
                  }}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, marginBottom: 6 })}>
                  <Text style={{ color: c.muted, fontSize: 13 }}>
                    <Text style={{ color: c.text, fontFamily: 'Inter_600SemiBold' }}>{demo.label}</Text>
                    {' — '}
                    {demo.username} / {demo.password}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <GroupedSection>
            <View style={styles.formInner}>
              {firebaseOn ? (
                <>
                  <Text style={[styles.label, { color: c.muted }]}>Логин или email</Text>
                  <AppInput
                    value={loginId}
                    onChangeText={setLoginId}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="default"
                    autoComplete="username"
                  />
                </>
              ) : (
                <>
                  <Text style={[styles.label, { color: c.muted }]}>Имя пользователя</Text>
                  <AppInput
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </>
              )}

              <Text style={[styles.label, { color: c.muted }]}>Пароль</Text>
              <AppInput value={password} onChangeText={setPassword} secureTextEntry />

              <PrimaryButton
                label="Войти"
                loading={loading}
                onPress={() => void onSubmit()}
              />

              <Pressable
                onPress={() => router.push('/(auth)/forgot-password')}
                style={({ pressed }) => [styles.forgotLink, { opacity: pressed ? 0.7 : 1 }]}>
                <Text style={[styles.forgotText, { color: c.text }]}>Забыли пароль?</Text>
              </Pressable>
            </View>
          </GroupedSection>

          <Pressable
            onPress={() => switchMode('register')}
            style={({ pressed }) => [styles.switchLink, { opacity: pressed ? 0.7 : 1 }]}>
            <Text style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 15 }}>
              Нет аккаунта?{' '}
              <Text style={{ color: c.lime, fontFamily: 'Inter_600SemiBold' }}>Зарегистрироваться</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 20, paddingTop: 64, paddingBottom: 40 },
  registerScroll: { paddingBottom: 48 },
  topTitleWrap: { marginBottom: 24 },
  formInner: { padding: 16, gap: 4 },
  label: { fontSize: 13, marginBottom: 6, fontFamily: 'Inter_500Medium' },
  error: { color: '#F87171', marginBottom: 12, fontSize: 14, fontFamily: 'Inter_500Medium' },
  forgotLink: { alignItems: 'center', marginTop: 16 },
  forgotText: { fontSize: 14, fontFamily: 'Inter_500Medium', textDecorationLine: 'underline' },
  demoCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
  },

  // ── Hero ──
  hero: {
    paddingTop: 60,
    paddingBottom: 28,
    paddingHorizontal: 24,
    borderBottomLeftRadius: WebTheme.radiusXl,
    borderBottomRightRadius: WebTheme.radiusXl,
    overflow: 'hidden',
    alignItems: 'center',
  },
  heroGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  backBtn: {
    position: 'absolute',
    top: 56,
    left: 20,
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  badgePulse: { position: 'absolute', width: 92, height: 92, borderRadius: 46 },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...WebTheme.shadowGlow,
  },
  brandRow: { flexDirection: 'row', marginBottom: 10 },
  brandWord: { fontSize: 20, fontFamily: 'Inter_700Bold', letterSpacing: -0.4 },
  heroTitle: {
    fontSize: 30,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.8,
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 300,
    marginBottom: 22,
  },

  // ── XP bar ──
  xpWrap: { width: '100%', maxWidth: 320 },
  xpHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  xpLevel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  xpHint: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  xpTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  xpFill: { height: 8, borderRadius: 4 },

  // ── Form ──
  formArea: { paddingHorizontal: 20, paddingTop: 24 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.4)',
    borderRadius: WebTheme.radiusSm,
    backgroundColor: 'rgba(255, 69, 58, 0.12)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  errorText: { color: '#FF6961', fontSize: 14, fontFamily: 'Inter_500Medium', flex: 1 },
  formCard: {
    borderWidth: 1,
    borderRadius: WebTheme.radiusLg,
    overflow: 'hidden',
    ...WebTheme.shadowSoft,
  },
  fieldRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingRight: 16 },
  fieldAccent: { width: 3, alignSelf: 'stretch', borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  fieldIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 13,
    marginRight: 12,
  },
  fieldBody: { flex: 1 },
  fieldLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.4, marginBottom: 2 },
  fieldInput: { fontSize: 16, fontFamily: 'Inter_400Regular', paddingVertical: Platform.OS === 'ios' ? 2 : 0 },
  strengthWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 2,
  },
  strengthBars: { flexDirection: 'row', gap: 4, flex: 1 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', minWidth: 64, textAlign: 'right' },

  // ── Perks ──
  perksRow: { flexDirection: 'row', gap: 8 },
  perkChip: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: WebTheme.radius,
    borderWidth: 1,
  },
  perkIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  perkLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', textAlign: 'center' },

  // ── CTA ──
  ctaWrap: { marginTop: 24 },
  registerHint: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 12,
  },
  switchLink: { alignItems: 'center', marginTop: 20 },
});
