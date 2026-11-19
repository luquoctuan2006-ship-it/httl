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
        <div className="bg-blue-600 text-white text-xs px-4 py-2 flex items-center justify-between z-20">
          <span>{weatherNotice}</span>
          <button type="button" onClick={() => setWeatherNotice(null)} className="font-bold cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Interactive Map Canvas Container */}
      <div className="relative w-full h-[380px] md:h-[430px] bg-neutral-100 overflow-hidden">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {locatedStopsCount === 0 && (
          <div className="absolute inset-0 z-[5] flex items-center justify-center bg-white/85 pointer-events-none">
            <p className="px-4 py-2 rounded-xl bg-white border border-neutral-200 text-xs font-semibold text-neutral-600 shadow-sm">
              Chưa có địa điểm tham quan có tọa độ trong phạm vi đang chọn.
            </p>
          </div>
        )}

        {/* Floating Live Weather Widget (Top Right) */}
        <div className="absolute top-4 right-4 bg-white/95 rounded-2xl p-3 shadow-lg border border-neutral-200 z-10 max-w-xs space-y-1.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200">
              <CloudSun className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-black text-neutral-950 leading-tight tabular-nums">
                  {hasWeatherData ? `${displayTemp}°C` : '—'}
                </span>
                <span className="text-xs font-bold text-neutral-700 truncate">
                  • {displayDesc}
                </span>
              </div>
              <div className="text-[11px] text-neutral-500 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                <span className="flex items-center gap-0.5">
                  <Droplets className="w-3 h-3 text-blue-600" />
                  Mưa: {displayRain}
                  {displayRainTime ? ` (${displayRainTime})` : ''}
                </span>
                {typeof displayHumidity === 'number' && displayHumidity > 0 && (
                  <span className="flex items-center gap-0.5">
                    <Wind className="w-3 h-3 text-neutral-600" /> {displayHumidity}%
                  </span>
                )}
              </div>
            </div>
          </div>

          {(currentStopWeather || nextStopWeather || stopForecasts.length > 1 || weather.lastFetched) && (
            <div className="pt-1.5 border-t border-neutral-100 text-[10px] text-neutral-600 space-y-0.5">
              {currentStopWeather && (
                <div className="truncate font-semibold text-neutral-800">
                  Hiện tại ở #{currentStop?.order} {currentStopWeather.stopName}
                </div>
              )}
              {nextStopWeather && nextStop && nextStopWeather.stopId !== currentStopWeather?.stopId && (
                <div className="truncate text-blue-700 font-semibold">
                  Kế tiếp ở #{nextStop.order} {nextStop.name}: {nextStopWeather.temp}°C • {nextStopWeather.description}
                  {nextStopWeather.rainProb ? ` (Mưa ${nextStopWeather.rainProb})` : ''}
                </div>
              )}
              {(stopForecasts.length > 1 || weather.lastFetched) && (
                <div className="text-neutral-400">
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
          <div className="absolute bottom-4 left-4 max-w-sm sm:max-w-md bg-[#090B11]/95 text-white rounded-2xl p-3.5 shadow-xl border border-neutral-800 z-10 space-y-2">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-neutral-900 text-red-500 border border-neutral-800 flex items-center justify-center shrink-0">
                  <Route className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-black text-white truncate">
                    Tiến độ tuyến: {completedStops}/{totalStops} điểm ({stopProgressPercent}%)
                  </div>
                  <div className="text-[11px] text-neutral-300 truncate">
                    {totalActivitiesCount > 0
                      ? `${completedActivitiesCount}/${totalActivitiesCount} hoàn tất (${activityProgressPercent}%) • ${confirmedActivitiesCount}/${totalActivitiesCount} sẵn sàng`
                      : `Tổng ${totalRouteKm} km • ~${formatTravelDuration(totalTravelMinutes)}`}
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-blue-600/20 text-blue-300 border border-blue-500/40 shrink-0 tabular-nums">
                {totalRouteKm} km
              </span>
            </div>

            <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-red-500 transition-all duration-300"
                style={{ width: `${stopProgressPercent}%` }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-300 pt-0.5">
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
              <span className="flex items-center gap-1 text-red-400 font-semibold shrink-0 tabular-nums">
                <Clock className="w-3 h-3" />
                Còn {remainingKm} km (~{formatTravelDuration(remainingMinutes)})
              </span>
            </div>

            {unlocatedStopsCount > 0 && (
              <div className="text-[10px] text-red-300">
                {unlocatedStopsCount} điểm chưa có tọa độ nên chưa hiển thị trên bản đồ và chưa tính quãng đường.
              </div>
            )}
          </div>
        )}

        {/* Map Controls (Bottom Right) */}
        <div className="absolute bottom-4 right-4 flex flex-col bg-neutral-950 rounded-xl shadow-md border border-neutral-800 overflow-hidden z-10">
          <button
            type="button"
            onClick={handleZoomIn}
            title="Phóng to"
            className="p-2 text-neutral-200 hover:bg-neutral-800 border-b border-neutral-800 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            title="Thu nhỏ"
            className="p-2 text-neutral-200 hover:bg-neutral-800 border-b border-neutral-800 transition cursor-pointer"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleFitRoute}
            title="Xem toàn bộ tuyến đường"
            className="p-2 text-blue-400 hover:bg-neutral-800 transition cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
};
