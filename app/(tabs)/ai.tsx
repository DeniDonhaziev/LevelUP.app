import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { AppInput } from '@/components/ui/AppInput';
import { ScreenScroll } from '@/components/ui/ScreenScroll';
import { TabScreenHeader } from '@/components/ui/TabScreenHeader';
import { AiPaywall } from '@/components/ai/AiPaywall';
import { AiHero, AiFeatureCards } from '@/components/ai/AiHero';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAppTopic } from '@/hooks/useAppTopic';
import { useTrackerStore } from '@/store/trackerStore';
import { buildAiProfileContext, mapToBodyGoal } from '@/lib/onboarding';
import { isCurrentUserAdmin, getCurrentAuthEmail } from '@/lib/admin';
import { isSubActive, SUBSCRIPTION_ENABLED, type PlanId } from '@/lib/subscription';
import { requestSubscription } from '@/lib/firebase/subscriptionSync';
import { WebTheme } from '@/lib/theme';
import {
  analyzeFoodImage,
  canAnalyzeFoodPhoto,
  coachChat,
  isAiConfigured,
  type BodyGoal,
  type ChatMessage,
  type FoodAnalysisResult,
} from '@/lib/ai/coachRouter';

const KEY_HINT = 'Добавьте в .env EXPO_PUBLIC_OPENROUTER_API_KEY — https://openrouter.ai/keys';

export default function AiScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const topic = useAppTopic();

  const [goal, setGoal] = useState<BodyGoal>('lose');

  // Стартовая цель коуча — из анкеты пользователя
  useEffect(() => {
    const st = useTrackerStore.getState();
    const profile = st.currentUser ? st.userData[st.currentUser]?.onboarding : undefined;
    if (profile?.completed) setGoal(mapToBodyGoal(profile.goals));
  }, []);

  // Прикреплённое к чату фото еды (отправляется вместе с сообщением)
  const [pendingImg, setPendingImg] = useState<{ uri: string; base64: string; mime: string } | null>(null);
  const [foodError, setFoodError] = useState<string | null>(null);

  // Сохранённые чаты (как в ChatGPT)
  const aiChats = useTrackerStore((s) => s.aiChats);
  const activeAiChatId = useTrackerStore((s) => s.activeAiChatId);
  const saveAiChat = useTrackerStore((s) => s.saveAiChat);
  const setActiveAiChat = useTrackerStore((s) => s.setActiveAiChat);
  const deleteAiChat = useTrackerStore((s) => s.deleteAiChat);

  const addFoodEntry = useTrackerStore((s) => s.addFoodEntry);

  // Подписка на ИИ
  const currentUser = useTrackerStore((s) => s.currentUser);
  const firebaseUid = useTrackerStore((s) => s.firebaseUid);
  const mySubscription = useTrackerStore((s) => s.mySubscription);
  const setMySubscription = useTrackerStore((s) => s.setMySubscription);
  const isAdmin = isCurrentUserAdmin(currentUser);
  const aiUnlocked = !SUBSCRIPTION_ENABLED || isAdmin || isSubActive(mySubscription);

  // Имя для приветствия — актуальное имя профиля (то, что пользователь меняет в профиле).
  const displayName = useTrackerStore((s) => s.currentUser?.trim() ?? '');

  const handleSubscribe = useCallback(
    async (plan: PlanId) => {
      if (!firebaseUid || !currentUser) throw new Error('Войдите в аккаунт');
      const email = getCurrentAuthEmail() ?? '';
      const sub = await requestSubscription(firebaseUid, currentUser, email, plan);
      setMySubscription(sub); // оптимистично — статус «на рассмотрении»
    },
    [firebaseUid, currentUser, setMySubscription]
  );

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const st = useTrackerStore.getState();
    return (st.aiChats.find((ch) => ch.id === st.activeAiChatId)?.messages as ChatMessage[]) ?? [];
  });
  const [showHistory, setShowHistory] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [typingMessageIndex, setTypingMessageIndex] = useState<number | null>(null);
  const [typingText, setTypingText] = useState('');
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAnimatedSignatureRef = useRef('');

  const hasKey = isAiConfigured();
  const canPhoto = canAnalyzeFoodPhoto();

  /** Прикрепить фото еды к чату (анализ — при отправке). */
  const pickImage = useCallback(
    async (source: 'library' | 'camera') => {
      setFoodError(null);
      if (!canPhoto) {
        setFoodError(KEY_HINT);
        return;
      }
      if (source === 'camera') {
        const cam = await ImagePicker.requestCameraPermissionsAsync();
        if (!cam.granted) {
          setFoodError('Нужно разрешение камеры.');
          return;
        }
      } else {
        const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!lib.granted) {
          setFoodError('Нужен доступ к галерее.');
          return;
        }
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.55, base64: true })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.55, base64: true });

      if (result.canceled || !result.assets?.[0]) return;
      const a = result.assets[0];
      if (!a.base64) {
        setFoodError('Не удалось прочитать фото. Попробуйте другое изображение.');
        return;
      }
      setPendingImg({ uri: a.uri, base64: a.base64, mime: a.mimeType ?? 'image/jpeg' });
    },
    [canPhoto]
  );

  const sendChat = useCallback(async () => {
    const text = chatInput.trim();
    const img = pendingImg;
    if ((!text && !img) || chatLoading) return;
    if (!isAiConfigured()) {
      setFoodError(KEY_HINT);
      return;
    }
    const userContent = img ? (text ? `🍽 ${text}` : '🍽 Фото еды — посчитай калории и дай совет') : text;
    const nextUser: ChatMessage = { role: 'user', content: userContent };
    const thread = [...chatMessages, nextUser];
    setChatInput('');
    setPendingImg(null);
    setChatMessages(thread);
    setChatLoading(true);
    setFoodError(null);
    try {
      let replyText: string;
      if (img) {
        // Анализ фото еды → калории + советы прямо в чат
        const out = await analyzeFoodImage(img.base64, img.mime, goal, topic.id);
        if (out.parsed) {
          const r = out.parsed;
          const kcal = r.calories != null ? `~${Math.round(r.calories)} ккал` : '';
          const macros = `Б ${fmtNum(r.protein_g)} · Ж ${fmtNum(r.fat_g)} · У ${fmtNum(r.carbs_g)} г`;
          replyText = `🍽 ${r.foods_ru}\n${kcal}${kcal ? ' · ' : ''}${macros}\n\n${r.advice_ru}`;
          addFoodEntry({
            foods: r.foods_ru,
            calories: r.calories,
            protein: r.protein_g,
            fat: r.fat_g,
            carbs: r.carbs_g,
          });
        } else {
          replyText = out.raw;
        }
      } else {
        const st = useTrackerStore.getState();
        const profile = st.currentUser ? st.userData[st.currentUser]?.onboarding : undefined;
        replyText = await coachChat(thread, goal, topic.id, buildAiProfileContext(profile), displayName);
      }
      const withReply = [...thread, { role: 'assistant' as const, content: replyText }];
      setChatMessages(withReply);
      saveAiChat(withReply); // сохраняем чат (как в ChatGPT)
    } catch (e) {
      setFoodError((e as Error).message ?? 'Ошибка');
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, pendingImg, chatLoading, chatMessages, goal, topic.id, saveAiChat, addFoodEntry, displayName]);

  function newChat() {
    setActiveAiChat(null);
    setChatMessages([]);
    setShowHistory(false);
  }

  function openChat(id: string) {
    const chat = aiChats.find((ch) => ch.id === id);
    if (!chat) return;
    setActiveAiChat(id);
    setChatMessages(chat.messages as ChatMessage[]);
    setShowHistory(false);
  }

  useEffect(() => {
    const lastIndex = chatMessages.length - 1;
    if (lastIndex < 0) return;
    const lastMessage = chatMessages[lastIndex];
    if (lastMessage.role !== 'assistant') return;

    const signature = `${lastIndex}:${lastMessage.content}`;
    if (lastAnimatedSignatureRef.current === signature) return;
    lastAnimatedSignatureRef.current = signature;

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    setTypingMessageIndex(lastIndex);
    setTypingText('');

    let cursor = 0;
    const full = lastMessage.content;
    const tick = () => {
      cursor += 6;
      if (cursor >= full.length) {
        setTypingText(full);
        setTypingMessageIndex(null);
        typingTimerRef.current = null;
        return;
      }
      setTypingText(full.slice(0, cursor));
      typingTimerRef.current = setTimeout(tick, 10);
    };

    typingTimerRef.current = setTimeout(tick, 10);
  }, [chatMessages]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  const cardBg = scheme === 'dark' ? c.cardHover : c.card;

  // Гейт подписки — без активной подписки показываем тарифы
  if (!aiUnlocked) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={88}>
        <ScreenScroll keyboardShouldPersistTaps="handled">
          <TabScreenHeader title={topic.aiTitle} subtitle="Коуч и анализ питания" />
          <AiPaywall
            sub={mySubscription}
            canSubmit={!!firebaseUid && !!currentUser}
            uid={firebaseUid}
            username={currentUser}
            onSubmit={handleSubscribe}
          />
        </ScreenScroll>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={88}>
      <ScreenScroll keyboardShouldPersistTaps="handled">
        <AiHero name={displayName} />

        {!hasKey ? (
          <View style={[styles.bubble, { borderColor: c.border, backgroundColor: cardBg }]}>
            <Text style={{ color: c.text, lineHeight: 22, fontFamily: 'Inter_600SemiBold', marginBottom: 8 }}>
              Нужен ключ API
            </Text>
            <Text style={{ color: c.muted, lineHeight: 20, marginBottom: 10 }}>
              Создайте ключ на <Text style={{ color: c.text }}>openrouter.ai/keys</Text> (в приложении по умолчанию{' '}
              <Text style={{ fontFamily: 'Inter_600SemiBold' }}>meta-llama/…-instruct:free</Text> и добавьте в
              .env:
            </Text>
            <Text style={{ color: c.text, fontSize: 13 }} selectable>
              EXPO_PUBLIC_OPENROUTER_API_KEY=sk-or-v1-…
            </Text>
            <Text style={{ color: c.muted, marginTop: 10, fontSize: 13 }}>
              Перезапустите <Text style={{ fontFamily: 'Inter_600SemiBold' }}>npx expo start --clear</Text>
            </Text>
          </View>
        ) : null}

        <View style={styles.chatHeadRow}>
          <Text style={[styles.section, { color: c.text }]}>{topic.aiCoachSectionTitle}</Text>
          <View style={styles.chatHeadBtns}>
            <Pressable
              onPress={() => setShowHistory((v) => !v)}
              style={[styles.chatHeadBtn, { borderColor: c.border, backgroundColor: cardBg }]}>
              <Ionicons name="time-outline" size={16} color={c.text} />
              <Text style={[styles.chatHeadBtnText, { color: c.text }]}>История{aiChats.length ? ` (${aiChats.length})` : ''}</Text>
            </Pressable>
            <Pressable
              onPress={newChat}
              style={[styles.chatHeadBtn, { borderColor: c.accent, backgroundColor: c.accentSoft }]}>
              <Ionicons name="add" size={16} color={c.accent} />
              <Text style={[styles.chatHeadBtnText, { color: c.accent }]}>Новый</Text>
            </Pressable>
          </View>
        </View>

        {showHistory ? (
          <View style={[styles.histPanel, { borderColor: c.border, backgroundColor: cardBg }]}>
            {aiChats.length === 0 ? (
              <Text style={{ color: c.muted, fontSize: 13, padding: 4 }}>Сохранённых чатов пока нет.</Text>
            ) : (
              aiChats.map((ch) => (
                <View key={ch.id} style={styles.histRow}>
                  <Pressable onPress={() => openChat(ch.id)} style={styles.histOpen}>
                    <Ionicons
                      name="chatbubble-ellipses-outline"
                      size={16}
                      color={ch.id === activeAiChatId ? c.accent : c.muted}
                    />
                    <Text
                      style={{ color: ch.id === activeAiChatId ? c.accent : c.text, fontSize: 14, flex: 1 }}
                      numberOfLines={1}>
                      {ch.title || 'Чат'}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => deleteAiChat(ch.id)} hitSlop={8} style={styles.histDel}>
                    <Ionicons name="trash-outline" size={15} color={c.muted} />
                  </Pressable>
                </View>
              ))
            )}
          </View>
        ) : null}

        {chatMessages.map((msg, i) => (
          <View
            key={i}
            style={[
              styles.chatBubble,
              {
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                backgroundColor: msg.role === 'user' ? 'rgba(28, 28, 30, 0.08)' : cardBg,
                borderColor: c.border,
              },
            ]}>
            <Text style={{ color: c.text, lineHeight: 22 }}>
              {typingMessageIndex === i ? typingText : msg.content}
              {typingMessageIndex === i ? '▌' : ''}
            </Text>
          </View>
        ))}
        {chatLoading ? (
          <View style={styles.centerRow}>
            <ActivityIndicator color={c.text} size="small" />
          </View>
        ) : null}

        {foodError ? (
          <Text style={{ color: '#ff6b6b', marginTop: 10, lineHeight: 20 }}>{foodError}</Text>
        ) : null}

        <View style={[styles.askCard, { borderColor: c.border, backgroundColor: cardBg }]}>
          {pendingImg ? (
            <View style={styles.attachRow}>
              <Image source={{ uri: pendingImg.uri }} style={styles.attachThumb} resizeMode="cover" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.text, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>Фото еды прикреплено</Text>
                <Text style={{ color: c.muted, fontSize: 12, marginTop: 2 }}>Отправь — посчитаю калории и дам совет</Text>
              </View>
              <Pressable onPress={() => setPendingImg(null)} hitSlop={8} style={{ padding: 6 }}>
                <Ionicons name="close" size={18} color={c.muted} />
              </Pressable>
            </View>
          ) : null}

          <AppInput
            style={styles.askInput}
            placeholder={pendingImg ? 'Добавь комментарий к фото (необязательно)…' : topic.aiPlaceholder}
            value={chatInput}
            onChangeText={setChatInput}
            multiline
            editable={!chatLoading}
          />
          <View style={styles.askBar}>
            <View style={styles.askBarLeft}>
              {canPhoto ? (
                <>
                  <Pressable
                    onPress={() => void pickImage('library')}
                    disabled={chatLoading}
                    style={({ pressed }) => [styles.attachBtn, { borderColor: c.border, opacity: pressed ? 0.7 : 1 }]}>
                    <Ionicons name="image-outline" size={18} color={c.text} />
                  </Pressable>
                  <Pressable
                    onPress={() => void pickImage('camera')}
                    disabled={chatLoading}
                    style={({ pressed }) => [styles.attachBtn, { borderColor: c.border, opacity: pressed ? 0.7 : 1 }]}>
                    <Ionicons name="camera-outline" size={18} color={c.text} />
                  </Pressable>
                </>
              ) : null}
              <View style={[styles.modelChip, { backgroundColor: c.accentSoft }]}>
                <Ionicons name="sparkles" size={13} color={c.accent} />
                <Text style={[styles.modelChipText, { color: c.accent }]}>ИИ-коуч</Text>
              </View>
            </View>
            <Pressable
              onPress={() => void sendChat()}
              disabled={chatLoading || (!chatInput.trim() && !pendingImg)}
              style={({ pressed }) => [
                styles.askSend,
                {
                  backgroundColor: c.accent,
                  opacity: chatLoading || (!chatInput.trim() && !pendingImg) ? 0.4 : 1,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                },
              ]}>
              <Ionicons name="arrow-up" size={20} color={c.onAccent} />
            </Pressable>
          </View>
        </View>

        <AiFeatureCards onPickFeature={(p) => setChatInput(p)} />
      </ScreenScroll>
    </KeyboardAvoidingView>
  );
}

function fmtNum(n: number | null): string {
  if (n == null || Number.isNaN(n)) return '—';
  return String(Math.round(n * 10) / 10);
}

function fmtTime(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (sameDay) return `${hh}:${mm}`;
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')} ${hh}:${mm}`;
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 140 },
  scrollDesktop: {
    width: '100%',
    maxWidth: 1220,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  title: { fontSize: 26, fontFamily: 'Inter_700Bold', marginBottom: 6 },
  section: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginTop: 20, marginBottom: 10 },
  chatHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chatHeadBtns: { flexDirection: 'row', gap: 8 },
  chatHeadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chatHeadBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  histPanel: { borderWidth: 1, borderRadius: 16, padding: 8, marginTop: 8, marginBottom: 4, gap: 2 },
  histRow: { flexDirection: 'row', alignItems: 'center' },
  histOpen: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 6 },
  histDel: { padding: 8 },
  kcalChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
    gap: 8,
  },
  bubble: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  goalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  goalChip: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    minWidth: '30%',
    flexGrow: 1,
  },
  rowBtns: { flexDirection: 'row', gap: 12 },
  btn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  centerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  preview: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginTop: 12,
    backgroundColor: '#1a1a1c',
  },
  chatBubble: {
    maxWidth: '92%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'column',
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginTop: 12,
    gap: 10,
  },
  input: {
    minHeight: 44,
    maxHeight: 120,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    paddingHorizontal: 4,
  },
  sendBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  askCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 14,
    marginTop: 14,
    gap: 12,
  },
  askInput: {
    minHeight: 48,
    maxHeight: 140,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    paddingHorizontal: 6,
    paddingTop: 6,
  },
  askBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  askBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  attachBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  attachThumb: { width: 48, height: 48, borderRadius: 12 },
  modelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  modelChipText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  askSend: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
