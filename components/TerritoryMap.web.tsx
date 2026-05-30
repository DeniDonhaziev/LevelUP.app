import { createElement, useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import type { TerritoryMapProps } from './territoryMapTypes';

function buildBBox(
  region: TerritoryMapProps['region'],
  userLocation?: TerritoryMapProps['userLocation']
) {
  const lat = userLocation?.latitude ?? region.latitude;
  const lon = userLocation?.longitude ?? region.longitude;
  const dLat = userLocation ? 0.018 : (region.latitudeDelta ?? 0.05);
  const dLon = userLocation ? 0.028 : (region.longitudeDelta ?? 0.05);
  const minLat = lat - dLat / 2;
  const maxLat = lat + dLat / 2;
  const minLon = lon - dLon / 2;
  const maxLon = lon + dLon / 2;
  return { minLat, maxLat, minLon, maxLon, lat, lon };
}

function buildEmbedUrl(region: TerritoryMapProps['region'], userLocation?: TerritoryMapProps['userLocation']): string {
  const { minLat, maxLat, minLon, maxLon, lat, lon } = buildBBox(region, userLocation);
  const bbox = `${minLon},${minLat},${maxLon},${maxLat}`;
  const base = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik`;
  return `${base}&marker=${encodeURIComponent(`${lat},${lon}`)}`;
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
}: TerritoryMapProps) {
  const bbox = useMemo(
    () => buildBBox(region, userLocation),
    [region.latitude, region.longitude, region.latitudeDelta, region.longitudeDelta, userLocation]
  );
  const embedUrl = useMemo(() => buildEmbedUrl(region, userLocation), [region, userLocation]);
  const openUrl = useMemo(() => buildOpenUrl(region, userLocation), [region, userLocation]);
  const [layout, setLayout] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const projectPoint = useCallback(
    (lat: number, lon: number) => {
      const { w, h } = layout;
      if (!w || !h) return null;
      const { minLat, maxLat, minLon, maxLon } = bbox;
      const denomLon = maxLon - minLon || 1;
      const denomLat = maxLat - minLat || 1;
      const x = ((lon - minLon) / denomLon) * w;
      const y = ((maxLat - lat) / denomLat) * h;
      if (Number.isNaN(x) || Number.isNaN(y)) return null;
      return { x, y };
    },
    [bbox, layout]
  );

  const projected = useMemo(() => {
    return currentTrack
      .map(([lat, lon]) => projectPoint(lat, lon))
      .filter(Boolean) as { x: number; y: number }[];
  }, [currentTrack, projectPoint]);

  const userPin = useMemo(() => {
    if (!userLocation) return null;
    return projectPoint(userLocation.latitude, userLocation.longitude);
  }, [userLocation, projectPoint]);

  const locationLine = userLocation
    ? `GPS: ${userLocation.latitude.toFixed(5)}, ${userLocation.longitude.toFixed(5)}`
    : geoHint || 'Нажмите «Моё местоположение», чтобы показать вас на карте';

  return (
    <View style={styles.root} onLayout={(e) => setLayout({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {createElement('iframe', {
        key: embedUrl,
        src: embedUrl,
        style: styles.iframe as object,
        title: 'Карта территорий',
        loading: 'lazy',
        referrerPolicy: 'no-referrer-when-downgrade',
      })}
      {projected.length >= 1 ? (
        <View style={styles.trackOverlay} pointerEvents="none">
          {projected.length >= 2 ? (
            <Svg style={styles.svg} width="100%" height="100%">
              <Polyline
                points={projected.map((p) => `${p.x},${p.y}`).join(' ')}
                stroke="#111111"
                strokeWidth={3}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {projected.map((p, idx) => (
                <Circle key={idx} cx={p.x} cy={p.y} r={3} fill="#111111" />
              ))}
            </Svg>
          ) : (
            <Svg style={styles.svg} width="100%" height="100%">
              <Circle cx={projected[0].x} cy={projected[0].y} r={4} fill="#111111" />
            </Svg>
          )}
        </View>
      ) : null}
      {userPin ? (
        <View style={styles.trackOverlay} pointerEvents="none">
          <Svg style={styles.svg} width="100%" height="100%">
            <Circle cx={userPin.x} cy={userPin.y} r={10} fill="rgba(17,17,17,0.15)" />
            <Circle cx={userPin.x} cy={userPin.y} r={5} fill="#111111" stroke="#FFFFFF" strokeWidth={2} />
          </Svg>
        </View>
      ) : null}
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
      {!userPin ? (
        <View style={styles.centerPin} pointerEvents="none">
          <View style={styles.centerPinInner} />
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
    backgroundColor: '#F2F2F7',
  },
  iframe: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    borderWidth: 0,
    borderStyle: 'solid',
  },
  trackOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  svg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
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
  centerPinInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#111111',
  },
});
