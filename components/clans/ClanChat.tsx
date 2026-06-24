import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useThemeColors } from '@/hooks/useThemeColors';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import {
  getNotificationPermissionState,
  requestNotificationPermissionFromUser,
} from '@/lib/notifications/clanChat';
import { registerPushToken } from '@/lib/notifications/pushTokens';
import type { ClanMessage } from '@/lib/types';
import { WebTheme } from '@/lib/theme';
import { useTrackerStore } from '@/store/trackerStore';

type Props = {
  messages: ClanMessage[];
  onSend: (text: string) => Promise<string | null>;
  bubbleMaxWidth: number;
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function ClanChat({ messages, onSend, bubbleMaxWidth }: Props) {
  const c = useThemeColors();
  const currentUser = useTrackerStore((s) => s.currentUser);
  const firebaseUid = useTrackerStore((s) => s.firebaseUid);
  const clanId = useTrackerStore((s) =>
    s.currentUser ? s.userData[s.currentUser]?.clanId ?? null : null
  );

  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const lastId = messages.length ? messages[messages.length - 1]?.id : null;

  useEffect(() => {
    if (!lastId) return;
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 40);
    return () => clearTimeout(t);
  }, [lastId, messages.length]);

  useEffect(() => {
    if (!firebaseUid || !isFirebaseConfigured()) return;
    const state = getNotificationPermissionState();
    setPushEnabled(state === 'granted');
  }, [firebaseUid, clanId]);

  async function enablePush() {
    if (!firebaseUid || pushBusy) return;
    setPushBusy(true);
    setError('');
    try {
      const state = getNotificationPermissionState();
      if (state === 'unsupported') {
        setError('Браузер не поддерживает уведомления.');
        return;
      }
      if (state !== 'granted') {
        const ok = await requestNotificationPermissionFromUser();
        if (!ok) {
          setError('Разрешите уведомления в браузере или настройках телефона.');
          return;
        }
      }
      const result = await registerPushToken(firebaseUid, clanId);
      setPushEnabled(result.ok);
      if (!result.ok) {
        setError('Не удалось подключить push. Обновите страницу и попробуйте снова.');
      }
    } finally {
      setPushBusy(false);
    }
  }

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError('');
    const err = await onSend(trimmed);
    setSending(false);
    if (err) {
      setError(err);
      return;
    }
    setText('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 30);
  }

  const isMine = (msg: ClanMessage) =>
    firebaseUid ? msg.uid === firebaseUid : msg.username === currentUser;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
      <View style={[styles.wrap, { backgroundColor: c.card, borderColor: c.border }]}>
        <View style={styles.head}>
          <Text style={[styles.title, { color: c.text }]}>Чат клана</Text>
          {pushEnabled === true ? (
            <View style={[styles.liveBadge, { backgroundColor: c.accentSoft }]}>
              <View style={[styles.liveDot, { backgroundColor: c.accent }]} />
              <Text style={[styles.liveText, { color: c.accent }]}>Push вкл.</Text>
            </View>
          ) : isFirebaseConfigured() && firebaseUid ? (
            <Pressable
              disabled={pushBusy}
              onPress={() => void enablePush()}
              style={[styles.pushBtn, { borderColor: c.accent, opacity: pushBusy ? 0.6 : 1 }]}>
              {pushBusy ? (
                <ActivityIndicator size="small" color={c.accent} />
              ) : (
                <>
                  <Ionicons name="notifications-outline" size={14} color={c.accent} />
                  <Text style={[styles.pushBtnText, { color: c.accent }]}>Push</Text>
                </>
              )}
            </Pressable>
          ) : null}
        </View>

        <View style={[styles.messagesBox, { backgroundColor: c.backgroundAlt, borderColor: c.border }]}>
          <ScrollView
            ref={scrollRef}
            style={styles.messagesScroll}
            contentContainerStyle={styles.messagesContent}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled>
            {messages.length === 0 ? (
              <Text style={[styles.empty, { color: c.muted }]}>
                Напишите первое сообщение — участники увидят его здесь и в push.
              </Text>
            ) : (
              messages.map((msg) => {
                const mine = isMine(msg);
                return (
                  <View key={msg.id} style={[styles.row, mine && styles.rowMine]}>
                    <View
                      style={[
                        styles.bubble,
                        { maxWidth: bubbleMaxWidth },
                        mine
                          ? { backgroundColor: c.accent }
                          : { backgroundColor: c.cardHover, borderColor: c.border, borderWidth: 1 },
                      ]}>
                      {!mine ? (
                        <Text style={[styles.author, { color: c.muted }]} numberOfLines={1}>
                          {msg.username}
                        </Text>
                      ) : null}
                      <Text
                        style={[
                          styles.body,
                          { color: mine ? c.onAccent : c.text },
                        ]}>
                        {msg.text}
                      </Text>
                      <Text
                        style={[
                          styles.time,
                          { color: mine ? 'rgba(10,10,11,0.55)' : c.muted },
                        ]}>
                        {formatTime(msg.createdAt)}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.inputRow}>
          <TextInput
            style={[
              styles.input,
              {
                color: c.text,
                backgroundColor: c.cardHover,
                borderColor: c.border,
              },
            ]}
            placeholder="Сообщение…"
            placeholderTextColor={c.muted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
            onSubmitEditing={() => void handleSend()}
            blurOnSubmit={false}
          />
          <Pressable
            onPress={() => void handleSend()}
            disabled={!text.trim() || sending}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: c.accent,
                opacity: !text.trim() || sending ? 0.45 : pressed ? 0.85 : 1,
              },
            ]}>
            {sending ? (
              <ActivityIndicator size="small" color={c.onAccent} />
            ) : (
              <Ionicons name="send" size={18} color={c.onAccent} />
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: WebTheme.radiusLg,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  pushBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  pushBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  messagesBox: {
    height: 320,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  messagesScroll: { flex: 1 },
  messagesContent: { padding: 12, gap: 8, flexGrow: 1 },
  empty: { textAlign: 'center', fontSize: 14, lineHeight: 20, marginTop: 24, paddingHorizontal: 12 },
  row: { flexDirection: 'row', justifyContent: 'flex-start' },
  rowMine: { justifyContent: 'flex-end' },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 0,
  },
  author: { fontSize: 11, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  body: { fontSize: 15, lineHeight: 21, fontFamily: 'Inter_400Regular' },
  time: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end', fontFamily: 'Inter_400Regular' },
  error: { color: '#ff6b6b', fontSize: 13, marginTop: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 10 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    fontFamily: 'Inter_400Regular',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
