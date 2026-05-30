import type { Territory } from './types';

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function simplifyPoints(points: [number, number][], toleranceM: number): [number, number][] {
  if (points.length < 3) return points;
  const out: [number, number][] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1],
      cur = points[i],
      next = points[i + 1];
    const dist = haversineMeters(prev[0], prev[1], cur[0], cur[1]);
    if (dist >= toleranceM) out.push(cur);
  }
  out.push(points[points.length - 1]);
  return out;
}

export function routeLengthMeters(points: [number, number][]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++)
    len += haversineMeters(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
  return len;
}

export function overlapScore(
  runPoints: [number, number][],
  territoryPoints: [number, number][],
  maxDistM: number
): number {
  if (territoryPoints.length < 2 || runPoints.length < 2) return 0;
  let hits = 0;
  for (let t = 0; t < territoryPoints.length; t++) {
    const tx = territoryPoints[t][0],
      ty = territoryPoints[t][1];
    for (let r = 0; r < runPoints.length - 1; r++) {
      const d = haversineMeters(tx, ty, runPoints[r][0], runPoints[r][1]);
      if (d <= maxDistM) {
        hits++;
        break;
      }
    }
  }
  return hits / territoryPoints.length;
}

export function runOverlapsTerritory(
  runPoints: [number, number][],
  territory: Territory,
  maxDistM: number,
  minOverlap: number
): boolean {
  const score = overlapScore(runPoints, territory.points, maxDistM);
  return score >= minOverlap;
}

/** Точки для карты/территории: привязка к дорогам + упрощение. */
export function prepareRoadTrack(runPoints: [number, number][]): [number, number][] {
  return simplifyPoints(runPoints, 12);
}

export function captureRoadFromRun(
  runPoints: [number, number][],
  username: string,
  territories: Territory[]
): { captured: Territory[]; takenOver: Territory[]; nextTerritories: Territory[] } {
  const simplified = prepareRoadTrack(runPoints);
  if (simplified.length < 2) return { captured: [], takenOver: [], nextTerritories: [...territories] };

  const maxDistM = 25,
    minOverlap = 0.5;
  const takenOver: Territory[] = [];
  const used: Record<number, boolean> = {};
  const next = territories.map((t, i) => {
    if (runOverlapsTerritory(simplified, t, maxDistM, minOverlap)) {
      used[i] = true;
      const upd = {
        ...t,
        owner: username,
        lastDefendedAt: new Date().toISOString(),
        capturedAt: t.capturedAt || new Date().toISOString(),
      };
      takenOver.push(upd);
      return upd;
    }
    return t;
  });

  const lengthM = routeLengthMeters(simplified);
  const newId = 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  const newTerritory: Territory = {
    id: newId,
    points: simplified,
    owner: username,
    capturedAt: new Date().toISOString(),
    lastDefendedAt: new Date().toISOString(),
    lengthMeters: lengthM,
  };

  const alreadyCovered = takenOver.some((t) =>
    runOverlapsTerritory(t.points, newTerritory, maxDistM, 0.7)
  );
  const captured: Territory[] = [];
  if (!alreadyCovered && lengthM >= 100) {
    next.push(newTerritory);
    captured.push(newTerritory);
  }

  return { captured, takenOver, nextTerritories: next };
}

export function getTerritoryColor(username: string): string {
  const colors = ['#c4ff0d', '#30d158', '#0a84ff', '#ff9f0a', '#bf5af2', '#64d2ff', '#ff375f'];
  let n = 0;
  for (let i = 0; i < (username || '').length; i++) n += username.charCodeAt(i);
  return colors[Math.abs(n) % colors.length];
}
