import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { authenticatedFetch, safeJsonResponse } from '../api';
import { normalizeTripData } from '../utils/trip/normalizeTripData';
import type { TripData } from '../types/travel';
import { detectScheduleAndWeatherAlerts } from '../utils/schedule/alertDetector';
import { getTripComparableJson } from '../utils/trip/tripRepository';
import { mergeAlertScanIntoTrip, type SingleFlightQueue } from '../utils/trip/tripSyncHelpers';

const ALERT_NOTIFY_PREF_KEY = 'voyager_alerts_notify';
const PERIODIC_ALERT_SCAN_MS = 3 * 60 * 1000;

interface UseRealtimeAlertScannerOptions {
  authUserId: string | null;
  activeTripId: string | undefined;
  canScanAlerts?: boolean;
  isOnline: boolean;
  loadedTripUserId: string | null;
  hasConflict: boolean;
  latestTripRef: MutableRefObject<TripData | null>;
  lastSavedContentByTripIdRef: MutableRefObject<Record<string, string>>;
  latestServerVersionByTripIdRef: MutableRefObject<Record<string, number>>;
  saveQueueRef: MutableRefObject<SingleFlightQueue>;
  setTrip: Dispatch<SetStateAction<TripData | null>>;
  setFirebaseStatus: (status: 'loading' | 'connected' | 'error') => void;
  saveTripToFirestore: (updatedTrip: TripData, successMessage?: string) => Promise<void | boolean>;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export function useRealtimeAlertScanner({
  authUserId,
  activeTripId,
  canScanAlerts = true,
  isOnline,
  loadedTripUserId,
  hasConflict,
  latestTripRef,
  lastSavedContentByTripIdRef,
  latestServerVersionByTripIdRef,
  saveQueueRef,
  setTrip,
  setFirebaseStatus,
  saveTripToFirestore,
  showToast,
}: UseRealtimeAlertScannerOptions) {
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return false;
    return Notification.permission === 'granted' && window.localStorage.getItem(ALERT_NOTIFY_PREF_KEY) === '1';
  });
  const [isScanningAlerts, setIsScanningAlerts] = useState<boolean>(false);

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

  const handleScanRealtimeAlerts = useCallback(async (silent = false) => {
    const activeTrip = latestTripRef.current;
    if (!activeTrip?.id || hasConflict) return;
    if (!canScanAlerts) {
      if (!silent) {
        showToast('Chỉ chủ chuyến đi mới có quyền quét và lưu cảnh báo.', 'info');
      }
      return;
    }

    const currentComparable = getTripComparableJson(activeTrip);
    const hasUnsavedEdits = currentComparable !== lastSavedContentByTripIdRef.current[activeTrip.id];

    if (silent && (saveQueueRef.current.isBusy || hasUnsavedEdits)) {
      return;
    }

    setIsScanningAlerts(true);
    const targetTripId = activeTrip.id;
    const previousAlertIds = new Set((activeTrip.alerts || []).map((a) => a.id));

    try {
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
          icon: '/favicon.png',
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
  }, [
    canScanAlerts,
    hasConflict,
    lastSavedContentByTripIdRef,
    latestServerVersionByTripIdRef,
    latestTripRef,
    notificationsEnabled,
    saveQueueRef,
    saveTripToFirestore,
    setFirebaseStatus,
    setTrip,
    showToast,
  ]);

  const latestScanRef = useRef(handleScanRealtimeAlerts);
  useEffect(() => {
    latestScanRef.current = handleScanRealtimeAlerts;
  }, [handleScanRealtimeAlerts]);

  useEffect(() => {
    if (!authUserId || !activeTripId || !canScanAlerts || !isOnline || loadedTripUserId !== authUserId) return;
    const timer = window.setInterval(() => {
      void latestScanRef.current(true);
    }, PERIODIC_ALERT_SCAN_MS);
    return () => window.clearInterval(timer);
  }, [authUserId, activeTripId, canScanAlerts, isOnline, loadedTripUserId]);

  return {
    notificationsEnabled,
    isScanningAlerts,
    handleToggleNotifications,
    handleScanRealtimeAlerts,
  };
}
