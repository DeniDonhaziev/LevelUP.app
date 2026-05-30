import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppInput } from '@/components/ui/AppInput';
import { GroupedSection } from '@/components/ui/GroupedSection';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenScroll } from '@/components/ui/ScreenScroll';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { sortClanMembers, sortClansByKm } from '@/lib/clanLogic';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import {
  pullClansFromCloud,
  startClanChatListener,
  stopClanChatListener,
} from '@/lib/firebase/clanListeners';
import {
  getNotificationPermissionState,
  requestNotificationPermissionFromUser,
} from '@/lib/notifications/clanChat';
import { registerPushToken } from '@/lib/notifications/pushTokens';
import type { Clan, ClanMember, ClanMessage } from '@/lib/types';
import { formatLength } from '@/lib/trackerLogic';
import { useTrackerStore } from '@/store/trackerStore';

const EMPTY_MEMBERS: ClanMember[] = [];
const EMPTY_MESSAGES: ClanMessage[] = [];

type TabKey = 'clan' | 'top';

export default function ClansScreen() {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 1100;
  const bubbleMaxWidth = Math.min(320, Math.max(200, width - 96));
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const cardBg = scheme === 'dark' ? c.cardHover : c.card;

  const currentUser = useTrackerStore((s) => s.currentUser);
  const firebaseUid = useTrackerStore((s) => s.firebaseUid);
  const clanId = useTrackerStore((s) =>
    s.currentUser ? s.userData[s.currentUser]?.clanId ?? null : null
  );
  const activeClan = useTrackerStore((s) => s.activeClan);
  const clanMembers = useTrackerStore((s) =>
    clanId ? s.clanMembersByClanId[clanId] ?? EMPTY_MEMBERS : EMPTY_MEMBERS
  );
  const clanMessages = useTrackerStore((s) =>
    clanId ? s.clanMessagesByClanId[clanId] ?? EMPTY_MESSAGES : EMPTY_MESSAGES
  );
  const clanLeaderboard = useTrackerStore((s) => s.clanLeaderboard);
  const clansById = useTrackerStore((s) => s.clansById);

  const createClan = useTrackerStore((s) => s.createClan);
  const joinClanByCode = useTrackerStore((s) => s.joinClanByCode);
  const leaveClan = useTrackerStore((s) => s.leaveClan);
  const sendClanMessage = useTrackerStore((s) => s.sendClanMessage);

  const [tab, setTab] = useState<TabKey>(clanId ? 'clan' : 'top');
  const [clanName, setClanName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [chatText, setChatText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState('');
  const pageScrollRef = useRef<ScrollView>(null);
  const chatMessagesRef = useRef<ScrollView>(null);
  const lastMessageId =
    clanMessages.length > 0 ? clanMessages[clanMessages.length - 1]?.id : null;

  const clan = activeClan ?? (clanId ? clansById[clanId] : null);
  const membersSorted: ClanMember[] = sortClanMembers(clanMembers);
  const topClans: Clan[] =
    clanLeaderboard.length > 0 ? clanLeaderboard : sortClansByKm(Object.values(clansById));

  useEffect(() => {
    useTrackerStore.getState().ensureClanCatalog();
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured() || !firebaseUid) return;
    void refreshFromCloud();
  }, [firebaseUid]);

  useEffect(() => {
    if (clanId) setTab('clan');
  }, [clanId]);

  useEffect(() => {
    if (tab === 'top' && isFirebaseConfigured() && firebaseUid) {
      void refreshFromCloud();
    }
  }, [tab, firebaseUid]);

  async function refreshFromCloud() {
    if (!isFirebaseConfigured() || !firebaseUid) return;
    setSyncing(true);
    try {
      await pullClansFromCloud();
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    if (!clanId) return;
    if (isFirebaseConfigured() && firebaseUid) {
      startClanChatListener(clanId);
      return () => stopClanChatListener();
    }
    return undefined;
  }, [clanId, firebaseUid]);

  useEffect(() => {
    if (!firebaseUid || !isFirebaseConfigured()) return;
    const state = getNotificationPermissionState();
    setPushEnabled(state === 'granted');
    if (state === 'denied') {
      setPushError('Уведомления заблокированы в настройках браузера. Разрешите их для этого сайта.');
    }
  }, [firebaseUid, clanId]);

  async function enablePushNotifications() {
    if (!firebaseUid || pushBusy) return;
    setPushError('');
    setPushBusy(true);
    try {
      const state = getNotificationPermissionState();
      if (state === 'unsupported') {
        setPushError('Браузер не поддерживает уведомления. Откройте сайт в Chrome или Safari.');
        setPushEnabled(false);
        return;
      }
      if (state === 'denied') {
        setPushError(
          'Уведомления отключены. В Chrome: замок слева от адреса → Уведомления → Разрешить. Затем обновите страницу.'
        );
        setPushEnabled(false);
        return;
      }

      const ok = await requestNotificationPermissionFromUser();
      if (!ok) {
        const after = getNotificationPermissionState();
        if (after === 'denied') {
          setPushError('Вы отклонили уведомления. Разрешите их в настройках браузера для этого сайта.');
        } else {
          setPushError('Нажмите «Разрешить» в окне браузера, когда оно появится.');
        }
        setPushEnabled(false);
        return;
      }

      const result = await registerPushToken(firebaseUid, clanId);
      if (result.ok) {
        setPushEnabled(true);
        setPushError('');
        void refreshFromCloud();
      } else if (result.reason === 'no_token') {
        setPushError(
          'Не удалось подключить push. Обновите страницу (Ctrl+Shift+R), снова нажмите «Включить». На iPhone — откройте сайт с иконки на рабочем столе.'
        );
        setPushEnabled(false);
      } else {
        setPushError('Не удалось подключить push. Обновите страницу и попробуйте снова.');
        setPushEnabled(false);
      }
    } finally {
      setPushBusy(false);
    }
  }

  useEffect(() => {
    if (!lastMessageId) return;
    const t = setTimeout(() => {
      chatMessagesRef.current?.scrollToEnd({ animated: true });
    }, 50);
    return () => clearTimeout(t);
  }, [lastMessageId, clanMessages.length]);

  async function onCreate() {
    setError('');
    setLoading(true);
    const err = await createClan(clanName);
    setLoading(false);
    if (err) setError(err);
    else {
      setClanName('');
      setTab('clan');
    }
  }

  async function onJoin() {
    setError('');
    setLoading(true);
    const err = await joinClanByCode(inviteCode);
    setLoading(false);
    if (err) setError(err);
    else {
      setInviteCode('');
      setTab('clan');
    }
  }

  async function onLeave() {
    setError('');
    setLoading(true);
    const err = await leaveClan();
    setLoading(false);
    if (err) setError(err);
    else setTab('top');
  }

  async function onSend() {
    if (!chatText.trim()) return;
    setError('');
    const err = await sendClanMessage(chatText);
    if (err) setError(err);
    else {
      setChatText('');
      setTimeout(() => chatMessagesRef.current?.scrollToEnd({ animated: true }), 30);
    }
  }

  const clansSubtitle =
    isFirebaseConfigured() && firebaseUid
      ? 'Облачный режим: кланы, чат и топ видны всем пользователям с любого устройства после входа по email.'
      : isFirebaseConfigured()
        ? 'Войдите по email (регистрация в приложении), чтобы кланы синхронизировались между устройствами.'
        : 'Общий список для всех аккаунтов на этом устройстве. Километры считаются с пробежек.';

  return (
    <ScreenScroll ref={pageScrollRef} keyboardShouldPersistTaps="handled">
        <SectionTitle title="Кланы" subtitle={clansSubtitle} />

        {isFirebaseConfigured() && !firebaseUid ? (
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: c.border, marginBottom: 12 }]}>
            <Text style={{ color: c.text, fontFamily: 'Inter_600SemiBold', marginBottom: 6 }}>
              Войдите по email
            </Text>
            <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20 }}>
              Чтобы создавать кланы и видеть чужие с любого устройства — зарегистрируйтесь или войдите в профиле
              (email + пароль). Локальный вход работает только на этом устройстве.
            </Text>
          </View>
        ) : null}

        <SegmentedControl
          value={tab}
          options={[
            { key: 'clan', label: 'Мой клан' },
            { key: 'top', label: 'Топ кланов' },
          ]}
          onChange={(key) => setTab(key as TabKey)}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {tab === 'top' ? (
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: c.border }]}>
            <View style={styles.topHeader}>
              <Text style={[styles.section, { color: c.text, marginBottom: 0 }]}>Рейтинг по километрам</Text>
              {isFirebaseConfigured() && firebaseUid ? (
                <Pressable
                  disabled={syncing}
                  onPress={() => void refreshFromCloud()}
                  style={({ pressed }) => [
                    styles.refreshBtn,
                    { borderColor: c.border, opacity: syncing ? 0.6 : pressed ? 0.85 : 1 },
                  ]}>
                  {syncing ? (
                    <ActivityIndicator size="small" color={c.accent} />
                  ) : (
                    <Ionicons name="refresh" size={18} color={c.accent} />
                  )}
                </Pressable>
              ) : null}
            </View>
            <Text style={{ color: c.muted, fontSize: 12, marginBottom: 10, lineHeight: 18 }}>
              Все кланы из облака. Чтобы вступить — скопируйте код и введите во вкладке «Мой клан».
            </Text>
            {topClans.length === 0 ? (
              <Text style={{ color: c.muted, lineHeight: 22 }}>
                Пока нет кланов. Создайте первый во вкладке «Мой клан».
              </Text>
            ) : (
              topClans.map((item, idx) => (
                <Pressable
                  key={item.id}
                  disabled={!!clanId}
                  onPress={() => {
                    if (clanId) return;
                    setInviteCode(item.inviteCode);
                    setTab('clan');
                  }}
                  style={[styles.topRow, { borderColor: c.border }]}>
                  <Text style={[styles.topRank, { color: c.accent }]}>{idx + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.text, fontFamily: 'Inter_700Bold', fontSize: 15 }}>
                      {item.name}
                      {item.id === clanId ? ' (ваш)' : ''}
                    </Text>
                    <Text style={{ color: c.muted, fontSize: 12, marginTop: 2 }}>
                      {item.memberCount || 0} участн. · код {item.inviteCode}
                      {!clanId ? ' · нажмите, чтобы вступить' : ''}
                    </Text>
                  </View>
                  <Text style={{ color: c.text, fontFamily: 'Inter_700Bold' }}>
                    {formatLength(item.totalDistanceMeters || 0)}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        ) : null}

        {tab === 'clan' && !clanId ? (
          <>
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: c.border }]}>
              <Text style={[styles.section, { color: c.text }]}>Создать клан</Text>
              <AppInput
                placeholder="Название клана"
                value={clanName}
                onChangeText={setClanName}
              />
              <PrimaryButton label="Создать" loading={loading} onPress={() => void onCreate()} />
            </View>

            <View style={[styles.card, { backgroundColor: cardBg, borderColor: c.border }]}>
              <Text style={{ color: c.muted, fontSize: 13, marginBottom: 10 }}>
                Демо-клан: код <Text style={{ fontFamily: 'Inter_700Bold', color: c.text }}>RUNNER</Text>
              </Text>
              <Text style={[styles.section, { color: c.text }]}>Вступить по коду</Text>
              <AppInput
                placeholder="Код приглашения"
                value={inviteCode}
                onChangeText={setInviteCode}
                autoCapitalize="characters"
              />
              <PrimaryButton label="Вступить" loading={loading} onPress={() => void onJoin()} />
            </View>
          </>
        ) : null}

        {tab === 'clan' && clanId && clan ? (
          <>
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: c.border }]}>
              <Text style={[styles.section, { color: c.text }]}>{clan.name}</Text>
              <Text style={{ color: c.muted, fontSize: 13, marginBottom: 12 }}>
                Код приглашения: <Text style={{ fontFamily: 'Inter_700Bold', color: c.text }}>{clan.inviteCode}</Text>
              </Text>
              <View style={styles.statRow}>
                <View style={[styles.statBox, { borderColor: c.border }]}>
                  <Text style={{ color: c.muted, fontSize: 11 }}>Км клана</Text>
                  <Text style={{ color: c.accent, fontFamily: 'Inter_700Bold', fontSize: 22, marginTop: 4 }}>
                    {formatLength(clan.totalDistanceMeters || 0)}
                  </Text>
                </View>
                <View style={[styles.statBox, { borderColor: c.border }]}>
                  <Text style={{ color: c.muted, fontSize: 11 }}>Участников</Text>
                  <Text style={{ color: c.text, fontFamily: 'Inter_700Bold', fontSize: 22, marginTop: 4 }}>
                    {clan.memberCount || membersSorted.length}
                  </Text>
                </View>
              </View>
              <Pressable
                disabled={loading}
                onPress={() => void onLeave()}
                style={({ pressed }) => [
                  styles.outlineBtn,
                  { borderColor: '#FF6B6B', opacity: pressed ? 0.8 : 1 },
                ]}>
                <Text style={{ color: '#FF6B6B', fontFamily: 'Inter_600SemiBold' }}>Выйти из клана</Text>
              </Pressable>
            </View>

            <View style={[styles.card, { backgroundColor: cardBg, borderColor: c.border }]}>
              <Text style={[styles.section, { color: c.text }]}>Участники</Text>
              {membersSorted.map((m, idx) => (
                <View key={m.uid} style={[styles.memberRow, { borderColor: c.border }]}>
                  <Text style={[styles.topRank, { color: c.muted }]}>{idx + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.text, fontFamily: 'Inter_600SemiBold' }}>
                      {m.username}
                      {m.username === currentUser ? ' (вы)' : ''}
                    </Text>
                  </View>
                  <Text style={{ color: c.text, fontFamily: 'Inter_600SemiBold' }}>
                    {formatLength(m.distanceMeters || 0)}
                  </Text>
                </View>
              ))}
            </View>

            {pushEnabled !== true && isFirebaseConfigured() && firebaseUid ? (
              <Pressable
                disabled={pushBusy}
                onPress={() => void enablePushNotifications()}
                style={({ pressed }) => [
                  styles.pushBanner,
                  {
                    backgroundColor: c.accent + '18',
                    borderColor: c.accent,
                    opacity: pushBusy ? 0.6 : pressed ? 0.85 : 1,
                  },
                ]}>
                {pushBusy ? (
                  <ActivityIndicator color={c.accent} />
                ) : (
                  <Ionicons name="notifications-outline" size={22} color={c.accent} />
                )}
                <View style={styles.pushBannerText}>
                  <Text style={[styles.pushBannerTitle, { color: c.text }]}>
                    {pushBusy ? 'Подключение…' : 'Включить уведомления'}
                  </Text>
                  <Text style={[styles.pushBannerSub, { color: c.muted }]}>
                    Сообщения на телефон, когда приложение закрыто
                  </Text>
                </View>
              </Pressable>
            ) : null}
            {pushError ? <Text style={styles.pushError}>{pushError}</Text> : null}

            <View style={[styles.card, { backgroundColor: cardBg, borderColor: c.border }]}>
              <Text style={[styles.section, { color: c.text }]}>Чат клана</Text>
              <View style={[styles.chatBox, { borderColor: c.border }]}>
                <ScrollView
                  ref={chatMessagesRef}
                  style={styles.chatScroll}
                  contentContainerStyle={styles.chatScrollContent}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled>
                  {clanMessages.length === 0 ? (
                    <Text style={{ color: c.muted, fontSize: 14, textAlign: 'center', marginTop: 12 }}>
                      Нет сообщений. Напишите первым.
                    </Text>
                  ) : (
                    clanMessages.map((msg) => {
                      const mine = msg.username === currentUser;
                      return (
                        <View key={msg.id} style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
                          <View
                            style={[
                              styles.bubble,
                              { maxWidth: bubbleMaxWidth },
                              mine
                                ? { backgroundColor: c.accent + '18' }
                                : { backgroundColor: scheme === 'dark' ? '#2a2a2e' : '#F3F4F6' },
                            ]}>
                            <Text numberOfLines={1} style={[styles.bubbleUser, { color: c.muted }]}>
                              {msg.username}
                            </Text>
                            <Text style={[styles.bubbleText, { color: c.text }]}>{msg.text}</Text>
                          </View>
                        </View>
                      );
                    })
                  )}
                </ScrollView>
              </View>
              <View style={styles.chatInputRow}>
                <AppInput
                  style={styles.chatInput}
                  placeholder="Введите сообщение…"
                  value={chatText}
                  onChangeText={setChatText}
                  onSubmitEditing={() => void onSend()}
                  multiline
                />
                <Pressable
                  onPress={() => void onSend()}
                  disabled={!chatText.trim()}
                  style={({ pressed }) => [
                    styles.sendBtn,
                    {
                      backgroundColor: c.accentSoft,
                      borderWidth: 1,
                      borderColor: c.accent,
                      opacity: !chatText.trim() ? 0.5 : pressed ? 0.85 : 1,
                    },
                  ]}>
                  <Text style={[styles.sendBtnText, { color: c.text }]}>Отправить</Text>
                </Pressable>
              </View>
            </View>
          </>
        ) : null}

        {tab === 'clan' && clanId && !clan ? (
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: c.border }]}>
            <Text style={[styles.section, { color: c.text }]}>Загрузка вашего клана…</Text>
            <Text style={{ color: c.muted, lineHeight: 22, marginBottom: 12 }}>
              Клан привязан к аккаунту. Нажмите «Обновить», если экран пустой.
            </Text>
            <Pressable
              disabled={syncing}
              onPress={() => void refreshFromCloud()}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: c.accentSoft, borderWidth: 1, borderColor: c.accent, opacity: syncing ? 0.7 : pressed ? 0.9 : 1 },
              ]}>
              {syncing ? (
                <ActivityIndicator color={c.text} />
              ) : (
                <Text style={[styles.primaryBtnTextDark, { color: c.text }]}>Обновить</Text>
              )}
            </Pressable>
          </View>
        ) : null}

      </ScreenScroll>
  );
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
  tabRow: {
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1,
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  section: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginBottom: 10 },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 10,
  },
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#161822', fontFamily: 'Inter_700Bold', fontSize: 15 },
  primaryBtnTextDark: { color: '#161822', fontFamily: 'Inter_700Bold', fontSize: 15 },
  outlineBtn: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  error: { color: '#ff6b6b', marginBottom: 10, fontSize: 14 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  topRank: { width: 28, fontFamily: 'Inter_700Bold', fontSize: 16 },
  clanHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  clanIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  statBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  pushBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  pushBannerText: { flex: 1 },
  pushBannerTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, marginBottom: 2 },
  pushBannerSub: { fontSize: 12, lineHeight: 16 },
  pushError: {
    color: '#ff6b6b',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
    marginTop: -6,
  },
  chatBox: {
    height: 280,
    borderWidth: 1,
    borderRadius: 16,
    marginBottom: 10,
    overflow: 'hidden',
  },
  chatScroll: {
    flex: 1,
  },
  chatScrollContent: {
    padding: 12,
    gap: 8,
    flexGrow: 1,
    width: '100%',
  },
  bubbleRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  bubbleRowMine: {
    justifyContent: 'flex-end',
  },
  bubble: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 0,
    flexShrink: 1,
  },
  bubbleUser: {
    fontSize: 11,
    marginBottom: 2,
    fontFamily: 'Inter_600SemiBold',
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 20,
    flexShrink: 1,
    ...(Platform.OS === 'web'
      ? ({ wordBreak: 'break-word', overflowWrap: 'break-word' } as object)
      : {}),
  },
  chatInputRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  sendBtnText: {
    color: '#121212',
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },
});
