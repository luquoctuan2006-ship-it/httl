import { normalizeTripData } from '../data/normalizeTripData';
import type { TripData } from '../types/travel';

const STORAGE_PREFIX = 'voyager_offline_trips_v1_';

export interface OfflineTripCache {
  trips: TripData[];
  activeTripId: string | null;
  cachedAt: string;
  pendingSyncIds: string[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function resolveStorage(customStorage?: StorageLike): StorageLike | null {
  if (customStorage) return customStorage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

export function getOfflineCacheKey(uid: string): string {
  const safeUid = String(uid || 'anonymous').replace(/[^A-Za-z0-9_-]/g, '_');
  return `${STORAGE_PREFIX}${safeUid}`;
}

export function loadOfflineTripsCache(uid: string, customStorage?: StorageLike): OfflineTripCache | null {
  const storage = resolveStorage(customStorage);
  if (!storage || !uid) return null;

  try {
    const raw = storage.getItem(getOfflineCacheKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OfflineTripCache>;
    const trips = Array.isArray(parsed.trips) ? parsed.trips.map((t) => normalizeTripData(t)) : [];
    const activeTripId = typeof parsed.activeTripId === 'string' ? parsed.activeTripId : trips[0]?.id || null;
    const pendingSyncIds = Array.isArray(parsed.pendingSyncIds)
      ? parsed.pendingSyncIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      : [];
    return {
      trips,
      activeTripId,
      cachedAt: typeof parsed.cachedAt === 'string' ? parsed.cachedAt : new Date().toISOString(),
      pendingSyncIds,
    };
  } catch {
    return null;
  }
}

export interface SaveOfflineCacheResult {
  cache: OfflineTripCache | null;
  quotaExceeded: boolean;
}

export function isStorageQuotaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { name?: string; code?: number };
  return (
    err.name === 'QuotaExceededError' ||
    err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    err.code === 22 ||
    err.code === 1014
  );
}

export function saveOfflineTripsCacheDetailed(
  uid: string,
  trips: TripData[],
  activeTripId: string | null,
  pendingSyncIds?: string[],
  customStorage?: StorageLike,
): SaveOfflineCacheResult {
  const storage = resolveStorage(customStorage);
  if (!storage || !uid) return { cache: null, quotaExceeded: false };

  const existingPending = pendingSyncIds ?? loadOfflineTripsCache(uid, storage)?.pendingSyncIds ?? [];
  const validTripIds = new Set(trips.map((t) => t.id));
  const cleanedPending = Array.from(new Set(existingPending.filter((id) => validTripIds.has(id))));

  const payload: OfflineTripCache = {
    trips: trips.map((t) => normalizeTripData(t)),
    activeTripId,
    cachedAt: new Date().toISOString(),
    pendingSyncIds: cleanedPending,
  };

  try {
    storage.setItem(getOfflineCacheKey(uid), JSON.stringify(payload));
    return { cache: payload, quotaExceeded: false };
  } catch (error) {
    return { cache: null, quotaExceeded: isStorageQuotaError(error) };
  }
}

export function saveOfflineTripsCache(
  uid: string,
  trips: TripData[],
  activeTripId: string | null,
  pendingSyncIds?: string[],
  customStorage?: StorageLike,
): OfflineTripCache | null {
  return saveOfflineTripsCacheDetailed(uid, trips, activeTripId, pendingSyncIds, customStorage).cache;
}

export function markTripPendingOfflineSyncDetailed(
  uid: string,
  trip: TripData,
  customStorage?: StorageLike,
): SaveOfflineCacheResult {
  const storage = resolveStorage(customStorage);
  if (!storage || !uid) return { cache: null, quotaExceeded: false };

  const current = loadOfflineTripsCache(uid, storage);
  const normalized = normalizeTripData(trip);
  const existingTrips = current?.trips || [];
  const idx = existingTrips.findIndex((t) => t.id === normalized.id);
  const nextTrips = idx >= 0
    ? existingTrips.map((t, i) => (i === idx ? normalized : t))
    : [normalized, ...existingTrips];
  const nextPending = Array.from(new Set([...(current?.pendingSyncIds || []), normalized.id]));

  return saveOfflineTripsCacheDetailed(uid, nextTrips, normalized.id, nextPending, storage);
}

export function markTripPendingOfflineSync(
  uid: string,
  trip: TripData,
  customStorage?: StorageLike,
): OfflineTripCache | null {
  return markTripPendingOfflineSyncDetailed(uid, trip, customStorage).cache;
}

export function clearTripPendingOfflineSync(
  uid: string,
  tripId: string,
  customStorage?: StorageLike,
): OfflineTripCache | null {
  const storage = resolveStorage(customStorage);
  if (!storage || !uid) return null;

  const current = loadOfflineTripsCache(uid, storage);
  if (!current) return null;
  const nextPending = current.pendingSyncIds.filter((id) => id !== tripId);
  return saveOfflineTripsCache(uid, current.trips, current.activeTripId, nextPending, storage);
}
