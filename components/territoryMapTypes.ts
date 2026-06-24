import type { Territory } from '@/lib/types';

export type TerritoryMapProps = {
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  lineColor: string;
  mine: Territory[];
  currentTrack?: [number, number][];
  /** Текущее местоположение (синяя метка на web) */
  userLocation?: { latitude: number; longitude: number } | null;
  onLocateMe?: () => void;
  locating?: boolean;
  geoHint?: string;
  /** Скрыть встроенный оверлей карты (web) — когда контролы рисует родитель */
  hideChrome?: boolean;
};
