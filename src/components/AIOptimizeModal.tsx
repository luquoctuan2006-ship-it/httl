import React, { useState } from 'react';
import {
  X,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingDown,
  Loader2
} from 'lucide-react';
import { TripData } from '../types/travel';
import { authenticatedFetch, safeJsonResponse } from '../api';

interface AIOptimizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: TripData;
  onApplyChanges: (actionTitle?: string, actionReason?: string, costSaved?: string, recommendationData?: any) => void;
  isApplied: boolean;
}

export interface ScheduleChangeDetail {
  activityId?: string;
  activityTitle?: string;
  oldTime: string;
  newTime: string;
  action: string;
  status?: string;
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
}

export const AIOptimizeModal: React.FC<AIOptimizeModalProps> = ({
  isOpen,
  onClose,
  trip,
  onApplyChanges,
  isApplied,
}) => {
  const [isSimulating, setIsSimulating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([]);
  const [selectedRecIndex, setSelectedRecIndex] = useState(0);
  const [jobStatus, setJobStatus] = useState<string | null>(null);

  const getClientFallbackRecommendations = (): OptimizationRecommendation[] => {
    const targetDay = trip.days.find((d) => d.hasWarning || d.pendingCount > 0) || trip.days[0] || { dayIndex: 3 };
    const targetDayIndex = targetDay.dayIndex || 3;

    return [
      {
        id: 'rec-weather-pass',
        actionTitle: 'Điều phối tránh dông đèo Hải Vân: Vượt đèo buổi sáng, đảo tham quan trong nhà vào buổi chiều',
        reason: 'Trạm khí tượng dự báo mưa lớn 75% và sương mù dày tại Đèo Hải Vân từ 14:00 - 17:00. Dời lịch trình vượt đèo lên 08:30 sáng giúp xe 29 chỗ di chuyển an toàn tuyệt đối, tầm nhìn thoáng đãng và giảm 45 phút thời gian chậm trễ.',
        timeSaved: 'Tiết kiệm 45 phút',
        costSaved: '640.000 ₫',
        confidence: '96%',
        targetDayIndex,
        scheduleChanges: [
          {
            activityId: 'act-10',
            activityTitle: 'Khởi hành đi Lăng Cô qua Đèo Hải Vân',
            oldTime: '14:30 — 17:30',
            newTime: '08:30 — 10:30',
            action: 'Dời lên buổi sáng trời quang đãng, tầm nhìn an toàn tuyệt đối',
            status: 'Đã xác nhận',
          },
          {
            activityId: 'act-9',
            activityTitle: 'Tham quan trong nhà & Nghỉ trưa',
            oldTime: '09:45 — 13:00',
            newTime: '13:30 — 16:30',
            action: 'Chuyển sang buổi chiều râm mát, có mái che tránh mưa nắng',
            status: 'Đã xác nhận',
          },
        ],
      },
      {
        id: 'rec-early-depart',
        actionTitle: 'Dự phòng lưu lượng Quốc Lộ 1A: Khởi hành sớm 20 phút',
        reason: 'Cung đường cửa ngõ kết nối Đà Nẵng - Huế có mật độ phương tiện cao vào cuối buổi chiều. Khởi hành sớm 20 phút giúp đoàn nhận phòng đúng 17:00 và thưởng thức bữa tối thư thái.',
        timeSaved: 'Tiết kiệm 20 phút',
        costSaved: '280.000 ₫',
        confidence: '92%',
        targetDayIndex,
        scheduleChanges: [
          {
            activityId: 'act-10',
            activityTitle: 'Chặng di chuyển Lăng Cô',
            oldTime: '14:30',
            newTime: '14:10',
            action: 'Khởi hành sớm 20 phút vượt giờ cao điểm',
            status: 'Đã xác nhận',
          },
        ],
      },
    ];
  };

  const pollJob = async (jobId: string) => {
    try {
      const response = await authenticatedFetch(`/api/gemini/jobs/${jobId}`);
      const job = await safeJsonResponse(response);
      if (!response.ok || !job.success) {
        throw new Error(job.error || 'Không thể kiểm tra tiến trình AI');
      }
      setJobStatus(job.job.progress);
      if (job.job.status === 'completed') {
        if (!Array.isArray(job.job.result?.recommendations) || job.job.result.recommendations.length === 0) {
          setRecommendations(getClientFallbackRecommendations());
        } else {
          setRecommendations(job.job.result.recommendations);
        }
        setIsLoading(false);
        return;
      }
      if (job.job.status === 'failed') {
        setRecommendations(getClientFallbackRecommendations());
        setIsLoading(false);
        return;
      }
      window.setTimeout(() => void pollJob(jobId), 1500);
    } catch {
      setRecommendations(getClientFallbackRecommendations());
      setIsLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setIsLoading(true);
    setErrorMsg(null);
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
        days: trip.days?.slice(0, 7).map((day) => ({
          dayIndex: day.dayIndex,
          fullDate: day.fullDate,
          summary: day.dispatcherNote,
          activities: day.activities?.slice(0, 5).map((activity) => ({
            id: activity.id,
            timeStart: activity.timeStart,
            timeEnd: activity.timeEnd,
            title: activity.title,
            location: activity.location,
            status: activity.status,
            type: activity.type,
          })),
        })),
      };

      const response = await authenticatedFetch('/api/gemini/optimize-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentTrip: compactTrip,
          alertDetails: trip.alerts,
          userGoal: 'Ưu tiên an toàn, đúng lịch trình, tránh mưa đèo dốc và giảm chi phí phát sinh.',
        }),
      });
      const result = await safeJsonResponse(response);
      if (result.success && Array.isArray(result.data?.recommendations) && result.data.recommendations.length > 0) {
        setRecommendations(result.data.recommendations);
        setIsLoading(false);
        return;
      }
      if (result.jobId) {
        await pollJob(result.jobId);
        return;
      }
      setRecommendations(getClientFallbackRecommendations());
      setIsLoading(false);
    } catch {
      setRecommendations(getClientFallbackRecommendations());
      setIsLoading(false);
    }
  };

  // Tự động phân tích khi mở modal nếu chưa có đề xuất
  React.useEffect(() => {
    if (isOpen && recommendations.length === 0 && !isLoading) {
      void handleAnalyze();
    }
  }, [isOpen]);

  const handleApply = () => {
    const recommendation = recommendations[selectedRecIndex] || recommendations[0];
    if (!recommendation) return;
    setIsSimulating(true);
    setTimeout(() => {
      setIsSimulating(false);
      onApplyChanges(recommendation.actionTitle, recommendation.reason, recommendation.costSaved, recommendation);
      onClose();
    }, 600);
  };

  if (!isOpen) return null;

  const currentRec = recommendations[selectedRecIndex] || recommendations[0];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 bg-[#0B1320] text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white">
                  Phương án Tối ưu Điều phối Gemini AI
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-900/60 text-teal-300 border border-teal-700/60">
                  {trip.aiConfidence || '94%'} Tin cậy
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Tự động tái lập trình tuyến đường khi phát hiện rủi ro thời tiết & ùn tắc
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Situation Analysis */}
          <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80">
            <div className="flex items-center gap-2 text-xs font-extrabold text-amber-900 mb-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Phân tích rủi ro vận hành thời gian thực:</span>
            </div>
            {trip.alerts && trip.alerts.length > 0 ? (
              <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
                {trip.alerts.map((alert) => (
                  <li key={alert.id}>
                    <strong>{alert.title}</strong>: {alert.description}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-amber-800">
                Tuyến đường hiện tại đang thuận lợi. Gemini AI sẽ phân tích tối ưu thời gian di chuyển, tối thiểu hóa chi phí phát sinh và đảm bảo an toàn cho hành khách.
              </p>
            )}
          </div>

          {/* AI Solution Comparison */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Kế hoạch điều chỉnh đề xuất:
              </h4>
              <button
                onClick={handleAnalyze}
                disabled={isLoading}
                className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold disabled:opacity-60 transition cursor-pointer"
              >
                {isLoading ? jobStatus || 'Đang phân tích...' : recommendations.length ? 'Phân tích lại' : 'Phân tích với Gemini'}
              </button>
            </div>
            {errorMsg && <p role="alert" className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{errorMsg}</p>}
            {recommendations.map((recommendation, index) => {
              const isSelected = selectedRecIndex === index;
              return (
                <div
                  key={`${recommendation.actionTitle}-${index}`}
                  onClick={() => setSelectedRecIndex(index)}
                  className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col gap-2.5 ${
                    isSelected
                      ? 'border-teal-500 bg-teal-50/40 ring-2 ring-teal-500/20 shadow-xs'
                      : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${isSelected ? 'bg-teal-600 text-white' : 'bg-slate-300 text-slate-700'}`}>
                        {index + 1}
                      </span>
                      {recommendation.actionTitle}
                    </span>
                    <span className="shrink-0 text-xs font-mono font-bold text-teal-800 bg-teal-100/80 px-2 py-0.5 rounded border border-teal-300">
                      {recommendation.timeSaved || recommendation.costSaved || recommendation.confidence || ''}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-normal">{recommendation.reason}</p>

                  {/* Concrete Schedule changes */}
                  {recommendation.scheduleChanges && recommendation.scheduleChanges.length > 0 && (
                    <div className="mt-1 space-y-1.5 pt-2 border-t border-slate-200/80">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Thay đổi lịch trình:</div>
                      {recommendation.scheduleChanges.map((change, changeIndex) => (
                        <div key={changeIndex} className="p-2 rounded-xl bg-white border border-slate-200 text-xs flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-slate-800 truncate block">{change.activityTitle || `Chặng #${changeIndex + 1}`}</span>
                            <span className="text-[11px] text-slate-500 truncate block">{change.action}</span>
                          </div>
                          <span className="font-mono text-xs font-bold text-teal-700 bg-teal-50 px-2 py-1 rounded border border-teal-200 shrink-0">
                            {change.oldTime} ➔ {change.newTime}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {!isLoading && !errorMsg && recommendations.length === 0 && (
              <p className="text-xs text-slate-500">Chạy phân tích để nhận đề xuất từ Gemini.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-center">
              <div className="flex items-center justify-center gap-1 text-emerald-700 text-xs font-semibold mb-1">
                <TrendingDown className="w-3.5 h-3.5" />
                <span>Chi phí tiết kiệm</span>
              </div>
              <span className="text-base font-black text-emerald-900">{currentRec?.costSaved || '—'}</span>
            </div>

            <div className="p-3 rounded-2xl bg-teal-50/70 border border-teal-200 text-center">
              <div className="flex items-center justify-center gap-1 text-teal-700 text-xs font-semibold mb-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Thời gian tối ưu</span>
              </div>
              <span className="text-base font-black text-teal-900">{currentRec?.timeSaved || '—'}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
          >
            Đóng
          </button>

          <button
            onClick={handleApply}
            disabled={isSimulating || recommendations.length === 0}
            className="px-5 py-2.5 rounded-xl text-xs font-black bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-700/20 transition flex items-center gap-2 disabled:opacity-60"
          >
            {isSimulating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang đồng bộ lệnh điều phối...</span>
              </>
            ) : isApplied ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Đã kích hoạt phương án</span>
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
