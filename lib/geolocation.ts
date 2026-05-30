import * as Location from 'expo-location';
import { Platform } from 'react-native';

export type GeoPoint = { latitude: number; longitude: number };

/** Единый запрос GPS для web (PWA) и native. */
export async function getCurrentGeoPoint(): Promise<GeoPoint | null> {
  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        () => resolve(null),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
      );
    });
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
