import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';

import { useTrackerStore } from '@/store/trackerStore';

/**
 * Не ждём rehydrate — иначе при сбое AsyncStorage/zustand вечный спиннер.
 * До загрузки из хранилища currentUser = null → экран входа; после merge стор
 * обновится и редирект на вкладки сработает сам.
 */
export default function Index() {
  const authReady = useTrackerStore((s) => s.authReady);
  const currentUser = useTrackerStore((s) => s.currentUser);

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

  return <Redirect href="/(tabs)" />;
}
