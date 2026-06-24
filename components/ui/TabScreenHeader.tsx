import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useThemeColors } from '@/hooks/useThemeColors';
import { selectAvatarDisplayUri, useTrackerStore } from '@/store/trackerStore';

type Props = {
  title?: string;
  subtitle?: string;
  showNotify?: boolean;
};

export function TabScreenHeader({ title, subtitle, showNotify = true }: Props) {
  const c = useThemeColors();
  const user = useTrackerStore((s) => s.currentUser);
  const avatarUri = useTrackerStore((s) => selectAvatarDisplayUri(s));

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          {title ? <Text style={[styles.title, { color: c.text }]}>{title}</Text> : null}
          {subtitle ? (
            <Text style={[styles.subtitle, { color: c.muted }]}>{subtitle}</Text>
          ) : null}
        </View>
        {showNotify ? (
          <Pressable
            onPress={() => router.push('/(tabs)/profile')}
            style={[styles.toolBtn, { backgroundColor: c.card, borderColor: c.border }]}>
            <Ionicons name="notifications-outline" size={20} color={c.text} />
          </Pressable>
        ) : null}
        <View style={[styles.avatar, { backgroundColor: c.cardHover, borderColor: c.border }]}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
          ) : (
            <Text style={[styles.avatarLetter, { color: c.text }]}>
              {(user || '?').charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 24, fontFamily: 'Inter_700Bold', letterSpacing: -0.4 },
  subtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 4 },
  toolBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarLetter: { fontSize: 17, fontFamily: 'Inter_700Bold' },
});
