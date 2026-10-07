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
import { authenticatedFetch } from '../api';

interface AIOptimizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: TripData;
  onApplyChanges: (actionTitle?: string, actionReason?: string, costSaved?: string) => void;
  isApplied: boolean;
}

interface OptimizationRecommendation {
  actionTitle: string;
  reason: string;
  timeSaved?: string;
  costSaved?: string;
  confidence?: string;
  scheduleChanges?: { oldTime: string; newTime: string; action: string }[];
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

  if (!isOpen) return null;

  const handleAnalyze = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setRecommendations([]);
    try {
      const response = await authenticatedFetch('/api/gemini/optimize-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentTrip: trip,
          alertDetails: trip.alerts,
          userGoal: 'Ưu tiên an toàn, đúng lịch trình và giảm chi phí phát sinh.',
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Không thể tối ưu lịch trình bằng Gemini');
      }
      if (!Array.isArray(result.data?.recommendations) || result.data.recommendations.length === 0) {
        throw new Error('Gemini không trả về đề xuất tối ưu hợp lệ');
      }
      setRecommendations(result.data.recommendations);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Không thể tối ưu lịch trình bằng Gemini');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    const recommendation = recommendations[0];
    if (!recommendation) return;
    setIsSimulating(true);
    setTimeout(() => {
      setIsSimulating(false);
      onApplyChanges(recommendation.actionTitle, recommendation.reason, recommendation.costSaved);
      onClose();
    }, 600);
  };

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
                  94% Tin cậy
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Tự động tái lập trình tuyến đường khi phát hiện rủi ro thời tiết & ùn tắc
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
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
            <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
              <li>Mưa giông cường độ lớn tại đèo Hải Vân - Lăng Cô từ 15:00 - 17:00 (Xác suất 75%).</li>
              <li>Giờ nhận phòng dự kiến tại Lăng Cô Bay Retreat (14:00) trùng thời gian đoàn đang di chuyển.</li>
            </ul>
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
                className="px-3 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold disabled:opacity-60"
              >
                {isLoading ? 'Gemini đang phân tích...' : recommendations.length ? 'Phân tích lại' : 'Phân tích với Gemini'}
              </button>
            </div>
            {errorMsg && <p role="alert" className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{errorMsg}</p>}
            {recommendations.map((recommendation, index) => (
              <div key={`${recommendation.actionTitle}-${index}`} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    {index === 0 ? <ShieldCheck className="w-4 h-4 text-teal-600" /> : <Clock className="w-4 h-4 text-emerald-600" />}
                    {recommendation.actionTitle}
                  </span>
                  <span className="shrink-0 text-xs font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                    {recommendation.timeSaved || recommendation.costSaved || recommendation.confidence || ''}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{recommendation.reason}</p>
                {recommendation.scheduleChanges?.map((change, changeIndex) => (
                  <p key={changeIndex} className="text-xs text-slate-500">
                    {change.oldTime} → {change.newTime}: {change.action}
                  </p>
                ))}
              </div>
            ))}
            {!isLoading && !errorMsg && recommendations.length === 0 && (
              <p className="text-xs text-slate-500">Chạy phân tích để nhận đề xuất từ Gemini.</p>
            )}
          </div>

          {/* Estimated Benefits */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-center">
              <div className="flex items-center justify-center gap-1 text-emerald-700 text-xs font-semibold mb-1">
                <TrendingDown className="w-3.5 h-3.5" />
                <span>Chi phí tiết kiệm</span>
              </div>
              <span className="text-base font-black text-emerald-900">{recommendations[0]?.costSaved || '—'}</span>
            </div>

            <div className="p-3 rounded-2xl bg-teal-50/70 border border-teal-200 text-center">
              <div className="flex items-center justify-center gap-1 text-teal-700 text-xs font-semibold mb-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Thời gian tối ưu</span>
              </div>
              <span className="text-base font-black text-teal-900">{recommendations[0]?.timeSaved || '—'}</span>
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
