import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingDown,
  Loader2,
  FileDiff,
  Eye,
  RotateCcw,
} from 'lucide-react';
import { TripData } from '../../types/travel';
import { authenticatedFetch, safeJsonResponse } from '../../api';
import { computeOptimizationDiff, OptimizationDiff } from '../../utils/schedule/applyOptimization';
import { buildTripScheduleSignature } from '../../utils/trip/tripSyncHelpers';

const MAX_POLL_DURATION_MS = 90_000;

interface AIOptimizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: TripData;
  onApplyChanges: (actionTitle?: string, actionReason?: string, costSaved?: string, recommendationData?: any) => void;
  isApplied: boolean;
  onUndo?: () => void;
  canUndo?: boolean;
}

export interface ScheduleChangeDetail {
  activityId?: string;
  activityTitle?: string;
  oldTime: string;
  newTime: string;
  action: string;
  status?: string;
}

export interface ValidationViolation {
  code: string;
  message: string;
  activityId?: string;
}

export interface OptimizationValidation {
  source: 'gemini' | 'fallback';
  tripSource?: 'server' | 'client';
  repaired: boolean;
  checked: number;
  accepted: number;
  rejected: { id?: string; actionTitle: string; violations: ValidationViolation[] }[];
}

export interface OptimizationRecommendation {
  id?: string;
  actionTitle: string;
  reason: string;
  timeSaved?: string;
  costSaved?: string;
  confidence?: string;
  targetDayIndex?: number;
  scheduleChanges?: ScheduleChangeDetail[];
  updatedActivities?: any[];
  /** Cảnh báo mềm từ bộ kiểm tra khả thi (đề xuất vẫn hợp lệ). */
  warnings?: ValidationViolation[];
}

export const AIOptimizeModal: React.FC<AIOptimizeModalProps> = ({
  isOpen,
  onClose,
  trip,
  onApplyChanges,
  isApplied,
  onUndo,
  canUndo,
}) => {
  const [isSimulating, setIsSimulating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([]);
  const [selectedRecIndex, setSelectedRecIndex] = useState(0);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [validation, setValidation] = useState<OptimizationValidation | null>(null);
  const [activeViewMode, setActiveViewMode] = useState<'cards' | 'diff'>('cards');

  const pollTimeoutRef = useRef<number | null>(null);
  const applyTimeoutRef = useRef<number | null>(null);
  const pollRunIdRef = useRef(0);
  const tripScheduleSignature = buildTripScheduleSignature(trip);

  const clearPolling = () => {
    if (pollTimeoutRef.current !== null) {
      window.clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    if (applyTimeoutRef.current !== null) {
      window.clearTimeout(applyTimeoutRef.current);
      applyTimeoutRef.current = null;
      setIsSimulating(false);
    }
  };

  // Nhận kết quả từ server. Server đã lọc đề xuất qua bộ kiểm tra khả thi nên client
  // KHÔNG tự bịa đề xuất dự phòng nữa: rỗng nghĩa là không có phương án nào an toàn để áp dụng.
  const applyResult = (data: any) => {
    const recs: OptimizationRecommendation[] = Array.isArray(data?.recommendations) ? data.recommendations : [];
    const info: OptimizationValidation | null = data?.validation ?? null;
    setRecommendations(recs);
    setSelectedRecIndex(0);
    setValidation(info);
    if (recs.length === 0) {
      setErrorMsg(
        info && info.checked > 0
          ? `Không có phương án nào vượt qua kiểm tra khả thi (${info.rejected.length}/${info.checked} bị loại). Xem lý do bên dưới hoặc điều chỉnh quy tắc rồi phân tích lại.`
          : 'Chưa có phương án phù hợp từ hệ thống. Hãy thử phân tích lại sau.',
      );
    }
    setIsLoading(false);
  };

  const failAnalysis = (message: string) => {
    setRecommendations([]);
    setValidation(null);
    setErrorMsg(message);
    setIsLoading(false);
  };

  const pollJob = async (jobId: string, runId: number, startedAt: number) => {
    if (pollRunIdRef.current !== runId) return;
    if (Date.now() - startedAt > MAX_POLL_DURATION_MS) {
      failAnalysis('Quá thời gian chờ phân tích chuyến đi (90 giây). Vui lòng thử lại.');
      return;
    }

    try {
      const response = await authenticatedFetch(`/api/gemini/jobs/${jobId}`);
      if (pollRunIdRef.current !== runId) return;
      const job = await safeJsonResponse(response);
      if (pollRunIdRef.current !== runId) return;
      if (!response.ok || !job.success) {
        throw new Error(job.error || 'Không thể kiểm tra tiến độ tối ưu');
      }
      setJobStatus(job.job.progress);
      if (job.job.status === 'completed') {
        applyResult(job.job.result);
        return;
      }
      if (job.job.status === 'failed') {
        failAnalysis(job.job.error || 'Phân tích lịch trình thất bại. Vui lòng thử lại.');
        return;
      }
      clearPolling();
      pollTimeoutRef.current = window.setTimeout(() => {
        void pollJob(jobId, runId, startedAt);
      }, 1500);
    } catch (error) {
      if (pollRunIdRef.current !== runId) return;
      failAnalysis(error instanceof Error ? error.message : 'Không thể kiểm tra tiến trình phân tích.');
    }
  };

  const handleAnalyze = async () => {
    clearPolling();
    const runId = ++pollRunIdRef.current;
    const startedAt = Date.now();
    setIsLoading(true);
    setErrorMsg(null);
    setValidation(null);
    setJobStatus('Đang phân tích dữ liệu vận hành');
    try {
      const compactTrip = {
        id: trip.id,
        title: trip.title,
        dates: trip.dates,
        origin: trip.origin,
        destination: trip.destination,
        totalDays: trip.totalDays,
        totalKm: trip.totalKm,
        vehicle: trip.vehicle,
        budgetTotal: trip.budgetTotal,
        days: trip.days?.map((day) => ({
          dayIndex: day.dayIndex,
          fullDate: day.fullDate,
          dispatcherNote: day.dispatcherNote,
          hasWarning: day.hasWarning,
          pendingCount: day.pendingCount,
          activities: day.activities?.map((activity) => ({
            id: activity.id,
            timeStart: activity.timeStart,
            timeEnd: activity.timeEnd,
            title: activity.title,
            location: activity.location,
            status: activity.status,
            type: activity.type,
            cost: activity.cost,
            coordinates: activity.coordinates,
          })),
        })),
        waypoints: trip.waypoints?.map((w) => ({ name: w.name, lat: w.lat, lng: w.lng, openHours: w.openHours })),
      };

      const response = await authenticatedFetch('/api/gemini/optimize-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentTrip: compactTrip,
          alertDetails: trip.alerts,
          userGoal: 'Ưu tiên an toàn, đúng lịch trình, tránh thời tiết xấu và giảm chi phí phát sinh.',
        }),
      });
      if (pollRunIdRef.current !== runId) return;
      const result = await safeJsonResponse(response);
      if (pollRunIdRef.current !== runId) return;
      if (result.success && result.data) {
        applyResult(result.data);
        return;
      }
      if (result.jobId) {
        await pollJob(result.jobId, runId, startedAt);
        return;
      }
      failAnalysis(result.error || 'Không nhận được phương án từ hệ thống.');
    } catch (error) {
      if (pollRunIdRef.current !== runId) return;
      failAnalysis(error instanceof Error ? error.message : 'Không thể kết nối để phân tích lịch trình.');
    }
  };

  // Xóa kết quả cũ, hủy timer/polling và tự động phân tích lại khi mở modal hoặc khi lịch trình thay đổi
  useEffect(() => {
    clearPolling();
    pollRunIdRef.current += 1;
    setRecommendations([]);
    setSelectedRecIndex(0);
    setValidation(null);
    setErrorMsg(null);
    setJobStatus(null);
    setActiveViewMode('cards');
    setIsLoading(false);
    if (isOpen) {
      void handleAnalyze();
    }
    return () => {
      clearPolling();
      pollRunIdRef.current += 1;
    };
  }, [isOpen, tripScheduleSignature]);

  const handleApply = () => {
    const recommendation = recommendations[selectedRecIndex] || recommendations[0];
    if (!recommendation) return;
    clearPolling();
    setIsSimulating(true);
    applyTimeoutRef.current = window.setTimeout(() => {
      applyTimeoutRef.current = null;
      setIsSimulating(false);
      onApplyChanges(recommendation.actionTitle, recommendation.reason, recommendation.costSaved, recommendation);
      onClose();
    }, 600);
  };

  if (!isOpen) return null;

  const currentRec = recommendations[selectedRecIndex] || recommendations[0];
  const diff: OptimizationDiff | null = currentRec ? computeOptimizationDiff(trip, currentRec) : null;
  const isFallback = validation?.source === 'fallback';

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white text-neutral-900 rounded-3xl max-w-2xl w-full border border-neutral-200 shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div
          className={`px-6 py-4 bg-neutral-950 text-white flex items-center justify-between border-b-2 shrink-0 ${
            isFallback ? 'border-red-600' : 'border-blue-600'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
              isFallback
                ? 'bg-red-600/20 text-red-400 border-red-500/30'
                : 'bg-blue-600/20 text-blue-400 border-blue-500/30'
            }`}>
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white">
                  {isFallback ? 'Tối ưu theo quy tắc lịch trình' : 'Phương án tối ưu chuyến đi'}
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                  isFallback
                    ? 'bg-red-950/70 text-red-300 border-red-700/60'
                    : 'bg-blue-950/70 text-blue-300 border-blue-700/60'
                }`}>
                  {isFallback ? 'Dự phòng quy tắc' : 'Đề xuất AI'}
                </span>
              </div>
              <p className="text-xs text-neutral-400 font-medium">
                {isFallback
                  ? 'Tối ưu tự động theo dữ liệu chuyến đi thực tế & quy tắc đã kiểm định'
                  : 'Tự động rà soát và sắp xếp lại lịch trình khi phát hiện xung đột hoặc thời tiết xấu'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Fallback Notice Banner */}
          {isFallback && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-900 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-extrabold text-red-900">
                  Thông báo chế độ dự phòng (Fallback Active):
                </p>
                <p className="text-red-800 leading-relaxed font-medium">
                  Dịch vụ lập lịch không khả dụng. Hệ thống đã chuyển sang <strong>bộ tối ưu theo quy tắc vận hành</strong>, sử dụng dữ liệu chuyến đi thật để kiểm tra khung giờ, thời gian đệm và xung đột.
                </p>
              </div>
            </div>
          )}

          {/* Situation Analysis */}
          <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 text-xs font-extrabold text-neutral-900">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span>Rủi ro vận hành đang ghi nhận ({trip.alerts?.length || 0} cảnh báo):</span>
              </div>
              <span className="text-[11px] text-neutral-500 font-medium">
                {trip.origin} ➔ {trip.destination}
              </span>
            </div>
            {trip.alerts && trip.alerts.length > 0 ? (
              <ul className="text-xs text-neutral-700 space-y-1 list-disc list-inside">
                {trip.alerts.map((alert) => (
                  <li key={alert.id}>
                    <strong className="text-neutral-950">{alert.title}</strong>: {alert.description}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-neutral-600">
                Tuyến đường hiện tại đang thuận lợi. Hệ thống tối ưu sẽ rà soát thời gian di chuyển, tối thiểu hóa chi phí phát sinh và đảm bảo nhịp độ nghỉ ngơi cho hành khách.
              </p>
            )}
          </div>

          {/* Tabs: Cards View vs Diff Preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 border-b border-neutral-200 pb-2">
              <div className="flex items-center gap-1.5 p-1 bg-neutral-100 rounded-xl text-xs font-bold text-neutral-700">
                <button
                  type="button"
                  onClick={() => setActiveViewMode('cards')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer ${
                    activeViewMode === 'cards'
                      ? 'bg-neutral-950 text-white shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-950'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Phương án đề xuất ({recommendations.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveViewMode('diff')}
                  disabled={!currentRec}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 ${
                    activeViewMode === 'diff'
                      ? 'bg-neutral-950 text-white shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-950'
                  }`}
                >
                  <FileDiff className="w-3.5 h-3.5" />
                  <span>Xem trước khác biệt (Diff Preview)</span>
                </button>
              </div>

              <button
                onClick={handleAnalyze}
                disabled={isLoading}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold disabled:opacity-60 transition cursor-pointer"
              >
                {isLoading ? jobStatus || 'Đang phân tích...' : recommendations.length ? 'Phân tích lại' : 'Phân tích ngay'}
              </button>
            </div>

            {errorMsg && (
              <p role="alert" className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
                {errorMsg}
              </p>
            )}

            {validation && validation.checked > 0 && (
              <p className="text-[11px] text-neutral-500">
                Kiểm tra khả thi: <strong>{validation.accepted}/{validation.checked}</strong> phương án đạt tiêu chuẩn
                {validation.repaired ? ' (Hệ thống đã tự điều chỉnh một lần theo quy tắc)' : ''}.
                {isFallback && ' Nguồn dữ liệu: Quy tắc vận hành nội bộ (Fallback).'}
              </p>
            )}

            {validation && validation.rejected.length > 0 && (
              <details className="text-xs text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-xl p-3">
                <summary className="cursor-pointer font-bold text-neutral-800">
                  {validation.rejected.length} phương án bị loại vì không khả thi
                </summary>
                <ul className="mt-2 space-y-2">
                  {validation.rejected.map((item, index) => (
                    <li key={`${item.id ?? 'rej'}-${index}`}>
                      <span className="font-semibold text-neutral-900">{item.actionTitle}</span>
                      <ul className="list-disc list-inside text-[11px] text-neutral-500">
                        {item.violations.map((violation, vIndex) => (
                          <li key={vIndex}>{violation.message}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {/* TAB 1: CARDS VIEW */}
            {activeViewMode === 'cards' && (
              <div className="space-y-3">
                {recommendations.map((recommendation, index) => {
                  const isSelected = selectedRecIndex === index;
                  return (
                    <div
                      key={`${recommendation.actionTitle}-${index}`}
                      onClick={() => setSelectedRecIndex(index)}
                      className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col gap-2.5 ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-600/20 shadow-xs'
                          : 'border-neutral-200 bg-neutral-50/70 hover:bg-neutral-100/70'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            isSelected ? 'bg-blue-600 text-white' : 'bg-neutral-300 text-neutral-800'
                          }`}>
                            {index + 1}
                          </span>
                          <span className="text-xs font-black text-neutral-950">
                            {recommendation.actionTitle}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isFallback ? (
                            <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                              Quy tắc nội bộ
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded border border-blue-300">
                              Phương án tự động
                            </span>
                          )}
                          <span className="text-xs font-mono font-bold text-neutral-700 bg-white px-2 py-0.5 rounded border border-neutral-300">
                            {recommendation.timeSaved || recommendation.costSaved || ''}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-neutral-600 leading-relaxed font-normal">{recommendation.reason}</p>

                      {recommendation.warnings && recommendation.warnings.length > 0 && (
                        <ul className="text-[11px] text-red-800 bg-red-50 border border-red-200 rounded-lg p-2 list-disc list-inside space-y-0.5">
                          {recommendation.warnings.map((warning, wIndex) => (
                            <li key={wIndex}>{warning.message}</li>
                          ))}
                        </ul>
                      )}

                      {/* Schedule changes list */}
                      {recommendation.scheduleChanges && recommendation.scheduleChanges.length > 0 && (
                        <div className="mt-1 space-y-1.5 pt-2 border-t border-neutral-200/80">
                          <div className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                            Thay đổi lịch trình (Ngày {recommendation.targetDayIndex || 3}):
                          </div>
                          {recommendation.scheduleChanges.map((change, changeIndex) => (
                            <div key={changeIndex} className="p-2.5 rounded-xl bg-white border border-neutral-200 text-xs flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-[10px] font-bold text-neutral-500 bg-neutral-100 px-1 rounded">
                                    {change.activityId}
                                  </span>
                                  <span className="font-bold text-neutral-900 truncate block">
                                    {change.activityTitle || `Hoạt động #${changeIndex + 1}`}
                                  </span>
                                </div>
                                <span className="text-[11px] text-neutral-500 truncate block mt-0.5">
                                  {change.action}
                                </span>
                              </div>
                              <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-200 shrink-0 tabular-nums">
                                {change.oldTime} ➔ {change.newTime}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 2: DIFF PREVIEW VIEW */}
            {activeViewMode === 'diff' && diff && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Diff Summary Bar */}
                <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-2xl flex items-center justify-between text-xs text-white">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-blue-400">Xem trước ngày {diff.targetDayIndex}:</span>
                    <span className="font-semibold text-neutral-200">
                      {diff.changedCount} hoạt động thay đổi • {diff.resolvedAlertsCount} cảnh báo khắc phục • {diff.remainingAlertsCount} cảnh báo giữ nguyên
                    </span>
                  </div>
                  <span className="font-mono font-bold text-[11px] bg-blue-600 px-2 py-0.5 rounded border border-blue-500 text-white">
                    {diff.timeSaved || diff.costSaved || 'An toàn'}
                  </span>
                </div>

                {/* Activities Diff Table */}
                <div className="border border-neutral-200 rounded-2xl overflow-hidden shadow-xs">
                  <div className="bg-neutral-100 px-3.5 py-2 border-b border-neutral-200 flex items-center justify-between text-[11px] font-extrabold text-neutral-600 uppercase tracking-wider">
                    <span>So sánh lịch trình hoạt động</span>
                    <span>Trước ➔ Sau tối ưu</span>
                  </div>

                  <div className="divide-y divide-neutral-100 bg-white">
                    {diff.activityDiffs.map((actDiff) => (
                      <div
                        key={actDiff.activityId}
                        className={`p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition ${
                          actDiff.isChanged
                            ? 'bg-blue-50/50 ring-1 ring-inset ring-blue-500/30'
                            : 'bg-white text-neutral-500 opacity-75'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] font-bold text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                              {actDiff.activityId}
                            </span>
                            <span className="font-bold text-neutral-950 truncate">
                              {actDiff.title}
                            </span>
                            {actDiff.isChanged ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                                Điều chỉnh
                              </span>
                            ) : (
                              <span className="text-[10px] text-neutral-400 font-medium">
                                Giữ nguyên
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                            {actDiff.location} • {actDiff.action || actDiff.before.details}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 font-mono text-xs shrink-0 tabular-nums">
                          <span className={`px-2 py-0.5 rounded ${actDiff.isChanged ? 'line-through text-neutral-400 bg-neutral-100' : 'text-neutral-600'}`}>
                            {actDiff.before.timeStart}–{actDiff.before.timeEnd}
                          </span>
                          {actDiff.isChanged && (
                            <>
                              <span className="text-blue-600 font-bold">➔</span>
                              <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-extrabold shadow-xs">
                                {actDiff.after.timeStart}–{actDiff.after.timeEnd}
                              </span>
                              {actDiff.timeDeltaMinutes !== null && actDiff.timeDeltaMinutes !== 0 && (
                                <span className="text-[10px] font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                                  {actDiff.timeDeltaMinutes < 0 ? `Sớm ${Math.abs(actDiff.timeDeltaMinutes)}'` : `Trễ ${actDiff.timeDeltaMinutes}'`}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Alerts Impact Section */}
                <div className="border border-neutral-200 rounded-2xl p-3.5 bg-neutral-50/70 space-y-2">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-600 flex items-center justify-between">
                    <span>Tác động tới các cảnh báo vận hành</span>
                    <span className="text-[10px] font-normal text-neutral-500">
                      Chỉ xóa cảnh báo được đề xuất xử lý thực tế
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {diff.alertDiffs.map((ad, idx) => (
                      <div
                        key={ad.alert.id || idx}
                        className={`p-2.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                          ad.isResolved
                            ? 'bg-blue-50/80 border-blue-200 text-blue-950'
                            : 'bg-red-50/70 border-red-200 text-red-950'
                        }`}
                      >
                        {ad.isResolved ? (
                          <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold">
                              {ad.alert.title}
                            </span>
                            <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                              ad.isResolved
                                ? 'bg-blue-200/70 text-blue-900'
                                : 'bg-red-200/70 text-red-900'
                            }`}>
                              {ad.isResolved ? 'Sẽ được giải quyết' : 'Vẫn giữ nguyên'}
                            </span>
                          </div>
                          <p className="text-[11px] opacity-80 mt-0.5">
                            {ad.isResolved ? ad.resolveReason || 'Được giải quyết bởi phương án tối ưu này.' : ad.alert.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!isLoading && !errorMsg && recommendations.length === 0 && (
              <p className="text-xs text-neutral-500">Chạy phân tích để nhận đề xuất từ hệ thống.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-2xl bg-neutral-950 border border-neutral-800 text-center text-white">
              <div className="flex items-center justify-center gap-1 text-blue-400 text-xs font-semibold mb-1">
                <TrendingDown className="w-3.5 h-3.5" />
                <span>Chi phí tiết kiệm</span>
              </div>
              <span className="text-base font-black text-white tabular-nums">{currentRec?.costSaved || '—'}</span>
            </div>

            <div className="p-3 rounded-2xl bg-blue-50/80 border border-blue-200 text-center">
              <div className="flex items-center justify-center gap-1 text-blue-700 text-xs font-semibold mb-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Thời gian tối ưu</span>
              </div>
              <span className="text-base font-black text-neutral-950 tabular-nums">{currentRec?.timeSaved || '—'}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:px-6 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-600 hover:bg-neutral-200 transition cursor-pointer"
            >
              Đóng
            </button>
            {canUndo && onUndo && (
              <button
                type="button"
                onClick={() => {
                  onUndo();
                  onClose();
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-red-50 hover:bg-red-100 text-red-800 transition flex items-center gap-1.5 cursor-pointer border border-red-200"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Hoàn tác thay đổi lịch</span>
              </button>
            )}
          </div>

          <button
            onClick={handleApply}
            disabled={isSimulating || recommendations.length === 0}
            className="px-5 py-2.5 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-900/20 transition flex items-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {isSimulating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang áp dụng thay đổi lịch...</span>
              </>
            ) : isApplied ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Cập nhật phương án mới</span>
              </>
            ) : (
              <>
                <span>Xác nhận & Áp dụng ngay</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

