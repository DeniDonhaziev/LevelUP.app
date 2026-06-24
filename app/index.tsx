import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';

import { useTrackerStore } from '@/store/trackerStore';
import { isOnboardingComplete } from '@/lib/onboarding';

/**
 * Не ждём rehydrate — иначе при сбое AsyncStorage/zustand вечный спиннер.
 * До загрузки из хранилища currentUser = null → экран входа; после merge стор
 * обновится и редирект на вкладки сработает сам.
 */
export default function Index() {
  const authReady = useTrackerStore((s) => s.authReady);
  const currentUser = useTrackerStore((s) => s.currentUser);
  const userData = useTrackerStore((s) => (currentUser ? s.userData[currentUser] : null));

  if (!authReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' }}>
        <ActivityIndicator size="large" color="#30d158" />
      </View>
    );
  }

  if (!currentUser) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  // Гейт анкеты: новый пользователь без заполненной анкеты → онбординг
  if (!isOnboardingComplete(userData)) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)" />;
}
