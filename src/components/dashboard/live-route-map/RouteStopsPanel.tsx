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
  Route,
  Sparkles,
} from 'lucide-react';
import type { RouteStopWeather } from '../../../types/travel';
import {
  formatTravelDuration,
  type RouteProgressSummary,
  type RouteStopItem,
  type RouteStopStatus,
} from '../../../utils/route/routeProgress';
import { findStopWeather } from './mapHelpers';
import { getStopKey } from './useLiveRouteMap';

interface RouteStopsPanelProps {
  progress: RouteProgressSummary;
  stopForecasts?: RouteStopWeather[];
  selectedStopKey: string | null;
  onFocusStop: (stop: RouteStopItem) => void;
  onChangeStopStatus?: (stop: RouteStopItem, nextStatus: RouteStopStatus) => void;
  onOpenStopActivity?: (stop: RouteStopItem) => void;
  tspPreview?: {
    originalKm: number;
    optimizedKm: number;
    savedKm: number;
    savedPercent: number;
    isApplying: boolean;
    onApply: () => void;
  };
  osrmSyncAction?: {
    osrmKm: number;
    currentTripKm: number;
    onSync: () => void;
  };
}

const STATUS_BADGE: Record<RouteStopStatus, { label: string; badgeClass: string; dotClass: string }> = {
  completed: {
    label: 'Đã tham quan',
    badgeClass: 'bg-neutral-100 text-neutral-900 border-neutral-300',
    dotClass: 'bg-neutral-950 text-white',
  },
  current: {
    label: 'Đang tham quan',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
    dotClass: 'bg-red-600 text-white',
  },
  pending: {
    label: 'Sắp tới',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    dotClass: 'bg-blue-600 text-white',
  },
};

export const RouteStopsPanel: React.FC<RouteStopsPanelProps> = ({
  progress,
  stopForecasts,
  selectedStopKey,
  onFocusStop,
  onChangeStopStatus,
  onOpenStopActivity,
  tspPreview,
  osrmSyncAction,
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
    <div className="border-t border-neutral-100 bg-neutral-50/80 p-4 sm:px-5 space-y-3">
      {/* Section Header & Progress Summary Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-red-600" />
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-neutral-800">
            Thứ tự địa điểm & Chặng di chuyển
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-600 font-semibold tabular-nums">
          <span>
            Hoàn tất: <strong className="text-neutral-950">{completedStops}/{totalStops}</strong> ({stopProgressPercent}%)
          </span>
          <span className="text-neutral-300">•</span>
          <span>
            Tổng quãng đường {routingSource === 'osrm' ? 'đường bộ' : 'ước tính'}:{' '}
            <strong className="text-neutral-950">{totalRouteKm} km</strong>
          </span>
          <span className="text-neutral-300">•</span>
          <span>
            Thời gian dự kiến: <strong className="text-blue-700">~{formatTravelDuration(totalTravelMinutes)}</strong>
          </span>
        </div>
      </div>

      {/* TSP Optimization & OSRM Distance Sync Banners */}
      {tspPreview && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/80 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 text-xs text-blue-950 min-w-0">
            <Route className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              Thuật toán <strong>TSP (Nearest Neighbor + 2-opt)</strong> tìm thấy lộ trình ngắn hơn:{' '}
              <span className="line-through text-neutral-500">{tspPreview.originalKm} km</span>{' '}
              ➔ <strong className="text-blue-700">{tspPreview.optimizedKm} km</strong>{' '}
              <span className="font-extrabold text-red-600">
                (tiết kiệm {tspPreview.savedKm} km · {tspPreview.savedPercent}%)
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={tspPreview.onApply}
            disabled={tspPreview.isApplying}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60 shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{tspPreview.isApplying ? 'Đang sắp xếp...' : 'Sắp xếp lộ trình ngắn nhất'}</span>
          </button>
        </div>
      )}

      {osrmSyncAction && (
        <div className="rounded-xl border border-neutral-200 bg-white px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-800">
          <span>
            Khoảng cách đường bộ thực tế từ <strong>OSRM</strong> là{' '}
            <strong className="text-blue-700">{osrmSyncAction.osrmKm} km</strong> (thông số chuyến hiện lưu{' '}
            {osrmSyncAction.currentTripKm} km).
          </span>
          <button
            type="button"
            onClick={osrmSyncAction.onSync}
            className="px-2.5 py-1 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-white font-bold transition cursor-pointer shrink-0"
          >
            Cập nhật {osrmSyncAction.osrmKm} km thực tế
          </button>
        </div>
      )}

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
                  ? 'border-blue-600 ring-2 ring-blue-500/20'
                  : 'border-neutral-200 hover:border-blue-400'
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
                      <span className="text-xs font-extrabold text-neutral-950 group-hover:text-blue-700 transition truncate">
                        {stop.name}
                      </span>
                      {stop.dayIndex && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600">
                          Ngày {stop.dayIndex}
                        </span>
                      )}
                    </div>
                    {stop.activityTitle && stop.activityTitle !== stop.name && (
                      <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                        {stop.activityTitle}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-neutral-500">
                      {stop.timeLabel && (
                        <span className="flex items-center gap-1 font-medium text-neutral-600">
                          <Clock className="w-3 h-3 text-neutral-400" />
                          {stop.timeLabel}
                        </span>
                      )}
                      {!stop.hasCoordinates ? (
                        <span className="font-semibold text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200/70">
                          Chưa có tọa độ (không tính chặng)
                        </span>
                      ) : isFirstLocatedStop ? (
                        <span className="flex items-center gap-1 font-semibold text-neutral-600">
                          <Navigation2 className="w-3 h-3 text-blue-600" />
                          Xuất phát (0 km)
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                          <ArrowDownRight className="w-3 h-3" />
                          {stop.legSource === 'osrm' ? '' : '~'}
                          {stop.distanceFromPrevKm} km • {formatTravelDuration(stop.travelMinutesFromPrev)}
                        </span>
                      )}
                      {stopWeather && (
                        <span
                          className="flex items-center gap-1 font-semibold text-neutral-800 bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200"
                          title={`Thời tiết hiện tại (hôm nay) tại điểm: ${stopWeather.description}${stopWeather.rainProbTime ? ` (${stopWeather.rainProbTime})` : ''}`}
                        >
                          <CloudSun className="w-3 h-3 text-blue-600" />
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
                      className="text-[10px] font-bold text-neutral-500 hover:text-blue-700 flex items-center gap-1 transition cursor-pointer"
                      title="Xem hoạt động tương ứng trong lịch trình"
                    >
                      {stop.status === 'completed' ? (
                        <CheckCircle2 className="w-3 h-3 text-neutral-900" />
                      ) : (
                        <MapPin className="w-3 h-3 text-red-500" />
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

      <p className="text-[11px] text-neutral-500 flex flex-wrap items-center justify-between gap-2">
        <span>{routingFootnote}</span>
        {unlocatedStopsCount > 0 && (
          <span className="font-semibold text-red-700">
            {unlocatedStopsCount} địa điểm chưa xác định được tọa độ.
          </span>
        )}
      </p>
    </div>
  );
};
