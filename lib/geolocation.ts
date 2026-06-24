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
    // 1) точно через GPS (телефон/PWA), 2) фолбэк по Wi-Fi/сети — надёжно на ПК
    const precise = await tryGet({ enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
    if (precise) return precise;
    return tryGet({ enableHighAccuracy: false, maximumAge: 60000, timeout: 12000 });
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
    const precise = await tryGet({ enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
    if (precise.ok || precise.reason === 'denied') return precise;
    return tryGet({ enableHighAccuracy: false, maximumAge: 60000, timeout: 12000 });
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
