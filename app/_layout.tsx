import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useMemo } from 'react';
import { Platform, Text, TextInput } from 'react-native';
import 'react-native-reanimated';

import '@/lib/configureWebIcons';
import { useWebIconsReady } from '@/lib/configureWebIcons';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { flushPendingUserSave, flushSaveUser } from '@/lib/firebase/debouncedSave';
import { subscribeToAuthChanges } from '@/lib/firebase/authFlow';
import { refreshFcmTokenIfPermitted, setupFcmNotificationHandlers } from '@/lib/notifications/fcm';
import { syncMotivationSchedule } from '@/lib/notifications/runMotivation';
import { DEFAULT_TOPIC_ID } from '@/lib/topics';
import { useTrackerStore } from '@/store/trackerStore';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

const navDark = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Colors.dark.background,
    card: Colors.dark.cardElevated,
    text: Colors.dark.text,
    border: Colors.dark.border,
    primary: Colors.dark.accent,
    notification: Colors.dark.accent,
  },
};

const navLight = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: Colors.light.background,
    card: Colors.light.card,
    text: Colors.light.text,
    border: Colors.light.border,
    primary: Colors.light.accent,
    notification: Colors.light.accent,
  },
};

function getNativeFontMap() {
  const { Inter_400Regular } = require('@expo-google-fonts/inter/400Regular');
  const { Inter_500Medium } = require('@expo-google-fonts/inter/500Medium');
  const { Inter_600SemiBold } = require('@expo-google-fonts/inter/600SemiBold');
  const { Inter_700Bold } = require('@expo-google-fonts/inter/700Bold');
  return {
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  };
}

export default function RootLayout() {
  const isWeb = Platform.OS === 'web';
  const iconsReady = useWebIconsReady();
  const nativeFonts = useMemo(() => (isWeb ? {} : getNativeFontMap()), [isWeb]);
  const [loaded, error] = useFonts(nativeFonts);

  const fontsReady = (isWeb || loaded) && iconsReady;

  useEffect(() => {
    if (!error) return;
    if (isWeb) {
      console.warn('[fonts] web fallback:', error.message);
      return;
    }
    throw error;
  }, [error, isWeb]);

  useEffect(() => {
    if (fontsReady) SplashScreen.hideAsync();
  }, [fontsReady]);

  useEffect(() => {
    if (!fontsReady) return;
    const T = Text as unknown as { defaultProps?: { style?: unknown } };
    T.defaultProps = T.defaultProps ?? {};
    const prev = T.defaultProps.style;
    T.defaultProps.style = [prev, { fontFamily: 'Inter_400Regular' }];

    const TI = TextInput as unknown as { defaultProps?: { style?: unknown } };
    TI.defaultProps = TI.defaultProps ?? {};
    const prevI = TI.defaultProps.style;
    TI.defaultProps.style = [prevI, { fontFamily: 'Inter_400Regular' }];
  }, [fontsReady]);

  if (!fontsReady) return null;

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const stackBg = scheme === 'dark' ? Colors.dark.background : Colors.light.background;

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      const st = useTrackerStore.getState();
      st.ensureClanCatalog();
      st.ensureDemoAccounts();
      st.setAuthReady(true);
      return;
    }
    return subscribeToAuthChanges();
  }, []);

  const currentUser = useTrackerStore((s) => s.currentUser);
  const authReady = useTrackerStore((s) => s.authReady);

  const firebaseUid = useTrackerStore((s) => s.firebaseUid);

  useEffect(() => {
    return setupFcmNotificationHandlers();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const persistOnHide = () => {
      void flushPendingUserSave();
      const st = useTrackerStore.getState();
      if (st.firebaseUid && st.currentUser) {
        void flushSaveUser(
          st.firebaseUid,
          st.currentUser,
          st.getUserData(st.currentUser),
          st.profilePhotoURL,
          st.getTopicId(st.currentUser)
        );
      }
    };
    window.addEventListener('beforeunload', persistOnHide);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') persistOnHide();
    });
    return () => {
      window.removeEventListener('beforeunload', persistOnHide);
    };
  }, []);

  useEffect(() => {
    if (!authReady || !currentUser || !firebaseUid) return;
    void (async () => {
      const st = useTrackerStore.getState();
      await refreshFcmTokenIfPermitted(firebaseUid, st.getClanId());
      const topicId = st.userTopics[currentUser] ?? DEFAULT_TOPIC_ID;
      if (topicId === 'sport') {
        await syncMotivationSchedule(currentUser, st.runHistory);
      }
    })();
  }, [authReady, currentUser, firebaseUid]);

  return (
    <ThemeProvider value={scheme === 'dark' ? navDark : navLight}>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: stackBg, flex: 1 },
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
        <Stack.Screen name="story-composer" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="story-viewer" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
