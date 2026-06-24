import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type TextInputProps,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  SlideInLeft,
  SlideInRight,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { WebTheme } from '@/lib/theme';
import { isDesktopWebLayout } from '@/lib/screenLayout';
import { useTrackerStore } from '@/store/trackerStore';
import type { OnboardingProfile } from '@/lib/types';
import {
  ACTIVITY_OPTIONS,
  GENDER_OPTIONS,
  GOAL_OPTIONS,
  HEALTH_OPTIONS,
  ONBOARDING_STEPS,
  RUN_VOLUME_OPTIONS,
  SAFETY_WARNING,
  STEP_GOAL_OPTIONS,
  isStepValid,
  requiresSafetyLimit,
  toggleGoal,
  toggleHealth,
  validateBasics,
  type Choice,
} from '@/lib/onboarding';

type ThemeColors = (typeof Colors)['dark'];

const STEP_META = [
  { eyebrow: 'Знакомство', title: 'Основная информация', subtitle: 'Нужно для расчёта персональных норм' },
  { eyebrow: 'Активность', title: 'Уровень физической активности', subtitle: 'Какой ваш уровень активности?' },
  { eyebrow: 'Цели', title: 'Для чего вам LevelUp?', subtitle: 'Можно выбрать несколько вариантов' },
  { eyebrow: 'Здоровье', title: 'Состояние здоровья', subtitle: 'Есть ли у вас ограничения?' },
  { eyebrow: 'Бег', title: 'Опыт бега', subtitle: 'Сколько км за одну тренировку?' },
  { eyebrow: 'Шаги', title: 'Ежедневная активность', subtitle: 'Сколько шагов в день вы хотите проходить?' },
  { eyebrow: 'Почти готово', title: 'Согласие пользователя', subtitle: 'Подтвердите перед стартом' },
];

/** ── Прогресс-бар ── */
function ProgressBar({ step, colors }: { step: number; colors: ThemeColors }) {
  const progress = (step + 1) / ONBOARDING_STEPS;
  const w = useSharedValue(progress);
  useEffect(() => {
    w.value = withTiming(progress, { duration: 320, easing: Easing.out(Easing.cubic) });
  }, [progress, w]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));

  return (
    <View style={styles.progressRow}>
      <View style={[styles.progressTrack, { backgroundColor: colors.cardHover }]}>
        <Animated.View style={[styles.progressFillWrap, fillStyle]}>
          <LinearGradient
            colors={[colors.lime, '#9ECC00']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.progressFill}
          />
        </Animated.View>
      </View>
      <Text style={[styles.progressLabel, { color: colors.muted }]}>
        {step + 1}/{ONBOARDING_STEPS}
      </Text>
    </View>
  );
}

/** ── Текстовое поле с лейблом и ошибкой ── */
type FieldProps = TextInputProps & { label: string; colors: ThemeColors; error?: string; suffix?: string };
function Field({ label, colors, error, suffix, style, ...rest }: FieldProps) {
  const [focused, setFocused] = useState(false);
  const border = error ? colors.danger : focused ? colors.lime : colors.border;
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>{label}</Text>
      <View style={[styles.fieldBox, { backgroundColor: focused ? colors.cardHover : colors.card, borderColor: border }]}>
        <TextInput
          placeholderTextColor={colors.muted}
          style={[styles.fieldInput, { color: colors.text }, style]}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...rest}
        />
        {suffix ? <Text style={[styles.fieldSuffix, { color: colors.muted }]}>{suffix}</Text> : null}
      </View>
      {error ? <Text style={[styles.fieldError, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

/** ── Карточка выбора (radio / checkbox) ── */
function OptionCard<T extends string | number>({
  choice,
  selected,
  multi,
  colors,
  onPress,
}: {
  choice: Choice<T>;
  selected: boolean;
  multi?: boolean;
  colors: ThemeColors;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionCard,
        {
          backgroundColor: selected ? colors.pastelMint : colors.cardElevated,
          borderColor: selected ? colors.lime : colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      {choice.icon ? (
        <View style={[styles.optionIcon, { backgroundColor: selected ? 'rgba(193,255,0,0.18)' : colors.card }]}>
          <Ionicons name={choice.icon} size={20} color={selected ? colors.lime : colors.muted} />
        </View>
      ) : null}
      <View style={styles.optionBody}>
        <Text style={[styles.optionLabel, { color: colors.text }]}>{choice.label}</Text>
        {choice.hint ? <Text style={[styles.optionHint, { color: colors.muted }]}>{choice.hint}</Text> : null}
      </View>
      <View
        style={[
          multi ? styles.checkBox : styles.radio,
          { borderColor: selected ? colors.lime : colors.border, backgroundColor: selected ? colors.lime : 'transparent' },
        ]}>
        {selected ? <Ionicons name="checkmark" size={14} color="#0A0A0B" /> : null}
      </View>
    </Pressable>
  );
}

/** ── Чип (пол) ── */
function Chip<T extends string>({
  choice,
  selected,
  colors,
  onPress,
}: {
  choice: Choice<T>;
  selected: boolean;
  colors: ThemeColors;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.pastelMint : colors.cardElevated,
          borderColor: selected ? colors.lime : colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      {choice.icon ? (
        <Ionicons name={choice.icon} size={16} color={selected ? colors.lime : colors.muted} />
      ) : null}
      <Text style={[styles.chipLabel, { color: selected ? colors.text : colors.muted }]}>{choice.label}</Text>
    </Pressable>
  );
}

/** ── Строка согласия ── */
function ConsentRow({
  text,
  checked,
  colors,
  onToggle,
}: {
  text: string;
  checked: boolean;
  colors: ThemeColors;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.consentRow,
        { backgroundColor: colors.cardElevated, borderColor: checked ? colors.lime : colors.border, opacity: pressed ? 0.85 : 1 },
      ]}>
      <View
        style={[
          styles.checkBox,
          { borderColor: checked ? colors.lime : colors.border, backgroundColor: checked ? colors.lime : 'transparent' },
        ]}>
        {checked ? <Ionicons name="checkmark" size={14} color="#0A0A0B" /> : null}
      </View>
      <Text style={[styles.consentText, { color: colors.text }]}>{text}</Text>
    </Pressable>
  );
}

export default function OnboardingScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = isDesktopWebLayout(width);

  const params = useLocalSearchParams<{ edit?: string }>();
  const isEdit = params.edit === '1';

  const currentUser = useTrackerStore((s) => s.currentUser);
  const existing = useTrackerStore((s) => (currentUser ? s.userData[currentUser]?.onboarding : undefined));
  const saveOnboarding = useTrackerStore((s) => s.saveOnboarding);

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [showErrors, setShowErrors] = useState(false);

  // Локальное состояние формы (строки для числовых полей — удобный ввод)
  const [name, setName] = useState(existing?.name ?? currentUser ?? '');
  const [ageStr, setAgeStr] = useState(existing?.age ? String(existing.age) : '');
  const [heightStr, setHeightStr] = useState(existing?.heightCm ? String(existing.heightCm) : '');
  const [weightStr, setWeightStr] = useState(existing?.weightKg ? String(existing.weightKg) : '');
  const [gender, setGender] = useState<OnboardingProfile['gender']>(existing?.gender ?? 'other');
  const [activityLevel, setActivityLevel] = useState<OnboardingProfile['activityLevel']>(existing?.activityLevel ?? 'none');
  const [activityTouched, setActivityTouched] = useState(!!existing);
  const [goals, setGoals] = useState<OnboardingProfile['goals']>(existing?.goals ?? []);
  const [health, setHealth] = useState<OnboardingProfile['health']>(existing?.health ?? []);
  const [runVolume, setRunVolume] = useState<OnboardingProfile['runVolume']>(existing?.runVolume ?? 'none');
  const [runTouched, setRunTouched] = useState(!!existing);
  const [stepGoal, setStepGoal] = useState<OnboardingProfile['stepGoal']>(existing?.stepGoal ?? 8000);
  const [consent1, setConsent1] = useState(existing?.consentAiInformational ?? false);
  const [consent2, setConsent2] = useState(existing?.consentConsultSpecialist ?? false);

  const profile: OnboardingProfile = useMemo(
    () => ({
      completed: false,
      name: name.trim(),
      age: parseInt(ageStr, 10) || 0,
      gender,
      heightCm: parseInt(heightStr, 10) || 0,
      weightKg: Math.round((parseFloat(weightStr.replace(',', '.')) || 0) * 10) / 10,
      activityLevel,
      goals,
      health,
      runVolume,
      stepGoal,
      consentAiInformational: consent1,
      consentConsultSpecialist: consent2,
    }),
    [name, ageStr, heightStr, weightStr, gender, activityLevel, goals, health, runVolume, stepGoal, consent1, consent2],
  );

  // Шаги 2 и 5 имеют дефолтное значение — требуем явного касания
  const stepValid = useMemo(() => {
    if (step === 1 && !activityTouched) return false;
    if (step === 4 && !runTouched) return false;
    return isStepValid(step, profile);
  }, [step, profile, activityTouched, runTouched]);

  const basicsErrors = showErrors ? validateBasics(profile) : {};

  function goNext() {
    if (!stepValid) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    if (step < ONBOARDING_STEPS - 1) {
      setDir(1);
      setStep((s) => s + 1);
    } else {
      finish();
    }
  }

  function goBack() {
    if (step === 0) {
      if (isEdit) router.back();
      return;
    }
    setShowErrors(false);
    setDir(-1);
    setStep((s) => s - 1);
  }

  function finish() {
    const now = Date.now();
    saveOnboarding({
      ...profile,
      completed: true,
      completedAt: existing?.completedAt ?? now,
      updatedAt: now,
    });
    if (isEdit) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }

  const containerWidth = isDesktop ? 560 : undefined;
  const enter = (dir >= 0 ? SlideInRight : SlideInLeft).duration(280).easing(Easing.out(Easing.cubic));

  return (
    <ScreenBackground>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.container, { maxWidth: containerWidth, paddingTop: insets.top + 12 }]}>
          {/* Header: назад + прогресс */}
          <View style={styles.header}>
            <Pressable
              onPress={goBack}
              hitSlop={10}
              disabled={step === 0 && !isEdit}
              style={({ pressed }) => [
                styles.backBtn,
                { borderColor: c.border, opacity: step === 0 && !isEdit ? 0 : pressed ? 0.7 : 1 },
              ]}>
              <Ionicons name="chevron-back" size={20} color={c.text} />
            </Pressable>
            <ProgressBar step={step} colors={c} />
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <Animated.View key={step} entering={enter} style={styles.stepWrap}>
              <Text style={[styles.eyebrow, { color: c.lime }]}>{STEP_META[step].eyebrow.toUpperCase()}</Text>
              <Text style={[styles.title, isDesktop && styles.titleDesktop, { color: c.text }]}>
                {STEP_META[step].title}
              </Text>
              <Text style={[styles.subtitle, { color: c.muted }]}>{STEP_META[step].subtitle}</Text>

              <View style={styles.stepBody}>
                {/* ШАГ 1 — основная информация */}
                {step === 0 && (
                  <>
                    <Field
                      label="Имя"
                      colors={c}
                      value={name}
                      onChangeText={setName}
                      placeholder="Как вас называть"
                      autoCapitalize="words"
                      error={basicsErrors.name}
                    />
                    <View style={styles.rowTwo}>
                      <View style={styles.flex1}>
                        <Field
                          label="Возраст"
                          colors={c}
                          value={ageStr}
                          onChangeText={(t) => setAgeStr(t.replace(/[^0-9]/g, ''))}
                          placeholder="25"
                          keyboardType="number-pad"
                          maxLength={3}
                          suffix="лет"
                          error={basicsErrors.age}
                        />
                      </View>
                      <View style={styles.flex1}>
                        <Field
                          label="Рост"
                          colors={c}
                          value={heightStr}
                          onChangeText={(t) => setHeightStr(t.replace(/[^0-9]/g, ''))}
                          placeholder="178"
                          keyboardType="number-pad"
                          maxLength={3}
                          suffix="см"
                          error={basicsErrors.heightCm}
                        />
                      </View>
                    </View>
                    <Field
                      label="Вес"
                      colors={c}
                      value={weightStr}
                      onChangeText={(t) => setWeightStr(t.replace(/[^0-9.,]/g, ''))}
                      placeholder="72"
                      keyboardType="decimal-pad"
                      maxLength={5}
                      suffix="кг"
                      error={basicsErrors.weightKg}
                    />
                    <Text style={[styles.fieldLabel, { color: c.muted, marginTop: 4 }]}>Пол</Text>
                    <View style={styles.chipRow}>
                      {GENDER_OPTIONS.map((opt) => (
                        <Chip key={opt.value} choice={opt} selected={gender === opt.value} colors={c} onPress={() => setGender(opt.value)} />
                      ))}
                    </View>
                  </>
                )}

                {/* ШАГ 2 — активность */}
                {step === 1 &&
                  ACTIVITY_OPTIONS.map((opt) => (
                    <OptionCard
                      key={opt.value}
                      choice={opt}
                      selected={activityTouched && activityLevel === opt.value}
                      colors={c}
                      onPress={() => {
                        setActivityLevel(opt.value);
                        setActivityTouched(true);
                      }}
                    />
                  ))}

                {/* ШАГ 3 — цели (мультивыбор) */}
                {step === 2 &&
                  GOAL_OPTIONS.map((opt) => (
                    <OptionCard
                      key={opt.value}
                      choice={opt}
                      multi
                      selected={goals.includes(opt.value)}
                      colors={c}
                      onPress={() => setGoals((g) => toggleGoal(g, opt.value))}
                    />
                  ))}

                {/* ШАГ 4 — здоровье (мультивыбор + предупреждение) */}
                {step === 3 && (
                  <>
                    {HEALTH_OPTIONS.map((opt) => (
                      <OptionCard
                        key={opt.value}
                        choice={opt}
                        multi
                        selected={health.includes(opt.value)}
                        colors={c}
                        onPress={() => setHealth((h) => toggleHealth(h, opt.value))}
                      />
                    ))}
                    {requiresSafetyLimit(health) ? (
                      <Animated.View entering={FadeIn.duration(220)} style={[styles.warnBox, { borderColor: c.warning }]}>
                        <Ionicons name="warning-outline" size={20} color={c.warning} />
                        <Text style={[styles.warnText, { color: c.text }]}>{SAFETY_WARNING}</Text>
                      </Animated.View>
                    ) : null}
                  </>
                )}

                {/* ШАГ 5 — бег */}
                {step === 4 &&
                  RUN_VOLUME_OPTIONS.map((opt) => (
                    <OptionCard
                      key={opt.value}
                      choice={opt}
                      selected={runTouched && runVolume === opt.value}
                      colors={c}
                      onPress={() => {
                        setRunVolume(opt.value);
                        setRunTouched(true);
                      }}
                    />
                  ))}

                {/* ШАГ 6 — шаги */}
                {step === 5 &&
                  STEP_GOAL_OPTIONS.map((opt) => (
                    <OptionCard
                      key={opt.value}
                      choice={opt}
                      selected={stepGoal === opt.value}
                      colors={c}
                      onPress={() => setStepGoal(opt.value)}
                    />
                  ))}

                {/* ШАГ 7 — согласие */}
                {step === 6 && (
                  <>
                    <ConsentRow
                      text="Я понимаю, что рекомендации ИИ носят информационный характер и не заменяют консультацию врача."
                      checked={consent1}
                      colors={c}
                      onToggle={() => setConsent1((v) => !v)}
                    />
                    <ConsentRow
                      text="При наличии заболеваний я обязуюсь консультироваться со специалистом перед выполнением физических нагрузок."
                      checked={consent2}
                      colors={c}
                      onToggle={() => setConsent2((v) => !v)}
                    />
                  </>
                )}
              </View>
            </Animated.View>
          </ScrollView>

          {/* CTA */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + 16, borderTopColor: c.border }]}>
            <PrimaryButton
              label={step < ONBOARDING_STEPS - 1 ? 'Далее' : isEdit ? 'Сохранить' : 'Завершить регистрацию'}
              disabled={!stepValid}
              onPress={goNext}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, width: '100%', alignSelf: 'center', paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 8 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFillWrap: { height: 8 },
  progressFill: { flex: 1, borderRadius: 4 },
  progressLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', minWidth: 34, textAlign: 'right' },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: 18, paddingBottom: 24 },
  stepWrap: { flex: 1 },
  eyebrow: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1.2, marginBottom: 8 },
  title: { fontSize: 26, fontFamily: 'Inter_700Bold', letterSpacing: -0.6, marginBottom: 8, lineHeight: 32 },
  titleDesktop: { fontSize: 32, lineHeight: 38 },
  subtitle: { fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 21, marginBottom: 22 },
  stepBody: { gap: 12 },

  // Field
  fieldWrap: { marginBottom: 4 },
  fieldLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginBottom: 8 },
  fieldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: WebTheme.radiusSm,
    paddingHorizontal: 14,
  },
  fieldInput: { flex: 1, paddingVertical: 14, fontSize: 16, fontFamily: 'Inter_400Regular' },
  fieldSuffix: { fontSize: 14, fontFamily: 'Inter_500Medium', marginLeft: 8 },
  fieldError: { fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 6 },
  rowTwo: { flexDirection: 'row', gap: 12 },
  flex1: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: WebTheme.radiusSm,
    borderWidth: 1,
  },
  chipLabel: { fontSize: 14, fontFamily: 'Inter_500Medium' },

  // Option card
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: WebTheme.radius,
    borderWidth: 1,
  },
  optionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  optionBody: { flex: 1 },
  optionLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  optionHint: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkBox: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },

  // Warning
  warnBox: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: WebTheme.radiusSm,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 214, 10, 0.1)',
    marginTop: 4,
  },
  warnText: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', lineHeight: 19 },

  // Consent
  consentRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: WebTheme.radius,
    borderWidth: 1,
  },
  consentText: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },

  // Footer
  footer: { paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
});
