/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { TripPlannerModal } from "./components/TripPlannerModal";
import { AutoArrangeModal } from "./components/AutoArrangeModal";
import { EditTripModal } from "./components/EditTripModal";
import { AccountModal } from "./components/AccountModal";
import { AuthScreen } from "./components/AuthScreen";
import { AdminDashboard } from "./components/AdminDashboard";
import { UserDashboard } from "./components/UserDashboard";
import { detectScheduleAndWeatherAlerts } from "./utils/alertDetector";
import { normalizeTripData } from "./data/normalizeTripData";
import { TripData, Activity, TripMember, DaySchedule, Waypoint } from "./types/travel";
import { AuthUser } from "./types/auth";
import { authenticatedFetch, safeJsonResponse } from "./api";
import { applyScheduleChangesStrict, filterAlertsByRecommendation } from "./utils/applyOptimization";
import { getTripComparableJson } from "./utils/tripRepository";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import {
  clearTripPendingOfflineSync,
  getOfflineCacheKey,
  loadOfflineTripsCache,
  markTripPendingOfflineSyncDetailed,
  saveOfflineTripsCacheDetailed,
} from "./utils/offlineStorage";
import { cloneTripForTemplate, findMatchingActivityForWaypoint } from "./utils/tripHelpers";
import {
  AuthSessionError,
  PROFILE_UPDATED_EVENT,
  PayloadTooLargeError,
  SingleFlightQueue,
  clearPendingRegisteredDisplayName,
  getPendingRegisteredDisplayName,
  mergeAlertScanIntoTrip,
  offloadTripReceipts,
} from "./utils/tripSyncHelpers";
import { SyncConflictModal } from "./components/SyncConflictModal";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { firebaseAuth } from "./firebase";

const ALERT_NOTIFY_PREF_KEY = 'voyager_alerts_notify';
const PERIODIC_ALERT_SCAN_MS = 3 * 60 * 1000;

export default function App() {
  const [trip, setTrip] = useState<TripData | null>(null);
  const [trips, setTrips] = useState<TripData[]>([]);
  const [tripsLoaded, setTripsLoaded] = useState<boolean>(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [currentDayIndex, setCurrentDayIndex] = useState<number>(1);
  const [filterMode, setFilterMode] = useState<'timeline' | 'all'>('timeline');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAIApplied, setIsAIApplied] = useState<boolean>(false);
  const [loadedTripUserId, setLoadedTripUserId] = useState<string | null>(null);
  const [firebaseStatus, setFirebaseStatus] = useState<'loading' | 'connected' | 'error'>('loading');

  // Offline & Notification states
  const isOnline = useOnlineStatus();
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return false;
    return Notification.permission === 'granted' && window.localStorage.getItem(ALERT_NOTIFY_PREF_KEY) === '1';
  });

  // Modals state
  const [isAIPlannerOpen, setIsAIPlannerOpen] = useState<boolean>(false);
  const [plannerInitialTab, setPlannerInitialTab] = useState<'traditional' | 'ai'>('traditional');
  const [isAutoArrangeOpen, setIsAutoArrangeOpen] = useState<boolean>(false);
  const [isAIOptimizeOpen, setIsAIOptimizeOpen] = useState<boolean>(false);
  const [isAddActivityOpen, setIsAddActivityOpen] = useState<boolean>(false);
  const [isAlertsModalOpen, setIsAlertsModalOpen] = useState<boolean>(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState<boolean>(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'error' | 'info';
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);
  const [lastOptimizedTripSnapshot, setLastOptimizedTripSnapshot] = useState<TripData | null>(null);
  const [isEditTripModalOpen, setIsEditTripModalOpen] = useState<boolean>(false);
  const [tripToEdit, setTripToEdit] = useState<TripData | null>(null);
  const [isScanningAlerts, setIsScanningAlerts] = useState<boolean>(false);
  const [conflictState, setConflictState] = useState<{
    localTrip: TripData;
    serverTrip: TripData;
  } | null>(null);
  const [isResolvingConflict, setIsResolvingConflict] = useState<boolean>(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState<boolean>(false);
  const [isSyncingBeforeLogout, setIsSyncingBeforeLogout] = useState<boolean>(false);

  const authUserId = authUser?.id || null;
  const isAdminMode = authUser?.role === 'admin';
  const lastSavedContentByTripIdRef = useRef<Record<string, string>>({});
  const latestServerVersionByTripIdRef = useRef<Record<string, number>>({});
  const latestTripRef = useRef<TripData | null>(trip);
  const saveQueueRef = useRef<SingleFlightQueue>(new SingleFlightQueue());
  const isSyncingOfflineRef = useRef<boolean>(false);
  const lastQuotaWarnAtRef = useRef<number>(0);

  useEffect(() => {
    latestTripRef.current = trip;
  }, [trip]);

  const showToast = useCallback((
    text: string,
    type: 'success' | 'error' | 'info' = 'success',
    actionLabel?: string,
    onAction?: () => void,
  ) => {
    setToastMessage({ text, type, actionLabel, onAction });
    window.setTimeout(() => {
      setToastMessage((current) => (current?.text === text ? null : current));
    }, 4500);
  }, []);

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
      setAuthUser(null);
    }
  }, [authUserId]);

  useEffect(() => {
    if (!firebaseAuth) {
      setAuthLoading(false);
      return;
    }

    const handleProfileUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ uid?: string; displayName?: string }>;
      const uid = custom.detail?.uid;
      const displayName = custom.detail?.displayName;
      if (!uid || !displayName) return;
      setAuthUser((prev) => (prev && prev.id === uid ? { ...prev, name: displayName } : prev));
    };

    window.addEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated);
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        setAuthUser(null);
        setAuthLoading(false);
        return;
      }

      try {
        // Quyền admin chỉ lấy từ custom claim `role` đã được Firebase ký.
        const token = await user.getIdTokenResult();
        const pendingName = getPendingRegisteredDisplayName(user.uid);
        const resolvedName =
          user.displayName || pendingName || user.email?.split('@')[0] || 'Người dùng';
        if (user.displayName) {
          clearPendingRegisteredDisplayName(user.uid);
        }
        setAuthUser({
          id: user.uid,
          name: resolvedName,
          email: user.email || '',
          role: token.claims.role === 'admin' ? 'admin' : 'user',
        });
      } catch {
        setAuthUser(null);
      } finally {
        setAuthLoading(false);
      }
    });

    return () => {
      window.removeEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const adminExclusiveTabs = ['planning', 'rules', 'ai', 'monitoring', 'system'];
    if (!isAdminMode && adminExclusiveTabs.includes(currentTab)) {
      setCurrentTab('dashboard');
    }
  }, [isAdminMode, currentTab]);

  useEffect(() => {
    if (trip?.days && trip.days.length > 0) {
      if (!trip.days.some((d) => d.dayIndex === currentDayIndex)) {
        const fallbackDay =
          trip.currentDay && trip.days.some((d) => d.dayIndex === trip.currentDay)
            ? trip.currentDay
            : trip.days[0].dayIndex;
        setCurrentDayIndex(fallbackDay);
      }
    }
  }, [trip, currentDayIndex]);

  const handleSelectTab = (tab: string) => {
    const adminExclusiveTabs = ['planning', 'rules', 'ai', 'monitoring', 'system'];
    if (!isAdminMode && adminExclusiveTabs.includes(tab)) {
      setCurrentTab('dashboard');
      return;
    }

    setCurrentTab(tab);
  };

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
        // Server chỉ trả về các chuyến của chính user này (admin: tất cả)
        const response = await authenticatedFetch('/api/trips');
        if (response.status === 401 || response.status === 403) {
          throw new AuthSessionError(response.status);
        }
        if (!response.ok) throw new Error('Không thể tải dữ liệu chuyến đi');
        const { activeTrip, trips: savedTrips } = await safeJsonResponse(response);
        if (cancelled) return;

        const correctedTrips = Array.isArray(savedTrips)
          ? savedTrips.map((item: unknown) => normalizeTripData(item))
          : activeTrip
            ? [normalizeTripData(activeTrip)]
            : [];

        const primaryTrip =
          (activeTrip ? normalizeTripData(activeTrip) : null) || correctedTrips[0] || null;

        const savedMap: Record<string, string> = {};
        const versionMap: Record<string, number> = {};
        for (const item of correctedTrips) {
          savedMap[item.id] = getTripComparableJson(item);
          if (typeof item.version === 'number') {
            versionMap[item.id] = item.version;
          }
        }
        lastSavedContentByTripIdRef.current = savedMap;
        latestServerVersionByTripIdRef.current = versionMap;

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

        // Nếu phiên đăng nhập hết hạn / tài khoản bị vô hiệu hóa (401/403) -> xóa cache ngoại tuyến & đăng xuất, KHÔNG nạp lại dữ liệu cũ
        if (error instanceof AuthSessionError) {
          await performSignOutAndClearCache(authUserId);
          showToast('Phiên đăng nhập không hợp lệ hoặc tài khoản đã bị vô hiệu hóa.', 'error');
          return;
        }

        // Chế độ ngoại tuyến (lỗi mạng / máy chủ 5xx): nạp lại chuyến đi từ cache thiết bị nếu có
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
  }, [authUserId, performSignOutAndClearCache, showToast, warnIfQuotaExceeded]);

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

  // Thực thi tuần tự một yêu cầu PUT chuyến đi kèm xử lý offload ảnh, 401/403, 413 và 409
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
        // Nếu nội dung chuẩn hóa giống hệt máy chủ -> không phải xung đột thật
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

  // Đồng bộ lại các thay đổi offline lên máy chủ khi có mạng trở lại (tôn trọng xung đột 409, không tự xóa thay đổi)
  const syncPendingOfflineTrips = useCallback(async () => {
    if (!authUserId || !isOnline || isSyncingOfflineRef.current || conflictState) return;
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
        if (!queuedTrip) {
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
          lastSavedContentByTripIdRef.current[savedTrip.id] = getTripComparableJson(savedTrip);
          clearTripPendingOfflineSync(authUserId, savedTrip.id);
          setTrip((prev) =>
            prev?.id === savedTrip.id
              ? {
                  ...prev,
                  invoices: savedTrip.invoices,
                  budgetTotal: savedTrip.budgetTotal,
                  budgetUsed: savedTrip.budgetUsed,
                  budgetRemaining: savedTrip.budgetRemaining,
                  budgetUsedPercent: savedTrip.budgetUsedPercent,
                  ...(typeof version === 'number' ? { version } : {}),
                }
              : prev,
          );
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
  }, [authUserId, isOnline, conflictState, executeTripPut, performSignOutAndClearCache, showToast, warnIfQuotaExceeded]);

  useEffect(() => {
    if (isOnline && authUserId && tripsLoaded && pendingSyncCount > 0 && !conflictState) {
      void syncPendingOfflineTrips();
    }
  }, [isOnline, authUserId, tripsLoaded, pendingSyncCount, conflictState, syncPendingOfflineTrips]);

  // Autosave trip changes qua hàng đợi tuần tự (single-flight)
  useEffect(() => {
    if (!authUserId || !trip?.id || loadedTripUserId !== authUserId || conflictState) return;

    const currentComparable = getTripComparableJson(trip);
    if (!currentComparable || currentComparable === lastSavedContentByTripIdRef.current[trip.id]) return;

    const tripIdSnapshot = trip.id;
    const timeout = window.setTimeout(() => {
      void saveQueueRef.current.enqueue(async () => {
        const liveTrip = latestTripRef.current;
        if (!liveTrip || liveTrip.id !== tripIdSnapshot) return;

        const normalized = normalizeTripData(liveTrip);
        const targetComparable = getTripComparableJson(normalized);
        if (!targetComparable || targetComparable === lastSavedContentByTripIdRef.current[normalized.id]) {
          return;
        }

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const saveRes = markTripPendingOfflineSyncDetailed(authUserId, normalized);
          warnIfQuotaExceeded(saveRes.quotaExceeded);
          if (saveRes.cache) {
            setPendingSyncCount(saveRes.cache.pendingSyncIds.length);
            setCachedAt(saveRes.cache.cachedAt);
          }
          setFirebaseStatus('error');
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
            const saveRes = markTripPendingOfflineSyncDetailed(authUserId, outcome.localTrip);
            warnIfQuotaExceeded(saveRes.quotaExceeded);
            if (saveRes.cache) {
              setPendingSyncCount(saveRes.cache.pendingSyncIds.length);
              setCachedAt(saveRes.cache.cachedAt);
            }
            if (outcome.serverTrip) {
              setConflictState({ localTrip: outcome.localTrip, serverTrip: outcome.serverTrip });
              showToast('Phát hiện xung đột phiên bản — bản sửa của bạn vẫn được giữ an toàn.', 'info');
            } else {
              showToast('Dữ liệu chuyến đi bị xung đột phiên bản. Vui lòng kiểm tra lại.', 'error');
            }
            setFirebaseStatus('error');
            return;
          }

          const { savedTrip, version } = outcome;
          lastSavedContentByTripIdRef.current[savedTrip.id] = getTripComparableJson(savedTrip);
          const cacheAfter = clearTripPendingOfflineSync(authUserId, savedTrip.id);
          if (cacheAfter) {
            setPendingSyncCount(cacheAfter.pendingSyncIds.length);
          }
          setTrip((prev) => {
            if (!prev || prev.id !== savedTrip.id) return prev;
            const prevJson = getTripComparableJson(prev);
            const prevIsSame =
              prevJson === targetComparable || prevJson === getTripComparableJson(preparedSnapshot);
            return {
              ...prev,
              ...(prevIsSame
                ? {
                    invoices: savedTrip.invoices,
                    budgetTotal: savedTrip.budgetTotal,
                    budgetUsed: savedTrip.budgetUsed,
                    budgetRemaining: savedTrip.budgetRemaining,
                    budgetUsedPercent: savedTrip.budgetUsedPercent,
                  }
                : {}),
              ...(typeof version === 'number' ? { version } : {}),
            };
          });
          setFirebaseStatus('connected');
        } catch (error) {
          if (error instanceof AuthSessionError) {
            await performSignOutAndClearCache(authUserId);
            showToast('Phiên đăng nhập không hợp lệ hoặc tài khoản đã bị vô hiệu hóa.', 'error');
            return;
          }
          if (error instanceof PayloadTooLargeError) {
            const cacheAfter = clearTripPendingOfflineSync(authUserId, preparedSnapshot.id);
            if (cacheAfter) {
              setPendingSyncCount(cacheAfter.pendingSyncIds.length);
            }
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
          const saveRes = markTripPendingOfflineSyncDetailed(authUserId, preparedSnapshot);
          warnIfQuotaExceeded(saveRes.quotaExceeded);
          if (saveRes.cache) {
            setPendingSyncCount(saveRes.cache.pendingSyncIds.length);
            setCachedAt(saveRes.cache.cachedAt);
          }
          setFirebaseStatus('error');
        }
      });
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [trip, authUserId, loadedTripUserId, conflictState, executeTripPut, performSignOutAndClearCache, showToast, warnIfQuotaExceeded]);

  const saveTripToFirestore = useCallback(async (updatedTrip: TripData, successMessage?: string) => {
    const normalizedTrip = normalizeTripData(updatedTrip);
    setTrip(normalizedTrip);

    if (authUserId && typeof navigator !== 'undefined' && !navigator.onLine) {
      const saveRes = markTripPendingOfflineSyncDetailed(authUserId, normalizedTrip);
      warnIfQuotaExceeded(saveRes.quotaExceeded);
      if (saveRes.cache) {
        setPendingSyncCount(saveRes.cache.pendingSyncIds.length);
        setCachedAt(saveRes.cache.cachedAt);
      }
      setFirebaseStatus('error');
      showToast('Đang ngoại tuyến: đã lưu tạm vào bộ nhớ máy và sẽ đồng bộ khi có mạng.', 'info');
      return;
    }

    setFirebaseStatus('loading');
    let preparedSnapshot = normalizedTrip;

    try {
      await saveQueueRef.current.enqueue(async () => {
        const outcome = await executeTripPut(normalizedTrip, {
          alignWithSessionVersion: true,
          onPreparedTrip: (prepared) => {
            preparedSnapshot = prepared;
          },
        });
        if (outcome.status === 'conflict') {
          if (authUserId) {
            const saveRes = markTripPendingOfflineSyncDetailed(authUserId, outcome.localTrip);
            warnIfQuotaExceeded(saveRes.quotaExceeded);
            if (saveRes.cache) {
              setPendingSyncCount(saveRes.cache.pendingSyncIds.length);
              setCachedAt(saveRes.cache.cachedAt);
            }
          }
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
          setFirebaseStatus('error');
          return;
        }

        const { savedTrip, version } = outcome;
        const sentComparable = getTripComparableJson(savedTrip);
        lastSavedContentByTripIdRef.current[savedTrip.id] = sentComparable;
        if (authUserId) {
          const cacheAfter = clearTripPendingOfflineSync(authUserId, savedTrip.id);
          if (cacheAfter) {
            setPendingSyncCount(cacheAfter.pendingSyncIds.length);
          }
        }
        setTrip((prev) => {
          if (!prev || prev.id !== savedTrip.id) return prev;
          const prevJson = getTripComparableJson(prev);
          const isUnchangedWhileSaving =
            prevJson === getTripComparableJson(normalizedTrip) ||
            prevJson === getTripComparableJson(preparedSnapshot);
          return {
            ...prev,
            ...(isUnchangedWhileSaving
              ? {
                  invoices: savedTrip.invoices,
                  budgetTotal: savedTrip.budgetTotal,
                  budgetUsed: savedTrip.budgetUsed,
                  budgetRemaining: savedTrip.budgetRemaining,
                  budgetUsedPercent: savedTrip.budgetUsedPercent,
                }
              : {}),
            ...(typeof version === 'number' ? { version } : {}),
          };
        });
        setFirebaseStatus('connected');
        if (successMessage) showToast(successMessage, 'success');
      });
    } catch (error) {
      if (error instanceof AuthSessionError) {
        await performSignOutAndClearCache(authUserId);
        showToast('Phiên đăng nhập không hợp lệ hoặc tài khoản đã bị vô hiệu hóa.', 'error');
        return;
      }
      if (error instanceof PayloadTooLargeError) {
        if (authUserId) {
          const cacheAfter = clearTripPendingOfflineSync(authUserId, preparedSnapshot.id);
          if (cacheAfter) {
            setPendingSyncCount(cacheAfter.pendingSyncIds.length);
          }
        }
        setFirebaseStatus('error');
        showToast(error.message, 'error');
        return;
      }
      console.error('All trip save methods failed:', error);
      if (preparedSnapshot !== normalizedTrip) {
        setTrip((prev) =>
          prev?.id === preparedSnapshot.id ? { ...prev, invoices: preparedSnapshot.invoices } : prev,
        );
      }
      if (authUserId) {
        const saveRes = markTripPendingOfflineSyncDetailed(authUserId, preparedSnapshot);
        warnIfQuotaExceeded(saveRes.quotaExceeded);
        if (saveRes.cache) {
          setPendingSyncCount(saveRes.cache.pendingSyncIds.length);
          setCachedAt(saveRes.cache.cachedAt);
        }
      }
      setFirebaseStatus('error');
      showToast('Không thể kết nối máy chủ — thay đổi đã được lưu tạm ngoại tuyến.', 'error');
    }
  }, [authUserId, executeTripPut, performSignOutAndClearCache, showToast, warnIfQuotaExceeded]);

  const handleKeepLocalConflict = async () => {
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
        lastSavedContentByTripIdRef.current[savedTrip.id] = getTripComparableJson(savedTrip);
        if (authUser) {
          const cacheAfter = clearTripPendingOfflineSync(authUser.id, savedTrip.id);
          if (cacheAfter) {
            setPendingSyncCount(cacheAfter.pendingSyncIds.length);
          }
        }
        setTrip(savedTrip);
        setConflictState(null);
        setFirebaseStatus('connected');
        showToast('Đã giữ bản chỉnh sửa của bạn và cập nhật lên máy chủ!', 'success');
      });
    } catch (err: any) {
      showToast(err?.message || 'Không thể ghi đè bản cục bộ lên máy chủ', 'error');
    } finally {
      setIsResolvingConflict(false);
    }
  };

  const handleUseServerConflict = () => {
    if (!conflictState) return;
    const serverTrip = normalizeTripData(conflictState.serverTrip);
    lastSavedContentByTripIdRef.current[serverTrip.id] = getTripComparableJson(serverTrip);
    if (typeof serverTrip.version === 'number') {
      latestServerVersionByTripIdRef.current[serverTrip.id] = serverTrip.version;
    }
    if (authUser) {
      const cacheAfter = clearTripPendingOfflineSync(authUser.id, serverTrip.id);
      if (cacheAfter) {
        setPendingSyncCount(cacheAfter.pendingSyncIds.length);
      }
    }
    setTrip(serverTrip);
    setConflictState(null);
    setFirebaseStatus('connected');
    showToast(`Đã áp dụng bản máy chủ (v${serverTrip.version ?? '?'}) thành công.`, 'info');
  };

  // Handler: Bật/tắt thông báo đẩy trình duyệt (Web Notification API)
  const handleToggleNotifications = useCallback(async () => {
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      window.localStorage.removeItem(ALERT_NOTIFY_PREF_KEY);
      showToast('Đã tắt thông báo đẩy trình duyệt.', 'info');
      return;
    }

    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
      showToast('Trình duyệt hiện tại không hỗ trợ Web Notification.', 'error');
      return;
    }

    try {
      const permission =
        Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        window.localStorage.setItem(ALERT_NOTIFY_PREF_KEY, '1');
        showToast('Đã bật thông báo đẩy khi phát hiện cảnh báo mới!', 'success');
      } else {
        setNotificationsEnabled(false);
        showToast('Trình duyệt đã chặn quyền gửi thông báo. Hãy cấp quyền trong cài đặt.', 'error');
      }
    } catch {
      showToast('Không thể yêu cầu quyền thông báo trên trình duyệt này.', 'error');
    }
  }, [notificationsEnabled, showToast]);

  // Handler: Tự động quét và cập nhật cảnh báo vận hành thời gian thực qua API server
  // Chỉ gộp alerts, weather và version; bỏ qua lượt quét tự động nếu đang sửa hoặc đang lưu để tránh mất chỉnh sửa
  const handleScanRealtimeAlerts = useCallback(async (silent = false) => {
    const activeTrip = latestTripRef.current;
    if (!activeTrip?.id || conflictState) return;

    const currentComparable = getTripComparableJson(activeTrip);
    const hasUnsavedEdits = currentComparable !== lastSavedContentByTripIdRef.current[activeTrip.id];

    if (silent && (saveQueueRef.current.isBusy || hasUnsavedEdits)) {
      return;
    }

    setIsScanningAlerts(true);
    const targetTripId = activeTrip.id;
    const previousAlertIds = new Set((activeTrip.alerts || []).map((a) => a.id));

    try {
      // Nếu ngoại tuyến -> tính cục bộ bằng bộ phát hiện quy tắc
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const detected = detectScheduleAndWeatherAlerts(activeTrip);
        const updated: TripData = { ...activeTrip, alerts: detected };
        await saveTripToFirestore(updated);
        if (!silent) {
          showToast(`Ngoại tuyến: Đã quét cục bộ ${detected.length} cảnh báo.`, 'info');
        }
        return;
      }

      const response = await authenticatedFetch(`/api/trips/${encodeURIComponent(targetTripId)}/scan-alerts`, {
        method: 'POST',
      });
      const result = await safeJsonResponse(response);
      if (!response.ok || !result.success || !result.trip) {
        throw new Error(result?.error || 'Không thể quét cảnh báo từ máy chủ');
      }

      const scannedTrip = normalizeTripData(result.trip);
      if (typeof scannedTrip.version === 'number') {
        latestServerVersionByTripIdRef.current[scannedTrip.id] = scannedTrip.version;
      }

      setTrip((prev) => {
        if (!prev || prev.id !== scannedTrip.id) return prev;
        const wasClean = getTripComparableJson(prev) === lastSavedContentByTripIdRef.current[scannedTrip.id];
        const merged = mergeAlertScanIntoTrip(prev, scannedTrip);
        if (wasClean) {
          lastSavedContentByTripIdRef.current[scannedTrip.id] = getTripComparableJson(merged);
        }
        return merged;
      });
      setFirebaseStatus('connected');

      const newlyDetected = (scannedTrip.alerts || []).filter((a) => !previousAlertIds.has(a.id));

      if (
        notificationsEnabled &&
        newlyDetected.length > 0 &&
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted'
      ) {
        const firstAlert = newlyDetected[0];
        new Notification(`Cảnh báo mới: ${scannedTrip.title}`, {
          body:
            newlyDetected.length === 1
              ? `${firstAlert.title} — ${firstAlert.description}`
              : `Phát hiện ${newlyDetected.length} cảnh báo vận hành/thời tiết mới (${firstAlert.title}...).`,
          icon: '/pwa-192x192.png',
        });
      }

      if (!silent) {
        showToast(
          `Đã quét máy chủ: ${scannedTrip.alerts.length} cảnh báo (Thời tiết ${scannedTrip.weather.temp}°C — ${scannedTrip.weather.description}).`,
          'success',
        );
      } else if (newlyDetected.length > 0) {
        showToast(`Phát hiện ${newlyDetected.length} cảnh báo vận hành mới!`, 'info');
      }
    } catch (error: any) {
      console.error('Scan alerts error:', error);
      if (!silent) {
        showToast(error?.message || 'Lỗi khi quét cảnh báo', 'error');
      }
    } finally {
      setIsScanningAlerts(false);
    }
  }, [conflictState, notificationsEnabled, saveTripToFirestore, showToast]);

  const latestScanRef = useRef(handleScanRealtimeAlerts);
  useEffect(() => {
    latestScanRef.current = handleScanRealtimeAlerts;
  }, [handleScanRealtimeAlerts]);

  // Tự động quét cảnh báo định kỳ mỗi 3 phút khi trực tuyến và đang mở chuyến đi
  useEffect(() => {
    if (!authUserId || !trip?.id || !isOnline || loadedTripUserId !== authUserId) return;
    const timer = window.setInterval(() => {
      void latestScanRef.current(true);
    }, PERIODIC_ALERT_SCAN_MS);
    return () => window.clearInterval(timer);
  }, [authUserId, trip?.id, isOnline, loadedTripUserId]);

  // Handler: Hoàn tác phương án tối ưu (Undo Optimization)
  const handleUndoOptimization = async () => {
    if (!lastOptimizedTripSnapshot) {
      showToast('Không có phương án nào để hoàn tác', 'info');
      return;
    }
    const previous = structuredClone(lastOptimizedTripSnapshot);
    setLastOptimizedTripSnapshot(null);
    setIsAIApplied(false);
    setTrip(previous);
    await saveTripToFirestore(previous, 'Đã hoàn tác phương án tối ưu thành công!');
  };

  // Handler: Mở modal chỉnh sửa thông tin chuyến đi
  const handleOpenEditTripModal = (tripTarget?: TripData) => {
    const resolved = tripTarget || trip;
    if (!resolved) return;
    setTripToEdit(resolved);
    setIsEditTripModalOpen(true);
  };

  // Handler: Lưu thông tin chuyến đi sau khi chỉnh sửa
  const handleSaveEditedTrip = async (updatedFields: Partial<TripData>) => {
    const target = tripToEdit || trip;
    if (!target) return;
    const merged: TripData = {
      ...target,
      ...updatedFields,
    };
    if (trip && target.id === trip.id) {
      await saveTripToFirestore(merged, 'Đã cập nhật thông tin chuyến đi thành công!');
    } else {
      try {
        await saveQueueRef.current.enqueue(async () => {
          const outcome = await executeTripPut(merged, { alignWithSessionVersion: true });
          if (outcome.status === 'conflict') {
            if (outcome.serverTrip) {
              setConflictState({ localTrip: outcome.localTrip, serverTrip: outcome.serverTrip });
              showToast('Phát hiện xung đột phiên bản — bản sửa của bạn vẫn được giữ nguyên.', 'info');
            } else {
              showToast('Xung đột phiên bản: Không thể cập nhật chuyến đi.', 'error');
            }
            return;
          }
          const finalMerged = outcome.savedTrip;
          lastSavedContentByTripIdRef.current[finalMerged.id] = getTripComparableJson(finalMerged);
          setTrips((prev) => prev.map((t) => (t.id === finalMerged.id ? finalMerged : t)));
          showToast('Đã cập nhật thông tin chuyến đi thành công!', 'success');
        });
      } catch (err: any) {
        showToast(err?.message || 'Không thể cập nhật chuyến đi', 'error');
      }
    }
    setIsEditTripModalOpen(false);
  };

  // Handler: Xóa chuyến đi (không tự bịa chuyến mẫu khi xóa hết)
  const handleDeleteTrip = async (tripId: string) => {
    try {
      const response = await authenticatedFetch(`/api/trips/${encodeURIComponent(tripId)}`, {
        method: 'DELETE',
      });
      const result = await safeJsonResponse(response);
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Lỗi khi xóa chuyến đi');
      }

      const nextTrips = trips.filter((t) => t.id !== tripId);
      setTrips(nextTrips);
      delete lastSavedContentByTripIdRef.current[tripId];

      if (trip?.id === tripId) {
        if (nextTrips.length > 0) {
          setTrip(nextTrips[0]);
          setCurrentDayIndex(nextTrips[0].currentDay || 1);
        } else if (result.activeTrip) {
          const fallbackActive = normalizeTripData(result.activeTrip);
          setTrip(fallbackActive);
          setTrips([fallbackActive]);
          setCurrentDayIndex(fallbackActive.currentDay || 1);
        } else {
          setTrip(null);
          setCurrentDayIndex(1);
        }
      }

      if (authUser) {
        clearTripPendingOfflineSync(authUser.id, tripId);
      }

      showToast(result.message || 'Đã xóa chuyến đi thành công', 'success');
    } catch (error: any) {
      console.error('Delete trip error:', error);
      showToast(error.message || 'Không thể xóa chuyến đi', 'error');
    }
  };

  // Handler: Nhân bản chuyến đi làm tour mẫu mới
  const handleCloneTrip = async (sourceTrip: TripData) => {
    const clonedPayload = cloneTripForTemplate(sourceTrip, authUser?.id);
    try {
      const response = await authenticatedFetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clonedPayload),
      });
      const result = await safeJsonResponse(response);
      if (!response.ok || !result.success || !result.trip) {
        throw new Error(result?.error || 'Không thể nhân bản chuyến đi');
      }

      const savedClone = normalizeTripData(result.trip);
      lastSavedContentByTripIdRef.current[savedClone.id] = getTripComparableJson(savedClone);
      setTrips((prev) => [savedClone, ...prev.filter((t) => t.id !== savedClone.id)]);
      setTrip(savedClone);
      setCurrentDayIndex(1);
      setIsAIApplied(false);
      showToast(`Đã nhân bản thành tour "${savedClone.title}"!`, 'success');
    } catch (error: any) {
      console.error('Clone trip error:', error);
      showToast(error?.message || 'Lỗi khi nhân bản chuyến đi', 'error');
    }
  };

  // Handler: Click vào điểm dừng (waypoint) trên bản đồ để mở hoạt động tương ứng
  const handleSelectWaypoint = (waypoint: Waypoint) => {
    if (!trip) return;
    const match = findMatchingActivityForWaypoint(trip, waypoint);
    if (match) {
      setCurrentDayIndex(match.dayIndex);
      setSelectedActivity(match.activity);
      setCurrentTab('schedule');
      showToast(`Đã mở chặng "${match.activity.title}" (Ngày ${match.dayIndex})`, 'info');
    } else {
      const timeRange = [waypoint.arrivalTime, waypoint.departureTime].filter(Boolean).join(' - ');
      showToast(
        `Điểm dừng "${waypoint.name}"${timeRange ? ` (${timeRange})` : ''} chưa gắn hoạt động chi tiết trong lịch trình.`,
        'info',
      );
    }
  };

  // Chức năng Lập lịch truyền thống & Lập lịch tự động
  const handleOpenTraditionalPlanner = () => {
    setPlannerInitialTab('traditional');
    setIsAIPlannerOpen(true);
  };

  const handleOpenAIPlanner = () => {
    setPlannerInitialTab('ai');
    setIsAIPlannerOpen(true);
  };

  const handleOpenAutoArrange = () => {
    if (!trip) return;
    setIsAutoArrangeOpen(true);
  };

  const handleApplyAutoArrangeDay = async (updatedDay: DaySchedule, message: string) => {
    if (!trip) return;
    const updatedDays = trip.days.map((d) => (d.dayIndex === updatedDay.dayIndex ? updatedDay : d));
    const allActs = updatedDays.flatMap((d) => d.activities);
    const confirmed = allActs.filter((a) => a.status === 'Hoàn tất' || a.status === 'Đã xác nhận').length;
    const pending = allActs.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra').length;
    const updatedTrip: TripData = {
      ...trip,
      days: updatedDays,
      confirmedActivities: confirmed,
      pendingActivities: pending,
    };
    await saveTripToFirestore(updatedTrip, message);
  };

  const handleApplyAutoArrangeTrip = async (updatedTrip: TripData, message: string) => {
    await saveTripToFirestore(updatedTrip, message);
  };

  const handleOpenAIOptimize = () => {
    if (!trip) return;
    setIsAIOptimizeOpen(true);
  };

  // Handler: Apply AI / Rule-based Optimization
  const handleApplyAIOptimization = async (
    actionTitle?: string,
    actionReason?: string,
    costSaved?: string,
    recommendationData?: any
  ) => {
    if (!trip) return;
    setLastOptimizedTripSnapshot(structuredClone(trip));

    const targetDayIndex =
      recommendationData?.targetDayIndex ??
      trip.days.find((d) => d.hasWarning || d.pendingCount > 0)?.dayIndex ??
      currentDayIndex;

    const scheduleChanges: any[] = Array.isArray(recommendationData?.scheduleChanges)
      ? recommendationData.scheduleChanges
      : [];

    let allChangedActivities: Activity[] = [];

    const updatedDays = trip.days.map((day) => {
      if (day.dayIndex === targetDayIndex) {
        const { updatedDay, changedActivities } = applyScheduleChangesStrict(
          day,
          scheduleChanges,
          actionTitle,
          actionReason,
        );
        allChangedActivities = changedActivities;
        return updatedDay;
      }
      return day;
    });

    const allActs = updatedDays.flatMap((d) => d.activities);
    const confirmed = allActs.filter((a) => a.status === 'Đã xác nhận' || a.status === 'Hoàn tất').length;
    const pending = allActs.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra').length;
    const totalActivityCosts = allActs.reduce((sum, a) => sum + (a.cost || 0), 0);
    const invoiceCosts = (trip.invoices || []).reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const newSpent = totalActivityCosts + invoiceCosts;
    const newRemaining = Math.max(0, trip.budgetTotal - newSpent);
    const newPercent = trip.budgetTotal > 0 ? Math.min(100, Math.round((newSpent / trip.budgetTotal) * 100)) : 0;

    const { remainingAlerts, resolvedAlerts } = filterAlertsByRecommendation(
      trip.alerts,
      recommendationData || { actionTitle, reason: actionReason, scheduleChanges },
      allChangedActivities,
      targetDayIndex,
    );

    const updatedTrip: TripData = {
      ...trip,
      alerts: remainingAlerts,
      days: updatedDays,
      budgetUsed: newSpent,
      budgetRemaining: newRemaining,
      budgetUsedPercent: newPercent,
      aiSavingsEstimate: costSaved || trip.aiSavingsEstimate || '',
      confirmedActivities: confirmed,
      pendingActivities: pending,
    };

    setIsAIApplied(true);
    await saveTripToFirestore(updatedTrip);

    showToast(
      `Đã áp dụng điều phối Ngày ${targetDayIndex} (đã xử lý ${resolvedAlerts.length} cảnh báo)!`,
      'success',
      'Hoàn tác',
      () => void handleUndoOptimization(),
    );
  };

  // Handler: Add Activity
  const handleAddActivity = async (newAct: Activity, targetDayIndex?: number) => {
    if (!trip) return;
    const dayTarget = targetDayIndex ?? currentDayIndex;
    let dayMatched = false;
    const updatedDays = trip.days.map((d) => {
      if (d.dayIndex === dayTarget) {
        dayMatched = true;
        const newActivities = [...d.activities, newAct];
        return {
          ...d,
          activities: newActivities,
          confirmedCount: newActivities.filter((a) => a.status === 'Đã xác nhận' || a.status === 'Hoàn tất').length,
          pendingCount: newActivities.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra').length,
        };
      }
      return d;
    });

    if (!dayMatched && updatedDays.length > 0) {
      const firstDayActs = [...updatedDays[0].activities, newAct];
      updatedDays[0] = {
        ...updatedDays[0],
        activities: firstDayActs,
        confirmedCount: firstDayActs.filter((a) => a.status === 'Đã xác nhận' || a.status === 'Hoàn tất').length,
        pendingCount: firstDayActs.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra').length,
      };
    }

    const allActs = updatedDays.flatMap((d) => d.activities);
    const totalActivityCosts = allActs.reduce((sum, a) => sum + (a.cost || 0), 0);
    const invoiceCosts = (trip.invoices || []).reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const newSpent = totalActivityCosts + invoiceCosts;
    const newRemaining = Math.max(0, trip.budgetTotal - newSpent);
    const newPercent = trip.budgetTotal > 0 ? Math.min(100, Math.round((newSpent / trip.budgetTotal) * 100)) : 0;
    const confirmed = allActs.filter((a) => a.status === 'Hoàn tất' || a.status === 'Đã xác nhận').length;
    const pending = allActs.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra').length;

    const updatedTrip: TripData = {
      ...trip,
      totalActivities: allActs.length,
      confirmedActivities: confirmed,
      pendingActivities: pending,
      budgetUsed: newSpent,
      budgetRemaining: newRemaining,
      budgetUsedPercent: newPercent,
      days: updatedDays,
    };

    await saveTripToFirestore(updatedTrip, `Đã thêm hoạt động "${newAct.title}"!`);
  };

  // Handler: Add New Day
  const handleAddDay = async () => {
    if (!trip) return;
    const nextDayIndex = trip.days.length > 0 ? Math.max(...trip.days.map((d) => d.dayIndex)) + 1 : 1;
    const dayNamesCycle = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    const dayName = dayNamesCycle[(nextDayIndex - 1) % 7];
    const newDay = {
      dayIndex: nextDayIndex,
      dateLabel: `${dayName} ${nextDayIndex}`,
      dayName,
      dateNum: nextDayIndex,
      fullDate: `Ngày ${nextDayIndex}`,
      confirmedCount: 0,
      pendingCount: 0,
      dispatcherNote: 'Chặng mới được thêm vào lịch trình',
      activities: [],
    };
    const updatedDays = [...trip.days, newDay];
    const updatedTrip: TripData = {
      ...trip,
      totalDays: updatedDays.length,
      days: updatedDays,
    };
    setCurrentDayIndex(nextDayIndex);
    await saveTripToFirestore(updatedTrip, `Đã thêm Ngày ${nextDayIndex} vào lịch trình!`);
  };

  // Handler: Delete Day
  const handleDeleteDay = async (dayIndexToDelete: number) => {
    if (!trip) return;
    if (trip.days.length <= 1) {
      showToast('Hành trình cần ít nhất 1 ngày!', 'error');
      return;
    }
    const updatedDays = trip.days
      .filter((d) => d.dayIndex !== dayIndexToDelete)
      .map((d, idx) => ({
        ...d,
        dayIndex: idx + 1,
      }));
    const allActs = updatedDays.flatMap((d) => d.activities);
    const totalActivityCosts = allActs.reduce((sum, a) => sum + (a.cost || 0), 0);
    const invoiceCosts = (trip.invoices || []).reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const newSpent = totalActivityCosts + invoiceCosts;
    const newRemaining = Math.max(0, trip.budgetTotal - newSpent);
    const newPercent = trip.budgetTotal > 0 ? Math.min(100, Math.round((newSpent / trip.budgetTotal) * 100)) : 0;

    const updatedTrip: TripData = {
      ...trip,
      totalDays: updatedDays.length,
      days: updatedDays,
      totalActivities: allActs.length,
      confirmedActivities: allActs.filter((a) => a.status === 'Hoàn tất' || a.status === 'Đã xác nhận').length,
      pendingActivities: allActs.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra').length,
      budgetUsed: newSpent,
      budgetRemaining: newRemaining,
      budgetUsedPercent: newPercent,
      currentDay: Math.min(currentDayIndex, updatedDays.length),
    };
    setCurrentDayIndex((prev) => Math.min(prev, updatedDays.length));
    await saveTripToFirestore(updatedTrip, `Đã xóa Ngày ${dayIndexToDelete} khỏi lịch trình!`);
  };

  // Handler: Update Day Note
  const handleUpdateDayNote = async (dayIndex: number, note: string) => {
    if (!trip) return;
    const updatedDays = trip.days.map((d) => (d.dayIndex === dayIndex ? { ...d, dispatcherNote: note } : d));
    const updatedTrip: TripData = { ...trip, days: updatedDays };
    await saveTripToFirestore(updatedTrip, `Đã lưu ghi chú Ngày ${dayIndex}!`);
  };

  // Handler: Update Activity status
  const handleUpdateActivityStatus = async (id: string, newStatus: Activity['status']) => {
    if (!trip) return;
    let activityTitle = '';
    const updatedDays = trip.days.map((d) => ({
      ...d,
      activities: d.activities.map((a) => {
        if (a.id === id) {
          activityTitle = a.title;
          return { ...a, status: newStatus };
        }
        return a;
      }),
    }));

    const allActs = updatedDays.flatMap((d) => d.activities);
    const confirmed = allActs.filter((a) => a.status === 'Hoàn tất' || a.status === 'Đã xác nhận').length;
    const pending = allActs.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra').length;

    const updatedTrip: TripData = {
      ...trip,
      confirmedActivities: confirmed,
      pendingActivities: pending,
      days: updatedDays,
    };

    await saveTripToFirestore(
      updatedTrip,
      `Đã chuyển "${activityTitle || 'Hoạt động'}" sang "${newStatus}"!`,
    );
  };

  // Handler: Delete Activity
  const handleDeleteActivity = async (id: string) => {
    if (!trip) return;
    let deletedTitle = '';
    const updatedDays = trip.days.map((d) => {
      const remaining = d.activities.filter((a) => {
        if (a.id === id) {
          deletedTitle = a.title;
          return false;
        }
        return true;
      });
      return { ...d, activities: remaining };
    });

    const allActs = updatedDays.flatMap((d) => d.activities);
    const confirmed = allActs.filter((a) => a.status === 'Hoàn tất' || a.status === 'Đã xác nhận').length;
    const pending = allActs.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra').length;
    const totalActivityCosts = allActs.reduce((sum, a) => sum + (a.cost || 0), 0);
    const invoiceCosts = (trip.invoices || []).reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const newSpent = totalActivityCosts + invoiceCosts;
    const newRemaining = Math.max(0, trip.budgetTotal - newSpent);
    const newPercent = trip.budgetTotal > 0 ? Math.min(100, Math.round((newSpent / trip.budgetTotal) * 100)) : 0;

    const updatedTrip: TripData = {
      ...trip,
      totalActivities: allActs.length,
      confirmedActivities: confirmed,
      pendingActivities: pending,
      budgetUsed: newSpent,
      budgetRemaining: newRemaining,
      budgetUsedPercent: newPercent,
      days: updatedDays,
    };

    await saveTripToFirestore(
      updatedTrip,
      `Đã xóa hoạt động "${deletedTitle || id}"!`,
    );
  };

  // Handler: Edit Activity
  const handleEditActivity = async (updatedActivity: Activity) => {
    if (!trip) return;
    const updatedDays = trip.days.map((d) => ({
      ...d,
      activities: d.activities.map((a) => (a.id === updatedActivity.id ? updatedActivity : a)),
    }));

    const allActs = updatedDays.flatMap((d) => d.activities);
    const confirmed = allActs.filter((a) => a.status === 'Hoàn tất' || a.status === 'Đã xác nhận').length;
    const pending = allActs.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra').length;
    const totalActivityCosts = allActs.reduce((sum, a) => sum + (a.cost || 0), 0);
    const invoiceCosts = (trip.invoices || []).reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const newSpent = totalActivityCosts + invoiceCosts;
    const newRemaining = Math.max(0, trip.budgetTotal - newSpent);
    const newPercent = trip.budgetTotal > 0 ? Math.min(100, Math.round((newSpent / trip.budgetTotal) * 100)) : 0;

    const updatedTrip: TripData = {
      ...trip,
      totalActivities: allActs.length,
      confirmedActivities: confirmed,
      pendingActivities: pending,
      budgetUsed: newSpent,
      budgetRemaining: newRemaining,
      budgetUsedPercent: newPercent,
      days: updatedDays,
    };

    await saveTripToFirestore(
      updatedTrip,
      `Đã cập nhật hoạt động "${updatedActivity.title}"!`,
    );
  };

  // Handler: Toggle Member Attendance
  const handleToggleMemberAttendance = async (id: string) => {
    if (!trip) return;
    const member = trip.members.find((item) => item.id === id);
    if (!member) return;

    const attendanceStatus: TripMember['attendanceStatus'] = member.attendanceStatus === 'Có mặt' ? 'Vắng mặt' : 'Có mặt';
    const tripId = trip.id;
    const optimisticMembers = trip.members.map((item) => (item.id === id ? { ...item, attendanceStatus } : item));
    const optimisticPresent = optimisticMembers.filter((item) => item.attendanceStatus === 'Có mặt').length;
    const optimisticTrip: TripData = {
      ...trip,
      members: optimisticMembers,
      membersTotal: optimisticMembers.length,
      membersOnline: optimisticMembers.filter((m) => m.status === 'online').length,
      membersStatus: `${optimisticPresent}/${optimisticMembers.length} đã điểm danh`,
    };

    try {
      await saveQueueRef.current.enqueue(async () => {
        const versionToUse = latestServerVersionByTripIdRef.current[tripId] ?? trip.version;
        const response = await authenticatedFetch(
          `/api/trips/${encodeURIComponent(tripId)}/members/${encodeURIComponent(id)}/attendance`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ attendanceStatus, version: versionToUse }),
          },
        );
        const result = await safeJsonResponse(response);
        if (response.status === 401 || response.status === 403) {
          throw new AuthSessionError(response.status, result?.error || undefined);
        }
        if (response.status === 409) {
          const freshNormalized = await fetchServerTripSnapshot(tripId);
          if (freshNormalized) {
            if (typeof freshNormalized.version === 'number') {
              latestServerVersionByTripIdRef.current[freshNormalized.id] = freshNormalized.version;
            }
            if (getTripComparableJson(optimisticTrip) === getTripComparableJson(freshNormalized)) {
              lastSavedContentByTripIdRef.current[freshNormalized.id] = getTripComparableJson(freshNormalized);
              setTrip(freshNormalized);
              return;
            }
            setTrip(optimisticTrip);
            setConflictState({ localTrip: optimisticTrip, serverTrip: freshNormalized });
            showToast('Phát hiện xung đột điểm danh với máy chủ — hãy chọn phiên bản muốn giữ.', 'info');
            return;
          }
          throw new Error(result?.error || 'Xung đột phiên bản điểm danh');
        }
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Không thể lưu điểm danh');
        }

        if (typeof result.version === 'number') {
          latestServerVersionByTripIdRef.current[tripId] = result.version;
        }

        setTrip((prev) => {
          if (!prev || prev.id !== tripId) return prev;
          const prevWasClean = getTripComparableJson(prev) === lastSavedContentByTripIdRef.current[tripId];
          const members = prev.members.map((item) => (item.id === id ? { ...item, attendanceStatus } : item));
          const presentCount = members.filter((item) => item.attendanceStatus === 'Có mặt').length;
          const nextTrip: TripData = {
            ...prev,
            members,
            membersTotal: members.length,
            membersOnline: members.filter((m) => m.status === 'online').length,
            membersStatus: `${presentCount}/${members.length} đã điểm danh`,
            ...(typeof result.version === 'number' ? { version: result.version } : {}),
          };
          // Chỉ cập nhật mốc đã lưu khi state trước đó chưa có thay đổi nào khác đang chờ autosave,
          // tránh đánh dấu nhầm các sửa đổi đang nhập là "đã lưu".
          if (prevWasClean) {
            lastSavedContentByTripIdRef.current[tripId] = getTripComparableJson(nextTrip);
          }
          return nextTrip;
        });
        showToast(`Đã lưu điểm danh: ${member.name} (${attendanceStatus})`, 'success');
      });
    } catch (error) {
      if (error instanceof AuthSessionError) {
        await performSignOutAndClearCache(authUserId);
        showToast('Phiên đăng nhập không hợp lệ hoặc tài khoản đã bị vô hiệu hóa.', 'error');
        return;
      }
      console.warn('PATCH điểm danh thất bại, chuyển sang lưu toàn bộ chuyến đi:', error);
      await saveTripToFirestore(
        optimisticTrip,
        `Đã lưu điểm danh: ${member.name} (${attendanceStatus})`,
      );
    }
  };

  // Handler: Update Trip Budget
  const handleUpdateTripBudget = async (updatedTrip: TripData) => {
    await saveTripToFirestore(updatedTrip, 'Đã cập nhật ngân sách và chứng từ chuyến đi!');
  };

  // Handler: Update Trip Members list
  const handleUpdateMembers = async (updatedMembers: TripMember[]) => {
    if (!trip) return;
    const presentCount = updatedMembers.filter((item) => item.attendanceStatus === 'Có mặt').length;
    const membersStatus = `${presentCount}/${updatedMembers.length} đã điểm danh`;

    const drivers = updatedMembers.filter((m) => m.role === 'Tài xế');
    const wasLinked = Boolean(trip.telematics.driverMemberId);
    const noDriverYet = !trip.telematics.driver || trip.telematics.driver === 'Chưa phân công';
    const assigned =
      drivers.find((m) => m.id === trip.telematics.driverMemberId) ||
      drivers.find((m) => m.name === trip.telematics.driver) ||
      (wasLinked || noDriverYet ? drivers[0] : undefined);

    const { driverMemberId: _previousDriverId, ...baseTelematics } = trip.telematics;
    let telematics: TripData['telematics'] = trip.telematics;
    if (assigned) {
      telematics = { ...baseTelematics, driver: assigned.name, driverPhone: assigned.phone, driverMemberId: assigned.id };
    } else if (wasLinked) {
      telematics = { ...baseTelematics, driver: 'Chưa phân công', driverPhone: '' };
    }

    const updatedTrip: TripData = {
      ...trip,
      members: updatedMembers,
      membersStatus,
      membersTotal: updatedMembers.length,
      membersOnline: updatedMembers.filter((m) => m.status === 'online').length,
      telematics,
    };
    await saveTripToFirestore(updatedTrip, 'Đã cập nhật danh sách thành viên!');
  };

  // Handler: Update General Trip Data
  const handleUpdateTrip = async (updatedTrip: TripData, message?: string) => {
    await saveTripToFirestore(updatedTrip, message || 'Đã đồng bộ dữ liệu chuyến đi!');
  };

  // Handler: Dismiss Alert
  const handleDismissAlert = async (id: string) => {
    if (!trip) return;
    const updatedTrip: TripData = {
      ...trip,
      alerts: trip.alerts.filter((a) => a.id !== id),
    };
    await saveTripToFirestore(updatedTrip);
  };

  // Handler: Select Trip
  const handleSelectTrip = (selectedTrip: TripData) => {
    const latestFromList = trips.find((t) => t.id === selectedTrip.id) || selectedTrip;
    setTrip(latestFromList);
    setCurrentDayIndex(latestFromList.currentDay || 1);
    setCurrentTab('dashboard');
  };

  const handleApplyGeneratedTrip = async (newTrip: TripData) => {
    const response = await authenticatedFetch('/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTrip),
    });
    const result = await safeJsonResponse(response);
    if (response.status === 413) {
      throw new PayloadTooLargeError(result?.error || undefined);
    }
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Không thể lưu chuyến đi mới');
    }

    const savedTrip = normalizeTripData(result.trip);
    lastSavedContentByTripIdRef.current[savedTrip.id] = getTripComparableJson(savedTrip);
    if (typeof savedTrip.version === 'number') {
      latestServerVersionByTripIdRef.current[savedTrip.id] = savedTrip.version;
    }
    setTrips((prev) => [savedTrip, ...prev.filter((item) => item.id !== savedTrip.id)]);
    setTrip(savedTrip);
    setCurrentDayIndex(1);
    setIsAIApplied(false);
    setCurrentTab('dashboard');
    showToast(`Đã tạo chuyến đi ${savedTrip.title} thành công!`, 'success');
  };


  const handleLogout = async () => {
    const hasUnsavedCurrentTrip = Boolean(
      trip?.id && getTripComparableJson(trip) !== lastSavedContentByTripIdRef.current[trip.id],
    );
    if (pendingSyncCount > 0 || hasUnsavedCurrentTrip || conflictState) {
      setIsLogoutConfirmOpen(true);
      return;
    }
    await performSignOutAndClearCache();
  };

  const handleSyncAndLogout = async () => {
    if (!authUser) {
      await performSignOutAndClearCache();
      return;
    }
    setIsSyncingBeforeLogout(true);
    try {
      await syncPendingOfflineTrips();
      const cache = loadOfflineTripsCache(authUser.id);
      if (!cache || cache.pendingSyncIds.length === 0) {
        await performSignOutAndClearCache();
      } else {
        showToast('Vẫn còn dữ liệu chưa thể đồng bộ. Vui lòng xử lý xung đột hoặc xác nhận đăng xuất.', 'info');
      }
    } finally {
      setIsSyncingBeforeLogout(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-sm text-slate-300">
        Đang kiểm tra phiên đăng nhập...
      </div>
    );
  }

  if (!authUser) {
    return <AuthScreen />;
  }

  return (
    <>
      {authUser.role === 'admin' ? (
        <AdminDashboard
          trip={trip}
          trips={trips}
          tripsLoaded={tripsLoaded}
          onSelectTrip={handleSelectTrip}
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          currentDayIndex={currentDayIndex}
          setCurrentDayIndex={setCurrentDayIndex}
          filterMode={filterMode}
          setFilterMode={setFilterMode}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          firebaseStatus={firebaseStatus}
          isAIApplied={isAIApplied}
          authUser={authUser}
          onLogout={handleLogout}
          onOpenAccount={() => setIsAccountModalOpen(true)}
          isAdminMode={isAdminMode}
          isAIPlannerOpen={isAIPlannerOpen}
          setIsAIPlannerOpen={setIsAIPlannerOpen}
          isAIOptimizeOpen={isAIOptimizeOpen}
          setIsAIOptimizeOpen={setIsAIOptimizeOpen}
          isAddActivityOpen={isAddActivityOpen}
          setIsAddActivityOpen={setIsAddActivityOpen}
          isAlertsModalOpen={isAlertsModalOpen}
          setIsAlertsModalOpen={setIsAlertsModalOpen}
          selectedActivity={selectedActivity}
          setSelectedActivity={setSelectedActivity}
          handleSelectTab={handleSelectTab}
          handleApplyGeneratedTrip={handleApplyGeneratedTrip}
          handleApplyAIOptimization={handleApplyAIOptimization}
          handleAddActivity={handleAddActivity}
          handleUpdateActivityStatus={handleUpdateActivityStatus}
          handleDeleteActivity={handleDeleteActivity}
          handleEditActivity={handleEditActivity}
          handleAddDay={handleAddDay}
          handleDeleteDay={handleDeleteDay}
          handleUpdateDayNote={handleUpdateDayNote}
          handleToggleMemberAttendance={handleToggleMemberAttendance}
          handleUpdateMembers={handleUpdateMembers}
          handleUpdateTrip={handleUpdateTrip}
          handleDismissAlert={handleDismissAlert}
          handleUpdateTripBudget={handleUpdateTripBudget}
          canUndo={!!lastOptimizedTripSnapshot}
          onUndo={handleUndoOptimization}
          onOpenEditTripModal={handleOpenEditTripModal}
          onDeleteTrip={handleDeleteTrip}
          onCloneTrip={handleCloneTrip}
          onSelectWaypoint={handleSelectWaypoint}
          onScanAlerts={() => handleScanRealtimeAlerts(false)}
          isScanningAlerts={isScanningAlerts}
          notificationsEnabled={notificationsEnabled}
          onToggleNotifications={() => void handleToggleNotifications()}
          pendingSyncCount={pendingSyncCount}
          cachedAt={cachedAt}
          onRetryOfflineSync={() => void syncPendingOfflineTrips()}
          onOpenAIPlanner={handleOpenAIPlanner}
          onOpenAIOptimize={handleOpenAIOptimize}
          onOpenAutoArrange={handleOpenAutoArrange}
          onOpenTraditionalPlanner={handleOpenTraditionalPlanner}
        />
      ) : (
        <UserDashboard
          trip={trip}
          trips={trips}
          tripsLoaded={tripsLoaded}
          onSelectTrip={handleSelectTrip}
          currentTab={currentTab}
          currentDayIndex={currentDayIndex}
          setCurrentDayIndex={setCurrentDayIndex}
          filterMode={filterMode}
          setFilterMode={setFilterMode}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          firebaseStatus={firebaseStatus}
          authUser={authUser}
          onLogout={handleLogout}
          onOpenAccount={() => setIsAccountModalOpen(true)}
          setCurrentTab={setCurrentTab}
          setSelectedActivity={setSelectedActivity}
          selectedActivity={selectedActivity}
          handleUpdateActivityStatus={handleUpdateActivityStatus}
          handleDeleteActivity={handleDeleteActivity}
          handleEditActivity={handleEditActivity}
          handleAddDay={handleAddDay}
          handleDeleteDay={handleDeleteDay}
          handleUpdateDayNote={handleUpdateDayNote}
          handleToggleMemberAttendance={handleToggleMemberAttendance}
          handleUpdateMembers={handleUpdateMembers}
          handleUpdateTrip={handleUpdateTrip}
          isAIPlannerOpen={isAIPlannerOpen}
          setIsAIPlannerOpen={setIsAIPlannerOpen}
          isAIOptimizeOpen={isAIOptimizeOpen}
          setIsAIOptimizeOpen={setIsAIOptimizeOpen}
          isAddActivityOpen={isAddActivityOpen}
          setIsAddActivityOpen={setIsAddActivityOpen}
          isAlertsModalOpen={isAlertsModalOpen}
          setIsAlertsModalOpen={setIsAlertsModalOpen}
          handleDismissAlert={handleDismissAlert}
          isAIApplied={isAIApplied}
          handleApplyGeneratedTrip={handleApplyGeneratedTrip}
          handleApplyAIOptimization={handleApplyAIOptimization}
          handleAddActivity={handleAddActivity}
          handleUpdateTripBudget={handleUpdateTripBudget}
          canUndo={!!lastOptimizedTripSnapshot}
          onUndo={handleUndoOptimization}
          onOpenEditTripModal={handleOpenEditTripModal}
          onDeleteTrip={handleDeleteTrip}
          onCloneTrip={handleCloneTrip}
          onSelectWaypoint={handleSelectWaypoint}
          onScanAlerts={() => handleScanRealtimeAlerts(false)}
          isScanningAlerts={isScanningAlerts}
          notificationsEnabled={notificationsEnabled}
          onToggleNotifications={() => void handleToggleNotifications()}
          pendingSyncCount={pendingSyncCount}
          cachedAt={cachedAt}
          onRetryOfflineSync={() => void syncPendingOfflineTrips()}
          onOpenAIPlanner={handleOpenAIPlanner}
          onOpenAIOptimize={handleOpenAIOptimize}
          onOpenAutoArrange={handleOpenAutoArrange}
          onOpenTraditionalPlanner={handleOpenTraditionalPlanner}
        />
      )}

      {/* Modal Lập lịch trình Đa năng */}
      <TripPlannerModal
        isOpen={isAIPlannerOpen}
        onClose={() => setIsAIPlannerOpen(false)}
        onApplyPlan={handleApplyGeneratedTrip}
        initialTab={plannerInitialTab}
      />

      {/* Modal Tự động Xếp lịch & Cân bằng thời gian */}
      {isAutoArrangeOpen && trip && (
        <AutoArrangeModal
          isOpen={isAutoArrangeOpen}
          onClose={() => setIsAutoArrangeOpen(false)}
          currentDay={trip.days.find((d) => d.dayIndex === currentDayIndex) || trip.days[0]}
          trip={trip}
          onApplyDay={handleApplyAutoArrangeDay}
          onApplyTrip={handleApplyAutoArrangeTrip}
        />
      )}

      {/* Modal Chỉnh sửa thông tin chuyến đi */}
      {isEditTripModalOpen && tripToEdit && (
        <EditTripModal
          isOpen={isEditTripModalOpen}
          onClose={() => setIsEditTripModalOpen(false)}
          trip={tripToEdit}
          onSave={handleSaveEditedTrip}
        />
      )}

      {/* Modal Quản lý tài khoản */}
      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        authUser={authUser}
        onProfileUpdated={(newName) => {
          setAuthUser((prev) => (prev ? { ...prev, name: newName } : prev));
        }}
        onAccountDeleted={() => {
          setIsAccountModalOpen(false);
          void performSignOutAndClearCache(authUserId);
        }}
        onShowToast={(text, type) => showToast(text, type)}
      />

      {/* Modal xử lý xung đột đồng bộ phiên bản (409) */}
      <SyncConflictModal
        localTrip={conflictState?.localTrip || null}
        serverTrip={conflictState?.serverTrip || null}
        isResolving={isResolvingConflict}
        onKeepLocal={() => void handleKeepLocalConflict()}
        onUseServer={handleUseServerConflict}
        onDismiss={() => setConflictState(null)}
      />

      {/* Modal cảnh báo khi đăng xuất còn dữ liệu ngoại tuyến chưa đồng bộ */}
      {isLogoutConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-rose-200 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 bg-rose-600 text-white flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div>
                <h3 className="text-sm font-extrabold">Cảnh báo dữ liệu chưa đồng bộ</h3>
                <p className="text-[11px] text-rose-100">Đăng xuất sẽ xóa bộ nhớ đệm ngoại tuyến trên máy</p>
              </div>
            </div>
            <div className="p-5 space-y-4 text-xs text-slate-700 leading-relaxed">
              <p>
                Hiện vẫn còn <strong>{Math.max(1, pendingSyncCount)} thay đổi</strong> đang lưu tạm trên thiết bị chưa được đồng bộ lên máy chủ. Để tránh lộ dữ liệu đoàn khách và ảnh chứng từ, thao tác đăng xuất sẽ xóa sạch cache ngoại tuyến khỏi trình duyệt này.
              </p>
              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsLogoutConfirmOpen(false)}
                  disabled={isSyncingBeforeLogout}
                  className="px-3.5 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Hủy
                </button>
                {isOnline && (
                  <button
                    type="button"
                    onClick={() => void handleSyncAndLogout()}
                    disabled={isSyncingBeforeLogout}
                    className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold transition disabled:opacity-50"
                  >
                    {isSyncingBeforeLogout ? 'Đang đồng bộ...' : 'Đồng bộ rồi đăng xuất'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void performSignOutAndClearCache()}
                  disabled={isSyncingBeforeLogout}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition disabled:opacity-50"
                >
                  Vẫn đăng xuất &amp; Xóa cache
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-xs font-bold transition-all duration-300 backdrop-blur-md bg-slate-900/95 text-white border-slate-700 animate-in fade-in slide-in-from-bottom-2"
        >
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              toastMessage.type === 'error'
                ? 'bg-rose-500'
                : 'bg-emerald-400 animate-pulse'
            }`}
          />
          <span className="flex-1">{toastMessage.text}</span>
          {toastMessage.onAction && (
            <button
              onClick={() => {
                toastMessage.onAction?.();
                setToastMessage(null);
              }}
              className="ml-2 px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-extrabold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{toastMessage.actionLabel || 'Hoàn tác'}</span>
            </button>
          )}
        </div>
      )}
    </>
  );
}
