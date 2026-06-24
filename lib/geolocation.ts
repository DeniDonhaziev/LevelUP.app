import * as Location from 'expo-location';
import { Platform } from 'react-native';

export type GeoPoint = { latitude: number; longitude: number };

/** Единый запрос GPS для web (PWA) и native. */
export async function getCurrentGeoPoint(): Promise<GeoPoint | null> {
  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
    const tryGet = (options: PositionOptions) =>
      new Promise<GeoPoint | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          () => resolve(null),
          options
        );
      });
    // 1) быстрый фикс по сети/Wi-Fi (надёжно на iOS и ПК), 2) уточняем по GPS
    const quick = await tryGet({ enableHighAccuracy: false, maximumAge: 30000, timeout: 12000 });
    if (quick) return quick;
    return tryGet({ enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  try {
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
  } catch {
    return null;
  }
}

export async function requestGeoPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    const pt = await getCurrentGeoPoint();
    return pt != null;
  }
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

/** Текущее состояние разрешения геолокации (web): можно ли показать окно запроса */
export async function getGeoPermissionState(): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return 'unknown';
  const perms = (navigator as Navigator & { permissions?: { query?: (d: { name: PermissionName }) => Promise<{ state: string }> } }).permissions;
  if (!perms?.query) return 'unknown';
  try {
    const status = await perms.query({ name: 'geolocation' as PermissionName });
    return (status.state as 'granted' | 'denied' | 'prompt') ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export type GeoReason = 'denied' | 'unavailable' | 'timeout' | 'unsupported';
export type GeoDetailed = { ok: true; point: GeoPoint } | { ok: false; reason: GeoReason };

/** Запрос с понятной причиной ошибки — для подсказок в UI. */
export async function requestGeoDetailed(): Promise<GeoDetailed> {
  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return { ok: false, reason: 'unsupported' };
    }
    const tryGet = (options: PositionOptions) =>
      new Promise<GeoDetailed>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ ok: true, point: { latitude: pos.coords.latitude, longitude: pos.coords.longitude } }),
          (err) => {
            const reason: GeoReason =
              err.code === err.PERMISSION_DENIED
                ? 'denied'
                : err.code === err.TIMEOUT
                  ? 'timeout'
                  : 'unavailable';
            resolve({ ok: false, reason });
          },
          options
        );
      });
    const quick = await tryGet({ enableHighAccuracy: false, maximumAge: 30000, timeout: 12000 });
    if (quick.ok || quick.reason === 'denied') return quick;
    return tryGet({ enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return { ok: false, reason: 'denied' };
  try {
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { ok: true, point: { latitude: loc.coords.latitude, longitude: loc.coords.longitude } };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
