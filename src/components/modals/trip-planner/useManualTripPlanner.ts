import React, { useState, type Dispatch, type SetStateAction } from 'react';
import type { Activity, DaySchedule, TripData } from '../../../types/travel';
import { autoArrangeDayActivities } from '../../../utils/scheduleAutoArranger';
import { getTodayISODate, resolveActivityCoordinatesWithFallback, type TripCreatorOwner } from './helpers';
import { buildManualTrip } from './buildManualTrip';

type StateSetter<T> = Dispatch<SetStateAction<T>>;

interface UseManualTripPlannerOptions {
  owner?: TripCreatorOwner;
  onApplyPlan: (trip: TripData) => Promise<void>;
  onClose: () => void;
  setErrorMsg: StateSetter<string | null>;
  setSuccessMsg: StateSetter<string | null>;
  setIsSaving: StateSetter<boolean>;
}

function createInitialManualDays(): DaySchedule[] {
  return [
    {
      dayIndex: 1,
      dateLabel: 'Ngày 1',
      dayName: 'N1',
      dateNum: 1,
      fullDate: 'Ngày 1: Khởi hành & Tham quan',
      confirmedCount: 0,
      pendingCount: 0,
      dispatcherNote: '',
      activities: [],
    },
    {
      dayIndex: 2,
      dateLabel: 'Ngày 2',
      dayName: 'N2',
      dateNum: 2,
      fullDate: 'Ngày 2: Trải nghiệm thực tế',
      confirmedCount: 0,
      pendingCount: 0,
      dispatcherNote: '',
      activities: [],
    },
    {
      dayIndex: 3,
      dateLabel: 'Ngày 3',
      dayName: 'N3',
      dateNum: 3,
      fullDate: 'Ngày 3: Mua sắm & Kết thúc',
      confirmedCount: 0,
      pendingCount: 0,
      dispatcherNote: '',
      activities: [],
    },
  ];
}

function generateRandomTripCode(): string {
  return `VN-${Math.floor(100 + Math.random() * 900)}`;
}

export function useManualTripPlanner({ owner, onApplyPlan, onClose, setErrorMsg, setSuccessMsg, setIsSaving }: UseManualTripPlannerOptions) {
  // ==========================================
  // STATE CHO LẬP LỊCH TRUYỀN THỐNG (THỦ CÔNG)
  // Không có bất kỳ dữ liệu mẫu hay dữ liệu tĩnh nào
  // ==========================================
  const [tripTitle, setTripTitle] = useState('');
  const [tripCode, setTripCode] = useState(generateRandomTripCode);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState(getTodayISODate());
  const [totalDays, setTotalDays] = useState(3);
  const [vehicle, setVehicle] = useState('Xe 29 chỗ tiêu chuẩn');
  const [membersCount, setMembersCount] = useState(15);
  const [budgetEstimated, setBudgetEstimated] = useState<number | ''>('');

  // Danh sách các ngày trong lịch trình thủ công
  const [manualDays, setManualDays] = useState<DaySchedule[]>(createInitialManualDays);
  const [activeDayIndex, setActiveDayIndex] = useState(1);

  // State thêm / sửa hoạt động trong ngày
  const [isActivityFormOpen, setIsActivityFormOpen] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [actTitle, setActTitle] = useState('');
  const [actTimeStart, setActTimeStart] = useState('08:00');
  const [actTimeEnd, setActTimeEnd] = useState('09:30');
  const [actLocation, setActLocation] = useState('');
  const [actType, setActType] = useState<Activity['type']>('sightseeing');
  const [actCost, setActCost] = useState<number | ''>('');
  const [actDetails, setActDetails] = useState('');
  const [actFormError, setActFormError] = useState<string | null>(null);

  // Đồng bộ số ngày khi người dùng đổi số ngày ở chế độ truyền thống
  const handleUpdateTotalDays = (newDaysCount: number) => {
    const validCount = Math.max(1, Math.min(15, newDaysCount));
    setTotalDays(validCount);
    setManualDays((prev) => {
      if (prev.length === validCount) return prev;
      if (prev.length < validCount) {
        const added: DaySchedule[] = [];
        for (let i = prev.length + 1; i <= validCount; i++) {
          added.push({
            dayIndex: i,
            dateLabel: `Ngày ${i}`,
            dayName: `N${i}`,
            dateNum: i,
            fullDate: `Ngày ${i}: Lịch trình chi tiết`,
            confirmedCount: 0,
            pendingCount: 0,
            dispatcherNote: '',
            activities: [],
          });
        }
        return [...prev, ...added];
      }
      return prev.slice(0, validCount);
    });
    if (activeDayIndex > validCount) {
      setActiveDayIndex(validCount);
    }
  };

  const currentDay = manualDays.find((d) => d.dayIndex === activeDayIndex) || manualDays[0];

  // Mở form thêm hoạt động mới vào ngày hiện tại
  const handleOpenAddActivity = () => {
    setEditingActivityId(null);
    setActTitle('');
    // Đề xuất giờ tiếp theo dựa trên hoạt động cuối cùng của ngày
    const acts = currentDay.activities || [];
    if (acts.length > 0) {
      const lastAct = acts[acts.length - 1];
      setActTimeStart(lastAct.timeEnd || '10:00');
      const [h, m] = (lastAct.timeEnd || '10:00').split(':').map(Number);
      const endMins = (h || 0) * 60 + (m || 0) + 90;
      const endH = Math.min(23, Math.floor(endMins / 60));
      const endM = endMins % 60;
      setActTimeEnd(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`);
    } else {
      setActTimeStart('08:00');
      setActTimeEnd('09:30');
    }
    setActLocation(destination || '');
    setActType('sightseeing');
    setActCost('');
    setActDetails('');
    setActFormError(null);
    setIsActivityFormOpen(true);
  };

  // Mở form chỉnh sửa hoạt động có sẵn
  const handleOpenEditActivity = (act: Activity) => {
    setEditingActivityId(act.id);
    setActTitle(act.title);
    setActTimeStart(act.timeStart);
    setActTimeEnd(act.timeEnd);
    setActLocation(act.location);
    setActType(act.type || 'sightseeing');
    setActCost(act.cost || '');
    setActDetails(act.details || '');
    setActFormError(null);
    setIsActivityFormOpen(true);
  };

  // Lưu hoạt động (thêm mới hoặc cập nhật)
  const handleSaveActivity = (e: React.FormEvent) => {
    e.preventDefault();
    setActFormError(null);

    const cleanTitle = actTitle.trim();
    if (!cleanTitle) {
      setActFormError('Vui lòng nhập tên hoạt động / địa điểm.');
      return;
    }

    if (!actTimeStart || !actTimeEnd) {
      setActFormError('Vui lòng nhập đầy đủ giờ bắt đầu và giờ kết thúc.');
      return;
    }

    const [sh, sm] = actTimeStart.split(':').map(Number);
    const [eh, em] = actTimeEnd.split(':').map(Number);
    const startMins = (sh || 0) * 60 + (sm || 0);
    const endMins = (eh || 0) * 60 + (em || 0);

    if (endMins <= startMins) {
      setActFormError('Giờ kết thúc phải muộn hơn giờ bắt đầu.');
      return;
    }

    const costNum = typeof actCost === 'number' ? actCost : Number(actCost) || 0;
    const cleanActLocation = actLocation.trim() || destination || 'Điểm tham quan';
    const resolvedCoords = resolveActivityCoordinatesWithFallback(cleanActLocation, cleanTitle);

    setManualDays((prevDays) =>
      prevDays.map((day) => {
        if (day.dayIndex !== activeDayIndex) return day;

        let updatedActivities: Activity[];
        if (editingActivityId) {
          // Cập nhật
          updatedActivities = day.activities.map((a) => {
            if (a.id !== editingActivityId) return a;
            const locationUnchanged = (a.location || '').trim().toLowerCase() === cleanActLocation.toLowerCase();
            const nextCoords = resolvedCoords || (locationUnchanged ? a.coordinates : undefined);
            const { coordinates: _oldCoords, ...restAct } = a;
            return {
              ...restAct,
              title: cleanTitle,
              timeStart: actTimeStart,
              timeEnd: actTimeEnd,
              location: cleanActLocation,
              type: actType,
              cost: costNum,
              details: actDetails.trim(),
              ...(nextCoords ? { coordinates: nextCoords } : {}),
            };
          });
        } else {
          // Thêm mới
          const newAct: Activity = {
            id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            title: cleanTitle,
            timeStart: actTimeStart,
            timeEnd: actTimeEnd,
            location: cleanActLocation,
            status: 'Đã xác nhận',
            type: actType,
            cost: costNum,
            details: actDetails.trim(),
            ...(resolvedCoords ? { coordinates: resolvedCoords } : {}),
          };
          updatedActivities = [...day.activities, newAct];
        }

        // Sắp xếp lại theo giờ bắt đầu
        updatedActivities.sort((a, b) => a.timeStart.localeCompare(b.timeStart));

        return {
          ...day,
          activities: updatedActivities,
          confirmedCount: updatedActivities.filter((a) => a.status === 'Đã xác nhận' || a.status === 'Hoàn tất')
            .length,
          pendingCount: updatedActivities.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra')
            .length,
        };
      })
    );

    setIsActivityFormOpen(false);
  };

  // Xóa hoạt động khỏi ngày hiện tại
  const handleDeleteActivity = (actId: string) => {
    setManualDays((prevDays) =>
      prevDays.map((day) => {
        if (day.dayIndex !== activeDayIndex) return day;
        const filtered = day.activities.filter((a) => a.id !== actId);
        return {
          ...day,
          activities: filtered,
          confirmedCount: filtered.filter((a) => a.status === 'Đã xác nhận' || a.status === 'Hoàn tất').length,
          pendingCount: filtered.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra').length,
        };
      })
    );
  };

  // Tự động xếp lịch nhanh cho ngày hiện tại (Auto-Arrange Day)
  const handleAutoArrangeCurrentDay = () => {
    if (!currentDay.activities || currentDay.activities.length < 2) {
      setSuccessMsg('Ngày này chưa có đủ 2 hoạt động để cần xếp lại.');
      setTimeout(() => setSuccessMsg(null), 3000);
      return;
    }

    const arrangeRes = autoArrangeDayActivities(currentDay.activities, { defaultBufferMinutes: 20 });
    setManualDays((prevDays) =>
      prevDays.map((day) => {
        if (day.dayIndex !== activeDayIndex) return day;
        return {
          ...day,
          activities: arrangeRes.reorderedActivities,
        };
      })
    );

    setSuccessMsg(
      arrangeRes.adjustments.length > 0
        ? `Đã tự động điều chỉnh ${arrangeRes.adjustments.length} mốc giờ và chèn đệm di chuyển an toàn!`
        : 'Lịch trình ngày này đã hoàn toàn hợp lý, không có xung đột thời gian.'
    );
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Thêm ngày mới
  const handleAddNewDay = () => {
    const nextIdx = manualDays.length + 1;
    setManualDays((prev) => [
      ...prev,
      {
        dayIndex: nextIdx,
        dateLabel: `Ngày ${nextIdx}`,
        dayName: `N${nextIdx}`,
        dateNum: nextIdx,
        fullDate: `Ngày ${nextIdx}: Lịch trình bổ sung`,
        confirmedCount: 0,
        pendingCount: 0,
        dispatcherNote: '',
        activities: [],
      },
    ]);
    setTotalDays(nextIdx);
    setActiveDayIndex(nextIdx);
  };

  // Xóa ngày đang chọn
  const handleDeleteActiveDay = (idxToDelete: number) => {
    if (manualDays.length <= 1) {
      setErrorMsg('Hành trình phải có ít nhất 1 ngày.');
      return;
    }
    const filtered = manualDays.filter((d) => d.dayIndex !== idxToDelete);
    const reindexed = filtered.map((d, i) => ({
      ...d,
      dayIndex: i + 1,
      dateLabel: `Ngày ${i + 1}`,
      dayName: `N${i + 1}`,
      dateNum: i + 1,
    }));
    setManualDays(reindexed);
    setTotalDays(reindexed.length);
    setActiveDayIndex((prev) => (prev > reindexed.length ? reindexed.length : prev));
  };

  // Tính tổng chi phí các hoạt động
  const totalCalculatedCost = manualDays
    .flatMap((d) => d.activities)
    .reduce((sum, a) => sum + (a.cost || 0), 0);

  const totalActivitiesCount = manualDays.reduce((sum, d) => sum + d.activities.length, 0);

  const resetManualForm = () => {
    setTripTitle('');
    setTripCode(generateRandomTripCode());
    setOrigin('');
    setDestination('');
    setStartDate(getTodayISODate());
    setTotalDays(3);
    setVehicle('Xe 29 chỗ tiêu chuẩn');
    setMembersCount(15);
    setBudgetEstimated('');
    setManualDays(createInitialManualDays());
    setActiveDayIndex(1);
    setIsActivityFormOpen(false);
    setEditingActivityId(null);
    setActFormError(null);
  };

  // Xử lý nạp lịch trình truyền thống vào hệ thống
  const handleApplyTraditionalSchedule = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!tripTitle.trim()) {
      setErrorMsg('Vui lòng nhập Tên hành trình chuyến đi.');
      return;
    }

    setIsSaving(true);
    try {
      const newTrip = buildManualTrip({
        tripTitle,
        tripCode,
        origin,
        destination,
        startDate,
        totalDays,
        vehicle,
        membersCount,
        budgetEstimated,
        totalCalculatedCost,
        totalActivitiesCount,
        manualDays,
        owner,
      });
      await onApplyPlan(newTrip);
      resetManualForm();
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể lưu chuyến đi truyền thống.');
    } finally {
      setIsSaving(false);
    }
  };

  return {
    tripTitle, setTripTitle, tripCode, setTripCode, origin, setOrigin, destination, setDestination,
    startDate, setStartDate, totalDays, onUpdateTotalDays: handleUpdateTotalDays, vehicle, setVehicle,
    membersCount, setMembersCount, budgetEstimated, setBudgetEstimated, manualDays, activeDayIndex,
    setActiveDayIndex, currentDay, onAddNewDay: handleAddNewDay, onDeleteActiveDay: handleDeleteActiveDay,
    onAutoArrangeCurrentDay: handleAutoArrangeCurrentDay, onOpenAddActivity: handleOpenAddActivity,
    isActivityFormOpen, setIsActivityFormOpen, onSaveActivity: handleSaveActivity, actFormError,
    editingActivityId, actTitle, setActTitle, actType, setActType, actTimeStart, setActTimeStart,
    actTimeEnd, setActTimeEnd, actLocation, setActLocation, actCost, setActCost, actDetails, setActDetails,
    setManualDays, onEditActivity: handleOpenEditActivity, onDeleteActivity: handleDeleteActivity,
    totalActivitiesCount, totalCalculatedCost, onApplyTraditionalSchedule: handleApplyTraditionalSchedule,
  };
}
