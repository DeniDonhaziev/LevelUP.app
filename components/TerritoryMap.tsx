import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import type { TerritoryMapProps } from './territoryMapTypes';

export type { TerritoryMapProps } from './territoryMapTypes';

export function TerritoryMap({ region, lineColor, mine, currentTrack = [], userLocation }: TerritoryMapProps) {
  const start = currentTrack.length > 0 ? currentTrack[0] : null;
  const end = currentTrack.length > 1 ? currentTrack[currentTrack.length - 1] : null;

  return (
    <View style={styles.root}>
      <MapView
        style={styles.map}
        region={userLocation ? { ...region, latitude: userLocation.latitude, longitude: userLocation.longitude } : region}
        showsUserLocation>
        {mine.map((t) =>
          t.points.length >= 2 ? (
            <Polyline
              key={t.id}
              coordinates={t.points.map((p) => ({ latitude: p[0], longitude: p[1] }))}
              strokeColor={lineColor}
              strokeWidth={4}
              lineCap="round"
              lineJoin="round"
            />
          ) : null
        )}
        {currentTrack.length >= 2 ? (
          <Polyline
            coordinates={currentTrack.map((p) => ({ latitude: p[0], longitude: p[1] }))}
            strokeColor="#0A84FF"
            strokeWidth={6}
            lineCap="round"
            lineJoin="round"
          />
        ) : null}
        {start ? (
          <Marker coordinate={{ latitude: start[0], longitude: start[1] }} title="Старт">
            <View style={styles.startOuter}>
              <View style={styles.startInner} />
            </View>
          </Marker>
        ) : null}
        {end ? (
          <Marker coordinate={{ latitude: end[0], longitude: end[1] }} title="Сейчас">
            <View style={styles.endOuter}>
              <View style={styles.endInner} />
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
    backgroundColor: '#F2F2F7',
  },
  map: { flex: 1 },
  startOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,159,10,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff9f0a',
  },
  endOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(10,132,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(10,132,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0A84FF',
  },
});
