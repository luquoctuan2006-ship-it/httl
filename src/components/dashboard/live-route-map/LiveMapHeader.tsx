import React from 'react';
import { Layers, Navigation, ChevronDown, Check, Edit3, Radio, RefreshCw } from 'lucide-react';
import type { TripData } from '../../../types/travel';
import type { MapLayer } from './mapHelpers';

interface LiveMapHeaderProps {
  trip: TripData;
  waypointCount: number;
  mapLayer: MapLayer;
  setMapLayer: React.Dispatch<React.SetStateAction<MapLayer>>;
  layerDropdownOpen: boolean;
  setLayerDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isGpsTracking: boolean;
  handleToggleGpsTracking: () => void;
  isRefreshingWeather: boolean;
  handleFetchLiveWeather: () => Promise<void>;
  openTelematicsEditor: () => void;
}

export const LiveMapHeader: React.FC<LiveMapHeaderProps> = (props) => {
  const { trip, waypointCount, mapLayer, setMapLayer, layerDropdownOpen, setLayerDropdownOpen, isGpsTracking, handleToggleGpsTracking, isRefreshingWeather, handleFetchLiveWeather, openTelematicsEditor } = props;
  return (
    <>
{/* Map Header */}
      <div className="p-4 sm:px-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center shrink-0">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-slate-900 leading-tight">
                Bản đồ tuyến đường tương tác
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {trip.originFull} → {trip.destinationFull} • {waypointCount} điểm dừng
            </p>
          </div>
        </div>

        {/* Right Map Controls: GPS Live, Layer Selector & Weather Live Button */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleToggleGpsTracking}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition shadow-2xs ${
              isGpsTracking
                ? 'border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-700'
                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
            }`}
            title="Chia sẻ vị trí GPS thực tế từ thiết bị lên bản đồ chuyến đi"
          >
            <Radio className={`w-3.5 h-3.5 ${isGpsTracking ? 'animate-pulse' : 'text-teal-600'}`} />
            <span>{isGpsTracking ? 'Đang phát GPS' : 'Bật GPS thiết bị'}</span>
          </button>

          <button
            type="button"
            onClick={handleFetchLiveWeather}
            disabled={isRefreshingWeather}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold transition shadow-2xs disabled:opacity-60"
            title="Lấy dữ liệu thời tiết thực tế từ trạm khí tượng"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingWeather ? 'animate-spin' : ''}`} />
            <span>{isRefreshingWeather ? 'Đang đo thời tiết...' : 'Thời tiết Live API'}</span>
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
                  onClick={() => { setMapLayer('streets'); setLayerDropdownOpen(false); }}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-50 ${mapLayer === 'streets' ? 'text-teal-700 font-bold bg-teal-50/50' : 'text-slate-700'}`}
                >
                  <span>Bản đồ đường phố</span>
                  {mapLayer === 'streets' && <Check className="w-3.5 h-3.5 text-teal-600" />}
                </button>
                <button
                  type="button"
                  onClick={() => { setMapLayer('satellite'); setLayerDropdownOpen(false); }}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-50 ${mapLayer === 'satellite' ? 'text-teal-700 font-bold bg-teal-50/50' : 'text-slate-700'}`}
                >
                  <span>Ảnh vệ tinh (Esri)</span>
                  {mapLayer === 'satellite' && <Check className="w-3.5 h-3.5 text-teal-600" />}
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={openTelematicsEditor}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-500" />
            <span>Sửa thông tin xe</span>
          </button>
        </div>
      </div>

    </>
  );
};
