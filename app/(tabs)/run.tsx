import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TerritoryMap } from '@/components/TerritoryMap';
import Colors from '@/constants/Colors';
import { WebTheme } from '@/lib/theme';
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
import { ScreenScroll } from '@/components/ui/ScreenScroll';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TabScreenHeader } from '@/components/ui/TabScreenHeader';

type ActivityMode = 'run' | 'bike';
const MODE_LABELS: Record<ActivityMode, { start: string; section: string; saved: string; subtitle: string }> = {
  run: {
    start: 'Начать пробежку',
    section: 'Пробежка',
    saved: 'Пробежка сохранена в истории.',
    subtitle: 'GPS-трекинг бега и захват территорий',
  },
  bike: {
    start: 'Начать заезд',
    section: 'Велозаезд',
    saved: 'Заезд сохранён в истории.',
    subtitle: 'GPS-трекинг велозаезда и захват территорий',
  },
};

export default function RunScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const user = useTrackerStore((s) => s.currentUser);
  const territories = useTrackerStore((s) => s.territories);
  const finishRun = useTrackerStore((s) => s.finishRun);

  const [mode, setMode] = useState<ActivityMode>('run');
  const modeRef = useRef<ActivityMode>('run');
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  const L = MODE_LABELS[mode];

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
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const visListenerRef = useRef<(() => void) | null>(null);
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
    const profile = modeRef.current === 'bike' ? 'bike' : 'foot';
    void snapRouteToRoads(pts, { profile }).then((snapped) => {
      if (snapGenRef.current !== gen) return;
      setDisplayTrack(snapped.length >= 2 ? snapped : pts);
    });
  }, []);

  const onGpsFix = useCallback(
    (fix: GeoFix) => {
      // Велосипед едет быстрее бега — ослабляем фильтр, иначе точки отбрасываются и трек обрывается
      const acceptOpts =
        modeRef.current === 'bike'
          ? { maxSpeedMps: 25, maxJumpM: 250, minMoveM: 6 }
          : undefined;
      const { state, accepted } = acceptGpsPoint(trackRef.current, fix, acceptOpts);
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
    if (wakeLockRef.current) {
      void wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
    if (visListenerRef.current && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', visListenerRef.current);
      visListenerRef.current = null;
    }
    setWatching(false);
  }, []);

  // Не даём экрану гаснуть во время записи (иначе GPS на телефоне останавливается)
  function requestWakeLock() {
    if (typeof navigator === 'undefined') return;
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock;
    if (!wl) return;
    void wl
      .request('screen')
      .then((sentinel) => {
        wakeLockRef.current = sentinel;
      })
      .catch(() => {});
  }

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
    requestWakeLock();
    // Браузер сбрасывает Wake Lock при сворачивании/гашении экрана — переустанавливаем при возврате
    if (typeof document !== 'undefined') {
      const onVis = () => {
        if (document.visibilityState === 'visible') requestWakeLock();
      };
      document.addEventListener('visibilitychange', onVis);
      visListenerRef.current = onVis;
    }

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
        const profile = modeRef.current === 'bike' ? 'bike' : 'foot';
        roadPoints = await snapRouteToRoads(pts, { force: true, profile });
      }
      const r = finishRun(pts, { startedAt, finishedAt, roadPoints, activity: modeRef.current });
      setDisplayTrack(roadPoints.length >= 2 ? roadPoints : pts);
      setResultMsg(r.message);
      setResultDetail(r.detail + (r.detail ? '\n' : '') + MODE_LABELS[modeRef.current].saved);
      setStopping(false);
    })();
  }

  return (
    <ScreenScroll>
      <TabScreenHeader title={mode === 'bike' ? 'Велосипед' : 'Бег'} subtitle={L.subtitle} />

      {/* Переключатель режима: бег / велосипед (нельзя менять во время активности) */}
      <View style={[styles.modeSwitch, watching && { opacity: 0.5 }]} pointerEvents={watching ? 'none' : 'auto'}>
        <SegmentedControl
          value={mode}
          onChange={(k) => setMode(k as ActivityMode)}
          options={[
            { key: 'run', label: '🏃 Бег' },
            { key: 'bike', label: '🚴 Велосипед' },
          ]}
        />
      </View>

      <View style={[styles.mapCard, { borderColor: c.border, backgroundColor: c.cardElevated }]}>
        <TerritoryMap
          region={mapRegion}
          lineColor={lineColor}
          mine={mine}
          currentTrack={displayTrack}
          userLocation={userLocation}
          onLocateMe={() => void refresh()}
          locating={locating}
          geoHint={geoError}
          hideChrome
        />

        {/* Кнопка «моё местоположение» */}
        <Pressable
          onPress={() => void refresh()}
          disabled={locating}
          style={({ pressed }) => [styles.locateFab, { opacity: pressed ? 0.8 : 1 }]}>
          <Ionicons name={locating ? 'sync-outline' : 'locate'} size={20} color="#16181C" />
        </Pressable>

        {/* Призыв включить геопозицию, пока её нет */}
        {!userLocation ? (
          <View style={styles.geoPromptWrap} pointerEvents="box-none">
            <Pressable
              onPress={() => void refresh()}
              disabled={locating}
              style={({ pressed }) => [styles.geoPromptBtn, { opacity: pressed ? 0.9 : 1 }]}>
              <Ionicons name="navigate" size={18} color="#16181C" />
              <Text style={styles.geoPromptText}>
                {locating ? 'Определяем…' : 'Разрешить местоположение'}
              </Text>
            </Pressable>
            {geoError ? <Text style={styles.geoPromptHint}>{geoError}</Text> : null}
          </View>
        ) : null}

        {/* Плавающая инфо-карточка */}
        <View style={[styles.mapInfoCard, { backgroundColor: 'rgba(20,20,22,0.92)', borderColor: watching ? c.lime : c.border }]}>
          <View style={styles.infoHeader}>
            <View style={[styles.statusPill, { backgroundColor: watching ? c.lime : c.cardHover }]}>
              {watching ? <View style={styles.liveDot} /> : null}
              <Text style={[styles.statusPillText, { color: watching ? '#16181C' : c.muted }]}>
                {watching ? 'LIVE' : 'GPS'}
              </Text>
            </View>
            <Text style={[styles.infoLocation, { color: '#FFFFFF' }]} numberOfLines={1}>
              {userLocation
                ? `${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}`
                : geoError || 'Определите позицию'}
            </Text>
          </View>
          <View style={styles.infoStats}>
            <View style={styles.infoStat}>
              <Text style={styles.infoStatLabel}>Дистанция</Text>
              <Text style={styles.infoStatValue}>{distText}</Text>
            </View>
            <View style={[styles.infoDivider, { backgroundColor: c.border }]} />
            <View style={styles.infoStat}>
              <Text style={styles.infoStatLabel}>Время</Text>
              <Text style={styles.infoStatValue}>{timerText}</Text>
            </View>
            <View style={[styles.infoDivider, { backgroundColor: c.border }]} />
            <View style={styles.infoStat}>
              <Text style={styles.infoStatLabel}>Точек</Text>
              <Text style={styles.infoStatValue}>{displayTrack.length}</Text>
            </View>
          </View>
        </View>
      </View>

      <GroupedSection title={L.section}>
        <View style={styles.runSection}>
          {!watching ? (
            <Pressable
              onPress={() => void startRun()}
              style={({ pressed }) => [styles.startBtn, { backgroundColor: c.accent, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
              <Ionicons name="play" size={20} color={c.onAccent} />
              <Text style={[styles.startText, { color: c.onAccent }]}>{L.start}</Text>
            </Pressable>
          ) : (
            <View style={[styles.panel, { backgroundColor: c.cardHover, borderColor: c.border }]}>
              <View style={styles.runGrid}>
                <View style={[styles.runStat, { borderColor: c.border, backgroundColor: c.cardElevated }]}>
                  <Text style={[styles.runStatLabel, { color: c.muted }]}>Время</Text>
                  <Text style={[styles.runStatValue, { color: c.text }]}>{timerText}</Text>
                </View>
                <View style={[styles.runStat, { borderColor: c.border, backgroundColor: c.cardElevated }]}>
                  <Text style={[styles.runStatLabel, { color: c.muted }]}>Дистанция</Text>
                  <Text style={[styles.runStatValue, { color: c.accent }]}>{distText}</Text>
                </View>
              </View>
              <Text style={{ color: c.muted, marginTop: 10, fontSize: 13, lineHeight: 18 }}>{gpsStatus}</Text>
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
  runSection: { padding: 16, gap: 12 },
  modeSwitch: { marginBottom: 14 },
  mapCard: {
    height: 380,
    borderRadius: WebTheme.radiusLg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    position: 'relative',
    marginBottom: 16,
    ...WebTheme.shadowSoft,
  },
  geoPromptWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 90,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  geoPromptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#C1FF00',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  geoPromptText: { color: '#16181C', fontSize: 14, fontFamily: 'Inter_700Bold' },
  geoPromptHint: {
    color: '#16181C',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    overflow: 'hidden',
  },
  locateFab: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  mapInfoCard: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    borderRadius: WebTheme.radius,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  infoHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16181C' },
  statusPillText: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  infoLocation: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium' },
  infoStats: { flexDirection: 'row', alignItems: 'center' },
  infoStat: { flex: 1 },
  infoStatLabel: { color: '#9A9EA8', fontSize: 11, fontFamily: 'Inter_500Medium', marginBottom: 3 },
  infoStatValue: { color: '#FFFFFF', fontSize: 17, fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
  infoDivider: { width: StyleSheet.hairlineWidth, height: 28, marginHorizontal: 8 },
  goBtn: { paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  goText: { fontSize: 17, fontFamily: 'Inter_700Bold', color: '#F2F2F7' },
  panel: { borderRadius: 16, borderWidth: 1, padding: 14, marginTop: 8 },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
  },
  startText: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  runGrid: { flexDirection: 'row', gap: 10 },
  runStat: { flex: 1, borderRadius: 14, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center', gap: 4 },
  runStatLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  runStatValue: { fontSize: 26, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  stopBtn: { backgroundColor: '#FF6B6B', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  stopText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 16 },
  result: { marginTop: 14, padding: 14, borderRadius: 16, borderWidth: 1 },
});
