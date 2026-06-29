import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { WebTheme } from '@/lib/theme';
import { useTrackerStore } from '@/store/trackerStore';
import { isCurrentUserAdmin } from '@/lib/admin';
import {
  adminDeleteClanInFirestore,
  adminKickMemberInFirestore,
  deleteClanMessageInFirestore,
  loadClanLeaderboard,
  loadClanMembers,
  loadClanMessages,
} from '@/lib/firebase/clanSync';
import {
  approveSubscription,
  deleteSubscription,
  loadAllSubscriptions,
  rejectSubscription,
} from '@/lib/firebase/subscriptionSync';
import { fmtSubDate, planTitle, type SubscriptionDoc } from '@/lib/subscription';
import type { Clan, ClanMember, ClanMessage } from '@/lib/types';

type ThemeColors = (typeof Colors)['dark'];

function confirm(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' ? window.confirm(`${title}\n\n${message}`) : false);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Отмена', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Удалить', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

export default function AdminScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const currentUser = useTrackerStore((s) => s.currentUser);
  const admin = isCurrentUserAdmin(currentUser);

  const [clans, setClans] = useState<Clan[]>([]);
  const [subs, setSubs] = useState<SubscriptionDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [members, setMembers] = useState<Record<string, ClanMember[]>>({});
  const [messages, setMessages] = useState<Record<string, ClanMessage[]>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [list, subList] = await Promise.all([loadClanLeaderboard(200), loadAllSubscriptions()]);
      setClans(list);
      setSubs(subList);
    } finally {
      setLoading(false);
    }
  }, []);

  async function onApproveSub(sub: SubscriptionDoc) {
    setBusy(`sub:${sub.uid}`);
    try {
      const updated = await approveSubscription(sub);
      setSubs((prev) => prev.map((s) => (s.uid === sub.uid ? updated : s)));
    } catch (e) {
      Alert.alert('Ошибка', (e as Error).message ?? 'Не удалось подтвердить');
    } finally {
      setBusy(null);
    }
  }

  async function onRejectSub(sub: SubscriptionDoc) {
    setBusy(`sub:${sub.uid}`);
    try {
      const updated = await rejectSubscription(sub);
      setSubs((prev) => prev.map((s) => (s.uid === sub.uid ? updated : s)));
    } catch (e) {
      Alert.alert('Ошибка', (e as Error).message ?? 'Не удалось отклонить');
    } finally {
      setBusy(null);
    }
  }

  async function onDeleteSub(sub: SubscriptionDoc) {
    const ok = await confirm('Удалить запись?', `Подписка ${sub.username} будет удалена.`);
    if (!ok) return;
    setBusy(`sub:${sub.uid}`);
    try {
      await deleteSubscription(sub.uid);
      setSubs((prev) => prev.filter((s) => s.uid !== sub.uid));
    } catch (e) {
      Alert.alert('Ошибка', (e as Error).message ?? 'Не удалось удалить');
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (admin) void reload();
  }, [admin, reload]);

  // Гейт: не админ — на главную
  if (!admin) return <Redirect href="/(tabs)" />;

  async function toggleExpand(clan: Clan) {
    if (expanded === clan.id) {
      setExpanded(null);
      return;
    }
    setExpanded(clan.id);
    if (!members[clan.id] || !messages[clan.id]) {
      const [mem, msg] = await Promise.all([loadClanMembers(clan.id), loadClanMessages(clan.id, 50)]);
      setMembers((prev) => ({ ...prev, [clan.id]: mem }));
      setMessages((prev) => ({ ...prev, [clan.id]: msg }));
    }
  }

  async function onDeleteClan(clan: Clan) {
    const ok = await confirm('Удалить клан?', `«${clan.name}» и все его сообщения/участники будут удалены безвозвратно.`);
    if (!ok) return;
    setBusy(`clan:${clan.id}`);
    try {
      await adminDeleteClanInFirestore(clan.id);
      setClans((prev) => prev.filter((x) => x.id !== clan.id));
      if (expanded === clan.id) setExpanded(null);
    } catch (e) {
      Alert.alert('Ошибка', (e as Error).message ?? 'Не удалось удалить клан');
    } finally {
      setBusy(null);
    }
  }

  async function onKick(clan: Clan, member: ClanMember) {
    const ok = await confirm('Выгнать участника?', `${member.username} будет удалён из клана «${clan.name}».`);
    if (!ok) return;
    setBusy(`member:${clan.id}:${member.uid}`);
    try {
      await adminKickMemberInFirestore(clan.id, member.uid, member.role === 'owner');
      setMembers((prev) => ({ ...prev, [clan.id]: (prev[clan.id] || []).filter((m) => m.uid !== member.uid) }));
      setClans((prev) => prev.map((x) => (x.id === clan.id ? { ...x, memberCount: Math.max(0, x.memberCount - 1) } : x)));
    } catch (e) {
      Alert.alert('Ошибка', (e as Error).message ?? 'Не удалось выгнать участника');
    } finally {
      setBusy(null);
    }
  }

  async function onDeleteMessage(clan: Clan, msg: ClanMessage) {
    const ok = await confirm('Удалить сообщение?', `«${msg.text.slice(0, 60)}»`);
    if (!ok) return;
    setBusy(`msg:${clan.id}:${msg.id}`);
    try {
      await deleteClanMessageInFirestore(clan.id, msg.id);
      setMessages((prev) => ({ ...prev, [clan.id]: (prev[clan.id] || []).filter((m) => m.id !== msg.id) }));
    } catch (e) {
      Alert.alert('Ошибка', (e as Error).message ?? 'Не удалось удалить сообщение');
    } finally {
      setBusy(null);
    }
  }

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={({ pressed }) => [styles.backBtn, { borderColor: c.border, opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="chevron-back" size={20} color={c.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: c.text }]}>Админ-панель</Text>
            <Text style={[styles.subtitle, { color: c.muted }]}>Управление кланами · только для админа</Text>
          </View>
          <Pressable
            onPress={() => void reload()}
            hitSlop={10}
            style={({ pressed }) => [styles.backBtn, { borderColor: c.border, opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="refresh" size={18} color={c.lime} />
          </Pressable>
        </View>

        <View style={[styles.banner, { backgroundColor: c.pastelMint, borderColor: 'rgba(193,255,0,0.4)' }]}>
          <Ionicons name="shield-checkmark" size={18} color={c.lime} />
          <Text style={[styles.bannerText, { color: c.text }]}>
            Всего кланов: {clans.length}. Удаление безвозвратно.
          </Text>
        </View>

        {/* ── Заявки на подписку ── */}
        <View style={styles.secHead}>
          <Text style={[styles.secTitle, { color: c.text }]}>Подписки на ИИ</Text>
          {(() => {
            const pend = subs.filter((s) => s.status === 'pending').length;
            return pend > 0 ? (
              <View style={[styles.pendPill, { backgroundColor: c.lime }]}>
                <Text style={styles.pendPillText}>{pend} новых</Text>
              </View>
            ) : null;
          })()}
        </View>
        {subs.length === 0 ? (
          <Text style={[styles.dim, { color: c.muted, marginBottom: 12 }]}>Заявок пока нет.</Text>
        ) : (
          [...subs]
            .sort((a, b) => {
              const order = { pending: 0, active: 1, rejected: 2 } as const;
              return order[a.status] - order[b.status] || (b.requestedAt || 0) - (a.requestedAt || 0);
            })
            .map((sub) => {
              const subBusy = busy === `sub:${sub.uid}`;
              const statusColor =
                sub.status === 'active' ? c.lime : sub.status === 'pending' ? '#FFB020' : c.danger;
              const statusText =
                sub.status === 'active'
                  ? `активна до ${fmtSubDate(sub.expiresAt)}`
                  : sub.status === 'pending'
                    ? 'ожидает подтверждения'
                    : 'отклонена';
              return (
                <View key={sub.uid} style={[styles.card, { backgroundColor: c.cardElevated, borderColor: c.border }]}>
                  <View style={styles.subRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.clanName, { color: c.text }]}>{sub.username}</Text>
                      <Text style={[styles.clanMeta, { color: c.muted }]}>{sub.email || '—'}</Text>
                      <Text style={[styles.clanMeta, { color: c.muted }]}>
                        Тариф «{planTitle(sub.plan)}» · {sub.price} ₽
                      </Text>
                      <Text style={[styles.clanMeta, { color: statusColor, fontFamily: 'Inter_600SemiBold' }]}>
                        {statusText}
                      </Text>
                    </View>
                    {subBusy ? <ActivityIndicator color={c.lime} /> : null}
                  </View>
                  <View style={styles.subActions}>
                    {sub.status !== 'active' ? (
                      <Pressable
                        onPress={() => void onApproveSub(sub)}
                        disabled={subBusy}
                        style={[styles.subBtn, { backgroundColor: c.lime, opacity: subBusy ? 0.5 : 1 }]}>
                        <Ionicons name="checkmark" size={16} color="#0A0A0B" />
                        <Text style={[styles.subBtnText, { color: '#0A0A0B' }]}>Подтвердить</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() => void onApproveSub(sub)}
                        disabled={subBusy}
                        style={[styles.subBtnOutline, { borderColor: c.lime, opacity: subBusy ? 0.5 : 1 }]}>
                        <Text style={[styles.subBtnText, { color: c.lime }]}>Продлить</Text>
                      </Pressable>
                    )}
                    {sub.status === 'pending' ? (
                      <Pressable
                        onPress={() => void onRejectSub(sub)}
                        disabled={subBusy}
                        style={[styles.subBtnOutline, { borderColor: c.danger, opacity: subBusy ? 0.5 : 1 }]}>
                        <Text style={[styles.subBtnText, { color: c.danger }]}>Отклонить</Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() => void onDeleteSub(sub)}
                      disabled={subBusy}
                      style={[styles.subIconBtn, { borderColor: c.border }]}>
                      <Ionicons name="trash-outline" size={15} color={c.muted} />
                    </Pressable>
                  </View>
                </View>
              );
            })
        )}

        <View style={styles.secHead}>
          <Text style={[styles.secTitle, { color: c.text }]}>Кланы</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={c.lime} style={{ marginTop: 40 }} />
        ) : clans.length === 0 ? (
          <Text style={[styles.empty, { color: c.muted }]}>Кланов пока нет.</Text>
        ) : (
          clans.map((clan) => {
            const isOpen = expanded === clan.id;
            const clanBusy = busy === `clan:${clan.id}`;
            return (
              <View key={clan.id} style={[styles.card, { backgroundColor: c.cardElevated, borderColor: c.border }]}>
                <Pressable onPress={() => void toggleExpand(clan)} style={styles.clanRow}>
                  <View style={[styles.clanIcon, { backgroundColor: c.cardHover }]}>
                    <Text style={{ fontSize: 20 }}>{clan.emoji || '🏃'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.clanName, { color: c.text }]}>{clan.name}</Text>
                    <Text style={[styles.clanMeta, { color: c.muted }]}>
                      {clan.memberCount} уч. · {(clan.totalDistanceMeters / 1000).toFixed(1)} км · код {clan.inviteCode}
                    </Text>
                    <Text style={[styles.clanMeta, { color: c.muted }]}>Владелец: {clan.ownerUsername}</Text>
                  </View>
                  <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} color={c.muted} />
                </Pressable>

                <View style={styles.clanActions}>
                  <Pressable
                    onPress={() => void onDeleteClan(clan)}
                    disabled={clanBusy}
                    style={({ pressed }) => [styles.deleteBtn, { opacity: clanBusy ? 0.5 : pressed ? 0.8 : 1 }]}>
                    {clanBusy ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="trash-outline" size={16} color="#fff" />
                        <Text style={styles.deleteBtnText}>Удалить клан</Text>
                      </>
                    )}
                  </Pressable>
                </View>

                {isOpen ? (
                  <View style={[styles.expandBlock, { borderTopColor: c.border }]}>
                    {/* Участники */}
                    <Text style={[styles.sectionCap, { color: c.muted }]}>УЧАСТНИКИ</Text>
                    {(members[clan.id] || []).length === 0 ? (
                      <Text style={[styles.dim, { color: c.muted }]}>Нет участников</Text>
                    ) : (
                      (members[clan.id] || []).map((m) => (
                        <View key={m.uid} style={styles.itemRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.itemMain, { color: c.text }]}>
                              {m.username} {m.role === 'owner' ? '👑' : m.role === 'motivator' ? '⭐' : ''}
                            </Text>
                            <Text style={[styles.dim, { color: c.muted }]}>{(m.distanceMeters / 1000).toFixed(1)} км</Text>
                          </View>
                          <Pressable
                            onPress={() => void onKick(clan, m)}
                            disabled={busy === `member:${clan.id}:${m.uid}`}
                            style={({ pressed }) => [styles.kickBtn, { borderColor: c.danger, opacity: pressed ? 0.7 : 1 }]}>
                            <Text style={[styles.kickText, { color: c.danger }]}>Выгнать</Text>
                          </Pressable>
                        </View>
                      ))
                    )}

                    {/* Сообщения */}
                    <Text style={[styles.sectionCap, { color: c.muted, marginTop: 14 }]}>СООБЩЕНИЯ</Text>
                    {(messages[clan.id] || []).length === 0 ? (
                      <Text style={[styles.dim, { color: c.muted }]}>Нет сообщений</Text>
                    ) : (
                      (messages[clan.id] || []).map((msg) => (
                        <View key={msg.id} style={styles.itemRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.itemMain, { color: c.text }]} numberOfLines={2}>
                              <Text style={{ fontFamily: 'Inter_600SemiBold' }}>{msg.username}: </Text>
                              {msg.text}
                            </Text>
                          </View>
                          <Pressable
                            onPress={() => void onDeleteMessage(clan, msg)}
                            disabled={busy === `msg:${clan.id}:${msg.id}`}
                            style={({ pressed }) => [styles.kickBtn, { borderColor: c.danger, opacity: pressed ? 0.7 : 1 }]}>
                            <Ionicons name="trash-outline" size={14} color={c.danger} />
                          </Pressable>
                        </View>
                      ))
                    )}
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, maxWidth: 720, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  title: { fontSize: 24, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  bannerText: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium' },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14, fontFamily: 'Inter_400Regular' },
  card: { borderRadius: WebTheme.radiusLg, borderWidth: 1, marginBottom: 12, overflow: 'hidden' },
  clanRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  clanIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  clanName: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  clanMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  clanActions: { paddingHorizontal: 14, paddingBottom: 14 },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FF453A',
    paddingVertical: 10,
    borderRadius: 12,
  },
  deleteBtnText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  expandBlock: { borderTopWidth: StyleSheet.hairlineWidth, padding: 14, gap: 4 },
  sectionCap: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.5, marginBottom: 6 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  itemMain: { fontSize: 14, fontFamily: 'Inter_500Medium', lineHeight: 19 },
  dim: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  kickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  kickText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  secHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6, marginBottom: 10 },
  secTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
  pendPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  pendPillText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#0A0A0B' },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  subActions: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 14 },
  subBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  subBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  subBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  subIconBtn: {
    width: 38,
    height: 36,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
});
