import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { TerritoryMap } from '@/components/TerritoryMap';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { getTerritoryColor } from '@/lib/geo';
import {
  acceptGpsPoint,
  createGpsTrackState,
  formatTrackDistance,
  type GeoFix,
} from '@/lib/gpsTrack';
import { useUserLocation } from '@/hooks/useUserLocation';
import { snapRouteToRoads } from '@/lib/roadSnap';
import { useTrackerStore } from '@/store/trackerStore';
import { GroupedSection } from '@/components/ui/GroupedSection';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenScroll } from '@/components/ui/ScreenScroll';
import { SectionTitle } from '@/components/ui/SectionTitle';

export default function RunScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const user = useTrackerStore((s) => s.currentUser);
  const territories = useTrackerStore((s) => s.territories);
  const finishRun = useTrackerStore((s) => s.finishRun);

  const [watching, setWatching] = useState(false);
  const [displayTrack, setDisplayTrack] = useState<[number, number][]>([]);
  const [timerText, setTimerText] = useState('0:00');
  const [distText, setDistText] = useState('0 м');
  const [gpsStatus, setGpsStatus] = useState('');
  const [resultMsg, setResultMsg] = useState('');
  const [resultDetail, setResultDetail] = useState('');
  const [stopping, setStopping] = useState(false);
  const [mapRegion, setMapRegion] = useState({
    latitude: 55.75,
    longitude: 37.62,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  const { userLocation, locating, geoError, refresh, setUserLocation } = useUserLocation({
    auto: true,
    watchOnWeb: !watching,
  });

  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const webWatchIdRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackRef = useRef(createGpsTrackState());
  const snapGenRef = useRef(0);

  const mine = territories.filter((t) => t.owner === user);
  const lineColor = user ? getTerritoryColor(user) : c.lime;

  const scheduleRoadSnap = useCallback((pts: [number, number][]) => {
    if (pts.length < 2) {
      setDisplayTrack(pts);
      return;
    }
    const gen = ++snapGenRef.current;
    void snapRouteToRoads(pts).then((snapped) => {
      if (snapGenRef.current !== gen) return;
      setDisplayTrack(snapped.length >= 2 ? snapped : pts);
    });
  }, []);

  const onGpsFix = useCallback(
    (fix: GeoFix) => {
      const { state, accepted } = acceptGpsPoint(trackRef.current, fix);
      trackRef.current = state;

      setUserLocation({ latitude: fix.lat, longitude: fix.lon });
      setMapRegion({
        latitude: fix.lat,
        longitude: fix.lon,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
      setDistText(formatTrackDistance(state.totalMeters));

      const acc = fix.accuracy != null ? fix.accuracy.toFixed(0) : '—';
      setGpsStatus(
        'GPS: ' +
          state.points.length +
          ' точек' +
          (accepted ? '' : ' (фильтр)') +
          '. Точность ~' +
          acc +
          ' м'
      );

      if (accepted) scheduleRoadSnap(state.points);
    },
    [scheduleRoadSnap]
  );

  const stopAll = useCallback(() => {
    if (watchRef.current) {
      watchRef.current.remove();
      watchRef.current = null;
    }
    if (webWatchIdRef.current != null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(webWatchIdRef.current);
      webWatchIdRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setWatching(false);
  }, []);

  useEffect(() => {
    if (!userLocation) return;
    setMapRegion({
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    });
  }, [userLocation?.latitude, userLocation?.longitude]);

  useEffect(() => () => stopAll(), [stopAll]);

  async function startRun() {
    if (!user) {
      setGpsStatus('Войдите в аккаунт, чтобы захватывать территории.');
      return;
    }

    trackRef.current = createGpsTrackState();
    snapGenRef.current = 0;
    setDisplayTrack([]);
    setDistText('0 м');
    setResultMsg('');
    setResultDetail('');
    setGpsStatus('Ожидание GPS…');
    startTimeRef.current = Date.now();
    setWatching(true);

    timerRef.current = setInterval(() => {
      const sec = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      setTimerText(m + ':' + (s < 10 ? '0' : '') + s);
    }, 1000);

    if (Platform.OS === 'web') {
      if (!navigator.geolocation) {
        setGpsStatus('Нет поддержки геолокации в браузере.');
        setWatching(false);
        return;
      }
      webWatchIdRef.current = navigator.geolocation.watchPosition(
        (pos) =>
          onGpsFix({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            speed: pos.coords.speed,
            timestamp: pos.timestamp,
          }),
        () => setGpsStatus('Нет доступа к геолокации.'),
        { enableHighAccuracy: true, maximumAge: 1500, timeout: 15000 }
      );
      return;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setGpsStatus('Нет доступа к геолокации.');
      setWatching(false);
      return;
    }

    watchRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 2000,
        distanceInterval: 4,
      },
      (loc) =>
        onGpsFix({
          lat: loc.coords.latitude,
          lon: loc.coords.longitude,
          accuracy: loc.coords.accuracy,
          speed: loc.coords.speed,
          timestamp: loc.timestamp,
        })
    );
  }

  function stopRun() {
    const pts = [...trackRef.current.points];
    const finishedAt = Date.now();
    const startedAt = startTimeRef.current || finishedAt;
    stopAll();
    setStopping(true);

    void (async () => {
      let roadPoints = pts;
      if (pts.length >= 2) {
        setGpsStatus('Привязка маршрута к дорогам…');
        roadPoints = await snapRouteToRoads(pts, { force: true });
      }
      const r = finishRun(pts, { startedAt, finishedAt, roadPoints });
      setDisplayTrack(roadPoints.length >= 2 ? roadPoints : pts);
      setResultMsg(r.message);
      setResultDetail(r.detail + (r.detail ? '\n' : '') + 'Пробежка сохранена в истории.');
      setStopping(false);
    })();
  }

  return (
    <ScreenScroll>
      <SectionTitle
        title="Бег"
        subtitle="Захват территорий по GPS. На месте километры не растут."
      />

      <GroupedSection title="Карта">
        <View style={styles.mapSection}>
          <View style={[styles.mapBox, { borderColor: c.border }]}>
            <TerritoryMap
              region={mapRegion}
              lineColor={lineColor}
              mine={mine}
              currentTrack={displayTrack}
              userLocation={userLocation}
              onLocateMe={() => void refresh()}
              locating={locating}
              geoHint={geoError}
            />
          </View>
        </View>
      </GroupedSection>

      <GroupedSection title="Пробежка">
        <View style={styles.runSection}>
          {!watching ? (
            <PrimaryButton label="Начать пробежку" onPress={() => void startRun()} />
          ) : (
            <View style={[styles.panel, { backgroundColor: c.cardHover, borderColor: c.border }]}>
              <Text style={{ color: c.text, fontSize: 32, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 }}>
                {timerText}
              </Text>
              <Text style={{ color: c.muted, marginTop: 6, fontFamily: 'Inter_500Medium' }}>
                Расстояние: {distText}
              </Text>
              <Text style={{ color: c.muted, marginTop: 8, fontSize: 13, lineHeight: 18 }}>{gpsStatus}</Text>
              <Pressable
                onPress={stopRun}
                disabled={stopping}
                style={({ pressed }) => [
                  styles.stopBtn,
                  { marginTop: 16, opacity: stopping ? 0.6 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
                ]}>
                <Text style={styles.stopText}>{stopping ? 'Сохранение…' : 'Завершить пробежку'}</Text>
              </Pressable>
            </View>
          )}

          {resultMsg || resultDetail ? (
            <View style={[styles.result, { borderColor: c.border, backgroundColor: c.cardHover }]}>
              <Text style={{ color: c.text, fontFamily: 'Inter_700Bold', marginBottom: 6 }}>{resultMsg}</Text>
              {resultDetail ? <Text style={{ color: c.muted, lineHeight: 20 }}>{resultDetail}</Text> : null}
            </View>
          ) : null}
        </View>
      </GroupedSection>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  mapSection: { padding: 12 },
  runSection: { padding: 16, gap: 12 },
  mapBox: { height: 260, borderRadius: 12, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  goBtn: { paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  goText: { fontSize: 17, fontFamily: 'Inter_700Bold', color: '#F2F2F7' },
  panel: { borderRadius: 16, borderWidth: 1, padding: 14, marginTop: 8 },
  stopBtn: { backgroundColor: '#FF6B6B', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  stopText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 16 },
  result: { marginTop: 14, padding: 14, borderRadius: 16, borderWidth: 1 },
});
