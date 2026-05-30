import { useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { firebaseSendPasswordReset } from '@/lib/firebase/authFlow';
import { AppInput } from '@/components/ui/AppInput';
import { GroupedSection } from '@/components/ui/GroupedSection';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { screenLayout } from '@/lib/screenLayout';
import { useTrackerStore } from '@/store/trackerStore';

export default function ForgotPasswordScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const currentUser = useTrackerStore((s) => s.currentUser);
  const resetLocalPassword = useTrackerStore((s) => s.resetLocalPassword);

  const firebaseOn = isFirebaseConfigured();

  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  if (currentUser) {
    return <Redirect href="/(tabs)" />;
  }

  async function onSubmitFirebase() {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const err = await firebaseSendPasswordReset(identifier);
      if (err) {
        setError(err);
        return;
      }
      setSuccess(
        'Если аккаунт существует, мы отправили письмо со ссылкой для создания нового пароля. Проверьте почту (и папку «Спам»).'
      );
    } finally {
      setLoading(false);
    }
  }

  function onSubmitLocal() {
    setError('');
    setSuccess('');
    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }
    const err = resetLocalPassword(username, newPassword);
    if (err) {
      setError(err);
      return;
    }
    setSuccess('Новый пароль сохранён. Теперь можно войти.');
  }

  return (
    <ScreenBackground>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backRow, { opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="chevron-back" size={22} color={c.text} />
            <Text style={[styles.backText, { color: c.text }]}>Назад</Text>
          </Pressable>

          <View style={styles.topTitleWrap}>
            <Text style={[screenLayout.pageTitle, { color: c.text }]}>Новый пароль</Text>
            <Text style={[screenLayout.pageSubtitle, { color: c.muted }]}>
              {firebaseOn
                ? 'Введите email или логин — отправим ссылку для сброса пароля'
                : 'Введите имя пользователя и придумайте новый пароль'}
            </Text>
          </View>

          {error ? <Text style={[styles.error, { color: c.text }]}>{error}</Text> : null}
          {success ? (
            <View style={[styles.successCard, { borderColor: c.border, backgroundColor: c.cardElevated }]}>
              <Text style={{ color: c.text, fontFamily: 'Inter_500Medium', lineHeight: 20 }}>{success}</Text>
            </View>
          ) : null}

          <GroupedSection>
            <View style={styles.formInner}>
              {firebaseOn ? (
                <>
                  <Text style={[styles.label, { color: c.muted }]}>Email или логин</Text>
                  <AppInput
                    value={identifier}
                    onChangeText={setIdentifier}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="default"
                    autoComplete="username"
                  />
                  <PrimaryButton
                    label="Отправить ссылку"
                    loading={loading}
                    disabled={!!success}
                    onPress={() => void onSubmitFirebase()}
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
                  <Text style={[styles.label, { color: c.muted }]}>Новый пароль</Text>
                  <AppInput
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                  />
                  <Text style={[styles.label, { color: c.muted }]}>Повторите пароль</Text>
                  <AppInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                  />
                  <PrimaryButton
                    label="Сохранить пароль"
                    loading={loading}
                    disabled={!!success}
                    onPress={onSubmitLocal}
                  />
                </>
              )}

              {success ? (
                <PrimaryButton label="Перейти ко входу" onPress={() => router.replace('/(auth)/sign-in')} />
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
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 4 },
  backText: { fontSize: 16, fontFamily: 'Inter_500Medium' },
  topTitleWrap: { marginBottom: 24 },
  formInner: { padding: 16, gap: 4 },
  label: { fontSize: 13, marginBottom: 6, fontFamily: 'Inter_500Medium' },
  error: { marginBottom: 12, fontSize: 14, fontFamily: 'Inter_500Medium' },
  successCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
  },
});
