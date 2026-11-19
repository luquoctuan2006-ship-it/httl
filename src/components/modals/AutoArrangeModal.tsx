/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  X,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  Sliders,
  Route,
} from 'lucide-react';
import { DaySchedule, TripData } from '../../types/travel';
import {
  autoArrangeDay,
  autoArrangeEntireTrip,
  detectDayScheduleConflicts,
} from '../../utils/schedule/scheduleAutoArranger';
import { syncTripRouteMetadata } from '../../utils/route/tripRouteSync';
import { isLegacyHashedCoordinate } from '../../utils/route/vietnamGeo';
import { fetchRealOsrmRouteSummary } from '../dashboard/live-route-map/useRoadRouting';

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
  const [optimizeRouteOrder, setOptimizeRouteOrder] = useState<boolean>(true);
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const dayResult = useMemo(
    () => autoArrangeDay(currentDay, bufferMinutes, { optimizeRouteOrder }),
    [currentDay, bufferMinutes, optimizeRouteOrder],
  );
  const conflicts = useMemo(
    () => detectDayScheduleConflicts(currentDay.activities, bufferMinutes),
    [currentDay.activities, bufferMinutes],
  );
  const tripResult = useMemo(
    () => autoArrangeEntireTrip(trip, { defaultBuffer: bufferMinutes, optimizeRouteOrder }),
    [trip, bufferMinutes, optimizeRouteOrder],
  );

  if (!isOpen) return null;

  const activeRouteOpt = scope === 'day' ? dayResult.routeOptimization : tripResult.routeOptimization;

  const handleApply = async () => {
    setApplyError(null);
    setIsApplying(true);
    try {
      if (scope === 'day') {
        if (optimizeRouteOrder && dayResult.routeOptimization?.changedOrder) {
          const updatedDays = trip.days.map((d) =>
            d.dayIndex === dayResult.updatedDay.dayIndex ? dayResult.updatedDay : d,
          );
          let updatedTrip = syncTripRouteMetadata({ ...trip, days: updatedDays });
          const locatedCoords = (updatedTrip.waypoints || []).filter(
            (wp) =>
              (Math.abs(wp.lat) > 0.0001 || Math.abs(wp.lng) > 0.0001) &&
              !isLegacyHashedCoordinate(wp.name || '', wp.lat, wp.lng),
          );
          const osrmSummary = await fetchRealOsrmRouteSummary(locatedCoords);
          if (osrmSummary) {
            updatedTrip = { ...updatedTrip, totalKm: osrmSummary.totalKm };
          }
          const savedLabel =
            dayResult.routeOptimization.savedKm > 0
              ? ` (tiết kiệm ${dayResult.routeOptimization.savedKm} km)`
              : '';
          await onApplyTrip(
            updatedTrip,
            `Đã tối ưu lộ trình Ngày ${currentDay.dayIndex}${savedLabel}!`,
          );
        } else {
          await onApplyDay(
            dayResult.updatedDay,
            `Đã tự động sắp xếp lại lịch trình Ngày ${currentDay.dayIndex} (${dayResult.adjustments.length} điều chỉnh)!`,
          );
        }
      } else {
        let finalTrip = tripResult.updatedTrip;
        const locatedCoords = (finalTrip.waypoints || []).filter(
          (wp) =>
            (Math.abs(wp.lat) > 0.0001 || Math.abs(wp.lng) > 0.0001) &&
            !isLegacyHashedCoordinate(wp.name || '', wp.lat, wp.lng),
        );
        const osrmSummary = await fetchRealOsrmRouteSummary(locatedCoords);
        if (osrmSummary) {
          finalTrip = { ...finalTrip, totalKm: osrmSummary.totalKm };
        }
        const savedLabel =
          tripResult.routeOptimization && tripResult.routeOptimization.savedKm > 0
            ? ` · Tiết kiệm ${tripResult.routeOptimization.savedKm} km (${tripResult.routeOptimization.savedPercent}%)`
            : '';
        await onApplyTrip(
          finalTrip,
          `Đã tối ưu & xếp lịch toàn bộ ${trip.totalDays} ngày (${tripResult.totalAdjustmentsCount} điều chỉnh${savedLabel})!`,
        );
      }
      onClose();
    } catch (error) {
      console.error('Lỗi áp dụng sắp xếp tự động:', error);
      setApplyError(error instanceof Error ? error.message : 'Không thể lưu lịch trình mới. Vui lòng thử lại.');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white text-neutral-900 rounded-3xl max-w-2xl w-full border border-neutral-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 bg-neutral-950 border-b-2 border-blue-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-red-600 flex items-center justify-center text-white border border-white/20 shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight">
                Tự động Xếp lịch &amp; Tối ưu Thứ tự Điểm đến (TSP)
              </h3>
              <p className="text-xs text-neutral-300 font-medium">
                Sắp xếp lộ trình ngắn nhất (Nearest Neighbor + 2-opt), loại bỏ chồng chéo &amp; chèn đệm di chuyển
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[72vh] overflow-y-auto text-xs">
          {/* Controls: Scope & Buffer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200">
            <div>
              <label className="block font-bold text-neutral-700 mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>Phạm vi tự động xếp lịch</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5 bg-white p-1 rounded-xl border border-neutral-200">
                <button
                  type="button"
                  onClick={() => setScope('day')}
                  className={`py-1.5 px-2 rounded-lg font-bold text-center transition cursor-pointer ${
                    scope === 'day'
                      ? 'bg-neutral-950 text-white shadow-2xs'
                      : 'text-neutral-600 hover:text-neutral-950'
                  }`}
                >
                  Ngày {currentDay.dayIndex} ({currentDay.dayName})
                </button>
                <button
                  type="button"
                  onClick={() => setScope('trip')}
                  className={`py-1.5 px-2 rounded-lg font-bold text-center transition cursor-pointer ${
                    scope === 'trip'
                      ? 'bg-neutral-950 text-white shadow-2xs'
                      : 'text-neutral-600 hover:text-neutral-950'
                  }`}
                >
                  Toàn tour ({trip.totalDays} ngày)
                </button>
              </div>
            </div>

            <div>
              <label className="block font-bold text-neutral-700 mb-1 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-blue-600" />
                <span>Thời gian đệm di chuyển giữa 2 điểm</span>
              </label>
              <select
                value={bufferMinutes}
                onChange={(e) => setBufferMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-white font-bold text-neutral-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              >
                <option value={15}>15 phút (Đường nội đô thông thoáng)</option>
                <option value={20}>20 phút (Tiêu chuẩn an toàn)</option>
                <option value={30}>30 phút (Đoàn đông / Giờ cao điểm)</option>
              </select>
            </div>

            {/* TSP Toggle */}
            <label className="sm:col-span-2 flex items-start gap-2.5 p-2.5 rounded-xl bg-white border border-neutral-200 cursor-pointer hover:border-blue-300 transition">
              <input
                type="checkbox"
                checked={optimizeRouteOrder}
                onChange={(e) => setOptimizeRouteOrder(e.target.checked)}
                className="mt-0.5 rounded accent-blue-600"
              />
              <div className="flex-1">
                <span className="font-bold text-neutral-950 flex items-center gap-1.5">
                  <Route className="w-3.5 h-3.5 text-blue-600" />
                  <span>Tối ưu thứ tự điểm đến theo khoảng cách (TSP Nearest Neighbor + 2-opt)</span>
                </span>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Giữ nguyên điểm xuất phát / đã hoàn tất và tự động sắp xếp lại các điểm tiếp theo sao cho tổng quãng đường di chuyển ngắn nhất.
                </p>
              </div>
            </label>
          </div>

          {/* TSP Distance Savings Card */}
          {optimizeRouteOrder && activeRouteOpt && activeRouteOpt.originalKm > 0 && (
            <div
              className={`p-3.5 rounded-2xl border flex flex-col gap-2 ${
                activeRouteOpt.savedKm > 0
                  ? 'bg-blue-50/80 border-blue-200 text-blue-950'
                  : 'bg-neutral-50 border-neutral-200 text-neutral-700'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Route className={`w-4 h-4 ${activeRouteOpt.savedKm > 0 ? 'text-blue-600' : 'text-neutral-700'}`} />
                  <span className="font-extrabold text-xs">
                    {activeRouteOpt.savedKm > 0
                      ? 'Phát hiện lộ trình ngắn hơn bằng thuật toán TSP'
                      : 'Thứ tự điểm đến hiện tại đã là tuyến ngắn nhất'}
                  </span>
                </div>
                {activeRouteOpt.savedKm > 0 && (
                  <span className="px-2.5 py-0.5 rounded-md bg-blue-600 text-white font-extrabold text-[11px] tabular-nums">
                    Tiết kiệm được {activeRouteOpt.savedKm} km ({activeRouteOpt.savedPercent}%)
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold tabular-nums">
                <span>
                  Quãng đường ban đầu:{' '}
                  <strong className={activeRouteOpt.savedKm > 0 ? 'line-through text-neutral-500' : 'text-neutral-950'}>
                    {activeRouteOpt.originalKm} km
                  </strong>
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-blue-600" />
                <span>
                  Sau tối ưu TSP:{' '}
                  <strong className="text-blue-700">{activeRouteOpt.optimizedKm} km</strong>
                </span>
              </div>

              {scope === 'day' &&
                activeRouteOpt.changedOrder &&
                activeRouteOpt.orderedStopNames &&
                activeRouteOpt.orderedStopNames.length >= 2 && (
                  <p className="text-[11px] text-blue-950 bg-white/80 rounded-xl px-3 py-2 border border-blue-200/70">
                    <strong className="font-bold">Thứ tự gợi ý: </strong>
                    {activeRouteOpt.orderedStopNames.join(' → ')}
                  </p>
                )}
            </div>
          )}

          {/* Diagnostic overview */}
          {scope === 'day' ? (
            <div>
              {conflicts.length > 0 ? (
                <div className="p-3.5 bg-red-50 rounded-2xl border border-red-200 text-red-900 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-red-950 font-bold">
                      Phát hiện {conflicts.length} xung đột thời gian trong Ngày {currentDay.dayIndex}:
                    </strong>
                    <ul className="list-disc list-inside space-y-1 mt-1 text-[11px] text-red-900">
                      {conflicts.map((c, idx) => (
                        <li key={idx}>{c.message}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-blue-50 rounded-2xl border border-blue-200 text-blue-900 flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    Ngày {currentDay.dayIndex} không có xung đột giờ. Thuật toán đảm bảo khoảng đệm {bufferMinutes} phút giữa các điểm.
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3.5 bg-neutral-950 rounded-2xl border border-neutral-800 text-white flex items-start gap-2.5">
              <Calendar className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-white font-bold">
                  Phân tích tự động toàn bộ {trip.totalDays} ngày:
                </strong>
                <p className="mt-0.5 text-[11px] text-neutral-300">
                  Tìm thấy {tripResult.totalAdjustmentsCount} hoạt động có thể tối ưu thứ tự di chuyển và cân chỉnh lại khung giờ hợp lý.
                </p>
              </div>
            </div>
          )}

          {/* Adjustments Preview List */}
          <div>
            <h4 className="font-bold text-neutral-800 uppercase tracking-wider text-[11px] mb-2 flex items-center justify-between">
              <span>Các hoạt động được thuật toán tự động điều chỉnh:</span>
              <span className="text-blue-700 font-extrabold font-mono tabular-nums">
                {scope === 'day' ? dayResult.adjustments.length : tripResult.totalAdjustmentsCount} mục
              </span>
            </h4>

            {scope === 'day' ? (
              dayResult.adjustments.length === 0 ? (
                <div className="p-4 text-center rounded-xl bg-neutral-50 border border-neutral-200 text-neutral-500 italic">
                  Các mốc giờ và thứ tự điểm hiện tại đã rất chuẩn, không cần điều chỉnh thêm.
                </div>
              ) : (
                <div className="space-y-2">
                  {dayResult.adjustments.map((adj, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-white border border-neutral-200 shadow-2xs hover:border-blue-300 transition"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <strong className="text-neutral-950 font-bold line-clamp-1">
                          {adj.activityTitle}
                        </strong>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-bold shrink-0">
                          {adj.reason}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-mono font-bold tabular-nums">
                        <span className="text-neutral-400 line-through">
                          {adj.originalTimeStart} — {adj.originalTimeEnd}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-blue-600" />
                        <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {adj.newTimeStart} — {adj.newTimeEnd}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : tripResult.dayAdjustments.length === 0 ? (
              <div className="p-4 text-center rounded-xl bg-neutral-50 border border-neutral-200 text-neutral-500 italic">
                Toàn bộ hành trình hiện tại đã được sắp xếp hợp lý.
              </div>
            ) : (
              <div className="space-y-3">
                {tripResult.dayAdjustments.map((dayAdj) => (
                  <div key={dayAdj.dayIndex} className="p-3 rounded-xl bg-neutral-50 border border-neutral-200">
                    <span className="font-bold text-blue-800 text-xs block mb-1.5">
                      Ngày {dayAdj.dayIndex} ({dayAdj.adjustments.length} hoạt động điều chỉnh):
                    </span>
                    <div className="space-y-1.5">
                      {dayAdj.adjustments.map((adj, idx) => (
                        <div key={idx} className="bg-white p-2 rounded-lg border border-neutral-100 flex items-center justify-between text-[11px] gap-2">
                          <span className="font-semibold text-neutral-800 truncate max-w-[240px]">
                            {adj.activityTitle}
                          </span>
                          <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold shrink-0 tabular-nums">
                            <span className="text-neutral-400 line-through">{adj.originalTimeStart}</span>
                            <span>➔</span>
                            <span className="text-blue-700 font-extrabold">{adj.newTimeStart}</span>
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

        {applyError && (
          <div role="alert" className="mx-6 mb-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">
            {applyError}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-200 rounded-xl transition cursor-pointer"
          >
            Đóng
          </button>

          <button
            type="button"
            onClick={handleApply}
            disabled={isApplying}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-red-600 hover:from-blue-500 hover:to-red-500 text-white rounded-xl text-xs font-black shadow-md shadow-blue-900/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
          >
            <Sparkles className="w-4 h-4 text-white" />
            <span>
              {isApplying
                ? 'Đang tối ưu & tính cự ly...'
                : scope === 'day'
                  ? `Áp dụng cho Ngày ${currentDay.dayIndex}`
                  : 'Áp dụng cho Toàn Tour'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

