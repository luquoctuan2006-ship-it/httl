import React from 'react';
import { Map, RefreshCw, Maximize2 } from 'lucide-react';
import type { TripData } from '../../../types/travel';
import { formatTravelDuration, type RouteProgressSummary } from '../../../utils/route/routeProgress';

interface LiveMapHeaderProps {
  trip: TripData;
  stopCount: number;
  totalRouteKm: number;
  totalTravelMinutes: number;
  routingSource: RouteProgressSummary['routingSource'];
  isRoutingLoading: boolean;
  dayFilter: number | 'all';
  setDayFilter: React.Dispatch<React.SetStateAction<number | 'all'>>;
  isRefreshingWeather: boolean;
  handleFetchLiveWeather: () => Promise<void>;
  handleFitRoute: () => void;
}

export const LiveMapHeader: React.FC<LiveMapHeaderProps> = (props) => {
  const {
    trip,
    stopCount,
    totalRouteKm,
    totalTravelMinutes,
    routingSource,
    isRoutingLoading,
    dayFilter,
    setDayFilter,
    isRefreshingWeather,
    handleFetchLiveWeather,
    handleFitRoute,
  } = props;

  const routeSourceLabel = isRoutingLoading
    ? 'Đang tính đường bộ OSRM...'
    : routingSource === 'osrm'
      ? 'Đường bộ OSRM'
      : routingSource === 'mixed'
        ? 'OSRM + ước tính'
        : 'Ước tính tọa độ';

  return (
    <div className="p-4 sm:px-5 border-b border-neutral-100 bg-white z-10 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-neutral-950 border border-neutral-800 text-blue-400 flex items-center justify-center shrink-0">
            <Map className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-neutral-950 leading-tight">
              Bản đồ tuyến đường & Tiến độ lịch trình
            </h2>
            <p className="text-xs text-neutral-500 font-medium mt-0.5 tabular-nums">
              {trip.originFull} → {trip.destinationFull} • {stopCount} địa điểm tham quan • {totalRouteKm} km • ~{formatTravelDuration(totalTravelMinutes)} ({routeSourceLabel})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleFitRoute}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 text-xs font-bold transition shadow-2xs cursor-pointer"
            title="Thu gọn để xem toàn bộ tuyến đường trên bản đồ"
          >
            <Maximize2 className="w-3.5 h-3.5 text-red-600" />
            <span>Toàn tuyến</span>
          </button>

          <button
            type="button"
            onClick={handleFetchLiveWeather}
            disabled={isRefreshingWeather}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold transition shadow-2xs disabled:opacity-60 cursor-pointer"
            title="Tự động cập nhật thời tiết hiện tại (hôm nay) tại các điểm dọc tuyến mỗi 10 phút khi đang mở; nhấn để làm mới và lưu ngay"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingWeather ? 'animate-spin' : ''}`} />
            <span>{isRefreshingWeather ? 'Đang cập nhật...' : 'Làm mới thời tiết'}</span>
          </button>

        </div>
      </div>

      {/* Day Filter Strip */}
      {trip.days && trip.days.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => setDayFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
              dayFilter === 'all'
                ? 'bg-neutral-950 text-white shadow-2xs'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            Toàn hành trình
          </button>
          {trip.days.map((day) => (
            <button
              key={day.dayIndex}
              type="button"
              onClick={() => setDayFilter(day.dayIndex)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                dayFilter === day.dayIndex
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Ngày {day.dayIndex}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
