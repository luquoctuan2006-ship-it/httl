import React, { useEffect, useRef, useState } from 'react';
import { authenticatedFetch, safeJsonResponse } from '../../../api';
import { createAiRiskAlerts, detectScheduleAndWeatherAlerts } from '../../../utils/alertDetector';
import { computeTripBudgetSummaryFields } from '../../../utils/budgetAlerts';
import { countPassengerMembers } from '../../../utils/tripJoinHelpers';
import { buildAIPlanWaypoints } from '../../../utils/vietnamGeo';
import type { TripData } from '../../../types/travel';
import {
  buildMembers,
  buildTripDatesLabel,
  computeEstimatedRouteKm,
  getEndLocation,
  getStartLocation,
  getTodayISODate,
  mapAiBudgetBreakdownToAllocations,
  normalizeAiGeneratedDays,
  normalizeAiMoney,
  normalizeAiSuggestions,
  parseGroupSize,
  type TripCreatorOwner,
} from './helpers';

interface UseAiTripPlannerOptions {
  owner?: TripCreatorOwner;
  isOpen: boolean;
  initialTab: 'traditional' | 'ai';
  onApplyPlan: (trip: TripData) => Promise<void>;
  onClose: () => void;
  setErrorMsg: React.Dispatch<React.SetStateAction<string | null>>;
  setSuccessMsg: React.Dispatch<React.SetStateAction<string | null>>;
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useAiTripPlanner({
  owner,
  isOpen,
  initialTab,
  onApplyPlan,
  onClose,
  setErrorMsg,
  setSuccessMsg,
  setIsSaving,
}: UseAiTripPlannerOptions) {
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
    'Ưu tiên điểm tham quan mát mẻ buổi trưa, ẩm thực địa phương đặc sắc, hành trình di chuyển hợp lý',
  );
  const [aiIsLoading, setAiIsLoading] = useState(false);
  const [aiJobStatus, setAiJobStatus] = useState<string | null>(null);
  const [aiGeneratedPlan, setAiGeneratedPlan] = useState<any>(null);

  const aiPollTimerRef = useRef<number | null>(null);
  const aiPollRunIdRef = useRef(0);

  const clearAiPolling = () => {
    if (aiPollTimerRef.current !== null) {
      window.clearTimeout(aiPollTimerRef.current);
      aiPollTimerRef.current = null;
    }
  };

  useEffect(() => {
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
      const stamp = Date.now();
      const memberCount = parseGroupSize(aiGroupType);
      const unitHint = typeof aiGeneratedPlan.budget?.unit === 'string' ? aiGeneratedPlan.budget.unit : undefined;
      const formattedDays = normalizeAiGeneratedDays(aiGeneratedPlan.days, aiStartDate, unitHint, stamp);
      const formattedActivities = formattedDays.flatMap((day) => day.activities);
      if (formattedActivities.length === 0) {
        throw new Error('Gemini chưa tạo hoạt động nào cho lịch trình. Vui lòng tạo lại.');
      }
      const totalActs = formattedActivities.length;
      const resolvedDaysCount = formattedDays.length || aiDays;

      const startName =
        typeof aiGeneratedPlan.routeSummary?.origin === 'string' && aiGeneratedPlan.routeSummary.origin.trim()
          ? aiGeneratedPlan.routeSummary.origin.trim()
          : getStartLocation(aiDestination);
      const endName =
        typeof aiGeneratedPlan.routeSummary?.destination === 'string' && aiGeneratedPlan.routeSummary.destination.trim()
          ? aiGeneratedPlan.routeSummary.destination.trim()
          : getEndLocation(aiDestination);

      const aiWaypoints = buildAIPlanWaypoints(startName, endName, formattedActivities);

      const rawTotalKm = Number(aiGeneratedPlan.routeSummary?.totalKm);
      const totalKm =
        Number.isFinite(rawTotalKm) && rawTotalKm > 0
          ? Math.round(rawTotalKm)
          : computeEstimatedRouteKm(aiWaypoints, resolvedDaysCount * 80);

      const vehicleType =
        (typeof aiGeneratedPlan.routeSummary?.vehicle === 'string' && aiGeneratedPlan.routeSummary.vehicle.trim()) ||
        (memberCount > 16 ? 'Xe 29 chỗ' : 'Xe 16 chỗ');

      const realActivityCosts = formattedActivities.reduce((sum, a) => sum + (Number(a.cost) || 0), 0);
      const parsedBudgetTotal = normalizeAiMoney(aiGeneratedPlan.budget?.total, unitHint);
      const budgetTotal =
        parsedBudgetTotal > 0
          ? parsedBudgetTotal
          : Math.max(Math.round(realActivityCosts * 1.15), 0);

      const customCategoryAllocations = mapAiBudgetBreakdownToAllocations(
        aiGeneratedPlan.budget?.breakdown,
        unitHint,
      );

      const { aiSuggestions, aiSavingsEstimate, aiConfidence } = normalizeAiSuggestions(
        aiGeneratedPlan.aiOperationalSuggestions,
        aiGeneratedPlan.aiSavingsEstimate,
        aiGeneratedPlan.aiConfidence,
      );

      const members = buildMembers(memberCount, owner);
      const membersOnline = members.filter((m) => m.status === 'online').length;

      const newTrip: TripData = {
        id: `trip-ai-${stamp}`,
        code:
          (typeof aiGeneratedPlan.tripCode === 'string' && aiGeneratedPlan.tripCode.trim().toUpperCase()) ||
          `VN-${Math.floor(100 + Math.random() * 900)}`,
        title:
          (typeof aiGeneratedPlan.title === 'string' && aiGeneratedPlan.title.trim()) ||
          `Hành trình khám phá ${aiDestination} ${resolvedDaysCount} ngày`,
        status: 'Chuẩn bị',
        dates: buildTripDatesLabel(aiStartDate, resolvedDaysCount),
        origin: startName.slice(0, 3).toUpperCase(),
        originFull: startName,
        destination: endName.slice(0, 3).toUpperCase(),
        destinationFull: endName,
        destinationsCount: aiWaypoints.length || resolvedDaysCount,
        totalKm,
        vehicle: vehicleType,
        currentDay: 1,
        totalDays: resolvedDaysCount,
        totalActivities: totalActs,
        confirmedActivities: totalActs,
        pendingActivities: 0,
        budgetTotal,
        budgetUsed: 0,
        budgetRemaining: budgetTotal,
        budgetUsedPercent: 0,
        ...(customCategoryAllocations ? { customCategoryAllocations } : {}),
        membersOnline,
        membersTotal: members.length,
        membersStatus: `0/${members.length} đã điểm danh`,
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
          passengerCount: countPassengerMembers(members),
        },
        waypoints: aiWaypoints,
        alerts: [],
        aiSuggestions,
        aiSavingsEstimate,
        aiConfidence,
        members,
        days: formattedDays,
      };

      Object.assign(newTrip, computeTripBudgetSummaryFields(newTrip));

      newTrip.alerts = createAiRiskAlerts(newTrip.id, aiGeneratedPlan.potentialRisks);
      newTrip.alerts = detectScheduleAndWeatherAlerts(newTrip);

      await onApplyPlan(newTrip);
      setAiGeneratedPlan(null);
      setAiJobStatus(null);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể lưu chuyến đi.');
    } finally {
      setIsSaving(false);
    }
  };

  return {
    aiDestination, setAiDestination, aiDays, setAiDays, aiStartDate, setAiStartDate, aiBudget, setAiBudget,
    aiTravelStyle, setAiTravelStyle, aiGroupType, setAiGroupType, aiPreferences, setAiPreferences,
    aiIsLoading, aiJobStatus, aiGeneratedPlan, getStartLocation, onGenerateAI: handleGenerateAI,
    onApplyAIPlan: handleApplyAIPlan,
  };
}
