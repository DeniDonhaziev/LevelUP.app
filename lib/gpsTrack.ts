import { haversineMeters } from './geo';

export type GeoFix = {
  lat: number;
  lon: number;
  /** Точность GPS в метрах (чем меньше — тем лучше). */
  accuracy?: number | null;
  /** Скорость с GPS, м/с. */
  speed?: number | null;
  timestamp?: number;
};

export type GpsTrackState = {
  /** Принятые точки [lat, lon] — только реальное перемещение. */
  points: [number, number][];
  totalMeters: number;
  lastFix: GeoFix | null;
  lastAcceptedAt: number;
};

const DEFAULTS = {
  /** Минимальный сдвиг между точками (м). */
  minMoveM: 5,
  /** Плохая точность — отбрасываем. */
  maxAccuracyM: 35,
  /** Скачок GPS «телепорт» — отбрасываем. */
  maxJumpM: 45,
  /** Макс. правдоподобная скорость бега, м/с (~25 км/ч). */
  maxSpeedMps: 7,
  /** Ниже — считаем стояние на месте, км не растёт. */
  minMoveWhenSlowM: 7,
  slowSpeedMps: 0.6,
};

export function createGpsTrackState(): GpsTrackState {
  return { points: [], totalMeters: 0, lastFix: null, lastAcceptedAt: 0 };
}

function impliedSpeedMps(distM: number, dtMs: number): number {
  if (dtMs <= 0) return 0;
  return distM / (dtMs / 1000);
}

/**
 * Принимает GPS-точку только при реальном перемещении.
 * Стояние на месте и дрожание GPS не увеличивают дистанцию.
 */
export function acceptGpsPoint(
  state: GpsTrackState,
  fix: GeoFix,
  opts?: Partial<typeof DEFAULTS>
): { state: GpsTrackState; accepted: boolean } {
  const o = { ...DEFAULTS, ...opts };
  const acc = fix.accuracy ?? 999;
  if (acc > o.maxAccuracyM) {
    return { state: { ...state, lastFix: fix }, accepted: false };
  }

  const ts = fix.timestamp ?? Date.now();

  if (state.points.length === 0) {
    const first: GpsTrackState = {
      points: [[fix.lat, fix.lon]],
      totalMeters: 0,
      lastFix: fix,
      lastAcceptedAt: ts,
    };
    return { state: first, accepted: true };
  }

  const [lastLat, lastLon] = state.points[state.points.length - 1];
  const dist = haversineMeters(lastLat, lastLon, fix.lat, fix.lon);
  const dtMs = state.lastAcceptedAt > 0 ? ts - state.lastAcceptedAt : 1000;
  const speed = fix.speed != null && fix.speed >= 0 ? fix.speed : impliedSpeedMps(dist, dtMs);

  const minMove = Math.max(o.minMoveM, Math.min(12, acc * 0.55));

  if (dist < minMove) {
    return { state: { ...state, lastFix: fix }, accepted: false };
  }

  if (dist > o.maxJumpM) {
    return { state: { ...state, lastFix: fix }, accepted: false };
  }

  if (speed > o.maxSpeedMps && dist > minMove * 2) {
    return { state: { ...state, lastFix: fix }, accepted: false };
  }

  if (speed < o.slowSpeedMps && dist < o.minMoveWhenSlowM) {
    return { state: { ...state, lastFix: fix }, accepted: false };
  }

  const next: GpsTrackState = {
    points: [...state.points, [fix.lat, fix.lon]],
    totalMeters: state.totalMeters + dist,
    lastFix: fix,
    lastAcceptedAt: ts,
  };
  return { state: next, accepted: true };
}

export function formatTrackDistance(meters: number): string {
  if (meters >= 1000) return (meters / 1000).toFixed(2) + ' км';
  return Math.round(meters) + ' м';
}
