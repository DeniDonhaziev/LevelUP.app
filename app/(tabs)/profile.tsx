import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { NotificationSettings } from '@/components/NotificationSettings';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { AppInput } from '@/components/ui/AppInput';
import { GroupedSection } from '@/components/ui/GroupedSection';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenScroll } from '@/components/ui/ScreenScroll';
import { pickAvatarImageAsPersistentUri } from '@/lib/avatarPick';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { saveFirebaseDisplayName, saveLocalDisplayName } from '@/lib/firebase/profile';
import { firebaseChangePassword } from '@/lib/firebase/authFlow';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useTrackerStore } from '@/store/trackerStore';
import { onboardingSummaryLine } from '@/lib/onboarding';
import { getGeoPermissionState, requestGeoDetailed, type GeoReason } from '@/lib/geolocation';
import { isCurrentUserAdmin } from '@/lib/admin';
import { Platform } from 'react-native';

export default function ProfileScreen() {
  const c = useThemeColors();
  const user = useTrackerStore((s) => s.currentUser);
  const onboarding = useTrackerStore((s) => (s.currentUser ? s.userData[s.currentUser]?.onboarding : undefined));
  const photoURL = useTrackerStore((s) => s.localAvatarDataUrl);
  const setLocalAvatarDataUrl = useTrackerStore((s) => s.setLocalAvatarDataUrl);
  const changeLocalPassword = useTrackerStore((s) => s.changeLocalPassword);
  const firebaseOn = isFirebaseConfigured();
  const admin = isCurrentUserAdmin(user);

  const [name, setName] = useState(user ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Местоположение
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoOk, setGeoOk] = useState<boolean | null>(null);
  const [geoText, setGeoText] = useState('');

  function geoReasonHint(reason: GeoReason): string {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isMobile = Platform.OS !== 'web' || /Android/i.test(ua) || isIOS;
    switch (reason) {
      case 'denied':
        if (isIOS)
          return 'iPhone: 1) Настройки → Конфиденциальность и безопасность → Службы геолокации → ВКЛ. 2) В том же списке найдите Safari (или это приложение) → «Спросить в следующий раз» или «При использовании», включите «Точная геопозиция». 3) Закройте приложение и откройте заново, затем нажмите кнопку снова.';
        return isMobile
          ? 'Доступ запрещён ранее. Android: меню браузера → «Настройки сайта» → Местоположение → Разрешить (или долгий тап по иконке приложения → Разрешения → Геолокация). Затем нажмите ещё раз.'
          : 'Доступ запрещён ранее. Нажмите значок 🔒 слева в адресной строке → «Местоположение» → «Разрешить», затем обновите страницу (Ctrl+Shift+R) и нажмите снова.';
      case 'unavailable':
        return isMobile
          ? 'Геолокация устройства выключена. Включите её (шторка → значок «Локация», или Настройки → Геопозиция) и нажмите ещё раз.'
          : 'Разрешение есть, но система не отдаёт координаты. На Windows: Параметры → «Конфиденциальность и защита» → «Расположение» → включите «Службы определения местоположения» и доступ для приложений. На Mac: Системные настройки → Конфиденциальность → Службы геолокации → включить для браузера. Затем нажмите ещё раз.';
      case 'timeout':
        return 'Не удалось определить за отведённое время. Попробуйте ещё раз — лучше у окна или на улице.';
      case 'unsupported':
      default:
        return 'Это устройство или браузер не поддерживает геолокацию.';
    }
  }

  // При открытии профиля показываем текущее состояние доступа
  useEffect(() => {
    let cancelled = false;
    void getGeoPermissionState().then((state) => {
      if (cancelled) return;
      if (state === 'granted') {
        setGeoOk(true);
        setGeoText('');
      } else if (state === 'denied') {
        setGeoOk(false);
        setGeoText(geoReasonHint('denied'));
      } else if (state === 'prompt') {
        setGeoOk(null);
        setGeoText('Нажмите кнопку — браузер покажет окно «Разрешить доступ к геолокации».');
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function requestLocation() {
    setGeoBusy(true);
    setGeoText('');
    try {
      const res = await requestGeoDetailed();
      if (res.ok) {
        setGeoOk(true);
        setGeoText(`Доступ разрешён · ${res.point.latitude.toFixed(4)}, ${res.point.longitude.toFixed(4)}`);
      } else {
        setGeoOk(false);
        setGeoText(geoReasonHint(res.reason));
      }
    } finally {
      setGeoBusy(false);
    }
  }

  useEffect(() => {
    if (user) setName(user);
  }, [user]);

  if (!user) {
    return (
      <ScreenScroll>
        <Text style={{ color: c.muted, fontFamily: 'Inter_400Regular' }}>Войдите в аккаунт</Text>
      </ScreenScroll>
    );
  }

  async function pickPhoto() {
    setUploading(true);
    try {
      const picked = await pickAvatarImageAsPersistentUri();
      if (picked === null) {
        Alert.alert('Доступ к фото', 'Разрешите доступ в настройках, чтобы выбрать аватарку.');
        return;
      }
      const { uri, stable } = picked;
      if (!stable) {
        Alert.alert(
          'Фото',
          'Не удалось сохранить изображение. Попробуйте другое фото или меньший размер.'
        );
        return;
      }
      setLocalAvatarDataUrl(uri);
    } catch (e) {
      console.warn('pickPhoto', e);
      Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось выбрать фото');
    } finally {
      setUploading(false);
    }
  }

  function removePhoto() {
    setLocalAvatarDataUrl(null);
  }

  async function saveName() {
    setSaving(true);
    try {
      if (firebaseOn) {
        const err = await saveFirebaseDisplayName(name);
        if (err) Alert.alert('Не удалось сохранить', err);
        else setName(useTrackerStore.getState().currentUser ?? name);
      } else {
        const err = saveLocalDisplayName(name);
        if (err) Alert.alert('Не удалось сохранить', err);
        else setName(useTrackerStore.getState().currentUser ?? name);
      }
    } finally {
      setSaving(false);
    }
  }

  async function savePassword() {
    if (!user) return;
    if (newPassword !== confirmPassword) {
      Alert.alert('Ошибка', 'Новые пароли не совпадают');
      return;
    }
    setChangingPassword(true);
    try {
      const err = firebaseOn
        ? await firebaseChangePassword(currentPassword, newPassword)
        : changeLocalPassword(user, currentPassword, newPassword);
      if (err) {
        Alert.alert('Не удалось сменить пароль', err);
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Готово', 'Пароль успешно изменён');
    } finally {
      setChangingPassword(false);
    }
  }

  const displayInitial = (user ?? '?').slice(0, 1).toUpperCase();

  return (
    <ScreenScroll keyboardShouldPersistTaps="handled">
      <ProfileHeader name={user} photoURL={photoURL} isAdmin={admin} />

      <GroupedSection title="Имя">
        <View style={styles.nameBlock}>
          <Text style={[styles.label, { color: c.muted }]}>Отображаемое имя</Text>
          <AppInput
            value={name}
            onChangeText={setName}
            placeholder="Ваше имя"
            autoCapitalize="words"
          />
          <PrimaryButton label="Сохранить имя" loading={saving} onPress={() => void saveName()} />
        </View>
      </GroupedSection>

      {admin ? (
        <GroupedSection title="Администрирование">
          <Pressable
            onPress={() => router.push('/admin')}
            style={({ pressed }) => [styles.anketaRow, { opacity: pressed ? 0.7 : 1 }]}>
            <View style={[styles.anketaIcon, { backgroundColor: c.pastelMint }]}>
              <Ionicons name="shield-checkmark" size={20} color={c.lime} />
            </View>
            <View style={styles.anketaBody}>
              <Text style={[styles.anketaTitle, { color: c.text }]}>Админ-панель</Text>
              <Text style={[styles.anketaSub, { color: c.muted }]} numberOfLines={1}>
                Удаление кланов, сообщений, кик участников
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={c.muted} />
          </Pressable>
        </GroupedSection>
      ) : null}

      <GroupedSection title="Анкета">
        <Pressable
          onPress={() => router.push('/onboarding?edit=1')}
          style={({ pressed }) => [styles.anketaRow, { opacity: pressed ? 0.7 : 1 }]}>
          <View style={[styles.anketaIcon, { backgroundColor: c.pastelMint }]}>
            <Ionicons name="clipboard-outline" size={20} color={c.lime} />
          </View>
          <View style={styles.anketaBody}>
            <Text style={[styles.anketaTitle, { color: c.text }]}>Моя анкета</Text>
            <Text style={[styles.anketaSub, { color: c.muted }]} numberOfLines={1}>
              {onboardingSummaryLine(onboarding)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.muted} />
        </Pressable>
      </GroupedSection>

      <GroupedSection title="Местоположение">
        <View style={styles.geoBlock}>
          <View style={[styles.geoStatusRow, { backgroundColor: c.cardHover, borderColor: c.border }]}>
            <Ionicons
              name={geoOk === true ? 'location' : geoOk === false ? 'location-outline' : 'navigate-outline'}
              size={20}
              color={geoOk === true ? c.lime : geoOk === false ? c.danger : c.muted}
            />
            <Text style={[styles.geoStatusText, { color: c.text }]}>
              {geoOk === true
                ? 'Геолокация разрешена — карта в «Беге» покажет вас'
                : geoOk === false
                  ? 'Доступ к геолокации не получен'
                  : 'Разрешите доступ, чтобы карта показывала вашу позицию'}
            </Text>
          </View>
          <Text style={[styles.geoHint, { color: c.muted }]}>
            Нужно для отображения вашей позиции и трека на вкладках «Бег» и «Велосипед».
          </Text>
          <PrimaryButton
            label="Определить моё местоположение"
            loading={geoBusy}
            onPress={() => void requestLocation()}
          />
          {geoText ? <Text style={[styles.geoResult, { color: c.muted }]}>{geoText}</Text> : null}
        </View>
      </GroupedSection>

      <GroupedSection title="Фото">
        <View style={styles.avatarBlock}>
          <View style={styles.avatarWrap}>
            {uploading ? (
              <View style={styles.avatarLoading}>
                {photoURL ? (
                  <Image source={{ uri: photoURL }} style={styles.avatarImgDimmed} resizeMode="cover" />
                ) : null}
                <View style={styles.avatarSpinnerOverlay}>
                  <ActivityIndicator size="large" color={c.text} />
                </View>
              </View>
            ) : photoURL ? (
              <Image
                source={{ uri: photoURL }}
                style={styles.avatarImg}
                resizeMode="cover"
                onError={() => setLocalAvatarDataUrl(null)}
              />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: c.cardHover, borderColor: c.border }]}>
                <Text style={[styles.avatarLetter, { color: c.text }]}>{displayInitial}</Text>
              </View>
            )}
          </View>

          <PrimaryButton
            variant="secondary"
            label="Выбрать аватар"
            onPress={() => void pickPhoto()}
            disabled={uploading}
          />
          {photoURL ? (
            <Pressable onPress={removePhoto} disabled={uploading} style={styles.removeLink}>
              <Text style={[styles.removeLinkText, { color: c.danger }]}>Убрать фото</Text>
            </Pressable>
          ) : null}
        </View>
      </GroupedSection>

      <NotificationSettings />

      <GroupedSection title="Пароль">
        <View style={styles.nameBlock}>
          <Text style={[styles.label, { color: c.muted }]}>Текущий пароль</Text>
          <AppInput
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={[styles.label, { color: c.muted }]}>Новый пароль</Text>
          <AppInput
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={[styles.label, { color: c.muted }]}>Повторите новый пароль</Text>
          <AppInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <PrimaryButton
            label="Сменить пароль"
            loading={changingPassword}
            onPress={() => void savePassword()}
          />
        </View>
      </GroupedSection>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  avatarBlock: { padding: 16, gap: 12, alignItems: 'center' },
  avatarWrap: {
    alignItems: 'center',
    minHeight: 120,
    justifyContent: 'center',
  },
  avatarImg: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarLoading: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    position: 'relative',
  },
  avatarImgDimmed: {
    width: 120,
    height: 120,
    borderRadius: 60,
    opacity: 0.4,
  },
  avatarSpinnerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { fontSize: 48, fontFamily: 'Inter_700Bold' },
  removeLink: { alignItems: 'center', paddingVertical: 4 },
  removeLinkText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  nameBlock: { padding: 16, gap: 12 },
  label: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  anketaRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  anketaIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  anketaBody: { flex: 1 },
  anketaTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  anketaSub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  geoBlock: { padding: 16, gap: 10 },
  geoStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  geoStatusText: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', lineHeight: 18 },
  geoHint: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter_400Regular' },
  geoResult: { fontSize: 13, marginTop: 4, fontFamily: 'Inter_400Regular', lineHeight: 18 },
});
