import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useThemeColors } from '@/hooks/useThemeColors';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { subscribeStories } from '@/lib/firebase/storiesSync';
import { selectAvatarDisplayUri, useTrackerStore } from '@/store/trackerStore';
import type { Story } from '@/lib/types';

type UserStories = { uid: string; username: string; viewed: boolean };

export function StoriesRow() {
  const c = useThemeColors();
  const user = useTrackerStore((s) => s.currentUser);
  const avatarUri = useTrackerStore((s) => selectAvatarDisplayUri(s));
  const [stories, setStories] = useState<Story[]>([]);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const unsub = subscribeStories(setStories);
    return unsub;
  }, []);

  // Одна аватарка-кружок на пользователя (последняя история)
  const byUser: UserStories[] = [];
  const seen = new Set<string>();
  for (const s of stories) {
    if (seen.has(s.uid)) continue;
    seen.add(s.uid);
    byUser.push({ uid: s.uid, username: s.username, viewed: false });
  }
  // свои истории — первыми
  byUser.sort((a, b) => (a.username === user ? -1 : b.username === user ? 1 : 0));

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Создать историю */}
        <Pressable style={styles.item} onPress={() => router.push('/story-composer')}>
          <View style={styles.createWrap}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.createAvatar} />
            ) : (
              <View style={[styles.createAvatar, { backgroundColor: c.cardHover, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: c.text, fontFamily: 'Inter_700Bold', fontSize: 18 }}>
                  {(user || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={[styles.plusBadge, { backgroundColor: c.lime, borderColor: c.background }]}>
              <Ionicons name="add" size={14} color="#0A0A0B" />
            </View>
          </View>
          <Text style={[styles.label, { color: c.muted }]} numberOfLines={1}>
            Ваша история
          </Text>
        </Pressable>

        {/* Чужие/свои активные истории */}
        {byUser.map((u) => (
          <Pressable
            key={u.uid}
            style={styles.item}
            onPress={() => router.push(`/story-viewer?uid=${encodeURIComponent(u.uid)}`)}>
            <LinearGradient
              colors={['#C1FF00', '#9ECC00', '#64D2FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ring}>
              <View style={[styles.ringInner, { backgroundColor: c.background }]}>
                <View style={[styles.storyAvatar, { backgroundColor: c.cardHover }]}>
                  <Text style={{ color: c.text, fontFamily: 'Inter_700Bold', fontSize: 18 }}>
                    {u.username.charAt(0).toUpperCase()}
                  </Text>
                </View>
              </View>
            </LinearGradient>
            <Text style={[styles.label, { color: c.text }]} numberOfLines={1}>
              {u.username === user ? 'Вы' : u.username}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const SIZE = 64;
const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  scroll: { gap: 14, paddingHorizontal: 2 },
  item: { width: SIZE + 8, alignItems: 'center', gap: 6 },
  createWrap: { width: SIZE, height: SIZE },
  createAvatar: { width: SIZE, height: SIZE, borderRadius: SIZE / 2 },
  plusBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  ringInner: {
    width: SIZE - 5,
    height: SIZE - 5,
    borderRadius: (SIZE - 5) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyAvatar: {
    width: SIZE - 11,
    height: SIZE - 11,
    borderRadius: (SIZE - 11) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 12, fontFamily: 'Inter_500Medium', maxWidth: SIZE + 6, textAlign: 'center' },
});
