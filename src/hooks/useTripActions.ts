import { useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { authenticatedFetch, safeJsonResponse } from '../api';
import { normalizeTripData } from '../data/normalizeTripData';
import type { Activity, DaySchedule, TripData, TripMember, Waypoint } from '../types/travel';
import { applyScheduleChangesStrict, filterAlertsByRecommendation } from '../utils/applyOptimization';
import { clearTripPendingOfflineSync } from '../utils/offlineStorage';
import { cloneTripForTemplate, findMatchingActivityForWaypoint } from '../utils/tripHelpers';
import { getTripComparableJson } from '../utils/tripRepository';
import { AuthSessionError, PayloadTooLargeError, type SingleFlightQueue } from '../utils/tripSyncHelpers';

interface UseTripActionsOptions {
  trip: TripData | null;
  trips: TripData[];
  authUserId: string | null;
  currentDayIndex: number;
  setTrip: Dispatch<SetStateAction<TripData | null>>;
  setTrips: Dispatch<SetStateAction<TripData[]>>;
  setCurrentDayIndex: Dispatch<SetStateAction<number>>;
  setCurrentTab: (tab: string) => void;
  setSelectedActivity: (activity: Activity | null) => void;
  tripToEdit: TripData | null;
  setTripToEdit: (trip: TripData | null) => void;
  setIsEditTripModalOpen: (open: boolean) => void;
  setIsAIPlannerOpen: (open: boolean) => void;
  setPlannerInitialTab: (tab: 'traditional' | 'ai') => void;
  setIsAutoArrangeOpen: (open: boolean) => void;
  setIsAIOptimizeOpen: (open: boolean) => void;
  saveTripToFirestore: (updatedTrip: TripData, successMessage?: string) => Promise<void>;
  executeTripPut: (
    candidateTrip: TripData,
    options?: {
      forceServerVersion?: number;
      alignWithSessionVersion?: boolean;
      onPreparedTrip?: (prepared: TripData) => void;
    },
  ) => Promise<
    | { status: 'ok'; savedTrip: TripData; version?: number }
    | { status: 'conflict'; localTrip: TripData; serverTrip: TripData | null }
  >;
  fetchServerTripSnapshot: (tripId: string) => Promise<TripData | null>;
  ensureFullTrip: (tripOrId: TripData | string) => Promise<TripData | null>;
  performSignOutAndClearCache: (uidOverride?: string | null) => Promise<void>;
  setConflictState: Dispatch<SetStateAction<{ localTrip: TripData; serverTrip: TripData } | null>>;
  saveQueueRef: MutableRefObject<SingleFlightQueue>;
  lastSavedContentByTripIdRef: MutableRefObject<Record<string, string>>;
  latestServerVersionByTripIdRef: MutableRefObject<Record<string, number>>;
  showToast: (
    text: string,
    type?: 'success' | 'error' | 'info',
    actionLabel?: string,
    onAction?: () => void,
  ) => void;
}

export function useTripActions({
  trip,
  trips,
  authUserId,
  currentDayIndex,
  setTrip,
  setTrips,
  setCurrentDayIndex,
  setCurrentTab,
  setSelectedActivity,
  tripToEdit,
  setTripToEdit,
  setIsEditTripModalOpen,
  setIsAIPlannerOpen,
  setPlannerInitialTab,
  setIsAutoArrangeOpen,
  setIsAIOptimizeOpen,
  saveTripToFirestore,
  executeTripPut,
  fetchServerTripSnapshot,
  ensureFullTrip,
  performSignOutAndClearCache,
  setConflictState,
  saveQueueRef,
  lastSavedContentByTripIdRef,
  latestServerVersionByTripIdRef,
  showToast,
}: UseTripActionsOptions) {
  const [isAIApplied, setIsAIApplied] = useState<boolean>(false);
  const [lastOptimizedTripSnapshot, setLastOptimizedTripSnapshot] = useState<TripData | null>(null);

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

  const handleOpenEditTripModal = async (tripTarget?: TripData) => {
    const resolved = tripTarget || trip;
    if (!resolved) return;
    let targetToEdit = resolved;
    if (resolved.isSummary) {
      const fullTrip = await ensureFullTrip(resolved);
      if (!fullTrip) {
        showToast('Không thể tải chi tiết chuyến đi để chỉnh sửa khi đang ngoại tuyến.', 'error');
        return;
      }
      targetToEdit = fullTrip;
    }
    setTripToEdit(targetToEdit);
    setIsEditTripModalOpen(true);
  };

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
          const candidate = nextTrips[0];
          const resolvedFallback = candidate.isSummary ? await ensureFullTrip(candidate) : candidate;
          if (resolvedFallback) {
            setTrip(resolvedFallback);
            setCurrentDayIndex(resolvedFallback.currentDay || 1);
          } else {
            setTrip(null);
            setCurrentDayIndex(1);
          }
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

      if (authUserId) {
        clearTripPendingOfflineSync(authUserId, tripId);
      }

      showToast(result.message || 'Đã xóa chuyến đi thành công', 'success');
    } catch (error: any) {
      console.error('Delete trip error:', error);
      showToast(error.message || 'Không thể xóa chuyến đi', 'error');
    }
  };

  const handleCloneTrip = async (sourceTrip: TripData) => {
    let resolvedSource = sourceTrip;
    if (sourceTrip.isSummary) {
      const hydrated = await ensureFullTrip(sourceTrip);
      if (!hydrated) {
        showToast('Không thể tải chi tiết chuyến đi để nhân bản.', 'error');
        return;
      }
      resolvedSource = hydrated;
    }
    const clonedPayload = cloneTripForTemplate(resolvedSource, authUserId || undefined);
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

  const handleApplyAIOptimization = async (
    actionTitle?: string,
    actionReason?: string,
    costSaved?: string,
    recommendationData?: any,
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

  const handleUpdateDayNote = async (dayIndex: number, note: string) => {
    if (!trip) return;
    const updatedDays = trip.days.map((d) => (d.dayIndex === dayIndex ? { ...d, dispatcherNote: note } : d));
    const updatedTrip: TripData = { ...trip, days: updatedDays };
    await saveTripToFirestore(updatedTrip, `Đã lưu ghi chú Ngày ${dayIndex}!`);
  };

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

  const handleUpdateTripBudget = async (updatedTrip: TripData) => {
    await saveTripToFirestore(updatedTrip, 'Đã cập nhật ngân sách và chứng từ chuyến đi!');
  };

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

  const handleUpdateTrip = async (updatedTrip: TripData, message?: string) => {
    await saveTripToFirestore(updatedTrip, message || 'Đã đồng bộ dữ liệu chuyến đi!');
  };

  const handleDismissAlert = async (id: string) => {
    if (!trip) return;
    const updatedTrip: TripData = {
      ...trip,
      alerts: trip.alerts.filter((a) => a.id !== id),
    };
    await saveTripToFirestore(updatedTrip);
  };

  const handleSelectTrip = async (selectedTrip: TripData) => {
    const latestFromList = trips.find((t) => t.id === selectedTrip.id) || selectedTrip;
    let resolvedTrip: TripData | null = latestFromList;
    if (latestFromList.isSummary) {
      resolvedTrip = await ensureFullTrip(latestFromList);
      if (!resolvedTrip) {
        showToast('Không thể tải chi tiết chuyến đi khi đang ngoại tuyến.', 'error');
        return;
      }
    }
    setTrip(resolvedTrip);
    setCurrentDayIndex(resolvedTrip.currentDay || 1);
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

  return {
    isAIApplied,
    lastOptimizedTripSnapshot,
    handleUndoOptimization,
    handleOpenEditTripModal,
    handleSaveEditedTrip,
    handleDeleteTrip,
    handleCloneTrip,
    handleSelectWaypoint,
    handleOpenTraditionalPlanner,
    handleOpenAIPlanner,
    handleOpenAutoArrange,
    handleApplyAutoArrangeDay,
    handleApplyAutoArrangeTrip,
    handleOpenAIOptimize,
    handleApplyAIOptimization,
    handleAddActivity,
    handleAddDay,
    handleDeleteDay,
    handleUpdateDayNote,
    handleUpdateActivityStatus,
    handleDeleteActivity,
    handleEditActivity,
    handleToggleMemberAttendance,
    handleUpdateTripBudget,
    handleUpdateMembers,
    handleUpdateTrip,
    handleDismissAlert,
    handleSelectTrip,
    handleApplyGeneratedTrip,
  };
}
