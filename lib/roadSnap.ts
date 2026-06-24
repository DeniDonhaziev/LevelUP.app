
const OSRM_BASE = 'https://router.project-osrm.org';
const MATCH_CHUNK = 80;
const MIN_INTERVAL_MS = 2200;

let lastMatchAt = 0;
let matchInFlight = false;

function parseGeoJsonLine(coords: number[][]): [number, number][] {
  return coords.map(([lon, lat]) => [lat, lon] as [number, number]);
}

/**
 * Привязка трека к пешеходным дорогам/тропам (OSRM foot).
 * При ошибке сети возвращает исходные точки.
 */
export async function snapRouteToRoads(
  points: [number, number][],
  opts?: { force?: boolean; profile?: 'foot' | 'bike' | 'driving' }
): Promise<[number, number][]> {
  if (points.length < 2) return points;

  const now = Date.now();
  if (!opts?.force && (now - lastMatchAt < MIN_INTERVAL_MS || matchInFlight)) {
    return points;
  }

  const profile = opts?.profile ?? 'foot';
  matchInFlight = true;
  lastMatchAt = now;

  try {
    if (points.length <= MATCH_CHUNK) {
      return await matchChunk(points, profile);
    }
    const merged: [number, number][] = [];
    for (let i = 0; i < points.length; i += MATCH_CHUNK - 1) {
      const chunk = points.slice(i, i + MATCH_CHUNK);
      const snapped = await matchChunk(chunk, profile);
      if (merged.length && snapped.length) {
        merged.push(...snapped.slice(1));
      } else {
        merged.push(...snapped);
      }
    }
    return merged.length >= 2 ? merged : points;
  } catch {
    return points;
  } finally {
    matchInFlight = false;
  }
}

async function matchChunk(
  points: [number, number][],
  profile: 'foot' | 'bike' | 'driving' = 'foot'
): Promise<[number, number][]> {
  if (points.length < 2) return points;

  // У велосипеда радиус привязки шире — он чаще на проезжей части
  const radius = profile === 'bike' ? '35' : '25';
  const coordStr = points.map(([lat, lon]) => `${lon},${lat}`).join(';');
  const url =
    `${OSRM_BASE}/match/v1/${profile}/${coordStr}` +
    '?geometries=geojson&overview=full&tidy=true&radiuses=' +
    points.map(() => radius).join(';');

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return points;
    const data = (await res.json()) as {
      code?: string;
      matchings?: { geometry?: { coordinates?: number[][] } }[];
    };
    if (data.code !== 'Ok' || !data.matchings?.length) return points;

    const out: [number, number][] = [];
    for (const m of data.matchings) {
      const line = m.geometry?.coordinates;
      if (line?.length) {
        const part = parseGeoJsonLine(line);
        if (out.length && part.length) out.push(...part.slice(1));
        else out.push(...part);
      }
    }
    return out.length >= 2 ? out : points;
  } finally {
    clearTimeout(t);
  }
}

/** Одна точка → ближайший участок дороги (для лёгкого live-snap). */
export async function snapPointToRoad(
  lat: number,
  lon: number
): Promise<{ lat: number; lon: number }> {
  try {
    const url = `${OSRM_BASE}/nearest/v1/foot/${lon},${lat}?number=1`;
    const res = await fetch(url);
    if (!res.ok) return { lat, lon };
    const data = (await res.json()) as {
      code?: string;
      waypoints?: { location?: [number, number] }[];
    };
    const loc = data.waypoints?.[0]?.location;
    if (data.code === 'Ok' && loc) return { lat: loc[1], lon: loc[0] };
  } catch {
    /* ignore */
  }
  return { lat, lon };
}
