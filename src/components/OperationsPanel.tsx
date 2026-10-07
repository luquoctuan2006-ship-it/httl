import React from 'react';
import {
  AlertTriangle,
  CloudRain,
  Clock,
  Sparkles,
  ArrowRight,
  Shuffle,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { TripData } from '../types/travel';

interface OperationsPanelProps {
  trip: TripData;
  onOpenAlertsModal: () => void;
  onOpenApplyAIPlan: () => void;
  isAIApplied: boolean;
}

export const OperationsPanel: React.FC<OperationsPanelProps> = ({
  trip,
  onOpenAlertsModal,
  onOpenApplyAIPlan,
  isAIApplied,
}) => {
  return (
    <div className="flex flex-col gap-4">
      {/* Box 1: Cảnh báo vận hành */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                Cảnh báo vận hành
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200">
              {trip.alerts.length} mới
            </span>
          </div>

          {/* Alert Items */}
          <div className="space-y-3.5">
            {trip.alerts.slice(0, 2).map((alert) => (
              <div key={alert.id} className="flex items-start gap-3 group">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    alert.category === 'weather'
                      ? 'bg-amber-50 text-amber-600 border border-amber-200'
                      : 'bg-rose-50 text-rose-600 border border-rose-200'
                  }`}
                >
                  {alert.category === 'weather' ? (
                    <CloudRain className="w-4 h-4" />
                  ) : (
                    <Clock className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900">
                      {alert.title}
                    </h4>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {alert.timeAgo}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed font-normal">
                    {alert.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Link */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={onOpenAlertsModal}
            className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1 group transition"
          >
            <span>Xem tất cả cảnh báo</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      {/* Box 2: Voyager AI (Dark Theme) */}
      <div className="bg-[#0B1320] text-white rounded-2xl p-5 border border-slate-800 shadow-md relative overflow-hidden flex flex-col justify-between">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl pointer-events-none"></div>

        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-teal-500/20 border border-teal-500/30 text-teal-400 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Voyager AI
              </h3>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-teal-950/60 text-teal-300 border border-teal-800/80">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
              {isAIApplied ? 'Đã kích hoạt phương án' : 'Đã phân tích'}
            </span>
          </div>

          <p className="text-xs text-slate-400 font-medium mb-3">
            {isAIApplied ? 'Lịch trình đã được tối ưu hoàn tất' : '2 đề xuất ưu tiên'}
          </p>

          {/* AI Suggestions List */}
          <div className="space-y-2.5">
            {/* Suggestion 1 */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-teal-900/40 text-teal-400 flex items-center justify-center shrink-0">
                    <Shuffle className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold text-slate-200">
                    Đảo thứ tự Lăng Cô – Đại Nội
                  </span>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-teal-900/50 text-teal-300 border border-teal-700/50 shrink-0">
                  -36’
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 pl-8">
                Tránh vùng mưa, giảm 36 phút di chuyển.
              </p>
            </div>

            {/* Suggestion 2 */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-emerald-900/40 text-emerald-400 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold text-slate-200">
                    Khởi hành sớm 20 phút
                  </span>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-900/50 text-emerald-300 border border-emerald-700/50 shrink-0">
                  +92%
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 pl-8">
                Dự phòng ùn tắc QL1A, đúng giờ nhận phòng.
              </p>
            </div>
          </div>
        </div>

        {/* Metrics & Action Button */}
        <div className="mt-4 pt-3 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
            <div>
              <span>Tiết kiệm dự kiến: </span>
              <strong className="text-white font-semibold">{trip.aiSavingsEstimate}</strong>
            </div>
            <div>
              <span>Độ tin cậy: </span>
              <strong className="text-teal-300 font-semibold">{trip.aiConfidence}</strong>
            </div>
          </div>

          <button
            onClick={onOpenApplyAIPlan}
            className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm ${
              isAIApplied
                ? 'bg-emerald-600 text-white'
                : 'bg-teal-600 hover:bg-teal-500 text-white active:scale-[0.98]'
            }`}
          >
            {isAIApplied ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Phương án đã được áp dụng</span>
              </>
            ) : (
              <span>Xem & áp dụng phương án</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
