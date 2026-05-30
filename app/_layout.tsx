/** Только подпакеты — не barrel index.js (он тянет все .ttf и ломает Metro/Web на части весов). */
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Text, TextInput } from 'react-native';
import 'react-native-reanimated';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { subscribeToAuthChanges } from '@/lib/firebase/authFlow';
import { ensureNotificationPermission } from '@/lib/notifications/clanChat';
import { registerPushToken } from '@/lib/notifications/pushTokens';
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

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  useEffect(() => {
    if (!loaded) return;
    const T = Text as unknown as { defaultProps?: { style?: unknown } };
    T.defaultProps = T.defaultProps ?? {};
    const prev = T.defaultProps.style;
    T.defaultProps.style = [prev, { fontFamily: 'Inter_400Regular' }];

    const TI = TextInput as unknown as { defaultProps?: { style?: unknown } };
    TI.defaultProps = TI.defaultProps ?? {};
    const prevI = TI.defaultProps.style;
    TI.defaultProps.style = [prevI, { fontFamily: 'Inter_400Regular' }];
  }, [loaded]);

  if (!loaded) return null;

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
    if (!authReady || !currentUser) return;
    const topicId = useTrackerStore.getState().userTopics[currentUser] ?? DEFAULT_TOPIC_ID;
    if (topicId !== 'sport') return;
    void (async () => {
      if (!(await ensureNotificationPermission()) || !firebaseUid) return;
      const clanId = useTrackerStore.getState().getClanId();
      await registerPushToken(firebaseUid, clanId);
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
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
