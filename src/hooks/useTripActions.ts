import { useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { authenticatedFetch, safeJsonResponse } from '../api';
import { normalizeTripData } from '../data/normalizeTripData';
import type { Activity, DaySchedule, TripData, TripMember, Waypoint } from '../types/travel';
import { applyScheduleChangesStrict, filterAlertsByRecommendation } from '../utils/applyOptimization';
import { clearTripPendingOfflineSync } from '../utils/offlineStorage';
import { cloneTripForTemplate, findMatchingActivityForWaypoint } from '../utils/tripHelpers';
import { getTripComparableJson } from '../utils/tripRepository';
import { countPassengerMembers, isUserTripOwnerOrAdmin } from '../utils/tripJoinHelpers';
import { AuthSessionError, PayloadTooLargeError, type SingleFlightQueue } from '../utils/tripSyncHelpers';
import { computeTripBudgetSummaryFields, syncBudgetAlertsIntoTrip } from '../utils/budgetAlerts';

interface UseTripActionsOptions {
  trip: TripData | null;
  trips: TripData[];
  authUserId: string | null;
  authUserRole?: 'user' | 'admin';
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
  applyAuthoritativeTripUpdate: (
    serverTrip: TripData,
    options?: { select?: boolean; prependIfNew?: boolean },
  ) => TripData;
  removeTripFromLocalState: (tripId: string) => Promise<TripData | null>;
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
  authUserRole,
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
  applyAuthoritativeTripUpdate,
  removeTripFromLocalState,
  performSignOutAndClearCache,
  setConflictState,
  saveQueueRef,
  lastSavedContentByTripIdRef,
  latestServerVersionByTripIdRef,
  showToast,
}: UseTripActionsOptions) {
  const [isAIApplied, setIsAIApplied] = useState<boolean>(false);
  const [lastOptimizedTripSnapshot, setLastOptimizedTripSnapshot] = useState<TripData | null>(null);

  const ensureTripOwner = (targetTrip: TripData | null | undefined): targetTrip is TripData => {
    if (!targetTrip) return false;
    if (!isUserTripOwnerOrAdmin(targetTrip, authUserId, authUserRole)) {
      showToast('Chỉ người tạo chuyến mới có quyền chỉnh sửa hoạt động và thay đổi trạng thái.', 'error');
      return false;
    }
    return true;
  };

  const handleUndoOptimization = async () => {
    if (!ensureTripOwner(trip)) return;
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
    if (!ensureTripOwner(resolved)) return;
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
    if (!ensureTripOwner(target)) return;
    const mergedBase: TripData = {
      ...target,
      ...updatedFields,
    };
    const { trip: merged, newlyTriggeredAlerts } = syncBudgetAlertsIntoTrip(mergedBase);
    if (trip && target.id === trip.id) {
      await saveTripToFirestore(merged, 'Đã cập nhật thông tin chuyến đi thành công!');
      const overAlert = newlyTriggeredAlerts.find((a) => a.severity === 'error');
      if (overAlert) {
        showToast(`Cảnh báo ngân sách: ${overAlert.title}`, 'error');
      }
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
    const candidate = trips.find((t) => t.id === tripId) || (trip?.id === tripId ? trip : null);
    if (candidate && !ensureTripOwner(candidate)) return;
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
        setSelectedActivity(null);
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
    if (!ensureTripOwner(trip)) return;
    setIsAutoArrangeOpen(true);
  };

  const handleApplyAutoArrangeDay = async (updatedDay: DaySchedule, message: string) => {
    if (!ensureTripOwner(trip)) return;
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
    if (!ensureTripOwner(updatedTrip)) return;
    await saveTripToFirestore(updatedTrip, message);
  };

  const handleOpenAIOptimize = () => {
    if (!ensureTripOwner(trip)) return;
    setIsAIOptimizeOpen(true);
  };

  const handleApplyAIOptimization = async (
    actionTitle?: string,
    actionReason?: string,
    costSaved?: string,
    recommendationData?: any,
  ) => {
    if (!ensureTripOwner(trip)) return;
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

    const { remainingAlerts, resolvedAlerts } = filterAlertsByRecommendation(
      trip.alerts,
      recommendationData || { actionTitle, reason: actionReason, scheduleChanges },
      allChangedActivities,
      targetDayIndex,
    );

    const updatedBase: TripData = {
      ...trip,
      alerts: remainingAlerts,
      days: updatedDays,
      aiSavingsEstimate: costSaved || trip.aiSavingsEstimate || '',
      confirmedActivities: confirmed,
      pendingActivities: pending,
    };
    const updatedWithBudget: TripData = {
      ...updatedBase,
      ...computeTripBudgetSummaryFields(updatedBase),
    };
    const { trip: updatedTrip } = syncBudgetAlertsIntoTrip(updatedWithBudget);

    setIsAIApplied(true);
    await saveTripToFirestore(updatedTrip);

    showToast(
      `Đã áp dụng tối ưu lịch Ngày ${targetDayIndex} (đã xử lý ${resolvedAlerts.length} cảnh báo)!`,
      'success',
      'Hoàn tác',
      () => void handleUndoOptimization(),
    );
  };

  const handleAddActivity = async (newAct: Activity, targetDayIndex?: number) => {
    if (!ensureTripOwner(trip)) return;
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
    const confirmed = allActs.filter((a) => a.status === 'Hoàn tất' || a.status === 'Đã xác nhận').length;
    const pending = allActs.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra').length;

    const updatedDraft: TripData = {
      ...trip,
      totalActivities: allActs.length,
      confirmedActivities: confirmed,
      pendingActivities: pending,
      days: updatedDays,
    };
    const updatedBase: TripData = {
      ...updatedDraft,
      ...computeTripBudgetSummaryFields(updatedDraft),
    };
    const { trip: updatedTrip, newlyTriggeredAlerts } = syncBudgetAlertsIntoTrip(updatedBase);

    await saveTripToFirestore(updatedTrip, `Đã thêm hoạt động "${newAct.title}"!`);
    const overAlert = newlyTriggeredAlerts.find((a) => a.severity === 'error');
    if (overAlert) {
      showToast(`Cảnh báo: ${overAlert.title}`, 'error');
    }
  };

  const handleAddDay = async () => {
    if (!ensureTripOwner(trip)) return;
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
    if (!ensureTripOwner(trip)) return;
    if (trip.days.length <= 1) {
      showToast('Hành trình cần ít nhất 1 ngày!', 'error');
      return;
    }
    const updatedDays = trip.days
      .filter((d) => d.dayIndex !== dayIndexToDelete)
      .map((d, idx) => {
        const nextIdx = idx + 1;
        const oldIdx = d.dayIndex;
        const nextFullDate =
          d.fullDate === `Ngày ${oldIdx}` || !d.fullDate ? `Ngày ${nextIdx}` : d.fullDate;
        const nextDateLabel =
          d.dateLabel === `${d.dayName} ${oldIdx}` || d.dateLabel === `Ngày ${oldIdx}`
            ? `${d.dayName || 'Ngày'} ${nextIdx}`.trim()
            : d.dateLabel;
        const nextDayName = d.dayName === `N${oldIdx}` ? `N${nextIdx}` : d.dayName;
        const nextDateNum = d.dateNum === oldIdx ? nextIdx : d.dateNum;
        return {
          ...d,
          dayIndex: nextIdx,
          dateLabel: nextDateLabel,
          dayName: nextDayName,
          dateNum: nextDateNum,
          fullDate: nextFullDate,
        };
      });
    const deletedDayObj = trip.days.find((d) => d.dayIndex === dayIndexToDelete);
    const deletedActIds = new Set((deletedDayObj?.activities || []).map((a) => a.id));
    const updatedInvoices = (trip.invoices || []).map((inv) => {
      const cleanedLink =
        inv.linkedActivityId && deletedActIds.has(inv.linkedActivityId) ? undefined : inv.linkedActivityId;
      let nextDayIndex = inv.dayIndex;
      if (inv.dayIndex === dayIndexToDelete) {
        nextDayIndex = Math.min(dayIndexToDelete, updatedDays.length);
      } else if (inv.dayIndex && inv.dayIndex > dayIndexToDelete) {
        nextDayIndex = inv.dayIndex - 1;
      }
      return {
        ...inv,
        dayIndex: nextDayIndex,
        linkedActivityId: cleanedLink,
      };
    });
    const allActs = updatedDays.flatMap((d) => d.activities);

    const updatedDraft: TripData = {
      ...trip,
      totalDays: updatedDays.length,
      days: updatedDays,
      invoices: updatedInvoices,
      totalActivities: allActs.length,
      confirmedActivities: allActs.filter((a) => a.status === 'Hoàn tất' || a.status === 'Đã xác nhận').length,
      pendingActivities: allActs.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra').length,
      currentDay: Math.min(currentDayIndex, updatedDays.length),
    };
    const updatedBase: TripData = {
      ...updatedDraft,
      ...computeTripBudgetSummaryFields(updatedDraft),
    };
    const { trip: updatedTrip } = syncBudgetAlertsIntoTrip(updatedBase);
    setCurrentDayIndex((prev) => Math.min(prev, updatedDays.length));
    await saveTripToFirestore(updatedTrip, `Đã xóa Ngày ${dayIndexToDelete} khỏi lịch trình!`);
  };

  const handleUpdateDayNote = async (dayIndex: number, note: string) => {
    if (!ensureTripOwner(trip)) return;
    const updatedDays = trip.days.map((d) => (d.dayIndex === dayIndex ? { ...d, dispatcherNote: note } : d));
    const updatedTrip: TripData = { ...trip, days: updatedDays };
    await saveTripToFirestore(updatedTrip, `Đã lưu ghi chú Ngày ${dayIndex}!`);
  };

  const handleUpdateActivityStatus = async (id: string, newStatus: Activity['status']) => {
    if (!ensureTripOwner(trip)) return;
    let activityTitle = '';
    const updatedDays = trip.days.map((d) => {
      const nextActivities = d.activities.map((a) => {
        if (a.id === id) {
          activityTitle = a.title;
          return { ...a, status: newStatus };
        }
        return a;
      });
      return {
        ...d,
        activities: nextActivities,
        confirmedCount: nextActivities.filter((a) => a.status === 'Đã xác nhận' || a.status === 'Hoàn tất').length,
        pendingCount: nextActivities.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra').length,
      };
    });

    const allActs = updatedDays.flatMap((d) => d.activities);
    const confirmed = allActs.filter((a) => a.status === 'Hoàn tất' || a.status === 'Đã xác nhận').length;
    const pending = allActs.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra').length;

    const statusDraft: TripData = {
      ...trip,
      confirmedActivities: confirmed,
      pendingActivities: pending,
      days: updatedDays,
    };
    const statusBase: TripData = {
      ...statusDraft,
      ...computeTripBudgetSummaryFields(statusDraft),
    };
    const { trip: updatedTrip, newlyTriggeredAlerts } = syncBudgetAlertsIntoTrip(statusBase);

    await saveTripToFirestore(
      updatedTrip,
      `Đã chuyển "${activityTitle || 'Hoạt động'}" sang "${newStatus}"!`,
    );
    const overAlert = newlyTriggeredAlerts.find((a) => a.severity === 'error');
    if (overAlert) {
      showToast(`Cảnh báo: ${overAlert.title}`, 'error');
    }
  };

  const handleDeleteActivity = async (id: string) => {
    if (!ensureTripOwner(trip)) return;
    let deletedTitle = '';
    const updatedDays = trip.days.map((d) => {
      const remaining = d.activities.filter((a) => {
        if (a.id === id) {
          deletedTitle = a.title;
          return false;
        }
        return true;
      });
      return {
        ...d,
        activities: remaining,
        confirmedCount: remaining.filter((a) => a.status === 'Đã xác nhận' || a.status === 'Hoàn tất').length,
        pendingCount: remaining.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra').length,
      };
    });

    const updatedInvoices = (trip.invoices || []).map((inv) =>
      inv.linkedActivityId === id ? { ...inv, linkedActivityId: undefined } : inv,
    );
    const allActs = updatedDays.flatMap((d) => d.activities);
    const confirmed = allActs.filter((a) => a.status === 'Hoàn tất' || a.status === 'Đã xác nhận').length;
    const pending = allActs.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra').length;

    const deletedDraft: TripData = {
      ...trip,
      totalActivities: allActs.length,
      confirmedActivities: confirmed,
      pendingActivities: pending,
      invoices: updatedInvoices,
      days: updatedDays,
    };
    const deletedBase: TripData = {
      ...deletedDraft,
      ...computeTripBudgetSummaryFields(deletedDraft),
    };
    const { trip: updatedTrip } = syncBudgetAlertsIntoTrip(deletedBase);

    await saveTripToFirestore(
      updatedTrip,
      `Đã xóa hoạt động "${deletedTitle || id}"!`,
    );
  };

  const handleEditActivity = async (updatedActivity: Activity) => {
    if (!ensureTripOwner(trip)) return;
    const updatedDays = trip.days.map((d) => {
      const nextActivities = d.activities.map((a) => (a.id === updatedActivity.id ? updatedActivity : a));
      return {
        ...d,
        activities: nextActivities,
        confirmedCount: nextActivities.filter((a) => a.status === 'Đã xác nhận' || a.status === 'Hoàn tất').length,
        pendingCount: nextActivities.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra').length,
      };
    });

    const allActs = updatedDays.flatMap((d) => d.activities);
    const confirmed = allActs.filter((a) => a.status === 'Hoàn tất' || a.status === 'Đã xác nhận').length;
    const pending = allActs.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra').length;

    const editedDraft: TripData = {
      ...trip,
      totalActivities: allActs.length,
      confirmedActivities: confirmed,
      pendingActivities: pending,
      days: updatedDays,
    };
    const editedBase: TripData = {
      ...editedDraft,
      ...computeTripBudgetSummaryFields(editedDraft),
    };
    const { trip: updatedTrip, newlyTriggeredAlerts } = syncBudgetAlertsIntoTrip(editedBase);

    await saveTripToFirestore(
      updatedTrip,
      `Đã cập nhật hoạt động "${updatedActivity.title}"!`,
    );
    const overAlert = newlyTriggeredAlerts.find((a) => a.severity === 'error');
    if (overAlert) {
      showToast(`Cảnh báo: ${overAlert.title}`, 'error');
    }
  };

  const handleToggleMemberAttendance = async (
    id: string,
    explicitStatus?: TripMember['attendanceStatus'],
  ) => {
    if (!trip) return;
    const member = trip.members.find((item) => item.id === id);
    if (!member) return;

    let attendanceStatus: TripMember['attendanceStatus'];
    if (explicitStatus) {
      attendanceStatus = explicitStatus;
    } else if (member.attendanceStatus === 'Có mặt') {
      attendanceStatus = 'Vắng mặt';
    } else if (member.attendanceStatus === 'Vắng mặt') {
      attendanceStatus = 'Chưa điểm danh';
    } else {
      attendanceStatus = 'Có mặt';
    }

    if (member.attendanceStatus === attendanceStatus) return;

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
        if (error.status === 403 && !isUserTripOwnerOrAdmin(trip, authUserId, authUserRole)) {
          showToast(error.message || 'Bạn chỉ có thể điểm danh cho bản thân hoặc người thân do mình đăng ký.', 'error');
          return;
        }
        await performSignOutAndClearCache(authUserId);
        showToast('Phiên đăng nhập không hợp lệ hoặc tài khoản đã bị vô hiệu hóa.', 'error');
        return;
      }
      if (!isUserTripOwnerOrAdmin(trip, authUserId, authUserRole)) {
        showToast(error instanceof Error ? error.message : 'Không thể lưu trạng thái điểm danh.', 'error');
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
    if (!ensureTripOwner(updatedTrip)) return;
    const normalizedBudgetTrip: TripData = {
      ...updatedTrip,
      ...computeTripBudgetSummaryFields(updatedTrip),
    };
    const { trip: syncedTrip, newlyTriggeredAlerts } = syncBudgetAlertsIntoTrip(normalizedBudgetTrip);
    await saveTripToFirestore(syncedTrip, 'Đã cập nhật ngân sách và chứng từ chuyến đi!');
    const overAlert = newlyTriggeredAlerts.find((a) => a.severity === 'error');
    const nearAlert = !overAlert ? newlyTriggeredAlerts.find((a) => a.severity === 'warning') : undefined;
    if (overAlert) {
      showToast(`Cảnh báo vượt hạn mức: ${overAlert.title}`, 'error');
    } else if (nearAlert) {
      showToast(`Lưu ý ngân sách: ${nearAlert.title}`, 'info');
    }
  };

  const handleUpdateMembers = async (updatedMembers: TripMember[]) => {
    if (!ensureTripOwner(trip)) return;

    const remainingAccountUids = new Set(
      updatedMembers
        .filter((m) => m.uid && m.memberType !== 'guest')
        .map((m) => m.uid as string),
    );
    if (trip.ownerId) {
      remainingAccountUids.add(trip.ownerId);
    }

    const cleanedMembers = updatedMembers.filter(
      (m) => !(m.memberType === 'guest' && m.invitedByUid && !remainingAccountUids.has(m.invitedByUid)),
    );

    const presentCount = cleanedMembers.filter((item) => item.attendanceStatus === 'Có mặt').length;
    const membersStatus = `${presentCount}/${cleanedMembers.length} đã điểm danh`;
    const passengerCount = countPassengerMembers(cleanedMembers);

    const drivers = cleanedMembers.filter((m) => m.role === 'Tài xế');
    const wasLinked = Boolean(trip.telematics.driverMemberId);
    const noDriverYet = !trip.telematics.driver || trip.telematics.driver === 'Chưa phân công';
    const assigned =
      drivers.find((m) => m.id === trip.telematics.driverMemberId) ||
      drivers.find((m) => m.name === trip.telematics.driver) ||
      (wasLinked || noDriverYet ? drivers[0] : undefined);

    const { driverMemberId: _previousDriverId, ...baseTelematics } = trip.telematics;
    let telematics: TripData['telematics'] = { ...trip.telematics, passengerCount };
    if (assigned) {
      telematics = {
        ...baseTelematics,
        driver: assigned.name,
        driverPhone: assigned.phone,
        driverMemberId: assigned.id,
        passengerCount,
      };
    } else if (wasLinked) {
      telematics = {
        ...baseTelematics,
        driver: 'Chưa phân công',
        driverPhone: '',
        passengerCount,
      };
    }

    const updatedTrip: TripData = {
      ...trip,
      members: cleanedMembers,
      membersStatus,
      membersTotal: cleanedMembers.length,
      membersOnline: cleanedMembers.filter((m) => m.status === 'online').length,
      telematics,
    };
    await saveTripToFirestore(updatedTrip, 'Đã cập nhật danh sách thành viên!');
  };

  const handleUpdateTrip = async (updatedTrip: TripData, message?: string) => {
    if (!ensureTripOwner(updatedTrip)) return;
    await saveTripToFirestore(updatedTrip, message || 'Đã đồng bộ dữ liệu chuyến đi!');
  };

  const handleDismissAlert = async (id: string) => {
    if (!ensureTripOwner(trip)) return;
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

  const handleJoinTripByCode = async (payload: {
    joinCode: string;
    phone?: string;
    specialPreference?: string;
    displayName?: string;
  }) => {
    const response = await authenticatedFetch('/api/trips/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await safeJsonResponse(response);
    if (!response.ok || !result?.success || !result?.trip) {
      throw new Error(result?.error || 'Không thể tham gia chuyến đi bằng mã này.');
    }

    const joinedTrip = applyAuthoritativeTripUpdate(result.trip, {
      select: true,
      prependIfNew: true,
    });
    setIsAIApplied(false);
    setCurrentTab('dashboard');
    showToast(result.message || `Đã tham gia chuyến đi "${joinedTrip.title}" với tư cách Hành khách!`, 'success');
  };

  const handleManageJoinCode = async (action: 'generate' | 'rotate' | 'toggle') => {
    if (!ensureTripOwner(trip)) return;
    try {
      const response = await authenticatedFetch(`/api/trips/${encodeURIComponent(trip.id)}/join-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          ...(action === 'toggle' ? { enabled: trip.joinCodeEnabled === false } : {}),
        }),
      });
      const result = await safeJsonResponse(response);
      if (!response.ok || !result?.success || !result?.trip) {
        throw new Error(result?.error || 'Không thể cập nhật mã mời chuyến đi.');
      }

      const updated = applyAuthoritativeTripUpdate(result.trip);
      if (action === 'toggle') {
        showToast(
          updated.joinCodeEnabled === false
            ? 'Đã tạm khóa mã tham gia chuyến đi.'
            : 'Đã mở lại mã tham gia chuyến đi!',
          'info',
        );
      } else {
        showToast(
          action === 'rotate'
            ? `Đã đổi sang mã mời mới: ${updated.joinCode}`
            : `Đã tạo mã mời chuyến đi: ${updated.joinCode}`,
          'success',
        );
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể cập nhật mã mời.', 'error');
    }
  };

  const handleAddGuestCompanion = async (payload: {
    name: string;
    phone?: string;
    specialPreference?: string;
  }) => {
    if (!trip) return;
    const response = await authenticatedFetch(`/api/trips/${encodeURIComponent(trip.id)}/guest-companions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await safeJsonResponse(response);
    if (!response.ok || !result?.success || !result?.trip) {
      throw new Error(result?.error || 'Không thể thêm người thân vào đoàn.');
    }

    applyAuthoritativeTripUpdate(result.trip);
    showToast(result.message || `Đã thêm "${payload.name}" vào danh sách hành khách.`, 'success');
  };

  const handleRemoveGuestCompanion = async (memberId: string) => {
    if (!trip) return;
    try {
      const response = await authenticatedFetch(
        `/api/trips/${encodeURIComponent(trip.id)}/guest-companions/${encodeURIComponent(memberId)}`,
        { method: 'DELETE' },
      );
      const result = await safeJsonResponse(response);
      if (!response.ok || !result?.success || !result?.trip) {
        throw new Error(result?.error || 'Không thể xóa người thân khỏi đoàn.');
      }

      applyAuthoritativeTripUpdate(result.trip);
      showToast('Đã xóa người thân khỏi danh sách đoàn.', 'info');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể xóa người thân.', 'error');
    }
  };

  const handleLeaveTrip = async () => {
    if (!trip) return;
    try {
      const leavingTripId = trip.id;
      const response = await authenticatedFetch(`/api/trips/${encodeURIComponent(leavingTripId)}/leave`, {
        method: 'POST',
      });
      const result = await safeJsonResponse(response);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Không thể rời khỏi chuyến đi.');
      }

      const nextActive = await removeTripFromLocalState(leavingTripId);
      setIsAIApplied(false);
      setCurrentTab(nextActive ? 'dashboard' : 'trips');
      showToast(result.message || 'Đã rời khỏi chuyến đi.', 'info');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể rời chuyến đi.', 'error');
    }
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
    handleJoinTripByCode,
    handleManageJoinCode,
    handleAddGuestCompanion,
    handleRemoveGuestCompanion,
    handleLeaveTrip,
  };
}
