import { useMemo, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import type { TerritoryMapProps } from './territoryMapTypes';

const TILE = 256;
/** Светлый «дизайнерский» базослой как на референсе (CARTO Positron) */
const TILE_URL = (z: number, x: number, y: number) =>
  `https://basemaps.cartocdn.com/light_all/${z}/${x}/${y}@2x.png`;

function lonToWorldX(lon: number, scale: number) {
  return ((lon + 180) / 360) * scale;
}
function latToWorldY(lat: number, scale: number) {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale;
}

/** Подбор зума так, чтобы дельта региона помещалась в видимую область */
function pickZoom(w: number, lonDelta: number) {
  if (!w || !lonDelta) return 13;
  const z = Math.log2((w / TILE) * (360 / lonDelta));
  return Math.max(3, Math.min(18, Math.floor(z)));
}

function buildOpenUrl(region: TerritoryMapProps['region'], userLocation?: TerritoryMapProps['userLocation']): string {
  const lat = userLocation?.latitude ?? region.latitude;
  const lon = userLocation?.longitude ?? region.longitude;
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;
}

export function TerritoryMap({
  region,
  mine,
  currentTrack = [],
  userLocation,
  onLocateMe,
  locating,
  geoHint,
  hideChrome,
}: TerritoryMapProps) {
  const [layout, setLayout] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const openUrl = useMemo(() => buildOpenUrl(region, userLocation), [region, userLocation]);

  const centerLat = userLocation?.latitude ?? region.latitude;
  const centerLon = userLocation?.longitude ?? region.longitude;
  const lonDelta = userLocation ? 0.03 : region.longitudeDelta ?? 0.05;

  const view = useMemo(() => {
    const { w, h } = layout;
    if (!w || !h) return null;
    const z = pickZoom(w, lonDelta);
    const scale = TILE * Math.pow(2, z);
    const n = Math.pow(2, z);
    const cx = lonToWorldX(centerLon, scale);
    const cy = latToWorldY(centerLat, scale);
    const topLeftX = cx - w / 2;
    const topLeftY = cy - h / 2;

    // Тайлы, покрывающие вьюпорт
    const tiles: { key: string; left: number; top: number; uri: string }[] = [];
    const startTX = Math.floor(topLeftX / TILE);
    const endTX = Math.floor((topLeftX + w) / TILE);
    const startTY = Math.floor(topLeftY / TILE);
    const endTY = Math.floor((topLeftY + h) / TILE);
    for (let tx = startTX; tx <= endTX; tx++) {
      for (let ty = startTY; ty <= endTY; ty++) {
        if (ty < 0 || ty >= n) continue;
        const wrappedX = ((tx % n) + n) % n;
        tiles.push({
          key: `${z}/${tx}/${ty}`,
          left: tx * TILE - topLeftX,
          top: ty * TILE - topLeftY,
          uri: TILE_URL(z, wrappedX, ty),
        });
      }
    }

    const project = (lat: number, lon: number) => ({
      x: lonToWorldX(lon, scale) - topLeftX,
      y: latToWorldY(lat, scale) - topLeftY,
    });

    return { tiles, project };
  }, [layout, centerLat, centerLon, lonDelta]);

  const projected = useMemo(() => {
    if (!view) return [];
    return currentTrack.map(([lat, lon]) => view.project(lat, lon));
  }, [view, currentTrack]);

  const userPin = useMemo(() => {
    if (!view || !userLocation) return null;
    return view.project(userLocation.latitude, userLocation.longitude);
  }, [view, userLocation]);

  const locationLine = userLocation
    ? `GPS: ${userLocation.latitude.toFixed(5)}, ${userLocation.longitude.toFixed(5)}`
    : geoHint || 'Нажмите «Моё местоположение», чтобы показать вас на карте';

  return (
    <View
      style={styles.root}
      onLayout={(e) => setLayout({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {/* Базослой из тайлов */}
      <View style={styles.tileLayer} pointerEvents="none">
        {view?.tiles.map((t) => (
          <Image
            key={t.key}
            source={{ uri: t.uri }}
            style={[styles.tile, { left: t.left, top: t.top }]}
            resizeMode="cover"
          />
        ))}
      </View>

      {/* Маршрут */}
      {projected.length >= 1 ? (
        <View style={styles.trackOverlay} pointerEvents="none">
          <Svg style={styles.svg} width="100%" height="100%">
            {projected.length >= 2 ? (
              <>
                <Polyline
                  points={projected.map((p) => `${p.x},${p.y}`).join(' ')}
                  stroke="rgba(0,0,0,0.12)"
                  strokeWidth={7}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Polyline
                  points={projected.map((p) => `${p.x},${p.y}`).join(' ')}
                  stroke="#16181C"
                  strokeWidth={4}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Circle cx={projected[0].x} cy={projected[0].y} r={8} fill="#16181C" stroke="#FFFFFF" strokeWidth={3} />
                <Circle cx={projected[0].x} cy={projected[0].y} r={3} fill="#C1FF00" />
                <Circle
                  cx={projected[projected.length - 1].x}
                  cy={projected[projected.length - 1].y}
                  r={10}
                  fill="#16181C"
                  stroke="#FFFFFF"
                  strokeWidth={3}
                />
                <Circle
                  cx={projected[projected.length - 1].x}
                  cy={projected[projected.length - 1].y}
                  r={4}
                  fill="#C1FF00"
                />
              </>
            ) : (
              <>
                <Circle cx={projected[0].x} cy={projected[0].y} r={8} fill="#16181C" stroke="#FFFFFF" strokeWidth={3} />
                <Circle cx={projected[0].x} cy={projected[0].y} r={3} fill="#C1FF00" />
              </>
            )}
          </Svg>
        </View>
      ) : null}

      {/* Текущее местоположение */}
      {userPin ? (
        <View style={styles.trackOverlay} pointerEvents="none">
          <Svg style={styles.svg} width="100%" height="100%">
            <Circle cx={userPin.x} cy={userPin.y} r={12} fill="rgba(193,255,0,0.25)" />
            <Circle cx={userPin.x} cy={userPin.y} r={6} fill="#16181C" stroke="#FFFFFF" strokeWidth={2.5} />
            <Circle cx={userPin.x} cy={userPin.y} r={2.5} fill="#C1FF00" />
          </Svg>
        </View>
      ) : null}

      {/* Атрибуция (требование CARTO/OSM) */}
      <Text style={styles.attribution}>© OpenStreetMap, © CARTO</Text>

      {/* Метка центра, если позиция ещё не определена */}
      {!userPin && projected.length === 0 ? (
        <View style={styles.centerPin} pointerEvents="none">
          <View style={styles.centerPinInner} />
        </View>
      ) : null}

      {/* Встроенные контролы (скрыты, когда их рисует родитель) */}
      {!hideChrome ? (
        <View style={styles.overlay} pointerEvents="box-none">
          <Text style={styles.text}>Live Map</Text>
          <Text style={styles.subText}>
            Территорий: {mine.length} · Точек: {currentTrack.length}
          </Text>
          <Text style={styles.gpsText} numberOfLines={2}>
            {locationLine}
          </Text>
          <View style={styles.btnRow}>
            {onLocateMe ? (
              <Pressable
                onPress={onLocateMe}
                disabled={locating}
                style={[styles.linkBtn, styles.locateBtn, locating && styles.linkBtnDisabled]}>
                <Text style={styles.linkText}>{locating ? 'Определяем…' : 'Моё местоположение'}</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => void Linking.openURL(openUrl)} style={styles.linkBtn}>
              <Text style={styles.linkText}>Открыть карту</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignSelf: 'stretch',
    width: '100%',
    minHeight: 200,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#f4f4f6',
  },
  tileLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  tile: { position: 'absolute', width: TILE, height: TILE },
  trackOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  svg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  attribution: {
    position: 'absolute',
    right: 6,
    top: 6,
    fontSize: 9,
    color: 'rgba(22,24,28,0.45)',
    backgroundColor: 'rgba(255,255,255,0.6)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  overlay: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(22,24,34,0.1)',
  },
  text: { color: '#161822', lineHeight: 18, fontSize: 13, fontFamily: 'Inter_700Bold' },
  subText: { color: '#73798A', fontSize: 12, marginTop: 2 },
  gpsText: { color: '#161822', fontSize: 11, marginTop: 6, fontFamily: 'Inter_500Medium', lineHeight: 15 },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  linkBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(17,17,17,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(17,17,17,0.12)',
  },
  locateBtn: { backgroundColor: 'rgba(17,17,17,0.08)' },
  linkBtnDisabled: { opacity: 0.6 },
  linkText: { color: '#111111', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  centerPin: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 22,
    height: 22,
    marginLeft: -11,
    marginTop: -11,
    borderRadius: 11,
    backgroundColor: 'rgba(17,17,17,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(17,17,17,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerPinInner: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#111111' },
});
