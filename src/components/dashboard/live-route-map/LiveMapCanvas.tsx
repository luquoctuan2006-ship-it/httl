import React from 'react';
import { AlertCircle, Bus, CloudSun, Droplets, LocateFixed, Minus, Plus, Wind } from 'lucide-react';
import type { TripData, Waypoint } from '../../../types/travel';

interface LiveMapCanvasProps {
  trip: TripData;
  mapContainerRef: React.RefObject<HTMLDivElement | null>;
  waypoints: Waypoint[];
  hasRealGps: boolean;
  weatherNotice: string | null;
  setWeatherNotice: React.Dispatch<React.SetStateAction<string | null>>;
  gpsError: string | null;
  setGpsError: React.Dispatch<React.SetStateAction<string | null>>;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleResetFocus: () => void;
}

export const LiveMapCanvas: React.FC<LiveMapCanvasProps> = (props) => {
  const { trip, mapContainerRef, waypoints, hasRealGps, weatherNotice, setWeatherNotice, gpsError, setGpsError, handleZoomIn, handleZoomOut, handleResetFocus } = props;
  return (
    <>
{weatherNotice && (
        <div className="bg-teal-600 text-white text-xs px-4 py-2 flex items-center justify-between z-20">
          <span>{weatherNotice}</span>
          <button type="button" onClick={() => setWeatherNotice(null)} className="font-bold">✕</button>
        </div>
      )}
      {gpsError && (
        <div className="bg-rose-50 border-b border-rose-200 text-rose-800 text-xs px-4 py-2 flex items-center justify-between z-20">
          <span className="flex items-center gap-1.5 font-semibold">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {gpsError}
          </span>
          <button type="button" onClick={() => setGpsError(null)} className="font-bold">✕</button>
        </div>
      )}

      {/* Interactive Map Canvas Container */}
      <div className="relative w-full h-[400px] md:h-[440px] bg-slate-100 overflow-hidden">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {waypoints.length === 0 && (
          <div className="absolute inset-0 z-[5] flex items-center justify-center bg-white/70 backdrop-blur-[1px] pointer-events-none">
            <p className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-600 shadow-sm">
              Chuyến đi này chưa có tọa độ điểm dừng để vẽ tuyến.
            </p>
          </div>
        )}

        {/* Floating Live Weather Widget (Top Right) */}
        <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-lg border border-slate-200/90 flex items-center gap-3 z-10 max-w-xs">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0 border border-amber-200">
            <CloudSun className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-black text-slate-900 leading-tight">
                {trip.weather.temp}°C
              </span>
              <span className="text-xs font-bold text-slate-700 truncate">
                • {trip.weather.description}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
              <span className="flex items-center gap-0.5">
                <Droplets className="w-3 h-3 text-blue-500" /> Mưa: {trip.weather.rainProb}
              </span>
              {trip.weather.humidity && (
                <span className="flex items-center gap-0.5">
                  <Wind className="w-3 h-3 text-teal-500" /> {trip.weather.humidity}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Floating Telematics Overlay Card (Bottom Left) */}
        <div className="absolute bottom-4 left-4 max-w-md bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-3.5 shadow-xl border border-slate-700/80 flex items-center justify-between gap-4 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 text-teal-400 border border-slate-700 flex items-center justify-center shrink-0">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-white leading-tight">
                  {trip.telematics.from} → {trip.telematics.to}
                </span>
                {trip.telematics.licensePlate && (
                  <span className="text-[10px] bg-teal-900/80 text-teal-300 font-mono px-1.5 py-0.5 rounded border border-teal-700 font-bold">
                    {trip.telematics.licensePlate}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5">
                Tài xế {trip.telematics.driver}{trip.telematics.driverPhone ? ` (${trip.telematics.driverPhone})` : ''} • {trip.telematics.passengerCount} khách
              </div>
              <div className="text-[10px] mt-1 flex items-center gap-1.5">
                <span
                  className={`px-1.5 py-0.5 rounded font-bold ${
                    hasRealGps
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  {hasRealGps
                    ? `GPS thực tế (${trip.telematics.gpsUpdatedAt || 'Live'})${typeof trip.telematics.speedKmh === 'number' ? ` • ${trip.telematics.speedKmh} km/h` : ''}`
                    : 'Vị trí ước tính theo điểm dừng (Chưa bật GPS)'}
                </span>
              </div>
            </div>
          </div>
        </div>

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
            onClick={handleResetFocus}
            title="Định vị tâm điểm xe du lịch"
            className="p-2 text-slate-700 hover:bg-slate-100 transition"
          >
            <LocateFixed className="w-4 h-4 text-teal-600" />
          </button>
        </div>
      </div>

      {/* Modal: Chỉnh sửa Telematics xe */}
    </>
  );
};
