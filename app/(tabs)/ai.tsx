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
import * as ImagePicker from 'expo-image-picker';

import { AppInput } from '@/components/ui/AppInput';
import { ScreenScroll } from '@/components/ui/ScreenScroll';
import { TabScreenHeader } from '@/components/ui/TabScreenHeader';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAppTopic } from '@/hooks/useAppTopic';
import { useTrackerStore } from '@/store/trackerStore';
import { buildAiProfileContext, mapToBodyGoal } from '@/lib/onboarding';
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

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [foodLoading, setFoodLoading] = useState(false);
  const [foodResult, setFoodResult] = useState<FoodAnalysisResult | null>(null);
  const [foodRawFallback, setFoodRawFallback] = useState<string | null>(null);
  const [foodError, setFoodError] = useState<string | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [typingMessageIndex, setTypingMessageIndex] = useState<number | null>(null);
  const [typingText, setTypingText] = useState('');
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAnimatedSignatureRef = useRef('');

  const hasKey = isAiConfigured();
  const canPhoto = canAnalyzeFoodPhoto();

  const runFoodAnalysis = useCallback(
    async (parsed: { parsed: FoodAnalysisResult | null; raw: string }) => {
      if (parsed.parsed) setFoodResult(parsed.parsed);
      else setFoodRawFallback(parsed.raw);
    },
    []
  );

  const pickImage = useCallback(
    async (source: 'library' | 'camera') => {
      setFoodError(null);
      setFoodRawFallback(null);
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
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              allowsEditing: false,
              quality: 0.55,
              base64: true,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: false,
              quality: 0.55,
              base64: true,
            });

      if (result.canceled || !result.assets?.[0]) return;
      const a = result.assets[0];
      setImageUri(a.uri);
      const m = a.mimeType ?? 'image/jpeg';
      if (!a.base64) {
        setFoodError('Не удалось прочитать фото. Попробуйте другое изображение.');
        return;
      }
      setFoodResult(null);
      setFoodLoading(true);
      try {
        const out = await analyzeFoodImage(a.base64, m, goal, topic.id);
        await runFoodAnalysis(out);
      } catch (e) {
        setFoodError((e as Error).message ?? 'Ошибка анализа');
      } finally {
        setFoodLoading(false);
      }
    },
    [canPhoto, goal, runFoodAnalysis, topic.id]
  );

  const sendChat = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    if (!isAiConfigured()) {
      setFoodError(KEY_HINT);
      return;
    }
    const nextUser: ChatMessage = { role: 'user', content: text };
    const thread = [...chatMessages, nextUser];
    setChatInput('');
    setChatMessages(thread);
    setChatLoading(true);
    setFoodError(null);
    try {
      const st = useTrackerStore.getState();
      const profile = st.currentUser ? st.userData[st.currentUser]?.onboarding : undefined;
      const reply = await coachChat(thread, goal, topic.id, buildAiProfileContext(profile));
      setChatMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch (e) {
      setFoodError((e as Error).message ?? 'Ошибка чата');
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, chatMessages, goal, topic.id]);

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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={88}>
      <ScreenScroll keyboardShouldPersistTaps="handled">
        <TabScreenHeader title={topic.aiTitle} subtitle="Коуч и анализ питания" />

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

        <Text style={[styles.section, { color: c.text }]}>
          Ваша цель
        </Text>
        <View style={styles.goalRow}>
          {topic.goals.map((g) => {
            const active = goal === g.id;
            return (
              <Pressable
                key={g.id}
                onPress={() => setGoal(g.id)}
                style={[
                  styles.goalChip,
                  {
                    borderColor: active ? topic.accent : c.border,
                    backgroundColor: active ? topic.accentMuted : cardBg,
                  },
                ]}>
                <Text style={{ color: c.text, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>{g.label}</Text>
                <Text style={{ color: c.muted, fontSize: 11, marginTop: 2 }}>{g.hint}</Text>
              </Pressable>
            );
          })}
        </View>

        {canPhoto ? (
          <>
            <Text style={[styles.section, { color: c.text }]}>{topic.photoSectionTitle}</Text>
            <View style={styles.rowBtns}>
              <Pressable
                onPress={() => void pickImage('library')}
                disabled={foodLoading}
                style={({ pressed }) => [
                  styles.btn,
                  { borderColor: c.border, opacity: foodLoading ? 0.6 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
                ]}>
                <Text style={{ color: c.text, fontFamily: 'Inter_600SemiBold' }}>Галерея</Text>
              </Pressable>
              <Pressable
                onPress={() => void pickImage('camera')}
                disabled={foodLoading}
                style={({ pressed }) => [
                  styles.btn,
                  { borderColor: c.border, opacity: foodLoading ? 0.6 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
                ]}>
                <Text style={{ color: c.text, fontFamily: 'Inter_600SemiBold' }}>Камера</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {foodLoading ? (
          <View style={styles.centerRow}>
            <ActivityIndicator color={c.text} />
            <Text style={{ color: c.muted, marginLeft: 10 }}>{topic.photoLoadingText}</Text>
          </View>
        ) : null}

        {foodError ? (
          <Text style={{ color: '#ff6b6b', marginTop: 10, lineHeight: 20 }}>{foodError}</Text>
        ) : null}

        {imageUri && canPhoto ? (
          <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
        ) : null}

        {foodResult ? (
          <View
            style={[
              styles.bubble,
              {
                borderColor: 'rgba(10,132,255,0.3)',
                backgroundColor: cardBg,
              },
            ]}>
            {topic.id === 'sport' && foodResult.calories != null ? (
              <Text style={{ color: c.text, fontFamily: 'Inter_700Bold', fontSize: 16 }}>
                ~{Math.round(foodResult.calories)} ккал
              </Text>
            ) : null}
            {topic.id === 'sport' ? (
              <Text style={{ color: c.muted, marginTop: 6, fontSize: 13 }}>
                Б: {fmtNum(foodResult.protein_g)} · Ж: {fmtNum(foodResult.fat_g)} · У:{' '}
                {fmtNum(foodResult.carbs_g)} г
              </Text>
            ) : null}
            <Text
              style={{
                color: c.text,
                marginTop: topic.id === 'sport' ? 12 : 0,
                lineHeight: 22,
              }}>
              {foodResult.foods_ru}
            </Text>
            <Text style={{ color: c.muted, marginTop: 10, lineHeight: 20 }}>{foodResult.advice_ru}</Text>
          </View>
        ) : null}

        {foodRawFallback && !foodResult ? (
          <View style={[styles.bubble, { borderColor: c.border, backgroundColor: cardBg }]}>
            <Text style={{ color: c.text, lineHeight: 22 }}>{foodRawFallback}</Text>
          </View>
        ) : null}

        <Text style={[styles.section, { color: c.text, marginTop: 8 }]}>
          {topic.aiCoachSectionTitle}
        </Text>
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

        <View style={[styles.inputRow, { borderColor: c.border, backgroundColor: cardBg }]}>
          <AppInput
            style={styles.input}
            placeholder={topic.aiPlaceholder}
            value={chatInput}
            onChangeText={setChatInput}
            multiline
            editable={!chatLoading}
          />
          <Pressable
            onPress={() => void sendChat()}
            disabled={chatLoading || !chatInput.trim()}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: c.accentSoft,
                borderWidth: 1,
                borderColor: c.accent,
                opacity: chatLoading || !chatInput.trim() ? 0.4 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}>
            <Text style={{ color: c.text, fontFamily: 'Inter_700Bold' }}>Отправить</Text>
          </Pressable>
        </View>
      </ScreenScroll>
    </KeyboardAvoidingView>
  );
}

function fmtNum(n: number | null): string {
  if (n == null || Number.isNaN(n)) return '—';
  return String(Math.round(n * 10) / 10);
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
});
