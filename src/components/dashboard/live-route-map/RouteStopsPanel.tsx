import React from 'react';
import {
  ArrowDownRight,
  CheckCircle2,
  Clock,
  CloudSun,
  Compass,
  ExternalLink,
  MapPin,
  Navigation2,
} from 'lucide-react';
import type { RouteStopWeather } from '../../../types/travel';
import {
  formatTravelDuration,
  type RouteProgressSummary,
  type RouteStopItem,
  type RouteStopStatus,
} from '../../../utils/routeProgress';
import { findStopWeather } from './mapHelpers';
import { getStopKey } from './useLiveRouteMap';

interface RouteStopsPanelProps {
  progress: RouteProgressSummary;
  stopForecasts?: RouteStopWeather[];
  selectedStopKey: string | null;
  onFocusStop: (stop: RouteStopItem) => void;
  onChangeStopStatus?: (stop: RouteStopItem, nextStatus: RouteStopStatus) => void;
  onOpenStopActivity?: (stop: RouteStopItem) => void;
}

const STATUS_BADGE: Record<RouteStopStatus, { label: string; badgeClass: string; dotClass: string }> = {
  completed: {
    label: 'Đã tham quan',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-600 text-white',
  },
  current: {
    label: 'Đang tham quan',
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
    dotClass: 'bg-teal-600 text-white',
  },
  pending: {
    label: 'Sắp tới',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    dotClass: 'bg-indigo-600 text-white',
  },
};

export const RouteStopsPanel: React.FC<RouteStopsPanelProps> = ({
  progress,
  stopForecasts,
  selectedStopKey,
  onFocusStop,
  onChangeStopStatus,
  onOpenStopActivity,
}) => {
  const {
    stops,
    totalStops,
    completedStops,
    totalRouteKm,
    totalTravelMinutes,
    stopProgressPercent,
    routingSource,
    unlocatedStopsCount,
  } = progress;

  if (stops.length === 0) {
    return null;
  }

  let seenFirstLocatedStop = false;

  const routingFootnote =
    routingSource === 'osrm'
      ? 'Quãng đường & thời gian chặng được tính theo tuyến đường bộ từ OSRM; tiến độ cập nhật theo trạng thái điểm dừng trên lịch trình (không sử dụng GPS theo dõi xe).'
      : routingSource === 'mixed'
        ? 'Một số chặng sử dụng tuyến đường bộ OSRM, các chặng còn lại tạm ước tính theo tọa độ; tiến độ cập nhật theo trạng thái điểm dừng (không sử dụng GPS xe).'
        : 'Hiện chưa kết nối được dữ liệu đường bộ OSRM nên khoảng cách & thời gian chặng đang tạm ước tính theo tọa độ; tiến độ cập nhật theo trạng thái điểm dừng (không sử dụng GPS xe).';

  return (
    <div className="border-t border-slate-100 bg-slate-50/70 p-4 sm:px-5 space-y-3">
      {/* Section Header & Progress Summary Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-teal-600" />
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
            Thứ tự địa điểm & Chặng di chuyển
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-semibold">
          <span>
            Hoàn tất: <strong className="text-emerald-700">{completedStops}/{totalStops}</strong> ({stopProgressPercent}%)
          </span>
          <span className="text-slate-300">•</span>
          <span>
            Tổng quãng đường {routingSource === 'osrm' ? 'đường bộ' : 'ước tính'}:{' '}
            <strong className="text-slate-900">{totalRouteKm} km</strong>
          </span>
          <span className="text-slate-300">•</span>
          <span>
            Thời gian dự kiến: <strong className="text-teal-700">~{formatTravelDuration(totalTravelMinutes)}</strong>
          </span>
        </div>
      </div>

      {/* Ordered Stops List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
        {stops.map((stop) => {
          const key = getStopKey(stop);
          const isSelected = selectedStopKey === key;
          const style = STATUS_BADGE[stop.status];
          const isFirstLocatedStop = stop.hasCoordinates && !seenFirstLocatedStop;
          if (stop.hasCoordinates) {
            seenFirstLocatedStop = true;
          }
          const stopWeather = findStopWeather(stop, stopForecasts);

          return (
            <div
              key={key}
              className={`rounded-xl border bg-white p-3 transition shadow-2xs ${
                isSelected
                  ? 'border-teal-500 ring-2 ring-teal-500/20'
                  : 'border-slate-200 hover:border-teal-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onFocusStop(stop)}
                  title={
                    stop.hasCoordinates
                      ? 'Nhấp để xem vị trí điểm dừng trên bản đồ'
                      : 'Điểm dừng chưa có tọa độ để định vị trên bản đồ'
                  }
                  className="flex items-start gap-2.5 text-left min-w-0 flex-1 cursor-pointer group"
                >
                  <span
                    className={`w-6 h-6 rounded-full text-[11px] font-extrabold flex items-center justify-center shrink-0 mt-0.5 ${style.dotClass}`}
                  >
                    {stop.order}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-extrabold text-slate-900 group-hover:text-teal-700 transition truncate">
                        {stop.name}
                      </span>
                      {stop.dayIndex && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          Ngày {stop.dayIndex}
                        </span>
                      )}
                    </div>
                    {stop.activityTitle && stop.activityTitle !== stop.name && (
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {stop.activityTitle}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-500">
                      {stop.timeLabel && (
                        <span className="flex items-center gap-1 font-medium text-slate-600">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {stop.timeLabel}
                        </span>
                      )}
                      {!stop.hasCoordinates ? (
                        <span className="font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/70">
                          Chưa có tọa độ (không tính chặng)
                        </span>
                      ) : isFirstLocatedStop ? (
                        <span className="flex items-center gap-1 font-semibold text-slate-500">
                          <Navigation2 className="w-3 h-3 text-teal-600" />
                          Xuất phát (0 km)
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 font-semibold text-teal-700 bg-teal-50/70 px-1.5 py-0.5 rounded">
                          <ArrowDownRight className="w-3 h-3" />
                          {stop.legSource === 'osrm' ? '' : '~'}
                          {stop.distanceFromPrevKm} km • {formatTravelDuration(stop.travelMinutesFromPrev)}
                        </span>
                      )}
                      {stopWeather && (
                        <span
                          className="flex items-center gap-1 font-semibold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200/70"
                          title={`Thời tiết hiện tại (hôm nay) tại điểm: ${stopWeather.description}${stopWeather.rainProbTime ? ` (${stopWeather.rainProbTime})` : ''}`}
                        >
                          <CloudSun className="w-3 h-3 text-amber-500" />
                          {stopWeather.temp}°C{stopWeather.rainProb ? ` • ${stopWeather.rainProb}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {onChangeStopStatus ? (
                    <select
                      aria-label={`Tiến độ tại ${stop.name}`}
                      value={stop.status}
                      onChange={(e) => onChangeStopStatus(stop, e.target.value as RouteStopStatus)}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg border outline-none cursor-pointer ${style.badgeClass}`}
                    >
                      <option value="pending">Sắp tới</option>
                      <option value="current">Đang tham quan</option>
                      <option value="completed">Đã tham quan</option>
                    </select>
                  ) : (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${style.badgeClass}`}>
                      {style.label}
                    </span>
                  )}

                  {onOpenStopActivity && (
                    <button
                      type="button"
                      onClick={() => onOpenStopActivity(stop)}
                      className="text-[10px] font-bold text-slate-500 hover:text-teal-700 flex items-center gap-1 transition cursor-pointer"
                      title="Xem hoạt động tương ứng trong lịch trình"
                    >
                      {stop.status === 'completed' ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <MapPin className="w-3 h-3" />
                      )}
                      <span>Chi tiết</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
        <span>{routingFootnote}</span>
        {unlocatedStopsCount > 0 && (
          <span className="font-semibold text-amber-700">
            {unlocatedStopsCount} địa điểm chưa xác định được tọa độ.
          </span>
        )}
      </p>
    </div>
  );
};
