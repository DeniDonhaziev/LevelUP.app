import { useEffect, useState } from 'react';
import {
  StyleSheet,
  Pressable,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { Redirect, router } from 'expo-router';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { firebaseLogin, firebaseRegister } from '@/lib/firebase/authFlow';
import { InstallAppBanner } from '@/components/InstallAppBanner';
import { AppInput } from '@/components/ui/AppInput';
import { GroupedSection } from '@/components/ui/GroupedSection';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { screenLayout } from '@/lib/screenLayout';
import { DEMO_ACCOUNTS, getTopicConfig, DEFAULT_TOPIC_ID } from '@/lib/topics';
import { useTrackerStore } from '@/store/trackerStore';

export default function SignInScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const currentUser = useTrackerStore((s) => s.currentUser);
  const login = useTrackerStore((s) => s.login);
  const register = useTrackerStore((s) => s.register);
  const ensureDemoAccounts = useTrackerStore((s) => s.ensureDemoAccounts);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  /** Локальный режим: логин */
  const [username, setUsername] = useState('');
  const [loginId, setLoginId] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const firebaseOn = isFirebaseConfigured();
  const topicPreview = getTopicConfig();

  useEffect(() => {
    if (!firebaseOn) ensureDemoAccounts();
  }, [firebaseOn, ensureDemoAccounts]);

  if (currentUser) {
    return <Redirect href="/(tabs)" />;
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
        router.replace('/(tabs)');
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
      router.replace('/(tabs)');
      return;
    }
    const err = register(username.trim(), password, DEFAULT_TOPIC_ID);
    if (err) {
      setError(err);
      return;
    }
    router.replace('/(tabs)');
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

        <InstallAppBanner />

        <SegmentedControl
          value={mode}
          options={[
            { key: 'login', label: 'Вход' },
            { key: 'register', label: 'Регистрация' },
          ]}
          onChange={(key) => {
            setMode(key);
            setError('');
            if (key === 'login' && email.trim()) setLoginId(email.trim());
            if (key === 'register' && loginId.trim().includes('@')) setEmail(loginId.trim());
          }}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!firebaseOn ? (
          <View style={[styles.demoCard, { borderColor: c.border, backgroundColor: c.cardElevated }]}>
            <Text style={{ color: c.text, fontFamily: 'Inter_600SemiBold', marginBottom: 8 }}>Демо-учётки</Text>
            {DEMO_ACCOUNTS.map((demo) => (
              <Pressable
                key={demo.username}
                onPress={() => {
                  setMode('login');
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
            {mode === 'login' ? (
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
                <Text style={[styles.label, { color: c.muted }]}>Email</Text>
                <AppInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  autoComplete="email"
                />
                <Text style={[styles.label, { color: c.muted }]}>Имя пользователя</Text>
                <AppInput
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  autoComplete="username"
                />
              </>
            )}
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
        <AppInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <PrimaryButton
          label={mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
          loading={loading}
          onPress={() => void onSubmit()}
        />

        {mode === 'login' ? (
          <Pressable
            onPress={() => router.push('/(auth)/forgot-password')}
            style={({ pressed }) => [styles.forgotLink, { opacity: pressed ? 0.7 : 1 }]}>
            <Text style={[styles.forgotText, { color: c.text }]}>Забыли пароль?</Text>
          </Pressable>
        ) : null}
        </View>
        </GroupedSection>
      </ScrollView>
    </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 20, paddingTop: 64, paddingBottom: 40 },
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
  topicRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  topicChip: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
});
