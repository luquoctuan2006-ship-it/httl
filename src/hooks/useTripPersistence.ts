import { useCallback, useEffect, useRef, useState } from 'react';
import { signOut } from 'firebase/auth';
import { authenticatedFetch, safeJsonResponse } from '../api';
import { normalizeTripData, normalizeTripSummary } from '../utils/trip/normalizeTripData';
import { firebaseAuth } from '../firebase';
import type { TripData } from '../types/travel';
import {
  clearTripPendingOfflineSync,
  getOfflineCacheKey,
  loadOfflineTripsCache,
  markTripPendingOfflineSyncDetailed,
  saveOfflineTripsCacheDetailed,
} from '../utils/client/offlineStorage';
import { getTripComparableJson } from '../utils/trip/tripRepository';
import { isUserTripOwnerOrAdmin } from '../utils/trip/tripJoinHelpers';
import {
  AuthSessionError,
  offloadTripReceipts,
  PayloadTooLargeError,
  SingleFlightQueue,
} from '../utils/trip/tripSyncHelpers';

interface UseTripPersistenceOptions {
  authUserId: string | null;
  authUserRole?: 'user' | 'admin';
  isOnline: boolean;
  onClearAuthUser: () => void;
  setCurrentDayIndex: (dayIndex: number) => void;
  showToast: (
    text: string,
    type?: 'success' | 'error' | 'info',
    actionLabel?: string,
    onAction?: () => void,
  ) => void;
}

export function useTripPersistence({
  authUserId,
  authUserRole,
  isOnline,
  onClearAuthUser,
  setCurrentDayIndex,
  showToast,
}: UseTripPersistenceOptions) {
  const [trip, setTrip] = useState<TripData | null>(null);
  const [trips, setTrips] = useState<TripData[]>([]);
  const [tripsLoaded, setTripsLoaded] = useState<boolean>(false);
  const [loadedTripUserId, setLoadedTripUserId] = useState<string | null>(null);
  const [firebaseStatus, setFirebaseStatus] = useState<'loading' | 'connected' | 'error'>('loading');
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [conflictState, setConflictState] = useState<{
    localTrip: TripData;
    serverTrip: TripData;
  } | null>(null);
  const [isResolvingConflict, setIsResolvingConflict] = useState<boolean>(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState<boolean>(false);
  const [isSyncingBeforeLogout, setIsSyncingBeforeLogout] = useState<boolean>(false);
  const [hydratingTripId, setHydratingTripId] = useState<string | null>(null);

  const lastSavedContentByTripIdRef = useRef<Record<string, string>>({});
  const latestServerVersionByTripIdRef = useRef<Record<string, number>>({});
  const latestTripRef = useRef<TripData | null>(trip);
  const tripsRef = useRef<TripData[]>(trips);
  const inFlightHydrationsRef = useRef<Map<string, Promise<TripData | null>>>(new Map());
  const saveQueueRef = useRef<SingleFlightQueue>(new SingleFlightQueue());
  const isSyncingOfflineRef = useRef<boolean>(false);
  const conflictDismissedRef = useRef<boolean>(false);
  const lastQuotaWarnAtRef = useRef<number>(0);

  useEffect(() => {
    if (!isOnline || !authUserId) {
      conflictDismissedRef.current = false;
    }
  }, [isOnline, authUserId]);

  useEffect(() => {
    latestTripRef.current = trip;
  }, [trip]);

  useEffect(() => {
    tripsRef.current = trips;
  }, [trips]);

  const warnIfQuotaExceeded = useCallback((quotaExceeded: boolean) => {
    if (!quotaExceeded) return;
    const now = Date.now();
    if (now - lastQuotaWarnAtRef.current < 10_000) return;
    lastQuotaWarnAtRef.current = now;
    showToast(
      'Bộ nhớ trình duyệt đã đầy nên không thể lưu bản sao ngoại tuyến. Vui lòng giữ kết nối mạng hoặc dọn bớt dữ liệu cũ.',
      'error',
    );
  }, [showToast]);

  const queueTripOffline = useCallback((targetTrip: TripData, uidOverride?: string | null) => {
    const uid = uidOverride ?? authUserId;
    if (!uid) {
      setFirebaseStatus('error');
      return;
    }
    const saveRes = markTripPendingOfflineSyncDetailed(uid, targetTrip);
    warnIfQuotaExceeded(saveRes.quotaExceeded);
    if (saveRes.cache) {
      setPendingSyncCount(saveRes.cache.pendingSyncIds.length);
      setCachedAt(saveRes.cache.cachedAt);
    }
    setFirebaseStatus('error');
  }, [authUserId, warnIfQuotaExceeded]);

  const clearPendingOfflineState = useCallback((tripId: string, uidOverride?: string | null) => {
    const uid = uidOverride ?? authUserId;
    if (!uid) return;
    const cacheAfter = clearTripPendingOfflineSync(uid, tripId);
    if (cacheAfter) {
      setPendingSyncCount(cacheAfter.pendingSyncIds.length);
    }
  }, [authUserId]);

  const applySavedTripState = useCallback(
    (savedTrip: TripData, version: number | undefined, baselineComparables?: string[]) => {
      lastSavedContentByTripIdRef.current[savedTrip.id] = getTripComparableJson(savedTrip);
      clearPendingOfflineState(savedTrip.id);
      setTrips((prev) => prev.map((item) => (item.id === savedTrip.id ? savedTrip : item)));
      setTrip((prev) => {
        if (!prev || prev.id !== savedTrip.id) return prev;
        if (!baselineComparables || baselineComparables.length === 0) return savedTrip;
        const prevJson = getTripComparableJson(prev);
        const isUnchanged = baselineComparables.includes(prevJson);
        return isUnchanged ? savedTrip : { ...prev, ...(typeof version === 'number' ? { version } : {}) };
      });
    },
    [clearPendingOfflineState],
  );

  const performSignOutAndClearCache = useCallback(async (uidOverride?: string | null) => {
    const uid = uidOverride ?? authUserId;
    if (uid && typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(getOfflineCacheKey(uid));
    }
    setIsLogoutConfirmOpen(false);
    setConflictState(null);
    setPendingSyncCount(0);
    setCachedAt(null);
    setTrips([]);
    setTrip(null);
    lastSavedContentByTripIdRef.current = {};
    latestServerVersionByTripIdRef.current = {};

    try {
      if (firebaseAuth && firebaseAuth.currentUser) {
        await signOut(firebaseAuth);
      }
    } catch (err) {
      console.warn('SignOut error:', err);
    } finally {
      onClearAuthUser();
    }
  }, [authUserId, onClearAuthUser]);

  // Luôn đồng bộ danh sách trips theo state trip hiện hành để chuyển chuyến qua lại không bị dữ liệu cũ
  useEffect(() => {
    if (!trip?.id) return;
    setTrips((prev) => {
      const idx = prev.findIndex((t) => t.id === trip.id);
      if (idx === -1 || prev[idx] === trip) return prev;
      const next = [...prev];
      next[idx] = trip;
      return next;
    });
  }, [trip]);

  // Luôn lưu cache cục bộ mỗi khi trips hoặc trip đang chọn thay đổi sau khi đã tải
  useEffect(() => {
    if (!authUserId || !tripsLoaded || loadedTripUserId !== authUserId) return;
    const result = saveOfflineTripsCacheDetailed(authUserId, trips, trip?.id || null);
    warnIfQuotaExceeded(result.quotaExceeded);
    if (result.cache) {
      setCachedAt(result.cache.cachedAt);
      setPendingSyncCount(result.cache.pendingSyncIds.length);
    }
  }, [authUserId, tripsLoaded, loadedTripUserId, trips, trip, warnIfQuotaExceeded]);

  useEffect(() => {
    let cancelled = false;

    if (!authUserId) {
      setTrips([]);
      setTrip(null);
      setTripsLoaded(false);
      setLoadedTripUserId(null);
      setPendingSyncCount(0);
      setCachedAt(null);
      return;
    }

    setFirebaseStatus('loading');
    setTripsLoaded(false);
    // Đổi tài khoản: bỏ ngay dữ liệu của người trước và chặn autosave cho tới khi nạp xong
    setTrips([]);
    setTrip(null);
    lastSavedContentByTripIdRef.current = {};
    setLoadedTripUserId(null);

    const existingCache = loadOfflineTripsCache(authUserId);
    if (existingCache) {
      setCachedAt(existingCache.cachedAt);
      setPendingSyncCount(existingCache.pendingSyncIds.length);
    }

    const loadFromApi = async () => {
      try {
        const response = await authenticatedFetch('/api/trips?mode=summary');
        if (response.status === 401 || response.status === 403) {
          throw new AuthSessionError(response.status);
        }
        if (!response.ok) throw new Error('Không thể tải dữ liệu chuyến đi');
        const { activeTrip, trips: savedTrips } = await safeJsonResponse(response);
        if (cancelled) return;

        const pendingLocalMap = new Map<string, TripData>();
        if (existingCache?.pendingSyncIds.length) {
          const pendingSet = new Set(existingCache.pendingSyncIds);
          for (const cached of existingCache.trips) {
            if (pendingSet.has(cached.id) && !cached.isSummary) {
              pendingLocalMap.set(cached.id, cached);
            }
          }
        }

        const normalizedActiveTrip = activeTrip ? normalizeTripData(activeTrip) : null;
        const serverTrips: TripData[] = Array.isArray(savedTrips)
          ? savedTrips.map((item: unknown) => {
              const raw = item && typeof item === 'object' ? (item as { id?: unknown; isSummary?: unknown }) : null;
              if (normalizedActiveTrip && raw?.id === normalizedActiveTrip.id) {
                return normalizedActiveTrip;
              }
              return raw?.isSummary === true ? normalizeTripSummary(item) : normalizeTripData(item);
            })
          : normalizedActiveTrip
            ? [normalizedActiveTrip]
            : [];

        const savedMap: Record<string, string> = {};
        const versionMap: Record<string, number> = {};
        for (const item of serverTrips) {
          if (!item.isSummary && !pendingLocalMap.has(item.id)) {
            savedMap[item.id] = getTripComparableJson(item);
          }
          if (typeof item.version === 'number') {
            versionMap[item.id] = item.version;
          }
        }
        lastSavedContentByTripIdRef.current = savedMap;
        latestServerVersionByTripIdRef.current = versionMap;

        const correctedTrips = serverTrips.map((item) => pendingLocalMap.get(item.id) ?? item);
        const primaryServerTrip =
          normalizedActiveTrip || serverTrips.find((t) => !t.isSummary) || serverTrips[0] || null;
        const primaryTrip = primaryServerTrip
          ? pendingLocalMap.get(primaryServerTrip.id) ?? primaryServerTrip
          : null;

        setTrips(correctedTrips);
        setTrip(primaryTrip);
        setCurrentDayIndex(primaryTrip?.currentDay || 1);
        setFirebaseStatus('connected');
        setLoadedTripUserId(authUserId);
        setTripsLoaded(true);

        const cachedResult = saveOfflineTripsCacheDetailed(
          authUserId,
          correctedTrips,
          primaryTrip?.id || null,
          existingCache?.pendingSyncIds,
        );
        warnIfQuotaExceeded(cachedResult.quotaExceeded);
        if (cachedResult.cache) {
          setCachedAt(cachedResult.cache.cachedAt);
          setPendingSyncCount(cachedResult.cache.pendingSyncIds.length);
        }
      } catch (error) {
        if (cancelled) return;
        console.error('Trip loading error:', error);

        if (error instanceof AuthSessionError) {
          await performSignOutAndClearCache(authUserId);
          showToast('Phiên đăng nhập không hợp lệ hoặc tài khoản đã bị vô hiệu hóa.', 'error');
          return;
        }

        const offlineCache = loadOfflineTripsCache(authUserId);
        if (offlineCache) {
          const restoredTrips = offlineCache.trips;
          const restoredActive =
            restoredTrips.find((t) => t.id === offlineCache.activeTripId) || restoredTrips[0] || null;
          setTrips(restoredTrips);
          setTrip(restoredActive);
          setCurrentDayIndex(restoredActive?.currentDay || 1);
          setCachedAt(offlineCache.cachedAt);
          setPendingSyncCount(offlineCache.pendingSyncIds.length);
          setLoadedTripUserId(authUserId);
          setTripsLoaded(true);
          setFirebaseStatus('error');
          if (restoredTrips.length > 0) {
            showToast('Đang dùng dữ liệu ngoại tuyến lưu trên thiết bị.', 'info');
          }
          return;
        }

        setFirebaseStatus('error');
        setTripsLoaded(true);
      }
    };

    void loadFromApi();
    return () => {
      cancelled = true;
    };
  }, [authUserId, performSignOutAndClearCache, setCurrentDayIndex, showToast, warnIfQuotaExceeded]);

  const uploadReceiptToServer = useCallback(async (tripId: string, dataUrl: string): Promise<string | null> => {
    try {
      const res = await authenticatedFetch(`/api/trips/${encodeURIComponent(tripId)}/receipts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl }),
      });
      if (!res.ok) return null;
      const payload = await safeJsonResponse(res);
      return typeof payload?.receiptId === 'string' ? payload.receiptId : null;
    } catch {
      return null;
    }
  }, []);

  const fetchServerTripSnapshot = useCallback(async (tripId: string): Promise<TripData | null> => {
    try {
      const freshRes = await authenticatedFetch(`/api/trips/${encodeURIComponent(tripId)}`);
      if (!freshRes.ok) return null;
      const freshJson = await safeJsonResponse(freshRes);
      const freshTrip = freshJson?.trip || (freshJson?.id ? freshJson : null);
      return freshTrip?.id ? normalizeTripData(freshTrip) : null;
    } catch {
      return null;
    }
  }, []);

  const ensureFullTrip = useCallback(async (tripOrId: TripData | string): Promise<TripData | null> => {
    const targetId = typeof tripOrId === 'string' ? tripOrId : tripOrId.id;
    if (!targetId) return null;

    if (latestTripRef.current?.id === targetId && !latestTripRef.current.isSummary) {
      return latestTripRef.current;
    }

    const existingInList = tripsRef.current.find((t) => t.id === targetId);
    if (existingInList && !existingInList.isSummary) {
      return existingInList;
    }

    const existingPending = inFlightHydrationsRef.current.get(targetId);
    if (existingPending) return existingPending;

    const hydratePromise = (async () => {
      setHydratingTripId(targetId);
      try {
        const snapshot = await fetchServerTripSnapshot(targetId);
        if (snapshot) {
          lastSavedContentByTripIdRef.current[snapshot.id] = getTripComparableJson(snapshot);
          if (typeof snapshot.version === 'number') {
            latestServerVersionByTripIdRef.current[snapshot.id] = snapshot.version;
          }
          setTrips((prev) => {
            const idx = prev.findIndex((item) => item.id === snapshot.id);
            if (idx === -1) return [snapshot, ...prev];
            const next = [...prev];
            next[idx] = snapshot;
            return next;
          });
          setTrip((prev) => (prev?.id === snapshot.id ? snapshot : prev));
          return snapshot;
        }

        if (authUserId) {
          const offlineCache = loadOfflineTripsCache(authUserId);
          const cachedFull = offlineCache?.trips.find((t) => t.id === targetId && !t.isSummary);
          if (cachedFull) {
            setTrips((prev) => prev.map((item) => (item.id === cachedFull.id ? cachedFull : item)));
            return cachedFull;
          }
        }
        return null;
      } finally {
        inFlightHydrationsRef.current.delete(targetId);
        setHydratingTripId((current) => (current === targetId ? null : current));
      }
    })();

    inFlightHydrationsRef.current.set(targetId, hydratePromise);
    return hydratePromise;
  }, [authUserId, fetchServerTripSnapshot]);

  const executeTripPut = useCallback(async (
    candidateTrip: TripData,
    options?: {
      forceServerVersion?: number;
      alignWithSessionVersion?: boolean;
      onPreparedTrip?: (prepared: TripData) => void;
    },
  ): Promise<
    | { status: 'ok'; savedTrip: TripData; version?: number }
    | { status: 'conflict'; localTrip: TripData; serverTrip: TripData | null }
  > => {
    if (candidateTrip.isSummary) {
      throw new Error('Không thể lưu dữ liệu tóm tắt lên máy chủ.');
    }
    const normalized = normalizeTripData(candidateTrip);
    const alignedVersion =
      typeof options?.forceServerVersion === 'number'
        ? options.forceServerVersion
        : options?.alignWithSessionVersion && typeof latestServerVersionByTripIdRef.current[normalized.id] === 'number'
          ? latestServerVersionByTripIdRef.current[normalized.id]
          : normalized.version;

    const prepared = await offloadTripReceipts(
      { ...normalized, ...(typeof alignedVersion === 'number' ? { version: alignedVersion } : {}) },
      uploadReceiptToServer,
    );
    options?.onPreparedTrip?.(prepared);

    const response = await authenticatedFetch(`/api/trips/${encodeURIComponent(prepared.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prepared),
    });
    const result = await safeJsonResponse(response);

    if (response.status === 401 || response.status === 403) {
      throw new AuthSessionError(response.status, result?.error || undefined);
    }

    if (response.status === 413) {
      throw new PayloadTooLargeError(result?.error || undefined);
    }

    if (response.status === 409) {
      const freshServer = await fetchServerTripSnapshot(prepared.id);
      if (freshServer) {
        if (typeof freshServer.version === 'number') {
          latestServerVersionByTripIdRef.current[freshServer.id] = freshServer.version;
        }
        if (getTripComparableJson(prepared) === getTripComparableJson(freshServer)) {
          return { status: 'ok', savedTrip: freshServer, version: freshServer.version };
        }
      }
      return { status: 'conflict', localTrip: prepared, serverTrip: freshServer };
    }

    if (!response.ok || (result && result.success === false)) {
      throw new Error(result?.error || 'Không thể lưu dữ liệu chuyến đi');
    }

    const serverSaved = result?.trip?.id ? normalizeTripData(result.trip) : prepared;
    const nextVersion =
      typeof result?.version === 'number'
        ? result.version
        : typeof serverSaved.version === 'number'
          ? serverSaved.version
          : prepared.version;
    if (typeof nextVersion === 'number') {
      latestServerVersionByTripIdRef.current[prepared.id] = nextVersion;
    }

    const savedTrip: TripData = {
      ...prepared,
      ...serverSaved,
      ...(typeof nextVersion === 'number' ? { version: nextVersion } : {}),
    };

    return {
      status: 'ok',
      savedTrip,
      version: nextVersion,
    };
  }, [fetchServerTripSnapshot, uploadReceiptToServer]);

  const syncPendingOfflineTrips = useCallback(async (forceRetry = false) => {
    if (!authUserId || !isOnline || isSyncingOfflineRef.current || conflictState) return;
    if (forceRetry) {
      conflictDismissedRef.current = false;
    }
    const cache = loadOfflineTripsCache(authUserId);
    if (!cache || cache.pendingSyncIds.length === 0) {
      setPendingSyncCount(0);
      return;
    }

    isSyncingOfflineRef.current = true;
    let syncedCount = 0;

    try {
      for (const pendingId of cache.pendingSyncIds) {
        const queuedTrip = cache.trips.find((t) => t.id === pendingId);
        if (!queuedTrip || !isUserTripOwnerOrAdmin(queuedTrip, authUserId, authUserRole)) {
          clearTripPendingOfflineSync(authUserId, pendingId);
          continue;
        }

        let preparedSnapshot = queuedTrip;
        try {
          const outcome = await saveQueueRef.current.enqueue(() =>
            executeTripPut(queuedTrip, {
              alignWithSessionVersion: false,
              onPreparedTrip: (prepared) => {
                preparedSnapshot = prepared;
              },
            }),
          );

          if (outcome.status === 'conflict') {
            if (preparedSnapshot !== queuedTrip) {
              const savedRes = markTripPendingOfflineSyncDetailed(authUserId, preparedSnapshot);
              warnIfQuotaExceeded(savedRes.quotaExceeded);
            }
            if (outcome.serverTrip) {
              setConflictState({ localTrip: outcome.localTrip, serverTrip: outcome.serverTrip });
              showToast('Phát hiện xung đột đồng bộ ngoại tuyến — hãy chọn phiên bản muốn giữ.', 'info');
            } else {
              showToast('Xung đột phiên bản khi đồng bộ, vui lòng kiểm tra lại.', 'error');
            }
            setFirebaseStatus('error');
            break;
          }

          const { savedTrip, version } = outcome;
          applySavedTripState(savedTrip, version, [
            getTripComparableJson(queuedTrip),
            getTripComparableJson(preparedSnapshot),
          ]);
          syncedCount += 1;
        } catch (itemError) {
          if (itemError instanceof AuthSessionError) {
            await performSignOutAndClearCache(authUserId);
            showToast('Phiên đăng nhập không hợp lệ hoặc tài khoản đã bị vô hiệu hóa.', 'error');
            return;
          }
          if (preparedSnapshot !== queuedTrip) {
            const savedRes = markTripPendingOfflineSyncDetailed(authUserId, preparedSnapshot);
            warnIfQuotaExceeded(savedRes.quotaExceeded);
          }
          if (itemError instanceof PayloadTooLargeError) {
            clearTripPendingOfflineSync(authUserId, pendingId);
            setFirebaseStatus('error');
            showToast(itemError.message, 'error');
            continue;
          }
          throw itemError;
        }
      }

      const refreshedCache = loadOfflineTripsCache(authUserId);
      setPendingSyncCount(refreshedCache?.pendingSyncIds.length || 0);
      if (syncedCount > 0) {
        setFirebaseStatus('connected');
        showToast(`Đã đồng bộ ${syncedCount} chuyến đi thay đổi khi ngoại tuyến.`, 'success');
      }
    } catch (error) {
      console.warn('Offline sync retry failed:', error);
    } finally {
      isSyncingOfflineRef.current = false;
    }
  }, [applySavedTripState, authUserId, authUserRole, isOnline, conflictState, executeTripPut, performSignOutAndClearCache, showToast, warnIfQuotaExceeded]);

  useEffect(() => {
    if (
      isOnline &&
      authUserId &&
      tripsLoaded &&
      pendingSyncCount > 0 &&
      !conflictState &&
      !conflictDismissedRef.current
    ) {
      void syncPendingOfflineTrips();
    }
  }, [isOnline, authUserId, tripsLoaded, pendingSyncCount, conflictState, syncPendingOfflineTrips]);

  // Autosave trip changes qua hàng đợi tuần tự (single-flight) — chỉ chạy cho chủ chuyến hoặc Admin
  useEffect(() => {
    if (
      !authUserId ||
      !trip?.id ||
      trip.isSummary ||
      loadedTripUserId !== authUserId ||
      conflictState ||
      !isUserTripOwnerOrAdmin(trip, authUserId, authUserRole)
    ) {
      return;
    }

    const currentComparable = getTripComparableJson(trip);
    if (!currentComparable || currentComparable === lastSavedContentByTripIdRef.current[trip.id]) return;

    const tripIdSnapshot = trip.id;
    const timeout = window.setTimeout(() => {
      void saveQueueRef.current.enqueue(async () => {
        const liveTrip = latestTripRef.current;
        if (
          !liveTrip ||
          liveTrip.id !== tripIdSnapshot ||
          liveTrip.isSummary ||
          !isUserTripOwnerOrAdmin(liveTrip, authUserId, authUserRole)
        ) {
          return;
        }

        const normalized = normalizeTripData(liveTrip);
        const targetComparable = getTripComparableJson(normalized);
        if (!targetComparable || targetComparable === lastSavedContentByTripIdRef.current[normalized.id]) {
          return;
        }

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          queueTripOffline(normalized);
          return;
        }

        let preparedSnapshot = normalized;
        try {
          const outcome = await executeTripPut(normalized, {
            alignWithSessionVersion: true,
            onPreparedTrip: (prepared) => {
              preparedSnapshot = prepared;
            },
          });
          if (outcome.status === 'conflict') {
            queueTripOffline(outcome.localTrip);
            if (outcome.serverTrip) {
              setConflictState({ localTrip: outcome.localTrip, serverTrip: outcome.serverTrip });
              showToast('Phát hiện xung đột phiên bản — bản sửa của bạn vẫn được giữ an toàn.', 'info');
            } else {
              showToast('Dữ liệu chuyến đi bị xung đột phiên bản. Vui lòng kiểm tra lại.', 'error');
            }
            return;
          }

          const { savedTrip, version } = outcome;
          applySavedTripState(savedTrip, version, [
            targetComparable,
            getTripComparableJson(preparedSnapshot),
          ]);
          setFirebaseStatus('connected');
        } catch (error) {
          if (error instanceof AuthSessionError) {
            await performSignOutAndClearCache(authUserId);
            showToast('Phiên đăng nhập không hợp lệ hoặc tài khoản đã bị vô hiệu hóa.', 'error');
            return;
          }
          if (error instanceof PayloadTooLargeError) {
            clearPendingOfflineState(preparedSnapshot.id);
            setFirebaseStatus('error');
            showToast(error.message, 'error');
            return;
          }
          console.error('Trip save error:', error);
          if (preparedSnapshot !== normalized) {
            setTrip((prev) =>
              prev?.id === preparedSnapshot.id ? { ...prev, invoices: preparedSnapshot.invoices } : prev,
            );
          }
          queueTripOffline(preparedSnapshot);
        }
      });
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [trip, authUserId, authUserRole, loadedTripUserId, conflictState, executeTripPut, performSignOutAndClearCache, showToast, queueTripOffline, clearPendingOfflineState, applySavedTripState]);

  const applyAuthoritativeTripUpdate = useCallback(
    (serverTrip: TripData, options?: { select?: boolean; prependIfNew?: boolean }) => {
      const normalized = normalizeTripData(serverTrip);
      lastSavedContentByTripIdRef.current[normalized.id] = getTripComparableJson(normalized);
      if (typeof normalized.version === 'number') {
        latestServerVersionByTripIdRef.current[normalized.id] = normalized.version;
      }
      clearPendingOfflineState(normalized.id);
      setTrips((prev) => {
        const exists = prev.some((item) => item.id === normalized.id);
        if (!exists) {
          return options?.prependIfNew ? [normalized, ...prev] : [...prev, normalized];
        }
        return prev.map((item) => (item.id === normalized.id ? normalized : item));
      });
      if (options?.select) {
        setTrip(normalized);
        setCurrentDayIndex(normalized.currentDay || 1);
      } else {
        setTrip((prev) => (prev?.id === normalized.id ? normalized : prev));
      }
      return normalized;
    },
    [authUserId, setCurrentDayIndex],
  );

  const removeTripFromLocalState = useCallback(
    async (tripId: string): Promise<TripData | null> => {
      delete lastSavedContentByTripIdRef.current[tripId];
      delete latestServerVersionByTripIdRef.current[tripId];
      clearPendingOfflineState(tripId);

      const remaining = tripsRef.current.filter((item) => item.id !== tripId);
      setTrips(remaining);

      if (latestTripRef.current?.id === tripId) {
        if (remaining.length > 0) {
          const candidate = remaining[0];
          const resolved = candidate.isSummary ? await ensureFullTrip(candidate) : candidate;
          const nextActive = resolved || candidate;
          setTrip(nextActive);
          setCurrentDayIndex(nextActive.currentDay || 1);
          return nextActive;
        }
        setTrip(null);
        setCurrentDayIndex(1);
        return null;
      }
      return latestTripRef.current;
    },
    [authUserId, ensureFullTrip, setCurrentDayIndex],
  );

  const saveTripToFirestore = useCallback(async (updatedTrip: TripData, successMessage?: string): Promise<boolean> => {
    if (updatedTrip.isSummary) return false;
    if (!isUserTripOwnerOrAdmin(updatedTrip, authUserId, authUserRole)) {
      showToast('Hành khách không có quyền chỉnh sửa toàn bộ chuyến đi.', 'info');
      return false;
    }
    const normalizedTrip = normalizeTripData(updatedTrip);
    const isTargetActive = latestTripRef.current?.id === normalizedTrip.id;
    setTrips((prev) => prev.map((item) => (item.id === normalizedTrip.id ? normalizedTrip : item)));
    if (isTargetActive) {
      setTrip(normalizedTrip);
    }

    if (authUserId && typeof navigator !== 'undefined' && !navigator.onLine) {
      queueTripOffline(normalizedTrip);
      showToast('Đang ngoại tuyến: đã lưu tạm vào bộ nhớ máy và sẽ đồng bộ khi có mạng.', 'info');
      return false;
    }

    setFirebaseStatus('loading');
    let preparedSnapshot = normalizedTrip;
    let didSync = false;

    try {
      await saveQueueRef.current.enqueue(async () => {
        const outcome = await executeTripPut(normalizedTrip, {
          alignWithSessionVersion: true,
          onPreparedTrip: (prepared) => {
            preparedSnapshot = prepared;
          },
        });
        if (outcome.status === 'conflict') {
          queueTripOffline(outcome.localTrip);
          if (preparedSnapshot !== normalizedTrip) {
            setTrip((prev) =>
              prev?.id === preparedSnapshot.id ? { ...prev, invoices: preparedSnapshot.invoices } : prev,
            );
          }
          if (outcome.serverTrip) {
            setConflictState({ localTrip: outcome.localTrip, serverTrip: outcome.serverTrip });
            showToast('Phát hiện xung đột phiên bản — bản sửa của bạn vẫn được giữ nguyên.', 'info');
          } else {
            showToast('Xung đột phiên bản: Dữ liệu đã được cập nhật bởi phiên làm việc khác.', 'error');
          }
          return;
        }

        const { savedTrip, version } = outcome;
        applySavedTripState(savedTrip, version, [
          getTripComparableJson(normalizedTrip),
          getTripComparableJson(preparedSnapshot),
        ]);
        setFirebaseStatus('connected');
        didSync = true;
        if (successMessage) showToast(successMessage, 'success');
      });
      return didSync;
    } catch (error) {
      if (error instanceof AuthSessionError) {
        await performSignOutAndClearCache(authUserId);
        showToast('Phiên đăng nhập không hợp lệ hoặc tài khoản đã bị vô hiệu hóa.', 'error');
        return false;
      }
      if (error instanceof PayloadTooLargeError) {
        clearPendingOfflineState(preparedSnapshot.id);
        setFirebaseStatus('error');
        showToast(error.message, 'error');
        return false;
      }
      console.error('All trip save methods failed:', error);
      if (preparedSnapshot !== normalizedTrip) {
        setTrip((prev) =>
          prev?.id === preparedSnapshot.id ? { ...prev, invoices: preparedSnapshot.invoices } : prev,
        );
      }
      queueTripOffline(preparedSnapshot);
      showToast('Không thể kết nối máy chủ — thay đổi đã được lưu tạm ngoại tuyến.', 'error');
      return false;
    }
  }, [applySavedTripState, authUserId, authUserRole, clearPendingOfflineState, executeTripPut, performSignOutAndClearCache, queueTripOffline, showToast]);

  const handleKeepLocalConflict = useCallback(async () => {
    if (!conflictState) return;
    setIsResolvingConflict(true);
    const { localTrip, serverTrip } = conflictState;
    try {
      await saveQueueRef.current.enqueue(async () => {
        const outcome = await executeTripPut(localTrip, { forceServerVersion: serverTrip.version });
        if (outcome.status === 'conflict') {
          if (outcome.serverTrip) {
            setConflictState({ localTrip: outcome.localTrip, serverTrip: outcome.serverTrip });
          }
          showToast('Máy chủ lại có thay đổi mới hơn trong lúc ghi đè. Vui lòng chọn lại.', 'error');
          return;
        }
        const { savedTrip } = outcome;
        applySavedTripState(savedTrip, savedTrip.version);
        conflictDismissedRef.current = false;
        setConflictState(null);
        setFirebaseStatus('connected');
        showToast('Đã giữ bản chỉnh sửa của bạn và cập nhật lên máy chủ!', 'success');
      });
    } catch (err: any) {
      showToast(err?.message || 'Không thể ghi đè bản cục bộ lên máy chủ', 'error');
    } finally {
      setIsResolvingConflict(false);
    }
  }, [applySavedTripState, conflictState, executeTripPut, showToast]);

  const handleUseServerConflict = useCallback(() => {
    if (!conflictState) return;
    const serverTrip = normalizeTripData(conflictState.serverTrip);
    if (typeof serverTrip.version === 'number') {
      latestServerVersionByTripIdRef.current[serverTrip.id] = serverTrip.version;
    }
    applySavedTripState(serverTrip, serverTrip.version);
    conflictDismissedRef.current = false;
    setConflictState(null);
    setFirebaseStatus('connected');
    showToast(`Đã áp dụng bản máy chủ (v${serverTrip.version ?? '?'}) thành công.`, 'info');
  }, [applySavedTripState, conflictState, showToast]);

  const dismissConflict = useCallback(() => {
    conflictDismissedRef.current = true;
    setConflictState(null);
  }, []);

  const handleLogout = useCallback(async () => {
    const hasUnsavedCurrentTrip = Boolean(
      trip?.id && getTripComparableJson(trip) !== lastSavedContentByTripIdRef.current[trip.id],
    );
    if (pendingSyncCount > 0 || hasUnsavedCurrentTrip || conflictState) {
      setIsLogoutConfirmOpen(true);
      return;
    }
    await performSignOutAndClearCache();
  }, [conflictState, pendingSyncCount, performSignOutAndClearCache, trip]);

  const handleSyncAndLogout = useCallback(async () => {
    if (!authUserId) {
      await performSignOutAndClearCache();
      return;
    }
    setIsSyncingBeforeLogout(true);
    try {
      await syncPendingOfflineTrips();
      const cache = loadOfflineTripsCache(authUserId);
      if (!cache || cache.pendingSyncIds.length === 0) {
        await performSignOutAndClearCache();
      } else {
        showToast('Vẫn còn dữ liệu chưa thể đồng bộ. Vui lòng xử lý xung đột hoặc xác nhận đăng xuất.', 'info');
      }
    } finally {
      setIsSyncingBeforeLogout(false);
    }
  }, [authUserId, performSignOutAndClearCache, showToast, syncPendingOfflineTrips]);

  return {
    trip,
    setTrip,
    trips,
    setTrips,
    tripsLoaded,
    loadedTripUserId,
    firebaseStatus,
    setFirebaseStatus,
    pendingSyncCount,
    cachedAt,
    conflictState,
    setConflictState,
    isResolvingConflict,
    isLogoutConfirmOpen,
    setIsLogoutConfirmOpen,
    isSyncingBeforeLogout,
    lastSavedContentByTripIdRef,
    latestServerVersionByTripIdRef,
    latestTripRef,
    saveQueueRef,
    hydratingTripId,
    ensureFullTrip,
    fetchServerTripSnapshot,
    executeTripPut,
    applyAuthoritativeTripUpdate,
    removeTripFromLocalState,
    saveTripToFirestore,
    syncPendingOfflineTrips,
    handleKeepLocalConflict,
    handleUseServerConflict,
    dismissConflict,
    performSignOutAndClearCache,
    handleLogout,
    handleSyncAndLogout,
  };
}
