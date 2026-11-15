import type { Express, RequestHandler } from 'express';

export interface RoadRoutePoint {
  lat: number;
  lng: number;
}

export interface RoadRouteLegResult {
  fromKey: string;
  toKey: string;
  distanceKm: number;
  durationMinutes: number;
  coordinates: [number, number][];
}

interface CacheEntry {
  expiresAt: number;
  legs: RoadRouteLegResult[];
}

const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;
const OSRM_TIMEOUT_MS = 6500;
const MAX_POINTS_PER_BATCH = 25;

const routeCache = new Map<string, CacheEntry>();

function formatCoordKey(pt: RoadRoutePoint): string {
  return `${pt.lat.toFixed(5)},${pt.lng.toFixed(5)}`;
}

function isValidPoint(raw: unknown): raw is RoadRoutePoint {
  if (!raw || typeof raw !== 'object') return false;
  const pt = raw as Record<string, unknown>;
  return (
    typeof pt.lat === 'number' &&
    typeof pt.lng === 'number' &&
    Number.isFinite(pt.lat) &&
    Number.isFinite(pt.lng) &&
    pt.lat >= -90 &&
    pt.lat <= 90 &&
    pt.lng >= -180 &&
    pt.lng <= 180 &&
    (Math.abs(pt.lat) > 0.0001 || Math.abs(pt.lng) > 0.0001)
  );
}

function simplifyPolyline(coords: [number, number][], maxPoints = 180): [number, number][] {
  if (coords.length <= maxPoints) return coords;
  const step = Math.ceil(coords.length / maxPoints);
  const sampled: [number, number][] = [];
  for (let i = 0; i < coords.length; i += step) {
    sampled.push(coords[i]);
  }
  const last = coords[coords.length - 1];
  const lastSampled = sampled[sampled.length - 1];
  if (!lastSampled || lastSampled[0] !== last[0] || lastSampled[1] !== last[1]) {
    sampled.push(last);
  }
  return sampled;
}

function extractLegCoordinates(leg: Record<string, unknown>, from: RoadRoutePoint, to: RoadRoutePoint): [number, number][] {
  const steps = Array.isArray(leg.steps) ? leg.steps : [];
  const rawPoints: [number, number][] = [];

  for (const stepRaw of steps) {
    if (!stepRaw || typeof stepRaw !== 'object') continue;
    const step = stepRaw as Record<string, unknown>;
    const geometry = step.geometry && typeof step.geometry === 'object' ? (step.geometry as Record<string, unknown>) : null;
    const coords = Array.isArray(geometry?.coordinates) ? geometry.coordinates : [];
    for (const pair of coords) {
      if (!Array.isArray(pair) || pair.length < 2) continue;
      const lng = Number(pair[0]);
      const lat = Number(pair[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const prev = rawPoints[rawPoints.length - 1];
      if (!prev || Math.abs(prev[0] - lat) > 1e-6 || Math.abs(prev[1] - lng) > 1e-6) {
        rawPoints.push([lat, lng]);
      }
    }
  }

  if (rawPoints.length >= 2) {
    return simplifyPolyline(rawPoints);
  }
  return [
    [from.lat, from.lng],
    [to.lat, to.lng],
  ];
}

async function fetchOsrmBatch(points: RoadRoutePoint[]): Promise<RoadRouteLegResult[] | null> {
  const coordList = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coordList}?overview=false&geometries=geojson&steps=true`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'VoyagerTravelOps/1.0',
      },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as Record<string, unknown>;
    if (data.code !== 'Ok' || !Array.isArray(data.routes) || data.routes.length === 0) {
      return null;
    }

    const primaryRoute = data.routes[0] as Record<string, unknown>;
    const legs = Array.isArray(primaryRoute.legs) ? primaryRoute.legs : [];
    if (legs.length !== points.length - 1) return null;

    const parsedLegs: RoadRouteLegResult[] = [];
    for (let i = 0; i < legs.length; i += 1) {
      const leg = (legs[i] && typeof legs[i] === 'object' ? legs[i] : {}) as Record<string, unknown>;
      const from = points[i];
      const to = points[i + 1];
      const distanceMeters = Number(leg.distance);
      const durationSeconds = Number(leg.duration);
      const distanceKm = Number.isFinite(distanceMeters) && distanceMeters >= 0
        ? Number((distanceMeters / 1000).toFixed(1))
        : 0;
      const durationMinutes = Number.isFinite(durationSeconds) && durationSeconds >= 0
        ? (distanceKm < 0.05 ? 0 : Math.max(1, Math.round(durationSeconds / 60)))
        : 0;

      parsedLegs.push({
        fromKey: formatCoordKey(from),
        toKey: formatCoordKey(to),
        distanceKm,
        durationMinutes,
        coordinates: extractLegCoordinates(leg, from, to),
      });
    }

    return parsedLegs;
  } catch (err) {
    console.warn('[OSRM Routing] Không thể truy vấn dịch vụ OSRM:', err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function computeRoadRouteLegs(
  rawPoints: unknown,
): Promise<{ status: 200; source: 'osrm' | 'fallback'; cached?: boolean; legs: RoadRouteLegResult[] } | { status: 400; error: string }> {
  if (!Array.isArray(rawPoints) || rawPoints.length < 2 || rawPoints.length > 60) {
    return {
      status: 400,
      error: 'Cần từ 2 đến 60 điểm tọa độ hợp lệ để tính tuyến đường bộ.',
    };
  }

  const points = rawPoints.filter(isValidPoint);
  if (points.length !== rawPoints.length) {
    return {
      status: 400,
      error: 'Danh sách tọa độ có phần tử không hợp lệ.',
    };
  }

  const cacheKey = points.map(formatCoordKey).join('>');
  const now = Date.now();
  const cached = routeCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return { status: 200, source: 'osrm', cached: true, legs: cached.legs };
  }

  const allLegs: RoadRouteLegResult[] = [];
  for (let start = 0; start < points.length - 1; start += MAX_POINTS_PER_BATCH - 1) {
    const batch = points.slice(start, start + MAX_POINTS_PER_BATCH);
    if (batch.length < 2) break;
    const batchLegs = await fetchOsrmBatch(batch);
    if (!batchLegs) {
      return { status: 200, source: 'fallback', legs: [] };
    }
    allLegs.push(...batchLegs);
  }

  if (routeCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = routeCache.keys().next().value;
    if (oldestKey) routeCache.delete(oldestKey);
  }
  routeCache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, legs: allLegs });

  return { status: 200, source: 'osrm', cached: false, legs: allLegs };
}

export function registerRoutingRoutes(
  app: Express,
  dependencies: { requireAuth: RequestHandler },
) {
  const { requireAuth } = dependencies;

  app.post('/api/routing/road', requireAuth, async (req, res) => {
    const rawPoints = (req.body as { points?: unknown })?.points;
    const result = await computeRoadRouteLegs(rawPoints);
    if (result.status === 400) {
      return res.status(400).json({ success: false, error: result.error });
    }
    return res.json({
      success: true,
      source: result.source,
      cached: Boolean(result.cached),
      legs: result.legs,
    });
  });
}
