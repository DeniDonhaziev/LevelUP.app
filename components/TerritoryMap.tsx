import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import type { TerritoryMapProps } from './territoryMapTypes';

export type { TerritoryMapProps } from './territoryMapTypes';

/** Минималистичный «дизайнерский» стиль карты (Google) — приглушённые тона, без шума */
const MINIMAL_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f4f4f6' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9aa0aa' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e6ede2' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#ededf0' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#e4e4e8' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#d9e4ec' }] },
];

export function TerritoryMap({ region, lineColor, mine, currentTrack = [], userLocation }: TerritoryMapProps) {
  const start = currentTrack.length > 0 ? currentTrack[0] : null;
  const end = currentTrack.length > 1 ? currentTrack[currentTrack.length - 1] : null;

  return (
    <View style={styles.root}>
      <MapView
        style={styles.map}
        customMapStyle={MINIMAL_MAP_STYLE}
        region={userLocation ? { ...region, latitude: userLocation.latitude, longitude: userLocation.longitude } : region}
        showsUserLocation
        showsPointsOfInterest={false}
        showsCompass={false}
        toolbarEnabled={false}>
        {mine.map((t) =>
          t.points.length >= 2 ? (
            <Polyline
              key={t.id}
              coordinates={t.points.map((p) => ({ latitude: p[0], longitude: p[1] }))}
              strokeColor={lineColor}
              strokeWidth={3}
              lineDashPattern={[2, 10]}
              lineCap="round"
              lineJoin="round"
            />
          ) : null
        )}
        {currentTrack.length >= 2 ? (
          <>
            {/* «тень» под треком для глубины */}
            <Polyline
              coordinates={currentTrack.map((p) => ({ latitude: p[0], longitude: p[1] }))}
              strokeColor="rgba(0,0,0,0.12)"
              strokeWidth={9}
              lineCap="round"
              lineJoin="round"
            />
            <Polyline
              coordinates={currentTrack.map((p) => ({ latitude: p[0], longitude: p[1] }))}
              strokeColor="#16181C"
              strokeWidth={5}
              lineDashPattern={[1, 9]}
              lineCap="round"
              lineJoin="round"
            />
          </>
        ) : null}
        {start ? (
          <Marker coordinate={{ latitude: start[0], longitude: start[1] }} title="Старт" anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.startOuter}>
              <View style={styles.startInner} />
            </View>
          </Marker>
        ) : null}
        {end ? (
          <Marker coordinate={{ latitude: end[0], longitude: end[1] }} title="Сейчас" anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.pinWrap}>
              <View style={styles.pinHead}>
                <View style={styles.pinDot} />
              </View>
              <View style={styles.pinTail} />
            </View>
          </Marker>
        ) : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#f4f4f6',
  },
  map: { flex: 1 },
  startOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#16181C',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  startInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#C1FF00' },
  pinWrap: { alignItems: 'center' },
  pinHead: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#16181C',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  pinDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#C1FF00' },
  pinTail: {
    width: 3,
    height: 8,
    backgroundColor: '#16181C',
    marginTop: -1,
  },
});
