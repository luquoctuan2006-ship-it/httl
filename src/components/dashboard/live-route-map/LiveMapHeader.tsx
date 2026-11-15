import React from 'react';
import { Layers, Map, ChevronDown, Check, RefreshCw, Maximize2 } from 'lucide-react';
import type { TripData } from '../../../types/travel';
import { formatTravelDuration } from '../../../utils/routeProgress';
import type { MapLayer } from './mapHelpers';

interface LiveMapHeaderProps {
  trip: TripData;
  stopCount: number;
  totalRouteKm: number;
  totalTravelMinutes: number;
  dayFilter: number | 'all';
  setDayFilter: React.Dispatch<React.SetStateAction<number | 'all'>>;
  mapLayer: MapLayer;
  setMapLayer: React.Dispatch<React.SetStateAction<MapLayer>>;
  layerDropdownOpen: boolean;
  setLayerDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
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
    dayFilter,
    setDayFilter,
    mapLayer,
    setMapLayer,
    layerDropdownOpen,
    setLayerDropdownOpen,
    isRefreshingWeather,
    handleFetchLiveWeather,
    handleFitRoute,
  } = props;

  return (
    <div className="p-4 sm:px-5 border-b border-slate-100 bg-white z-10 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center shrink-0">
            <Map className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900 leading-tight">
              Bản đồ tuyến đường & Tiến độ lịch trình
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {trip.originFull} → {trip.destinationFull} • {stopCount} địa điểm tham quan • {totalRouteKm} km • ~{formatTravelDuration(totalTravelMinutes)} di chuyển
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleFitRoute}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs"
            title="Thu gọn để xem toàn bộ tuyến đường trên bản đồ"
          >
            <Maximize2 className="w-3.5 h-3.5 text-teal-600" />
            <span>Toàn tuyến</span>
          </button>

          <button
            type="button"
            onClick={handleFetchLiveWeather}
            disabled={isRefreshingWeather}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold transition shadow-2xs disabled:opacity-60"
            title="Cập nhật dự báo thời tiết thực tế dọc tuyến đường"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingWeather ? 'animate-spin' : ''}`} />
            <span>{isRefreshingWeather ? 'Đang cập nhật...' : 'Thời tiết Live API'}</span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setLayerDropdownOpen(!layerDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition"
            >
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>{mapLayer === 'satellite' ? 'Ảnh vệ tinh' : 'Bản đồ đường phố'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {layerDropdownOpen && (
              <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-30 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setMapLayer('streets');
                    setLayerDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-50 ${mapLayer === 'streets' ? 'text-teal-700 font-bold bg-teal-50/50' : 'text-slate-700'}`}
                >
                  <span>Bản đồ đường phố</span>
                  {mapLayer === 'streets' && <Check className="w-3.5 h-3.5 text-teal-600" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMapLayer('satellite');
                    setLayerDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-50 ${mapLayer === 'satellite' ? 'text-teal-700 font-bold bg-teal-50/50' : 'text-slate-700'}`}
                >
                  <span>Ảnh vệ tinh (Esri)</span>
                  {mapLayer === 'satellite' && <Check className="w-3.5 h-3.5 text-teal-600" />}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Day Filter Strip */}
      {trip.days && trip.days.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => setDayFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition shrink-0 ${
              dayFilter === 'all'
                ? 'bg-teal-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Toàn hành trình
          </button>
          {trip.days.map((day) => (
            <button
              key={day.dayIndex}
              type="button"
              onClick={() => setDayFilter(day.dayIndex)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition shrink-0 ${
                dayFilter === day.dayIndex
                  ? 'bg-teal-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
