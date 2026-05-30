import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';

import { useThemeColors } from '@/hooks/useThemeColors';
import { useTrackerStore } from '@/store/trackerStore';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { firebaseLogout } from '@/lib/firebase/authFlow';

export function LogoutButton() {
  const c = useThemeColors();
  const logout = useTrackerStore((s) => s.logout);

  return (
    <Pressable
      onPress={() => {
        void (async () => {
          if (isFirebaseConfigured()) {
            await firebaseLogout();
          } else {
            logout();
          }
          router.replace('/(auth)/sign-in');
        })();
      }}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.cardElevated,
      }}>
      <Text style={{ color: c.muted, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>Выйти</Text>
    </Pressable>
  );
}
