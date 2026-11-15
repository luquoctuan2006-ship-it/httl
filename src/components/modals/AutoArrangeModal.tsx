/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  Sliders,
} from 'lucide-react';
import { DaySchedule, TripData } from '../../types/travel';
import {
  autoArrangeDay,
  autoArrangeEntireTrip,
  detectDayScheduleConflicts,
} from '../../utils/scheduleAutoArranger';

interface AutoArrangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDay: DaySchedule;
  trip: TripData;
  onApplyDay: (updatedDay: DaySchedule, message: string) => Promise<void>;
  onApplyTrip: (updatedTrip: TripData, message: string) => Promise<void>;
}

export const AutoArrangeModal: React.FC<AutoArrangeModalProps> = ({
  isOpen,
  onClose,
  currentDay,
  trip,
  onApplyDay,
  onApplyTrip,
}) => {
  const [scope, setScope] = useState<'day' | 'trip'>('day');
  const [bufferMinutes, setBufferMinutes] = useState<number>(20);
  const [isApplying, setIsApplying] = useState<boolean>(false);

  if (!isOpen) return null;

  // Tính toán kết quả sắp xếp tự động dựa trên cấu hình
  const dayResult = autoArrangeDay(currentDay, bufferMinutes);
  const conflicts = detectDayScheduleConflicts(currentDay.activities, bufferMinutes);
  const tripResult = autoArrangeEntireTrip(trip);

  const handleApply = async () => {
    setIsApplying(true);
    try {
      if (scope === 'day') {
        await onApplyDay(
          dayResult.updatedDay,
          `Đã tự động sắp xếp lại lịch trình Ngày ${currentDay.dayIndex} (${dayResult.adjustments.length} điều chỉnh)!`
        );
      } else {
        await onApplyTrip(
          tripResult.updatedTrip,
          `Đã tự động tối ưu & xếp lịch toàn bộ ${trip.totalDays} ngày (${tripResult.totalAdjustmentsCount} điều chỉnh)!`
        );
      }
      onClose();
    } catch (error) {
      console.error('Lỗi áp dụng sắp xếp tự động:', error);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shrink-0">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight">
                Tự động Lập & Sắp xếp lại Khung giờ Lịch trình
              </h3>
              <p className="text-xs text-teal-100 font-medium">
                Loại bỏ chồng chéo thời gian, chèn đệm di chuyển an toàn & tối ưu trình tự hoạt động
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[72vh] overflow-y-auto text-xs">
          {/* Controls: Scope & Buffer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-teal-600" />
                <span>Phạm vi tự động xếp lịch</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5 bg-white p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setScope('day')}
                  className={`py-1.5 px-2 rounded-lg font-bold text-center transition ${
                    scope === 'day'
                      ? 'bg-teal-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Ngày {currentDay.dayIndex} ({currentDay.dayName})
                </button>
                <button
                  type="button"
                  onClick={() => setScope('trip')}
                  className={`py-1.5 px-2 rounded-lg font-bold text-center transition ${
                    scope === 'trip'
                      ? 'bg-teal-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Toàn tour ({trip.totalDays} ngày)
                </button>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-teal-600" />
                <span>Thời gian đệm di chuyển giữa 2 điểm</span>
              </label>
              <select
                value={bufferMinutes}
                onChange={(e) => setBufferMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
              >
                <option value={15}>15 phút (Đường nội đô thông thoáng)</option>
                <option value={20}>20 phút (Tiêu chuẩn an toàn)</option>
                <option value={30}>30 phút (Đoàn đông / Giờ cao điểm)</option>
              </select>
            </div>
          </div>

          {/* Diagnostic overview */}
          {scope === 'day' ? (
            <div>
              {conflicts.length > 0 ? (
                <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-amber-950 font-bold">
                      Phát hiện {conflicts.length} xung đột thời gian trong Ngày {currentDay.dayIndex}:
                    </strong>
                    <ul className="list-disc list-inside space-y-1 mt-1 text-[11px] text-amber-900">
                      {conflicts.map((c, idx) => (
                        <li key={idx}>{c.message}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-900 flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Hiện tại Ngày {currentDay.dayIndex} không có xung đột nghiêm trọng. Thuật toán sẽ tối ưu thêm khoảng đệm {bufferMinutes} phút di chuyển.
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3.5 bg-teal-50 rounded-2xl border border-teal-200 text-teal-900 flex items-start gap-2.5">
              <Calendar className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-teal-950 font-bold">
                  Phân tích tự động toàn bộ {trip.totalDays} ngày:
                </strong>
                <p className="mt-0.5 text-[11px]">
                  Tìm thấy {tripResult.totalAdjustmentsCount} vị trí có thể căn chỉnh lại giờ để hành trình xuyên suốt, tránh trễ giờ ăn trưa và check-in khách sạn.
                </p>
              </div>
            </div>
          )}

          {/* Adjustments Preview List */}
          <div>
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-2 flex items-center justify-between">
              <span>Các hoạt động được thuật toán tự động điều chỉnh:</span>
              <span className="text-teal-700 font-extrabold font-mono">
                {scope === 'day' ? dayResult.adjustments.length : tripResult.totalAdjustmentsCount} mục
              </span>
            </h4>

            {scope === 'day' ? (
              dayResult.adjustments.length === 0 ? (
                <div className="p-4 text-center rounded-xl bg-slate-50 border border-slate-200 text-slate-500 italic">
                  Các mốc giờ hiện tại đã rất chuẩn, không cần điều chỉnh thêm.
                </div>
              ) : (
                <div className="space-y-2">
                  {dayResult.adjustments.map((adj, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs hover:border-teal-300 transition"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <strong className="text-slate-900 font-bold line-clamp-1">
                          {adj.activityTitle}
                        </strong>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 font-bold shrink-0">
                          {adj.reason}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-mono font-bold">
                        <span className="text-slate-400 line-through">
                          {adj.originalTimeStart} — {adj.originalTimeEnd}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-teal-600" />
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {adj.newTimeStart} — {adj.newTimeEnd}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="space-y-3">
                {tripResult.dayAdjustments.map((dayAdj) => (
                  <div key={dayAdj.dayIndex} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="font-bold text-teal-800 text-xs block mb-1.5">
                      Ngày {dayAdj.dayIndex} ({dayAdj.adjustments.length} hoạt động điều chỉnh):
                    </span>
                    <div className="space-y-1.5">
                      {dayAdj.adjustments.map((adj, idx) => (
                        <div key={idx} className="bg-white p-2 rounded-lg border border-slate-100 flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-800 truncate max-w-[240px]">
                            {adj.activityTitle}
                          </span>
                          <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold shrink-0">
                            <span className="text-slate-400 line-through">{adj.originalTimeStart}</span>
                            <span>➔</span>
                            <span className="text-emerald-700 font-extrabold">{adj.newTimeStart}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition"
          >
            Đóng
          </button>

          <button
            type="button"
            onClick={handleApply}
            disabled={isApplying}
            className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black shadow-md shadow-teal-700/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>
              {isApplying
                ? 'Đang áp dụng lịch tự động...'
                : scope === 'day'
                ? `Áp dụng lịch tự động cho Ngày ${currentDay.dayIndex}`
                : 'Áp dụng lịch tự động cho Toàn Tour'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
