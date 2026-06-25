import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  onEdit?: (id: string, text: string) => Promise<string | null>;
  onDelete?: (id: string) => Promise<string | null>;
  /** Может удалять чужие сообщения (владелец/мотиватор) */
  canModerate?: boolean;
  bubbleMaxWidth: number;
};

const TIME_GROUP_MS = 5 * 60 * 1000;
const AVATAR_COLORS = ['#C1FF00', '#64D2FF', '#FF9F0A', '#BF5AF2', '#FF6B6B', '#30D158', '#FFD60A'];

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const today = dayKey(now.getTime());
  const yesterday = dayKey(now.getTime() - 86400000);
  const key = dayKey(ts);
  if (key === today) return 'Сегодня';
  if (key === yesterday) return 'Вчера';
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

type ChatItem =
  | { type: 'sep'; id: string; label: string }
  | {
      type: 'msg';
      msg: ClanMessage;
      mine: boolean;
      showAuthor: boolean;
      showAvatar: boolean;
      grouped: boolean;
    };

export function ClanChat({ messages, onSend, onEdit, onDelete, canModerate, bubbleMaxWidth }: Props) {
  const c = useThemeColors();
  const currentUser = useTrackerStore((s) => s.currentUser);
  const firebaseUid = useTrackerStore((s) => s.firebaseUid);
  const clanId = useTrackerStore((s) =>
    s.currentUser ? s.userData[s.currentUser]?.clanId ?? null : null
  );

  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [actionFor, setActionFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const lastId = messages.length ? messages[messages.length - 1]?.id : null;

  const identityOf = (msg: ClanMessage) => (firebaseUid ? msg.uid : msg.username);
  const isMine = (msg: ClanMessage) =>
    firebaseUid ? msg.uid === firebaseUid : msg.username === currentUser;

  // Группировка подряд идущих сообщений + разделители дат
  const items = useMemo<ChatItem[]>(() => {
    const out: ChatItem[] = [];
    let lastDay = '';
    messages.forEach((msg, i) => {
      const prev = messages[i - 1];
      const next = messages[i + 1];
      const day = dayKey(msg.createdAt);
      if (day !== lastDay) {
        out.push({ type: 'sep', id: `sep-${msg.id}`, label: dayLabel(msg.createdAt) });
        lastDay = day;
      }
      const mine = isMine(msg);
      const sameAsPrev =
        !!prev &&
        isMine(prev) === mine &&
        identityOf(prev) === identityOf(msg) &&
        dayKey(prev.createdAt) === day &&
        msg.createdAt - prev.createdAt < TIME_GROUP_MS;
      const sameAsNext =
        !!next &&
        isMine(next) === mine &&
        identityOf(next) === identityOf(msg) &&
        dayKey(next.createdAt) === day &&
        next.createdAt - msg.createdAt < TIME_GROUP_MS;
      out.push({
        type: 'msg',
        msg,
        mine,
        showAuthor: !mine && !sameAsPrev,
        showAvatar: !mine && !sameAsNext,
        grouped: sameAsPrev,
      });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, firebaseUid, currentUser]);

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
    const err = editingId ? await onEdit?.(editingId, trimmed) ?? null : await onSend(trimmed);
    setSending(false);
    if (err) {
      setError(err);
      return;
    }
    setText('');
    setEditingId(null);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 30);
  }

  function startEdit(msg: ClanMessage) {
    setActionFor(null);
    setEditingId(msg.id);
    setText(msg.text);
  }

  function cancelEdit() {
    setEditingId(null);
    setText('');
  }

  async function doDelete(id: string) {
    setActionFor(null);
    setError('');
    const err = await onDelete?.(id);
    if (err) setError(err);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
      <View style={[styles.wrap, { backgroundColor: c.card, borderColor: c.border }]}>
        <View style={styles.head}>
          <View style={styles.headLeft}>
            <View style={[styles.headIcon, { backgroundColor: c.accentSoft }]}>
              <Ionicons name="chatbubbles" size={16} color={c.accent} />
            </View>
            <Text style={[styles.title, { color: c.text }]}>Чат клана</Text>
          </View>
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
              <View style={styles.emptyWrap}>
                <View style={[styles.emptyIcon, { backgroundColor: c.accentSoft }]}>
                  <Ionicons name="chatbubble-ellipses-outline" size={26} color={c.accent} />
                </View>
                <Text style={[styles.emptyTitle, { color: c.text }]}>Пока тихо</Text>
                <Text style={[styles.empty, { color: c.muted }]}>
                  Напишите первое сообщение — участники увидят его здесь и в push-уведомлении.
                </Text>
              </View>
            ) : (
              items.map((it) => {
                if (it.type === 'sep') {
                  return (
                    <View key={it.id} style={styles.sepRow}>
                      <View style={[styles.sepPill, { backgroundColor: c.cardHover }]}>
                        <Text style={[styles.sepText, { color: c.muted }]}>{it.label}</Text>
                      </View>
                    </View>
                  );
                }
                const { msg, mine, showAuthor, showAvatar, grouped } = it;
                const color = avatarColor(msg.username || '?');
                const canAct = (mine && !!onEdit) || (mine && !!onDelete) || (!mine && canModerate && !!onDelete);
                const open = actionFor === msg.id;
                return (
                  <View
                    key={msg.id}
                    style={[styles.row, mine && styles.rowMine, grouped && styles.rowGrouped]}>
                    {!mine ? (
                      <View style={styles.avatarGutter}>
                        {showAvatar ? (
                          <View style={[styles.avatar, { backgroundColor: `${color}26`, borderColor: `${color}55` }]}>
                            <Text style={[styles.avatarText, { color }]}>
                              {(msg.username || '?').charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                    <View style={{ maxWidth: bubbleMaxWidth, alignItems: mine ? 'flex-end' : 'flex-start' }}>
                      <Pressable
                        onLongPress={() => {
                          if (canAct) setActionFor(open ? null : msg.id);
                        }}
                        delayLongPress={250}
                        style={[
                          styles.bubble,
                          open && { borderWidth: 1, borderColor: c.accent },
                          mine
                            ? { backgroundColor: c.accent, borderBottomRightRadius: grouped ? 16 : 6 }
                            : {
                                backgroundColor: c.cardHover,
                                borderColor: open ? c.accent : c.border,
                                borderWidth: 1,
                                borderBottomLeftRadius: grouped ? 16 : 6,
                              },
                        ]}>
                        {showAuthor ? (
                          <Text style={[styles.author, { color }]} numberOfLines={1}>
                            {msg.username}
                          </Text>
                        ) : null}
                        <Text style={[styles.body, { color: mine ? c.onAccent : c.text }]}>{msg.text}</Text>
                        <Text style={[styles.time, { color: mine ? 'rgba(10,10,11,0.5)' : c.muted }]}>
                          {msg.editedAt ? 'изм. · ' : ''}
                          {formatTime(msg.createdAt)}
                        </Text>
                      </Pressable>

                      {open ? (
                        <View style={[styles.actionRow, { backgroundColor: c.card, borderColor: c.border }]}>
                          {mine && onEdit ? (
                            <Pressable style={styles.actionBtn} onPress={() => startEdit(msg)}>
                              <Ionicons name="create-outline" size={16} color={c.text} />
                              <Text style={[styles.actionText, { color: c.text }]}>Изменить</Text>
                            </Pressable>
                          ) : null}
                          {onDelete && (mine || canModerate) ? (
                            <Pressable style={styles.actionBtn} onPress={() => void doDelete(msg.id)}>
                              <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
                              <Text style={[styles.actionText, { color: '#FF6B6B' }]}>Удалить</Text>
                            </Pressable>
                          ) : null}
                          <Pressable style={styles.actionBtn} onPress={() => setActionFor(null)}>
                            <Ionicons name="close" size={16} color={c.muted} />
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {editingId ? (
          <View style={[styles.editBanner, { borderColor: c.accent, backgroundColor: c.accentSoft }]}>
            <Ionicons name="create-outline" size={14} color={c.accent} />
            <Text style={[styles.editBannerText, { color: c.accent }]}>Редактирование сообщения</Text>
            <Pressable onPress={cancelEdit} hitSlop={8}>
              <Ionicons name="close" size={16} color={c.accent} />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.inputRow}>
          <TextInput
            style={[
              styles.input,
              { color: c.text, backgroundColor: c.cardHover, borderColor: c.border },
            ]}
            placeholder="Сообщение…"
            placeholderTextColor={c.muted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
            onKeyPress={(e) => {
              // На web: Enter — отправить, Shift+Enter — перенос строки
              const ne = e.nativeEvent as { key?: string; shiftKey?: boolean };
              if (Platform.OS === 'web' && ne.key === 'Enter' && !ne.shiftKey) {
                (e as unknown as { preventDefault?: () => void }).preventDefault?.();
                void handleSend();
              }
            }}
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
              <Ionicons name={editingId ? 'checkmark' : 'send'} size={18} color={c.onAccent} />
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
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
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
    height: 340,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  messagesScroll: { flex: 1 },
  messagesContent: { padding: 12, gap: 3, flexGrow: 1 },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', flex: 1, paddingHorizontal: 20, gap: 8 },
  emptyIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  empty: { textAlign: 'center', fontSize: 13, lineHeight: 19 },
  sepRow: { alignItems: 'center', marginVertical: 8 },
  sepPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  sepText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  row: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'flex-end', gap: 8 },
  rowMine: { justifyContent: 'flex-end' },
  rowGrouped: { marginTop: -1 },
  avatarGutter: { width: 30, alignItems: 'center', justifyContent: 'flex-end' },
  avatar: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 0,
  },
  author: { fontSize: 11.5, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  body: { fontSize: 15, lineHeight: 21, fontFamily: 'Inter_400Regular' },
  time: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end', fontFamily: 'Inter_400Regular' },
  error: { color: '#ff6b6b', fontSize: 13, marginTop: 8 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 9,
  },
  actionText: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold' },
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
  },
  editBannerText: { flex: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
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
