import React from 'react';
import { Clock, CloudSun, Droplets, Maximize2, Minus, Plus, Route, Wind } from 'lucide-react';
import type { TripData } from '../../../types/travel';
import { formatTravelDuration, type RouteProgressSummary } from '../../../utils/route/routeProgress';
import { findStopWeather } from './mapHelpers';

interface LiveMapCanvasProps {
  weather: TripData['weather'];
  isRefreshingWeather: boolean;
  progress: RouteProgressSummary;
  mapContainerRef: React.RefObject<HTMLDivElement | null>;
  weatherNotice: string | null;
  setWeatherNotice: React.Dispatch<React.SetStateAction<string | null>>;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleFitRoute: () => void;
}

export const LiveMapCanvas: React.FC<LiveMapCanvasProps> = (props) => {
  const {
    weather,
    isRefreshingWeather,
    progress,
    mapContainerRef,
    weatherNotice,
    setWeatherNotice,
    handleZoomIn,
    handleZoomOut,
    handleFitRoute,
  } = props;

  const {
    totalStops,
    locatedStopsCount,
    unlocatedStopsCount,
    completedStops,
    currentStop,
    nextStop,
    nextLegDistanceKm,
    nextLegMinutes,
    totalRouteKm,
    totalTravelMinutes,
    remainingKm,
    remainingMinutes,
    stopProgressPercent,
    activityProgressPercent,
    completedActivitiesCount,
    confirmedActivitiesCount,
    totalActivitiesCount,
  } = progress;

  const stopForecasts = weather?.stopForecasts || [];
  const currentStopWeather = currentStop ? findStopWeather(currentStop, stopForecasts) : undefined;
  const nextStopWeather = nextStop ? findStopWeather(nextStop, stopForecasts) : undefined;

  const hasWeatherData = Boolean(
    currentStopWeather || weather.isLive || weather.description || weather.rainProb || weather.temp !== 0,
  );
  const displayTemp = currentStopWeather?.temp ?? weather.temp;
  const displayDesc =
    currentStopWeather?.description ||
    weather.description ||
    (isRefreshingWeather ? 'Đang tải dự báo...' : 'Chưa có dữ liệu');
  const displayRain = currentStopWeather?.rainProb || weather.rainProb || 'Không có dữ liệu';
  const displayRainTime = currentStopWeather?.rainProbTime || weather.rainProbTime;
  const displayHumidity = currentStopWeather?.humidity ?? weather.humidity;

  return (
    <>
      {weatherNotice && (
        <div className="bg-teal-600 text-white text-xs px-4 py-2 flex items-center justify-between z-20">
          <span>{weatherNotice}</span>
          <button type="button" onClick={() => setWeatherNotice(null)} className="font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Interactive Map Canvas Container */}
      <div className="relative w-full h-[380px] md:h-[430px] bg-slate-100 overflow-hidden">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {locatedStopsCount === 0 && (
          <div className="absolute inset-0 z-[5] flex items-center justify-center bg-white/85 pointer-events-none">
            <p className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-600 shadow-sm">
              Chưa có địa điểm tham quan có tọa độ trong phạm vi đang chọn.
            </p>
          </div>
        )}

        {/* Floating Live Weather Widget (Top Right) */}
        <div className="absolute top-4 right-4 bg-white/95 rounded-2xl p-3 shadow-lg border border-slate-200/90 z-10 max-w-xs space-y-1.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0 border border-amber-200">
              <CloudSun className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-black text-slate-900 leading-tight">
                  {hasWeatherData ? `${displayTemp}°C` : '—'}
                </span>
                <span className="text-xs font-bold text-slate-700 truncate">
                  • {displayDesc}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                <span className="flex items-center gap-0.5">
                  <Droplets className="w-3 h-3 text-blue-500" />
                  Mưa: {displayRain}
                  {displayRainTime ? ` (${displayRainTime})` : ''}
                </span>
                {typeof displayHumidity === 'number' && displayHumidity > 0 && (
                  <span className="flex items-center gap-0.5">
                    <Wind className="w-3 h-3 text-teal-500" /> {displayHumidity}%
                  </span>
                )}
              </div>
            </div>
          </div>

          {(currentStopWeather || nextStopWeather || stopForecasts.length > 1 || weather.lastFetched) && (
            <div className="pt-1.5 border-t border-slate-100 text-[10px] text-slate-600 space-y-0.5">
              {currentStopWeather && (
                <div className="truncate font-semibold text-slate-700">
                  Hiện tại ở #{currentStop?.order} {currentStopWeather.stopName}
                </div>
              )}
              {nextStopWeather && nextStop && nextStopWeather.stopId !== currentStopWeather?.stopId && (
                <div className="truncate text-teal-700 font-semibold">
                  Kế tiếp ở #{nextStop.order} {nextStop.name}: {nextStopWeather.temp}°C • {nextStopWeather.description}
                  {nextStopWeather.rainProb ? ` (Mưa ${nextStopWeather.rainProb})` : ''}
                </div>
              )}
              {(stopForecasts.length > 1 || weather.lastFetched) && (
                <div className="text-slate-400">
                  {stopForecasts.length > 1
                    ? `Thời tiết hôm nay tại ${stopForecasts.length} điểm dọc tuyến`
                    : 'Thời tiết thực tế hôm nay'}
                  {weather.lastFetched ? ` • Cập nhật lúc ${weather.lastFetched}` : ''}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Floating Route & Schedule Progress Card (Bottom Left) */}
        {totalStops > 0 && (
          <div className="absolute bottom-4 left-4 max-w-sm sm:max-w-md bg-slate-900/95 text-white rounded-2xl p-3.5 shadow-xl border border-slate-700/80 z-10 space-y-2">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-slate-800 text-teal-400 border border-slate-700 flex items-center justify-center shrink-0">
                  <Route className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-black text-white truncate">
                    Tiến độ tuyến: {completedStops}/{totalStops} điểm ({stopProgressPercent}%)
                  </div>
                  <div className="text-[11px] text-slate-300 truncate">
                    {totalActivitiesCount > 0
                      ? `${completedActivitiesCount}/${totalActivitiesCount} hoàn tất (${activityProgressPercent}%) • ${confirmedActivitiesCount}/${totalActivitiesCount} sẵn sàng`
                      : `Tổng ${totalRouteKm} km • ~${formatTravelDuration(totalTravelMinutes)}`}
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/30 shrink-0">
                {totalRouteKm} km
              </span>
            </div>

            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all duration-300"
                style={{ width: `${stopProgressPercent}%` }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300 pt-0.5">
              {nextStop && currentStop ? (
                <span className="truncate">
                  Chặng kế: <strong className="text-white">#{currentStop.order} → #{nextStop.order} {nextStop.name}</strong>{' '}
                  {nextStop.hasCoordinates && nextLegDistanceKm > 0
                    ? `(${nextLegDistanceKm} km • ~${formatTravelDuration(nextLegMinutes)})`
                    : !nextStop.hasCoordinates
                      ? '(chưa có tọa độ)'
                      : ''}
                </span>
              ) : currentStop ? (
                <span className="truncate">
                  Đang tham quan: <strong className="text-white">#{currentStop.order} {currentStop.name}</strong>
                </span>
              ) : null}
              <span className="flex items-center gap-1 text-teal-300 font-semibold shrink-0">
                <Clock className="w-3 h-3" />
                Còn {remainingKm} km (~{formatTravelDuration(remainingMinutes)})
              </span>
            </div>

            {unlocatedStopsCount > 0 && (
              <div className="text-[10px] text-amber-300/95">
                {unlocatedStopsCount} điểm chưa có tọa độ nên chưa hiển thị trên bản đồ và chưa tính quãng đường.
              </div>
            )}
          </div>
        )}

        {/* Map Controls (Bottom Right) */}
        <div className="absolute bottom-4 right-4 flex flex-col bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden z-10">
          <button
            type="button"
            onClick={handleZoomIn}
            title="Phóng to"
            className="p-2 text-slate-700 hover:bg-slate-100 border-b border-slate-100 transition"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            title="Thu nhỏ"
            className="p-2 text-slate-700 hover:bg-slate-100 border-b border-slate-100 transition"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleFitRoute}
            title="Xem toàn bộ tuyến đường"
            className="p-2 text-slate-700 hover:bg-slate-100 transition"
          >
            <Maximize2 className="w-4 h-4 text-teal-600" />
          </button>
        </div>
      </div>
    </>
  );
};
