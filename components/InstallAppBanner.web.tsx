import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const APP_URL = 'https://tracker-mobile.expo.app';

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Подсказка установить LevelUp как приложение на рабочий стол (только web). */
export function InstallAppBanner() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    const onInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const onInstall = useCallback(async () => {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      return;
    }
    window.open(APP_URL, '_blank', 'noopener');
  }, [deferred]);

  if (Platform.OS !== 'web' || installed || hidden) return null;

  const canNativeInstall = !!deferred;

  return (
    <View
      style={{
        marginBottom: 14,
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.cardHover,
      }}>
      <Text style={{ color: c.text, fontFamily: 'Inter_600SemiBold', fontSize: 15, marginBottom: 6 }}>
        Установить на рабочий стол
      </Text>
      <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18, marginBottom: 10 }}>
        {canNativeInstall
          ? 'Откроется как отдельная программа — без адресной строки браузера.'
          : 'В Chrome или Edge: меню ⋮ → «Установить LevelUp» / «Приложения» → «Установить этот сайт». Или запустите scripts/create-desktop-shortcut.ps1'}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={() => void onInstall()}
          style={({ pressed }) => ({
            flex: 1,
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: c.cardElevated,
            borderWidth: 1,
            borderColor: c.accent,
            opacity: pressed ? 0.9 : 1,
            alignItems: 'center',
          })}>
          <Text style={{ color: c.text, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>
            {canNativeInstall ? 'Установить' : 'Открыть сайт'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setHidden(true)}
          style={({ pressed }) => ({
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: c.border,
            opacity: pressed ? 0.85 : 1,
            justifyContent: 'center',
          })}>
          <Text style={{ color: c.muted, fontFamily: 'Inter_500Medium', fontSize: 14 }}>Скрыть</Text>
        </Pressable>
      </View>
    </View>
  );
}
