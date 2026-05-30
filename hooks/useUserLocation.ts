import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { getCurrentGeoPoint, type GeoPoint } from '@/lib/geolocation';

type Options = {
  /** Авто-запрос при открытии экрана */
  auto?: boolean;
  /** На web — следить за позицией, пока экран открыт */
  watchOnWeb?: boolean;
};

export function useUserLocation({ auto = true, watchOnWeb = true }: Options = {}) {
  const [userLocation, setUserLocation] = useState<GeoPoint | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState('');
  const webWatchIdRef = useRef<number | null>(null);

  const refresh = useCallback(async (): Promise<GeoPoint | null> => {
    setLocating(true);
    setGeoError('');
    const pt = await getCurrentGeoPoint();
    setLocating(false);
    if (pt) {
      setUserLocation(pt);
      setGeoError('');
      return pt;
    }
    setGeoError(
      Platform.OS === 'web'
        ? 'Разрешите доступ к геолокации в браузере (значок замка в адресной строке).'
        : 'Не удалось определить местоположение.'
    );
    return null;
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!auto) return;
      let cancelled = false;
      void (async () => {
        const pt = await getCurrentGeoPoint();
        if (cancelled) return;
        if (pt) {
          setUserLocation(pt);
          setGeoError('');
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [auto])
  );

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'web' || !watchOnWeb) return;
      if (typeof navigator === 'undefined' || !navigator.geolocation) return;

      webWatchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          setUserLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          setGeoError('');
        },
        () => {
          setGeoError('Нет доступа к геолокации в браузере.');
        },
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 }
      );

      return () => {
        if (webWatchIdRef.current != null) {
          navigator.geolocation.clearWatch(webWatchIdRef.current);
          webWatchIdRef.current = null;
        }
      };
    }, [watchOnWeb])
  );

  useEffect(
    () => () => {
      if (webWatchIdRef.current != null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(webWatchIdRef.current);
        webWatchIdRef.current = null;
      }
    },
    []
  );

  return { userLocation, locating, geoError, refresh, setUserLocation };
}
