import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, Switch, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { GroupedSection } from '@/components/ui/GroupedSection';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useThemeColors } from '@/hooks/useThemeColors';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import {
  DEFAULT_NOTIFICATION_PREFS,
  loadNotificationPrefs,
  registerFcmForUser,
  saveNotificationPrefs,
  type NotificationPrefs,
} from '@/lib/notifications/fcm';
import { useTrackerStore } from '@/store/trackerStore';

type PrefRow = { key: keyof NotificationPrefs; label: string; icon: keyof typeof Ionicons.glyphMap };

const ROWS: PrefRow[] = [
  { key: 'goals', label: 'Цели на сегодня', icon: 'flag-outline' },
  { key: 'habits', label: 'Привычки', icon: 'repeat-outline' },
  { key: 'streaks', label: 'Серия дней', icon: 'flame-outline' },
  { key: 'runs', label: 'Пробежки и статистика', icon: 'footsteps-outline' },
  { key: 'ai', label: 'AI-рекомендации', icon: 'sparkles-outline' },
  { key: 'clubs', label: 'Клубы и чат', icon: 'people-outline' },
  { key: 'retention', label: 'Мотивация и возвращение', icon: 'rocket-outline' },
];

type PermState = 'default' | 'granted' | 'denied' | 'unsupported';

function readWebPermission(): PermState {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !('Notification' in window)) {
    return Platform.OS === 'web' ? 'unsupported' : 'default';
  }
  return Notification.permission as PermState;
}

/** Локальный тест-пуш — показать уведомление на рабочем столе прямо сейчас */
async function showTestNotification(): Promise<string> {
  if (Platform.OS !== 'web') {
    try {
      const Notifications = await import('expo-notifications');
      await Notifications.scheduleNotificationAsync({
        content: { title: 'LevelUp', body: 'Тест ✅ Уведомления работают' },
        trigger: null,
      });
      return 'Тест отправлен';
    } catch {
      return 'Не удалось показать тест';
    }
  }
  if (typeof window === 'undefined' || !('Notification' in window)) return 'Браузер не поддерживает уведомления';
  if (Notification.permission !== 'granted') return 'Сначала включите уведомления';
  try {
    const reg =
      (await navigator.serviceWorker?.getRegistration('/')) || (await navigator.serviceWorker?.ready);
    if (reg) {
      await reg.showNotification('LevelUp', {
        body: 'Тест ✅ Уведомления работают',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'levelup-test',
      });
    } else {
      new Notification('LevelUp', { body: 'Тест ✅ Уведомления работают' });
    }
    return 'Тест отправлен — проверьте рабочий стол';
  } catch {
    return 'Не удалось показать тест';
  }
}

export function NotificationSettings() {
  const c = useThemeColors();
  const firebaseUid = useTrackerStore((s) => s.firebaseUid);
  const clanId = useTrackerStore((s) => (s.currentUser ? s.getClanId() : null));

  // Стартуем с дефолтов — тумблеры активны сразу, не дожидаясь загрузки
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [perm, setPerm] = useState<PermState>('default');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    setPerm(readWebPermission());
    if (!firebaseUid || !isFirebaseConfigured()) return;
    void loadNotificationPrefs(firebaseUid).then((p) => p && setPrefs(p));
  }, [firebaseUid]);

  // Любое изменение тумблера сразу сохраняется в Firestore
  const toggle = useCallback(
    (key: keyof NotificationPrefs, value: boolean) => {
      setPrefs((prev) => {
        const next = { ...prev, [key]: value };
        if (firebaseUid) {
          void saveNotificationPrefs(firebaseUid, next).then(() => setStatus('Сохранено'));
        }
        return next;
      });
    },
    [firebaseUid],
  );

  async function enablePush() {
    if (!firebaseUid) return;
    setBusy(true);
    setStatus('');
    try {
      const result = await registerFcmForUser(firebaseUid, clanId, { requestPermission: true });
      setPerm(readWebPermission());
      if (result.ok) {
        setStatus('Готово — уведомления подключены к этому устройству');
        if (!prefs.enabled) toggle('enabled', true);
      } else if (result.reason === 'permission') {
        setStatus('Разрешение не выдано. Откройте настройки браузера и разрешите уведомления для сайта.');
      } else {
        setStatus('Не удалось зарегистрировать push на этом устройстве');
      }
    } finally {
      setBusy(false);
    }
  }

  async function onTest() {
    setStatus('');
    const msg = await showTestNotification();
    setStatus(msg);
  }

  if (!isFirebaseConfigured() || !firebaseUid) return null;

  const permMeta: Record<PermState, { color: string; icon: keyof typeof Ionicons.glyphMap; text: string }> = {
    granted: { color: c.lime, icon: 'checkmark-circle', text: 'Уведомления включены на этом устройстве' },
    denied: { color: c.danger, icon: 'close-circle', text: 'Заблокированы — разрешите в настройках браузера' },
    default: { color: c.muted, icon: 'notifications-off-outline', text: 'Пока не включены на этом устройстве' },
    unsupported: { color: c.muted, icon: 'alert-circle-outline', text: 'Это устройство не поддерживает push' },
  };
  const pm = permMeta[perm];

  return (
    <GroupedSection title="Push-уведомления">
      <View style={styles.block}>
        {/* Статус разрешения */}
        <View style={[styles.statusBox, { backgroundColor: c.cardHover, borderColor: c.border }]}>
          <Ionicons name={pm.icon} size={20} color={pm.color} />
          <Text style={[styles.statusText, { color: c.text }]}>{pm.text}</Text>
        </View>

        <Text style={[styles.hint, { color: c.muted }]}>
          Приходят на рабочий стол, даже когда вкладка закрыта — как в мессенджере.
        </Text>

        {perm !== 'granted' ? (
          <PrimaryButton label="Включить уведомления" loading={busy} onPress={() => void enablePush()} />
        ) : (
          <View style={styles.actionRow}>
            <View style={styles.flex1}>
              <PrimaryButton variant="secondary" label="Проверить" onPress={() => void onTest()} />
            </View>
            <View style={styles.flex1}>
              <PrimaryButton variant="ghost" label="Переподключить" loading={busy} onPress={() => void enablePush()} />
            </View>
          </View>
        )}

        {/* Мастер-тумблер */}
        <View style={[styles.row, styles.masterRow, { borderColor: c.border }]}>
          <Ionicons name="notifications" size={18} color={c.lime} style={styles.rowIcon} />
          <Text style={{ color: c.text, flex: 1, fontFamily: 'Inter_600SemiBold' }}>Все уведомления</Text>
          <Switch
            value={prefs.enabled}
            onValueChange={(v) => toggle('enabled', v)}
            trackColor={{ true: c.accent, false: c.border }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* Категории */}
        {ROWS.map((row) => (
          <View key={row.key} style={[styles.row, { borderColor: c.border }]}>
            <Ionicons name={row.icon} size={18} color={prefs.enabled ? c.muted : c.border} style={styles.rowIcon} />
            <Text style={{ color: prefs.enabled ? c.text : c.muted, flex: 1, fontFamily: 'Inter_500Medium' }}>
              {row.label}
            </Text>
            <Switch
              value={prefs[row.key] as boolean}
              onValueChange={(v) => toggle(row.key, v)}
              disabled={!prefs.enabled}
              trackColor={{ true: c.accent, false: c.border }}
              thumbColor="#FFFFFF"
            />
          </View>
        ))}

        {status ? <Text style={[styles.statusLine, { color: c.muted }]}>{status}</Text> : null}
      </View>
    </GroupedSection>
  );
}

const styles = StyleSheet.create({
  block: { padding: 16, gap: 10 },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  statusText: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', lineHeight: 18 },
  hint: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter_400Regular' },
  actionRow: { flexDirection: 'row', gap: 10 },
  flex1: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  masterRow: { marginTop: 4 },
  rowIcon: { marginRight: 12 },
  statusLine: { fontSize: 13, marginTop: 8, fontFamily: 'Inter_400Regular' },
});
