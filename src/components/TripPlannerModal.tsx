/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Route,
  Calendar,
  MapPin,
  Clock,
  Compass,
  Wallet,
  Users,
  Check,
  Loader2,
  ArrowRight,
  Plus,
  Trash2,
  Edit2,
  AlertCircle,
  Bus,
  UtensilsCrossed,
  Mountain,
  Landmark,
  Building2,
  Sun,
  ShieldCheck,
} from 'lucide-react';
import { TripData, TripMember, Waypoint, Activity, DaySchedule } from '../types/travel';
import { authenticatedFetch, safeJsonResponse } from '../api';
import { createAiRiskAlerts, detectScheduleAndWeatherAlerts } from '../utils/alertDetector';
import { buildAIPlanWaypoints, buildDynamicWaypoints } from '../utils/vietnamGeo';
import { autoArrangeDayActivities, detectDayScheduleConflicts } from '../utils/scheduleAutoArranger';

interface TripPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyPlan: (newTrip: TripData) => Promise<void>;
  initialTab?: 'traditional' | 'ai';
}

function parseGroupSize(groupType: string): number {
  const m =
    groupType.match(/(\d{1,3})\s*(?:người|khách|pax|thành viên)/i) ||
    groupType.match(/(\d{1,3})/);
  const n = m ? parseInt(m[1], 10) : 10;
  return Math.min(Math.max(Number.isFinite(n) ? n : 10, 1), 100);
}

function buildMembers(count: number): TripMember[] {
  const stamp = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    id: `member-${stamp}-${i + 1}`,
    name: `Thành viên ${i + 1}`,
    avatar: String((i % 10) + 1),
    role: i === 0 ? 'Trưởng đoàn' : 'Khách du lịch',
    phone: '',
    status: 'offline' as const,
    attendanceStatus: 'Chưa điểm danh' as const,
  }));
}

function getStartLocation(destination: string): string {
  const first = destination.split(/\s*(?:-|–|—|→|>)\s*/)[0]?.trim();
  return first || 'Hà Nội';
}

function getEndLocation(destination: string): string {
  const parts = destination.split(/\s*(?:-|–|—|→|>)\s*/).map((part) => part.trim()).filter(Boolean);
  return parts[parts.length - 1] || 'Hà Nội';
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function getTodayISODate(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const TripPlannerModal: React.FC<TripPlannerModalProps> = ({
  isOpen,
  onClose,
  onApplyPlan,
  initialTab = 'traditional',
}) => {
  // Tab chính: 'traditional' (Lập lịch truyền thống / thủ công) | 'ai' (Lập lịch tự động bằng AI)
  const [activeTab, setActiveTab] = useState<'traditional' | 'ai'>(initialTab);

  // ==========================================
  // STATE CHO LẬP LỊCH TRUYỀN THỐNG (THỦ CÔNG)
  // Không có bất kỳ dữ liệu mẫu hay dữ liệu tĩnh nào
  // ==========================================
  const [tripTitle, setTripTitle] = useState('');
  const [tripCode, setTripCode] = useState(() => `VN-${Math.floor(100 + Math.random() * 900)}`);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState(getTodayISODate());
  const [totalDays, setTotalDays] = useState(3);
  const [vehicle, setVehicle] = useState('Xe 29 chỗ tiêu chuẩn');
  const [membersCount, setMembersCount] = useState(15);
  const [budgetEstimated, setBudgetEstimated] = useState<number | ''>('');

  // Danh sách các ngày trong lịch trình thủ công
  const [manualDays, setManualDays] = useState<DaySchedule[]>(() => [
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
  ]);
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

  // ==========================================
  // STATE CHO LẬP LỊCH TỰ ĐỘNG BẰNG GEMINI AI
  // ==========================================
  const [aiDestination, setAiDestination] = useState('');
  const [aiDays, setAiDays] = useState(3);
  const [aiStartDate, setAiStartDate] = useState(getTodayISODate());
  const [aiBudget, setAiBudget] = useState('Tiêu chuẩn (30 - 45 triệu)');
  const [aiTravelStyle, setAiTravelStyle] = useState('Văn hóa, Di sản & Ẩm thực bản địa');
  const [aiGroupType, setAiGroupType] = useState('Đoàn gia đình & bạn bè (15 người)');
  const [aiPreferences, setAiPreferences] = useState(
    'Ưu tiên điểm tham quan mát mẻ buổi trưa, ẩm thực địa phương đặc sắc, hành trình di chuyển hợp lý'
  );
  const [aiIsLoading, setAiIsLoading] = useState(false);
  const [aiJobStatus, setAiJobStatus] = useState<string | null>(null);
  const [aiGeneratedPlan, setAiGeneratedPlan] = useState<any>(null);

  // Trạng thái chung
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const aiPollTimerRef = useRef<number | null>(null);
  const aiPollRunIdRef = useRef(0);

  const clearAiPolling = () => {
    if (aiPollTimerRef.current !== null) {
      window.clearTimeout(aiPollTimerRef.current);
      aiPollTimerRef.current = null;
    }
  };

  useEffect(() => {
    setActiveTab(initialTab);
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!isOpen) {
      clearAiPolling();
      aiPollRunIdRef.current += 1;
      setAiIsLoading(false);
    }
    return () => {
      clearAiPolling();
      aiPollRunIdRef.current += 1;
    };
  }, [initialTab, isOpen]);

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

    setManualDays((prevDays) =>
      prevDays.map((day) => {
        if (day.dayIndex !== activeDayIndex) return day;

        let updatedActivities: Activity[];
        if (editingActivityId) {
          // Cập nhật
          updatedActivities = day.activities.map((a) =>
            a.id === editingActivityId
              ? {
                  ...a,
                  title: cleanTitle,
                  timeStart: actTimeStart,
                  timeEnd: actTimeEnd,
                  location: actLocation.trim() || destination || 'Điểm tham quan',
                  type: actType,
                  cost: costNum,
                  details: actDetails.trim(),
                }
              : a
          );
        } else {
          // Thêm mới
          const newAct: Activity = {
            id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            title: cleanTitle,
            timeStart: actTimeStart,
            timeEnd: actTimeEnd,
            location: actLocation.trim() || destination || 'Điểm tham quan',
            status: 'Đã xác nhận',
            type: actType,
            cost: costNum,
            details: actDetails.trim(),
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

  // Xử lý nạp lịch trình truyền thống vào hệ thống
  const handleApplyTraditionalSchedule = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanTitle = tripTitle.trim();
    if (!cleanTitle) {
      setErrorMsg('Vui lòng nhập Tên hành trình chuyến đi.');
      return;
    }

    const cleanOrigin = origin.trim() || 'Điểm khởi hành';
    const cleanDestination = destination.trim() || 'Điểm đến';

    setIsSaving(true);
    try {
      const stamp = Date.now();
      const budgetNum = typeof budgetEstimated === 'number' && budgetEstimated > 0
        ? budgetEstimated
        : Math.max(totalCalculatedCost * 1.2, 10000000);

      const allActivityLocations = manualDays
        .flatMap((d) => d.activities.map((a) => a.location))
        .filter(Boolean);

      // Tạo Waypoints động với tọa độ Việt Nam thực tế
      const dynamicWaypoints = buildDynamicWaypoints(cleanOrigin, cleanDestination, allActivityLocations);

      const newTrip: TripData = {
        id: `trip-manual-${stamp}`,
        code: tripCode.trim().toUpperCase() || `VN-${Math.floor(100 + Math.random() * 900)}`,
        title: cleanTitle,
        status: 'Chuẩn bị',
        dates: `${formatDateDisplay(startDate)} (${totalDays} ngày)`,
        origin: cleanOrigin.slice(0, 3).toUpperCase(),
        originFull: cleanOrigin,
        destination: cleanDestination.slice(0, 3).toUpperCase(),
        destinationFull: cleanDestination,
        destinationsCount: dynamicWaypoints.length || totalDays,
        totalKm: totalDays * 75,
        vehicle,
        currentDay: 1,
        totalDays,
        totalActivities: totalActivitiesCount,
        confirmedActivities: totalActivitiesCount,
        pendingActivities: 0,
        budgetTotal: Math.round(budgetNum),
        budgetUsed: totalCalculatedCost,
        budgetRemaining: Math.max(0, Math.round(budgetNum - totalCalculatedCost)),
        budgetUsedPercent: budgetNum > 0 ? Math.min(100, Math.round((totalCalculatedCost / budgetNum) * 100)) : 0,
        membersOnline: 0,
        membersTotal: membersCount,
        membersStatus: `0/${membersCount} đã điểm danh`,
        weather: {
          temp: 0,
          description: '',
          rainProb: '',
          rainProbTime: '',
        },
        telematics: {
          from: cleanOrigin,
          to: cleanDestination,
          vehicleType: vehicle,
          driver: 'Chưa phân công',
          driverPhone: '',
          passengerCount: membersCount,
        },
        waypoints: dynamicWaypoints,
        alerts: [],
        aiSuggestions: [
          {
            id: `sug-manual-${stamp}`,
            title: 'Lịch trình được khởi tạo thủ công',
            badge: 'Tự lập lịch',
            description: 'Các mốc thời gian và hoạt động được người dùng thiết lập hoàn toàn tự do theo nhu cầu.',
          },
        ],
        aiSavingsEstimate: '',
        aiConfidence: '',
        members: buildMembers(membersCount),
        days: manualDays,
      };

      // Tự động kiểm tra cảnh báo xung đột nếu có
      const detectedAlerts = detectScheduleAndWeatherAlerts(newTrip);
      if (detectedAlerts.length > 0) {
        newTrip.alerts = detectedAlerts;
      }

      await onApplyPlan(newTrip);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể lưu chuyến đi truyền thống.');
    } finally {
      setIsSaving(false);
    }
  };

  // ==========================================
  // XỬ LÝ LẬP LỊCH TỰ ĐỘNG BẰNG GEMINI AI
  // ==========================================
  const pollAiJob = async (jobId: string, runId: number, startedAt: number) => {
    if (aiPollRunIdRef.current !== runId) return;
    if (Date.now() - startedAt > 90_000) {
      setErrorMsg('Quá thời gian chờ tạo lịch trình (90 giây). Vui lòng thử lại.');
      setAiIsLoading(false);
      return;
    }

    try {
      const response = await authenticatedFetch(`/api/gemini/jobs/${jobId}`);
      if (aiPollRunIdRef.current !== runId) return;
      const job = await safeJsonResponse(response);
      if (aiPollRunIdRef.current !== runId) return;
      if (!response.ok || !job.success) {
        throw new Error(job.error || 'Không thể kiểm tra tiến độ lập lịch');
      }
      setAiJobStatus(job.job.progress);
      if (job.job.status === 'completed') {
        setAiGeneratedPlan(job.job.result);
        setAiIsLoading(false);
        return;
      }
      if (job.job.status === 'failed') {
        throw new Error(job.job.error || 'Không thể hoàn tất lịch trình');
      }
      clearAiPolling();
      aiPollTimerRef.current = window.setTimeout(() => {
        void pollAiJob(jobId, runId, startedAt);
      }, 1500);
    } catch (error) {
      if (aiPollRunIdRef.current !== runId) return;
      setErrorMsg(error instanceof Error ? error.message : 'Không thể tạo lịch trình');
      setAiIsLoading(false);
    }
  };

  const handleGenerateAI = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setAiGeneratedPlan(null);

    const cleanDest = aiDestination.trim();
    if (!cleanDest) {
      setErrorMsg('Vui lòng nhập Điểm đến du lịch (VD: Nha Trang, Đà Lạt, Sa Pa, Phú Quốc).');
      return;
    }

    clearAiPolling();
    const runId = ++aiPollRunIdRef.current;
    const startedAt = Date.now();
    setAiIsLoading(true);
    setAiJobStatus('Đang gửi yêu cầu lập lịch trình...');

    try {
      const response = await authenticatedFetch('/api/gemini/generate-itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: cleanDest,
          days: aiDays,
          budget: aiBudget,
          travelStyle: aiTravelStyle,
          groupType: aiGroupType,
          preferences: aiPreferences,
          startLocation: getStartLocation(cleanDest),
        }),
      });
      if (aiPollRunIdRef.current !== runId) return;
      const result = await safeJsonResponse(response);
      if (aiPollRunIdRef.current !== runId) return;
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Không thể tạo lịch trình');
      }
      if (result.cached && result.data) {
        setAiGeneratedPlan(result.data);
        setAiIsLoading(false);
        return;
      }
      if (!result.jobId) {
        throw new Error(result.error || 'Máy chủ không trả về mã tiến trình');
      }
      await pollAiJob(result.jobId, runId, startedAt);
    } catch (error) {
      if (aiPollRunIdRef.current !== runId) return;
      setErrorMsg(error instanceof Error ? error.message : 'Không thể tạo lịch trình');
      setAiIsLoading(false);
    }
  };

  const handleApplyAIPlan = async () => {
    if (!aiGeneratedPlan) return;
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const memberCount = parseGroupSize(aiGroupType);
      const generatedDays = Array.isArray(aiGeneratedPlan.days) ? aiGeneratedPlan.days : [];
      const generatedActivities = generatedDays.flatMap((day: any) =>
        Array.isArray(day?.activities) ? day.activities : [],
      );
      if (generatedActivities.length === 0) {
        throw new Error('Gemini chưa tạo hoạt động nào cho lịch trình. Vui lòng tạo lại.');
      }
      const totalActs = generatedActivities.length;

      const startName = typeof aiGeneratedPlan.routeSummary?.origin === 'string' && aiGeneratedPlan.routeSummary.origin.trim()
        ? aiGeneratedPlan.routeSummary.origin.trim()
        : getStartLocation(aiDestination);
      const endName = typeof aiGeneratedPlan.routeSummary?.destination === 'string' && aiGeneratedPlan.routeSummary.destination.trim()
        ? aiGeneratedPlan.routeSummary.destination.trim()
        : getEndLocation(aiDestination);

      const aiWaypoints = buildAIPlanWaypoints(startName, endName, generatedActivities);

      const totalKm = aiGeneratedPlan.routeSummary?.totalKm || aiDays * 80;
      const vehicleType = aiGeneratedPlan.routeSummary?.vehicle || (memberCount > 16 ? 'Xe 29 chỗ' : 'Xe 16 chỗ');

      const formattedDays: DaySchedule[] = generatedDays.map((d: any, idx: number) => {
        const activities = Array.isArray(d.activities) ? d.activities : [];
        return {
          dayIndex: idx + 1,
          dateLabel: d.dateLabel || `Ngày ${idx + 1}`,
          dayName: `N${idx + 1}`,
          dateNum: idx + 1,
          fullDate: d.fullDate || `Ngày ${idx + 1}: Khám phá`,
          confirmedCount: activities.length,
          pendingCount: 0,
          dispatcherNote: d.summary || d.dispatcherNote || 'Theo dõi hành trình',
          activities,
        };
      });

      const realActivityCosts = formattedDays
        .flatMap((d) => d.activities)
        .reduce((sum, a) => sum + (Number(a.cost) || 0), 0);
      const budgetTotal = typeof aiGeneratedPlan.budget?.total === 'number' && aiGeneratedPlan.budget.total > 0
        ? aiGeneratedPlan.budget.total
        : Math.max(realActivityCosts, 0);
      const budgetUsed = typeof aiGeneratedPlan.budget?.used === 'number'
        ? aiGeneratedPlan.budget.used
        : realActivityCosts;

      const newTrip: TripData = {
        id: `trip-ai-${Date.now()}`,
        code: aiGeneratedPlan.tripCode || `VN-${Math.floor(100 + Math.random() * 900)}`,
        title: aiGeneratedPlan.title || `Hành trình khám phá ${aiDestination} ${aiDays} ngày`,
        status: 'Chuẩn bị',
        dates: `${formatDateDisplay(aiStartDate)} (${aiDays} ngày)`,
        origin: startName.slice(0, 3).toUpperCase(),
        originFull: startName,
        destination: endName.slice(0, 3).toUpperCase(),
        destinationFull: endName,
        destinationsCount: aiWaypoints.length || aiDays,
        totalKm,
        vehicle: vehicleType,
        currentDay: 1,
        totalDays: aiDays,
        totalActivities: totalActs,
        confirmedActivities: totalActs,
        pendingActivities: 0,
        budgetTotal,
        budgetUsed,
        budgetRemaining: Math.max(0, budgetTotal - budgetUsed),
        budgetUsedPercent: budgetTotal > 0 ? Math.min(100, Math.round((budgetUsed / budgetTotal) * 100)) : 0,
        membersOnline: 0,
        membersTotal: memberCount,
        membersStatus: `0/${memberCount} đã điểm danh`,
        weather: {
          temp: 0,
          description: '',
          rainProb: '',
          rainProbTime: '',
        },
        telematics: {
          from: startName,
          to: endName,
          vehicleType,
          driver: 'Chưa phân công',
          driverPhone: '',
          passengerCount: memberCount,
        },
        waypoints: aiWaypoints,
        alerts: [],
        aiSuggestions: aiGeneratedPlan.aiOperationalSuggestions || [
          {
            id: `sug-${Date.now()}`,
            title: 'Lịch trình được sắp xếp tự động',
            badge: 'Tự động',
            description: 'Lộ trình và các chặng đã được tính toán cân bằng thời gian tham quan và di chuyển.',
          },
        ],
        aiSavingsEstimate: typeof aiGeneratedPlan.aiSavingsEstimate === 'string' ? aiGeneratedPlan.aiSavingsEstimate : '',
        aiConfidence: typeof aiGeneratedPlan.aiConfidence === 'string' ? aiGeneratedPlan.aiConfidence : '',
        members: buildMembers(memberCount),
        days: formattedDays,
      };

      newTrip.alerts = createAiRiskAlerts(newTrip.id, aiGeneratedPlan.potentialRisks);
      newTrip.alerts = detectScheduleAndWeatherAlerts(newTrip);

      await onApplyPlan(newTrip);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể lưu chuyến đi.');
    } finally {
      setIsSaving(false);
    }
  };

  const getActivityTypeIcon = (type: string) => {
    switch (type) {
      case 'meal':
        return <UtensilsCrossed className="w-3.5 h-3.5 text-amber-600" />;
      case 'hotel':
        return <Building2 className="w-3.5 h-3.5 text-purple-600" />;
      case 'transport':
        return <Bus className="w-3.5 h-3.5 text-blue-600" />;
      case 'sightseeing':
        return <Mountain className="w-3.5 h-3.5 text-teal-600" />;
      default:
        return <Landmark className="w-3.5 h-3.5 text-slate-600" />;
    }
  };

  const getActivityTypeLabel = (type: string) => {
    switch (type) {
      case 'meal':
        return 'Ăn uống';
      case 'hotel':
        return 'Khách sạn / Lưu trú';
      case 'transport':
        return 'Di chuyển';
      case 'sightseeing':
        return 'Tham quan';
      default:
        return 'Tự do / Khác';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden my-4 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[94vh]">
        {/* Top Header */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shrink-0">
              <Compass className="w-5 h-5 text-teal-100" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">Hoạch định Lịch trình Chuyến đi</h3>
              <p className="text-xs text-teal-100 font-medium">
                Tạo chuyến đi thủ công hoặc sắp xếp lịch trình tự động
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center bg-slate-200/80 p-1 rounded-2xl gap-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab('traditional');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                activeTab === 'traditional'
                  ? 'bg-white text-teal-800 shadow-xs ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-4 h-4 text-teal-600" />
              <span>📋 Lập lịch truyền thống (Thủ công)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('ai');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                activeTab === 'ai'
                  ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Route className="w-4 h-4 text-amber-300" />
              <span>Lập lịch tự động</span>
            </button>
          </div>

          <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
            {activeTab === 'traditional'
              ? 'Tự thiết lập từng ngày & hoạt động'
              : 'Sắp xếp lộ trình và hoạt động theo chuyến đi'}
          </span>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 1: LẬP LỊCH TRUYỀN THỐNG (THỦ CÔNG - ZERO MOCK DATA) */}
          {/* ==================================================== */}
          {activeTab === 'traditional' && (
            <div className="space-y-5">
              {/* Card 1: Thông tin cơ bản chuyến đi */}
              <div className="bg-slate-50/90 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-teal-600" />
                    <span>1. Thông tin chung của chuyến đi</span>
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">Nhập thông tin thực tế</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
                  <div className="sm:col-span-8">
                    <label className="block font-bold text-slate-700 mb-1">
                      Tên hành trình chuyến đi <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={tripTitle}
                      onChange={(e) => setTripTitle(e.target.value)}
                      placeholder="VD: Tour Nha Trang - Đà Lạt 4N3Đ (hoặc tên theo tour thực tế của bạn)"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block font-bold text-slate-700 mb-1">Mã tour / Chuyến đi</label>
                    <input
                      type="text"
                      value={tripCode}
                      onChange={(e) => setTripCode(e.target.value)}
                      placeholder="VD: NT-DL-01"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold uppercase outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block font-bold text-slate-700 mb-1">
                      Điểm xuất phát (Origin)
                    </label>
                    <input
                      type="text"
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value)}
                      placeholder="VD: TP. Hồ Chí Minh / Hà Nội"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block font-bold text-slate-700 mb-1">
                      Điểm đến chính (Destination)
                    </label>
                    <input
                      type="text"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      placeholder="VD: Nha Trang / Đà Lạt / Phú Quốc"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block font-bold text-slate-700 mb-1">Ngày khởi hành</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block font-bold text-slate-700 mb-1">Số ngày hành trình</label>
                    <div className="flex items-center gap-1">
                      <select
                        value={totalDays}
                        onChange={(e) => handleUpdateTotalDays(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold outline-none"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14].map((d) => (
                          <option key={d} value={d}>
                            {d} ngày ({d > 1 ? `${d - 1} đêm` : 'trong ngày'})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block font-bold text-slate-700 mb-1">Phương tiện di chuyển</label>
                    <select
                      value={vehicle}
                      onChange={(e) => setVehicle(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none"
                    >
                      <option value="Xe 7 chỗ">Xe 7 chỗ</option>
                      <option value="Xe 16 chỗ Ford Transit">Xe 16 chỗ</option>
                      <option value="Xe 29 chỗ tiêu chuẩn">Xe 29 chỗ</option>
                      <option value="Xe 45 chỗ Universe">Xe 45 chỗ</option>
                      <option value="Máy bay + Xe đưa đón">Máy bay + Xe đưa đón</option>
                      <option value="Tàu hỏa du lịch">Tàu hỏa du lịch</option>
                      <option value="Tàu cao tốc / Du thuyền">Tàu cao tốc / Du thuyền</option>
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block font-bold text-slate-700 mb-1">Số khách / thành viên</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={membersCount}
                      onChange={(e) => setMembersCount(Math.max(1, Number(e.target.value)))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold outline-none"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block font-bold text-slate-700 mb-1">
                      Tổng ngân sách dự kiến (VNĐ)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={500000}
                      value={budgetEstimated}
                      onChange={(e) =>
                        setBudgetEstimated(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      placeholder="VD: 30000000"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Thiết kế lịch trình chi tiết từng ngày */}
              <div className="bg-slate-50/90 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                  <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-teal-600" />
                    <span>2. Chi tiết các hoạt động theo ngày ({manualDays.length} ngày)</span>
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAddNewDay}
                      className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 text-[11px] font-bold border border-teal-200 transition flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Thêm ngày mới</span>
                    </button>
                    {manualDays.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteActiveDay(activeDayIndex)}
                        className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold border border-rose-200 transition flex items-center gap-1 cursor-pointer"
                        title="Xóa ngày hiện tại"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Xóa Ngày {activeDayIndex}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Day Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  {manualDays.map((day) => {
                    const isSelected = day.dayIndex === activeDayIndex;
                    return (
                      <button
                        key={day.dayIndex}
                        type="button"
                        onClick={() => {
                          setActiveDayIndex(day.dayIndex);
                          setIsActivityFormOpen(false);
                        }}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition shrink-0 flex items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-teal-600 text-white shadow-xs'
                            : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                        }`}
                      >
                        <span>Ngày {day.dayIndex}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                            isSelected ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {day.activities.length}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Active Day Header & Actions */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                      Chủ đề / Ghi chú Ngày {activeDayIndex}:
                    </label>
                    <input
                      type="text"
                      value={currentDay.fullDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setManualDays((prev) =>
                          prev.map((d) => (d.dayIndex === activeDayIndex ? { ...d, fullDate: val } : d))
                        );
                      }}
                      placeholder="VD: Ngày 1: Đón đoàn & tham quan Tháp Bà Ponagar"
                      className="w-full font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-teal-500 outline-none text-xs py-0.5"
                    />
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleAutoArrangeCurrentDay}
                      className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200 transition flex items-center gap-1 cursor-pointer"
                      title="Tự động kiểm tra và sắp xếp lại khung giờ của ngày này nếu có xung đột"
                    >
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      <span>⚡ Tự động xếp lịch ngày này</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenAddActivity}
                      className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm hoạt động</span>
                    </button>
                  </div>
                </div>

                {/* Form Thêm / Chỉnh sửa hoạt động (Inline Form) */}
                {isActivityFormOpen && (
                  <form
                    onSubmit={handleSaveActivity}
                    className="p-4 bg-teal-50/60 rounded-2xl border-2 border-teal-500/30 space-y-3 animate-in fade-in slide-in-from-top-2"
                  >
                    <div className="flex items-center justify-between border-b border-teal-200 pb-2">
                      <h5 className="text-xs font-black text-teal-900 flex items-center gap-1.5">
                        {editingActivityId ? (
                          <>
                            <Edit2 className="w-3.5 h-3.5 text-teal-700" />
                            <span>Chỉnh sửa hoạt động</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5 text-teal-700" />
                            <span>Thêm hoạt động mới vào Ngày {activeDayIndex}</span>
                          </>
                        )}
                      </h5>
                      <button
                        type="button"
                        onClick={() => setIsActivityFormOpen(false)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {actFormError && (
                      <div className="p-2 bg-rose-100 text-rose-800 text-[11px] font-semibold rounded-lg">
                        {actFormError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 text-xs">
                      <div className="sm:col-span-8">
                        <label className="block font-bold text-slate-700 mb-1">
                          Tên hoạt động / Điểm tham quan <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={actTitle}
                          onChange={(e) => setActTitle(e.target.value)}
                          placeholder="VD: Tham quan Tháp Bà Ponagar / Dùng cơm trưa nem nướng"
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-medium outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                        />
                      </div>

                      <div className="sm:col-span-4">
                        <label className="block font-bold text-slate-700 mb-1">Phân loại</label>
                        <select
                          value={actType}
                          onChange={(e) => setActType(e.target.value as any)}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-medium outline-none"
                        >
                          <option value="sightseeing">Tham quan</option>
                          <option value="meal">Ăn uống</option>
                          <option value="transport">Di chuyển</option>
                          <option value="hotel">Lưu trú / Khách sạn</option>
                          <option value="other">Tự do / Khác</option>
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block font-bold text-slate-700 mb-1">Giờ bắt đầu</label>
                        <input
                          type="time"
                          value={actTimeStart}
                          onChange={(e) => setActTimeStart(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-mono outline-none"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block font-bold text-slate-700 mb-1">Giờ kết thúc</label>
                        <input
                          type="time"
                          value={actTimeEnd}
                          onChange={(e) => setActTimeEnd(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-mono outline-none"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block font-bold text-slate-700 mb-1">Địa điểm cụ thể</label>
                        <input
                          type="text"
                          value={actLocation}
                          onChange={(e) => setActLocation(e.target.value)}
                          placeholder="VD: Đường 2/4, Vĩnh Phước, Nha Trang"
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white outline-none"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block font-bold text-slate-700 mb-1">Chi phí dự kiến (VNĐ)</label>
                        <input
                          type="number"
                          min={0}
                          step={50000}
                          value={actCost}
                          onChange={(e) => setActCost(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="VD: 500000"
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-mono outline-none"
                        />
                      </div>

                      <div className="sm:col-span-12">
                        <label className="block font-bold text-slate-700 mb-1">
                          Chi tiết / Yêu cầu vận hành
                        </label>
                        <input
                          type="text"
                          value={actDetails}
                          onChange={(e) => setActDetails(e.target.value)}
                          placeholder="VD: Vé tham quan đã đặt trước, HDV liên hệ ban quản lý trước 15 phút"
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-teal-200">
                      <button
                        type="button"
                        onClick={() => setIsActivityFormOpen(false)}
                        className="px-3 py-1.5 rounded-xl text-slate-600 hover:bg-slate-200 text-xs font-semibold cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                      >
                        {editingActivityId ? 'Cập nhật hoạt động' : 'Lưu hoạt động vào Ngày ' + activeDayIndex}
                      </button>
                    </div>
                  </form>
                )}

                {/* Danh sách hoạt động của Ngày hiện tại */}
                <div className="space-y-2">
                  {currentDay.activities.length === 0 ? (
                    <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-300 text-xs text-slate-500">
                      <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="font-bold text-slate-700">Chưa có hoạt động nào trong Ngày {activeDayIndex}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Nhấp nút &quot;+ Thêm hoạt động&quot; ở trên để tự do thiết lập điểm đến và thời gian theo kế hoạch của bạn.
                      </p>
                    </div>
                  ) : (
                    currentDay.activities.map((act, actIdx) => (
                      <div
                        key={act.id}
                        className="p-3 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition text-xs flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-[11px] text-slate-500 shrink-0">
                            {actIdx + 1}
                          </span>

                          <div className="flex items-center gap-1.5 font-mono font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200 text-xs shrink-0">
                            <Clock className="w-3 h-3 text-teal-600" />
                            <span>
                              {act.timeStart} — {act.timeEnd}
                            </span>
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 truncate">{act.title}</span>
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.2 rounded-full font-bold bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                                {getActivityTypeIcon(act.type)}
                                <span>{getActivityTypeLabel(act.type)}</span>
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5 truncate">
                              <span className="flex items-center gap-1 truncate">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{act.location}</span>
                              </span>
                              {act.cost && act.cost > 0 ? (
                                <span className="font-mono text-emerald-700 font-bold shrink-0">
                                  • {act.cost.toLocaleString('vi-VN')} ₫
                                </span>
                              ) : null}
                              {act.details ? (
                                <span className="text-slate-400 truncate hidden md:inline">
                                  • {act.details}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEditActivity(act)}
                            className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"
                            title="Sửa hoạt động"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteActivity(act.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Xóa hoạt động này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Bottom Summary Bar & Save Button */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-lg">
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Tổng hoạt động:</span>
                    <strong className="text-white text-sm font-black">
                      {totalActivitiesCount} hoạt động
                    </strong>
                  </div>
                  <div className="border-l border-slate-700 pl-4">
                    <span className="text-slate-400 block text-[10px]">Chi phí các hoạt động:</span>
                    <strong className="text-emerald-400 text-sm font-mono font-black">
                      {totalCalculatedCost.toLocaleString('vi-VN')} ₫
                    </strong>
                  </div>
                  {typeof budgetEstimated === 'number' && budgetEstimated > 0 && (
                    <div className="border-l border-slate-700 pl-4">
                      <span className="text-slate-400 block text-[10px]">Ngân sách dự kiến:</span>
                      <strong className="text-amber-300 text-sm font-mono font-black">
                        {budgetEstimated.toLocaleString('vi-VN')} ₫
                      </strong>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleApplyTraditionalSchedule}
                  disabled={isSaving}
                  className="px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-teal-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 shrink-0"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {isSaving
                      ? 'Đang lưu vào Bảng điều phối...'
                      : `Hoàn tất & Khởi tạo Tour (${totalDays} ngày)`}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 2: LẬP LỊCH TỰ ĐỘNG */}
          {/* ==================================================== */}
          {activeTab === 'ai' && (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-teal-50/80 rounded-2xl border border-teal-200/80 flex items-start gap-2.5">
                <Route className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <p className="text-xs text-teal-900 font-medium">
                  Hệ thống sẽ phân tích lộ trình, giờ mở cửa và thời gian di chuyển để đề xuất lịch trình phù hợp.
                </p>
              </div>

              {/* Destination & Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-6">
                  <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-teal-600" />
                    <span>Điểm đến du lịch mong muốn</span>
                  </label>
                  <input
                    type="text"
                    value={aiDestination}
                    onChange={(e) => setAiDestination(e.target.value)}
                    placeholder="VD: Nha Trang, Đà Lạt, Sa Pa, Phú Quốc, Huế..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-teal-600" />
                    <span>Số ngày hành trình</span>
                  </label>
                  <select
                    value={aiDays}
                    onChange={(e) => setAiDays(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none bg-white"
                  >
                    <option value={2}>2 ngày 1 đêm</option>
                    <option value={3}>3 ngày 2 đêm</option>
                    <option value={4}>4 ngày 3 đêm</option>
                    <option value={5}>5 ngày 4 đêm</option>
                    <option value={7}>7 ngày 6 đêm</option>
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-teal-600" />
                    <span>Ngày khởi hành</span>
                  </label>
                  <input
                    type="date"
                    value={aiStartDate}
                    onChange={(e) => setAiStartDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none bg-white"
                  />
                </div>
              </div>

              {/* Budget & Style */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-teal-600" />
                    <span>Mức ngân sách</span>
                  </label>
                  <select
                    value={aiBudget}
                    onChange={(e) => setAiBudget(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none bg-white"
                  >
                    <option value="Tiết kiệm (15 - 25 triệu)">Tiết kiệm (15 - 25 triệu)</option>
                    <option value="Tiêu chuẩn (30 - 45 triệu)">Tiêu chuẩn (30 - 45 triệu)</option>
                    <option value="Cao cấp / Nghỉ dưỡng (> 60 triệu)">Cao cấp / Nghỉ dưỡng (&gt; 60 triệu)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-teal-600" />
                    <span>Phong cách du lịch</span>
                  </label>
                  <input
                    type="text"
                    value={aiTravelStyle}
                    onChange={(e) => setAiTravelStyle(e.target.value)}
                    placeholder="VD: Văn hóa, Di sản, Sinh thái, Biển đảo, Check-in"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none"
                  />
                </div>
              </div>

              {/* Group Profile */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-teal-600" />
                  <span>Đối tượng thành viên đoàn</span>
                </label>
                <input
                  type="text"
                  value={aiGroupType}
                  onChange={(e) => setAiGroupType(e.target.value)}
                  placeholder="VD: Gia đình có trẻ nhỏ, nhóm bạn thân 12 người, đoàn công ty 30 người"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none"
                />
              </div>

              {/* Personal Preferences */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span>Yêu cầu điều phối & Tối ưu hóa đặc biệt</span>
                  </span>
                </label>
                <textarea
                  rows={2}
                  value={aiPreferences}
                  onChange={(e) => setAiPreferences(e.target.value)}
                  placeholder="Ưu tiên điểm tham quan mát mẻ buổi trưa, tránh nắng gắt, ăn hải sản tươi sống, khách sạn ven biển..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none resize-none"
                />
              </div>

              {/* Generate Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleGenerateAI}
                  disabled={aiIsLoading}
                  className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black shadow-md shadow-teal-700/20 transition flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  {aiIsLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{aiJobStatus || 'Đang phân tích và sắp xếp lịch trình...'}</span>
                    </>
                  ) : (
                    <>
                      <Calendar className="w-4 h-4 text-amber-300" />
                      <span>Tạo lịch trình tự động</span>
                    </>
                  )}
                </button>
              </div>

              {/* Generated Plan Preview Box */}
              {aiGeneratedPlan && (
                <div className="mt-3 p-4 rounded-2xl bg-teal-50/70 border border-teal-200/80 animate-in fade-in slide-in-from-bottom-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-teal-600 text-white flex items-center justify-center font-bold text-xs">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <h4 className="text-sm font-extrabold text-teal-900">
                        {aiGeneratedPlan.title || 'Hành trình đề xuất tự động'}
                      </h4>
                    </div>
                    <span className="text-xs font-mono font-bold text-teal-700 bg-white px-2 py-0.5 rounded border border-teal-200">
                      {aiGeneratedPlan.tripCode || 'VN-1025'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white p-2.5 rounded-xl border border-teal-100">
                      <span className="text-slate-400 block text-[10px]">Tuyến di chuyển:</span>
                      <strong className="text-slate-800">
                        {aiGeneratedPlan.routeSummary?.origin || getStartLocation(aiDestination)} →{' '}
                        {aiGeneratedPlan.routeSummary?.destination || aiDestination} (
                        {aiGeneratedPlan.routeSummary?.totalKm || aiDays * 80} km)
                      </strong>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-teal-100">
                      <span className="text-slate-400 block text-[10px]">Phương tiện:</span>
                      <strong className="text-slate-800">
                        {aiGeneratedPlan.routeSummary?.vehicle || 'Xe 29 chỗ tiêu chuẩn'}
                      </strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyAIPlan}
                    disabled={isSaving}
                    className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>
                      {isSaving
                        ? 'Đang lưu chuyến đi...'
                        : 'Nạp lịch trình tự động này vào Bảng điều phối'}
                    </span>
                    {!isSaving && <ArrowRight className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
