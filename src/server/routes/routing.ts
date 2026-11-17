import type { Express, RequestHandler } from 'express';
import { normalizeVietnameseText, searchLocalPlaces } from '../../utils/vietnamGeo';

export interface GeocodePlaceSuggestion {
  id: string;
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  source: 'local' | 'osm';
}

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

interface GeocodeCacheEntry {
  expiresAt: number;
  source: 'osm' | 'local';
  results: GeocodePlaceSuggestion[];
}

const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;
const OSRM_TIMEOUT_MS = 6500;
const NOMINATIM_TIMEOUT_MS = 5000;
const NOMINATIM_MIN_INTERVAL_MS = 1050;
const MAX_POINTS_PER_BATCH = 25;

const routeCache = new Map<string, CacheEntry>();
const geocodeCache = new Map<string, GeocodeCacheEntry>();
let nextAllowedNominatimAt = 0;

async function waitForNominatimSlot(): Promise<void> {
  const now = Date.now();
  const waitMs = Math.max(0, nextAllowedNominatimAt - now);
  nextAllowedNominatimAt = Math.max(now, nextAllowedNominatimAt) + NOMINATIM_MIN_INTERVAL_MS;
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

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

function buildShortNominatimName(rawName: unknown, displayName: string): string {
  const explicitName = typeof rawName === 'string' ? rawName.trim() : '';
  if (explicitName) return explicitName.slice(0, 120);
  const firstSegment = displayName.split(',')[0]?.trim() || displayName.trim();
  return firstSegment.slice(0, 120);
}

async function queryNominatim(
  query: string,
  countryCode: string | null,
  fetchImpl: typeof fetch,
): Promise<{ ok: boolean; results: GeocodePlaceSuggestion[] }> {
  const params = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    limit: '6',
    'accept-language': 'vi',
    q: query,
  });
  if (countryCode) {
    params.set('countrycodes', countryCode);
  }
  const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS);

  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'VoyagerTravelOps/1.0',
      },
    });
    if (!response.ok) {
      return { ok: false, results: [] };
    }
    const payload = (await response.json()) as unknown;
    if (!Array.isArray(payload)) {
      return { ok: false, results: [] };
    }

    const parsed: GeocodePlaceSuggestion[] = [];
    for (const rawItem of payload) {
      if (!rawItem || typeof rawItem !== 'object') continue;
      const item = rawItem as Record<string, unknown>;
      const lat = Number(item.lat);
      const lng = Number(item.lon);
      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180 ||
        (Math.abs(lat) <= 0.0001 && Math.abs(lng) <= 0.0001)
      ) {
        continue;
      }

      const displayName =
        typeof item.display_name === 'string' && item.display_name.trim()
          ? item.display_name.trim().slice(0, 220)
          : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      const name = buildShortNominatimName(item.name, displayName);
      const osmId = item.place_id ?? item.osm_id ?? `${lat.toFixed(5)}-${lng.toFixed(5)}`;

      parsed.push({
        id: `osm-${String(osmId)}`,
        name,
        displayName,
        lat: Number(lat.toFixed(5)),
        lng: Number(lng.toFixed(5)),
        source: 'osm',
      });
    }

    return { ok: true, results: parsed };
  } catch (err) {
    console.warn('[Nominatim Geocoding] Không thể truy vấn OpenStreetMap:', err);
    return { ok: false, results: [] };
  } finally {
    clearTimeout(timer);
  }
}

function mergeGeocodeSuggestions(
  osmResults: readonly GeocodePlaceSuggestion[],
  localResults: readonly GeocodePlaceSuggestion[],
): GeocodePlaceSuggestion[] {
  const merged: GeocodePlaceSuggestion[] = [];
  const addIfUnique = (candidate: GeocodePlaceSuggestion) => {
    const candidateNorm = normalizeVietnameseText(candidate.name);
    const duplicate = merged.some(
      (existing) =>
        Math.abs(existing.lat - candidate.lat) < 0.001 &&
        Math.abs(existing.lng - candidate.lng) < 0.001 &&
        normalizeVietnameseText(existing.name) === candidateNorm,
    );
    if (!duplicate) {
      merged.push(candidate);
    }
  };

  for (const item of osmResults) addIfUnique(item);
  for (const item of localResults) addIfUnique(item);
  return merged.slice(0, 8);
}

export async function searchPlaces(
  rawQuery: unknown,
  options: { fetchImpl?: typeof fetch; bypassCache?: boolean } = {},
): Promise<
  | { status: 200; cached: boolean; source: 'osm' | 'local' | 'fallback'; results: GeocodePlaceSuggestion[] }
  | { status: 400; error: string }
> {
  const query = typeof rawQuery === 'string' ? rawQuery.trim() : '';
  if (query.length < 2 || query.length > 150) {
    return {
      status: 400,
      error: 'Từ khóa tìm kiếm địa điểm phải có từ 2 đến 150 ký tự.',
    };
  }

  const cacheKey = normalizeVietnameseText(query) || query.toLowerCase();
  const now = Date.now();
  if (!options.bypassCache) {
    const cached = geocodeCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return {
        status: 200,
        cached: true,
        source: cached.source,
        results: cached.results,
      };
    }
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const localResults = searchLocalPlaces(query, 4);

  if (!options.fetchImpl) {
    await waitForNominatimSlot();
  }
  const vnSearch = await queryNominatim(query, 'vn', fetchImpl);
  let osmResults = vnSearch.results;
  let osmSucceeded = vnSearch.ok;

  if (vnSearch.ok && osmResults.length === 0) {
    if (!options.fetchImpl) {
      await waitForNominatimSlot();
    }
    const globalSearch = await queryNominatim(query, null, fetchImpl);
    osmSucceeded = globalSearch.ok;
    osmResults = globalSearch.results;
  }

  const merged = mergeGeocodeSuggestions(osmResults, localResults);
  const source: 'osm' | 'local' | 'fallback' = osmResults.length > 0
    ? 'osm'
    : localResults.length > 0
      ? 'local'
      : 'fallback';

  if (osmSucceeded && !options.bypassCache) {
    if (geocodeCache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = geocodeCache.keys().next().value;
      if (oldestKey) geocodeCache.delete(oldestKey);
    }
    geocodeCache.set(cacheKey, {
      expiresAt: now + CACHE_TTL_MS,
      source: osmResults.length > 0 ? 'osm' : 'local',
      results: merged,
    });
  }

  return {
    status: 200,
    cached: false,
    source,
    results: merged,
  };
}

export function registerRoutingRoutes(
  app: Express,
  dependencies: { requireAuth: RequestHandler; geocodeRateLimiter?: RequestHandler },
) {
  const { requireAuth, geocodeRateLimiter } = dependencies;
  const geocodeMiddlewares: RequestHandler[] = geocodeRateLimiter
    ? [requireAuth, geocodeRateLimiter]
    : [requireAuth];

  app.get('/api/routing/geocode', ...geocodeMiddlewares, async (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const result = await searchPlaces(query);
    if (result.status === 400) {
      return res.status(400).json({ success: false, error: result.error });
    }
    return res.json({
      success: true,
      cached: result.cached,
      source: result.source,
      results: result.results,
    });
  });

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
