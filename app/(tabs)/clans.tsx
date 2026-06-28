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

import { ClanChat } from '@/components/clans/ClanChat';
import { AppInput } from '@/components/ui/AppInput';
import { GroupedSection } from '@/components/ui/GroupedSection';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenScroll } from '@/components/ui/ScreenScroll';
import { TabScreenHeader } from '@/components/ui/TabScreenHeader';
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
import { registerPushToken } from '@/lib/notifications/pushTokens';
import type { Clan, ClanMember, ClanMessage } from '@/lib/types';
import { formatLength } from '@/lib/trackerLogic';
import { useTrackerStore } from '@/store/trackerStore';

const EMPTY_MEMBERS: ClanMember[] = [];
const EMPTY_MESSAGES: ClanMessage[] = [];

type TabKey = 'clan' | 'top';

const AVATAR_COLORS = ['#C1FF00', '#64D2FF', '#FF9F0A', '#BF5AF2', '#FF6B6B', '#30D158', '#FFD60A'];
function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function medal(idx: number): string | null {
  return idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
}
const CLAN_EMOJIS = ['🔥', '⚡', '🏆', '🐺', '🦁', '🚀', '💪', '⭐', '🎯', '🏃', '👑', '🛡️', '💎', '🐉', '⚔️', '🌟'];
async function copyToClipboard(textValue: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(textValue);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

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
  const setMemberRole = useTrackerStore((s) => s.setMemberRole);
  const editClanMessage = useTrackerStore((s) => s.editClanMessage);
  const deleteClanMessage = useTrackerStore((s) => s.deleteClanMessage);
  const setClanLogo = useTrackerStore((s) => s.setClanLogo);

  const [tab, setTab] = useState<TabKey>(clanId ? 'clan' : 'top');
  const [clanName, setClanName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showLogoPicker, setShowLogoPicker] = useState(false);
  const pageScrollRef = useRef<ScrollView>(null);

  async function onCopyCode(code: string) {
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  const clan = activeClan ?? (clanId ? clansById[clanId] : null);
  const myUid = firebaseUid ?? (currentUser ? `local:${currentUser}` : '');
  const isOwner = !!clan && clan.ownerUid === myUid;
  const myRole = clanMembers.find((m) => m.uid === myUid)?.role;
  const canModerate = isOwner || myRole === 'motivator';
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
      void registerPushToken(firebaseUid, clanId);
      return () => stopClanChatListener();
    }
    return undefined;
  }, [clanId, firebaseUid]);

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

  async function onSendMessage(text: string) {
    return sendClanMessage(text);
  }

  return (
    <ScreenScroll ref={pageScrollRef} keyboardShouldPersistTaps="handled">
        <TabScreenHeader title="Кланы" subtitle="Чат, рейтинг и командный дух" />

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
                  {medal(idx) ? (
                    <Text style={styles.medal}>{medal(idx)}</Text>
                  ) : (
                    <Text style={[styles.topRank, { color: c.muted, textAlign: 'center' }]}>{idx + 1}</Text>
                  )}
                  <View style={[styles.topEmblem, { backgroundColor: item.emoji ? c.cardElevated : item.id === clanId ? c.accent : c.cardElevated, borderColor: c.border }]}>
                    <Text style={{ color: item.id === clanId ? '#16181C' : c.text, fontFamily: 'Inter_700Bold', fontSize: item.emoji ? 18 : 15 }}>
                      {item.emoji || (item.name || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.text, fontFamily: 'Inter_700Bold', fontSize: 15 }} numberOfLines={1}>
                      {item.name}
                      {item.id === clanId ? ' (ваш)' : ''}
                    </Text>
                    <Text style={{ color: c.muted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                      {item.memberCount || 0} участн. · код {item.inviteCode}
                      {!clanId ? ' · вступить' : ''}
                    </Text>
                  </View>
                  <Text style={{ color: c.accent, fontFamily: 'Inter_700Bold' }}>
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
              <View style={styles.clanHead}>
                <Pressable
                  disabled={!isOwner}
                  onPress={() => setShowLogoPicker((v) => !v)}
                  style={[styles.clanIcon, { backgroundColor: clan.emoji ? c.cardElevated : c.accent, borderColor: c.border, borderWidth: clan.emoji ? 1 : 0 }]}>
                  {clan.emoji ? (
                    <Text style={styles.clanEmojiBig}>{clan.emoji}</Text>
                  ) : (
                    <Text style={styles.clanEmblem}>{(clan.name || '?').charAt(0).toUpperCase()}</Text>
                  )}
                  {isOwner ? (
                    <View style={[styles.editBadge, { backgroundColor: c.accent, borderColor: cardBg }]}>
                      <Ionicons name="pencil" size={9} color="#16181C" />
                    </View>
                  ) : null}
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontFamily: 'Inter_700Bold', fontSize: 18 }} numberOfLines={1}>
                    {clan.name}
                  </Text>
                  <Text style={{ color: c.muted, fontSize: 12, marginTop: 2 }}>
                    {membersSorted.length || clan.memberCount || 0} участников
                    {isOwner ? ' · нажмите на логотип, чтобы сменить' : ''}
                  </Text>
                </View>
              </View>

              {isOwner && showLogoPicker ? (
                <View style={[styles.emojiPicker, { borderColor: c.border, backgroundColor: c.cardElevated }]}>
                  {CLAN_EMOJIS.map((em) => (
                    <Pressable
                      key={em}
                      onPress={() => {
                        void setClanLogo(em);
                        setShowLogoPicker(false);
                      }}
                      style={({ pressed }) => [
                        styles.emojiOption,
                        {
                          backgroundColor: clan.emoji === em ? c.accentSoft : 'transparent',
                          borderColor: clan.emoji === em ? c.accent : 'transparent',
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}>
                      <Text style={{ fontSize: 22 }}>{em}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <Pressable
                onPress={() => void onCopyCode(clan.inviteCode)}
                style={({ pressed }) => [
                  styles.codeChip,
                  { backgroundColor: c.cardElevated, borderColor: c.border, opacity: pressed ? 0.8 : 1 },
                ]}>
                <Ionicons name="key-outline" size={15} color={c.accent} />
                <Text style={{ color: c.muted, fontSize: 13 }}>Код:</Text>
                <Text style={{ color: c.text, fontFamily: 'Inter_700Bold', fontSize: 14, letterSpacing: 1 }}>
                  {clan.inviteCode}
                </Text>
                <View style={{ flex: 1 }} />
                <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={copied ? c.accent : c.muted} />
                <Text style={{ color: copied ? c.accent : c.muted, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>
                  {copied ? 'Скопировано' : 'Копировать'}
                </Text>
              </Pressable>
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
                    {membersSorted.length || clan.memberCount || 0}
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
              {membersSorted.map((m, idx) => {
                const mine = m.username === currentUser;
                const col = avatarColor(m.username || '?');
                const md = medal(idx);
                const canManage = isOwner && m.uid !== myUid && m.role !== 'owner';
                return (
                  <View key={m.uid} style={[styles.memberRow, { borderColor: c.border }]}>
                    {md ? (
                      <Text style={styles.medal}>{md}</Text>
                    ) : (
                      <Text style={[styles.topRank, { color: c.muted, textAlign: 'center' }]}>{idx + 1}</Text>
                    )}
                    <View style={[styles.memberAvatar, { backgroundColor: `${col}26`, borderColor: `${col}55` }]}>
                      <Text style={{ color: col, fontFamily: 'Inter_700Bold', fontSize: 13 }}>
                        {(m.username || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: c.text, fontFamily: 'Inter_600SemiBold' }} numberOfLines={1}>
                        {m.username}
                        {mine ? ' (вы)' : ''}
                      </Text>
                      <View style={styles.roleRow}>
                        {m.role === 'owner' ? (
                          <View style={[styles.roleBadge, { backgroundColor: c.accentSoft }]}>
                            <Ionicons name="ribbon" size={11} color={c.accent} />
                            <Text style={[styles.roleText, { color: c.accent }]}>Владелец</Text>
                          </View>
                        ) : m.role === 'motivator' ? (
                          <View style={[styles.roleBadge, { backgroundColor: 'rgba(100,210,255,0.15)' }]}>
                            <Ionicons name="megaphone" size={11} color="#64D2FF" />
                            <Text style={[styles.roleText, { color: '#64D2FF' }]}>Мотиватор</Text>
                          </View>
                        ) : (
                          <Text style={{ color: c.muted, fontSize: 11 }}>Участник</Text>
                        )}
                        <Text style={{ color: mine ? c.accent : c.muted, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>
                          · {formatLength(m.distanceMeters || 0)}
                        </Text>
                      </View>
                    </View>
                    {canManage ? (
                      <Pressable
                        onPress={() =>
                          void setMemberRole(m.uid, m.role === 'motivator' ? 'member' : 'motivator')
                        }
                        style={({ pressed }) => [
                          styles.roleBtn,
                          {
                            borderColor: m.role === 'motivator' ? c.border : '#64D2FF',
                            backgroundColor: m.role === 'motivator' ? 'transparent' : 'rgba(100,210,255,0.12)',
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}>
                        <Ionicons
                          name={m.role === 'motivator' ? 'remove-circle-outline' : 'megaphone-outline'}
                          size={14}
                          color={m.role === 'motivator' ? c.muted : '#64D2FF'}
                        />
                        <Text
                          style={{
                            color: m.role === 'motivator' ? c.muted : '#64D2FF',
                            fontSize: 11,
                            fontFamily: 'Inter_600SemiBold',
                          }}>
                          {m.role === 'motivator' ? 'Снять' : 'Мотиватор'}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>

            <ClanChat
              messages={clanMessages}
              onSend={onSendMessage}
              onEdit={(id, t) => editClanMessage(id, t)}
              onDelete={(id) => deleteClanMessage(id)}
              canModerate={canModerate}
              bubbleMaxWidth={bubbleMaxWidth}
            />
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
  clanHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  clanIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clanEmblem: { color: '#16181C', fontFamily: 'Inter_700Bold', fontSize: 24 },
  clanEmojiBig: { fontSize: 28 },
  editBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    borderWidth: 1,
    borderRadius: 14,
    padding: 8,
    marginBottom: 14,
  },
  emojiOption: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  medal: { width: 28, fontSize: 18, textAlign: 'center' },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleText: { fontSize: 10.5, fontFamily: 'Inter_700Bold' },
  roleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  topEmblem: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
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
