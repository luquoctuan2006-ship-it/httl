import React, { useState } from 'react';
import {
  Layers,
  CloudSun,
  Bus,
  Plus,
  Minus,
  LocateFixed,
  Navigation,
  Check,
  MapPin,
  ChevronDown
} from 'lucide-react';
import { Waypoint, TripData } from '../types/travel';

interface LiveRouteMapProps {
  trip: TripData;
  onSelectWaypoint?: (wp: Waypoint) => void;
}

export const LiveRouteMap: React.FC<LiveRouteMapProps> = ({
  trip,
  onSelectWaypoint,
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedLayer, setSelectedLayer] = useState<'all' | 'traffic' | 'weather'>('all');
  const [layerDropdownOpen, setLayerDropdownOpen] = useState(false);
  const [activeWaypointId, setActiveWaypointId] = useState<string>('wp-3');

  const waypoints = trip.waypoints;

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.15, 1.6));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.15, 0.85));
  const handleResetZoom = () => setZoomLevel(1);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col relative">
      {/* Map Header */}
      <div className="p-4 sm:px-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 fill-none stroke-[2] stroke-current" viewBox="0 0 24 24">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
              <line x1="9" y1="3" x2="9" y2="18" />
              <line x1="15" y1="6" x2="15" y2="21" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 leading-tight">
              Bản đồ tuyến đường trực tiếp
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Cập nhật vị trí lúc {trip.telematics.lastUpdated} • {trip.telematics.gpsStatus}
            </p>
          </div>
        </div>

        {/* Right Map Controls */}
        <div className="flex items-center gap-2 relative">
          <div className="relative">
            <button
              onClick={() => setLayerDropdownOpen(!layerDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition"
            >
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>Giao thông & thời tiết</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {layerDropdownOpen && (
              <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-30 text-xs">
                <button
                  onClick={() => { setSelectedLayer('all'); setLayerDropdownOpen(false); }}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-50 ${selectedLayer === 'all' ? 'text-teal-700 font-bold bg-teal-50/50' : 'text-slate-700'}`}
                >
                  <span>Hiển thị tất cả</span>
                  {selectedLayer === 'all' && <Check className="w-3.5 h-3.5 text-teal-600" />}
                </button>
                <button
                  onClick={() => { setSelectedLayer('traffic'); setLayerDropdownOpen(false); }}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-50 ${selectedLayer === 'traffic' ? 'text-teal-700 font-bold bg-teal-50/50' : 'text-slate-700'}`}
                >
                  <span>Chỉ dữ liệu giao thông</span>
                  {selectedLayer === 'traffic' && <Check className="w-3.5 h-3.5 text-teal-600" />}
                </button>
                <button
                  onClick={() => { setSelectedLayer('weather'); setLayerDropdownOpen(false); }}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-50 ${selectedLayer === 'weather' ? 'text-teal-700 font-bold bg-teal-50/50' : 'text-slate-700'}`}
                >
                  <span>Chỉ dự báo thời tiết</span>
                  {selectedLayer === 'weather' && <Check className="w-3.5 h-3.5 text-teal-600" />}
                </button>
              </div>
            )}
          </div>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            {trip.telematics.trafficStatus}
          </span>
        </div>
      </div>

      {/* Map Canvas Area */}
      <div className="relative w-full h-[360px] md:h-[400px] lg:h-[420px] bg-[#E8EEF5] overflow-hidden select-none">
        {/* Transform container for zoom */}
        <div
          className="w-full h-full relative transition-transform duration-300 ease-out"
          style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
        >
          {/* Stylized Coastal Map SVG */}
          <svg className="w-full h-full" viewBox="0 0 900 480" preserveAspectRatio="xMidYMid slice">
            <defs>
              {/* Sea gradient */}
              <linearGradient id="seaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#DFE8F3" />
                <stop offset="100%" stopColor="#D2DFEC" />
              </linearGradient>

              {/* Land gradient */}
              <linearGradient id="landGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#F8FAFC" />
                <stop offset="100%" stopColor="#F1F5F9" />
              </linearGradient>

              {/* Route line gradient */}
              <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#0D9488" />
                <stop offset="60%" stopColor="#0F766E" />
                <stop offset="100%" stopColor="#7E22CE" />
              </linearGradient>

              {/* Route glow filter */}
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#0D9488" floodOpacity="0.4" />
              </filter>
            </defs>

            {/* Ocean background */}
            <rect width="900" height="480" fill="url(#seaGrad)" />

            {/* Sea contour waves */}
            <path d="M400,0 Q600,120 750,220 T900,320 L900,0 Z" fill="#D7E3EE" opacity="0.4" />
            <path d="M500,0 Q680,100 820,180 T900,240 L900,0 Z" fill="#CFDDEB" opacity="0.3" />

            {/* Mainland Terrain (Central Vietnam coastline shape) */}
            <path
              d="M0,0 L320,0 
                 C350,40 370,80 390,130 
                 C410,170 440,200 480,210 
                 C520,220 560,200 580,230 
                 C610,270 590,320 540,340 
                 C480,360 410,330 380,360 
                 C340,400 310,480 280,480 
                 L0,480 Z"
              fill="url(#landGrad)"
              stroke="#CBD5E1"
              strokeWidth="1.5"
            />

            {/* Son Tra Peninsula protrusion */}
            <path
              d="M390,130 C430,110 460,130 470,160 C465,185 435,180 410,170 Z"
              fill="#E2E8F0"
              stroke="#94A3B8"
              strokeWidth="1"
            />

            {/* Road network grid lines (muted) */}
            <g opacity="0.35" stroke="#94A3B8" strokeWidth="1" fill="none">
              <path d="M50,150 Q180,180 320,170 T500,280" />
              <path d="M120,40 Q250,90 380,140 T580,330" />
              <path d="M300,50 L450,260" />
              <path d="M180,260 Q320,310 450,390" />
              <path d="M220,100 L260,400" />
              <path d="M400,220 L580,260" />
            </g>

            {/* Mountain terrain hints (Hai Van Pass & Ba Na range) */}
            <g opacity="0.4" stroke="#94A3B8" fill="none" strokeWidth="1.5" strokeDasharray="2,3">
              <path d="M280,160 Q320,140 360,170 T420,190" />
              <path d="M260,190 Q300,170 340,200 T400,220" />
              <path d="M460,230 Q500,210 540,240" />
            </g>

            {/* Main Highway Route (Teal Ribbon) */}
            {/* Completed section: Hoi An (wp1) -> Son Tra (wp2) -> Ba Na (wp3) */}
            <path
              d="M200,320 C260,290 320,240 350,220 C380,200 400,210 420,190"
              fill="none"
              stroke="#0D9488"
              strokeWidth="7"
              strokeLinecap="round"
              filter="url(#glow)"
            />
            <path
              d="M200,320 C260,290 320,240 350,220 C380,200 400,210 420,190"
              fill="none"
              stroke="#2DD4BF"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {/* Upcoming section to Lang Co & Hue (dashed/dotted purple) */}
            <path
              d="M420,190 C460,160 490,180 540,150 C580,120 620,100 680,80"
              fill="none"
              stroke="#7E22CE"
              strokeWidth="4"
              strokeDasharray="6,6"
              strokeLinecap="round"
              opacity="0.8"
            />

            {/* Route corridor pulse indicator at current vehicle */}
            <circle cx="420" cy="190" r="14" fill="#0D9488" opacity="0.2" className="animate-ping" />
            <circle cx="420" cy="190" r="8" fill="#0D9488" stroke="#ffffff" strokeWidth="2.5" />
          </svg>

          {/* Waypoint Markers Overlay (Positioned along the route) */}
          {/* 01 Hoi An */}
          <div
            onClick={() => { setActiveWaypointId('wp-1'); onSelectWaypoint?.(waypoints[0]); }}
            className="absolute left-[20%] top-[64%] -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 cursor-pointer group"
          >
            <div className="bg-white/95 px-2.5 py-1 rounded-xl shadow-md border border-emerald-500/40 flex items-center gap-1.5 hover:scale-105 transition-transform">
              <span className="text-[11px] font-extrabold text-emerald-800">01</span>
              <span className="text-xs font-bold text-slate-800">Hội An</span>
              <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              </div>
            </div>
          </div>

          {/* 02 Son Tra */}
          <div
            onClick={() => { setActiveWaypointId('wp-2'); onSelectWaypoint?.(waypoints[1]); }}
            className="absolute left-[36%] top-[45%] -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 cursor-pointer group"
          >
            <div className="bg-white/95 px-2.5 py-1 rounded-xl shadow-md border border-emerald-500/40 flex items-center gap-1.5 hover:scale-105 transition-transform">
              <span className="text-[11px] font-extrabold text-emerald-800">02</span>
              <span className="text-xs font-bold text-slate-800">Sơn Trà</span>
              <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              </div>
            </div>
          </div>

          {/* 03 Ba Na (Active Waypoint) */}
          <div
            onClick={() => { setActiveWaypointId('wp-3'); onSelectWaypoint?.(waypoints[2]); }}
            className="absolute left-[47%] top-[39%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer group"
          >
            <div className="bg-white px-3 py-1 rounded-xl shadow-xl border-2 border-teal-500 flex items-center gap-2 ring-4 ring-teal-500/20 hover:scale-105 transition-transform">
              <span className="text-xs font-extrabold text-teal-800">03</span>
              <span className="text-xs font-black text-slate-900">Bà Nà</span>
              <div className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-xs">
                <Navigation className="w-3 h-3 fill-current rotate-45" />
              </div>
            </div>
          </div>

          {/* 04 Lang Co */}
          <div
            onClick={() => { setActiveWaypointId('wp-4'); onSelectWaypoint?.(waypoints[3]); }}
            className="absolute left-[62%] top-[30%] -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 cursor-pointer group"
          >
            <div className="bg-white/95 px-2.5 py-1 rounded-xl shadow-md border border-purple-400 flex items-center gap-1.5 hover:scale-105 transition-transform">
              <span className="text-[11px] font-extrabold text-purple-700">04</span>
              <span className="text-xs font-bold text-slate-800">Lăng Cô</span>
              <div className="w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center">
                <MapPin className="w-2.5 h-2.5 fill-current" />
              </div>
            </div>
          </div>

          {/* 05 Dai Noi Hue */}
          <div
            onClick={() => { setActiveWaypointId('wp-5'); onSelectWaypoint?.(waypoints[4]); }}
            className="absolute left-[78%] top-[16%] -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 cursor-pointer group opacity-90"
          >
            <div className="bg-white/90 px-2 py-0.5 rounded-lg shadow-sm border border-slate-300 flex items-center gap-1 hover:scale-105 transition-transform">
              <span className="text-[10px] font-bold text-slate-500">05</span>
              <span className="text-[11px] font-bold text-slate-700">Đại Nội Huế</span>
            </div>
          </div>
        </div>

        {/* Floating Weather Tag (Top Right) */}
        {(selectedLayer === 'all' || selectedLayer === 'weather') && (
          <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md rounded-2xl px-3.5 py-2.5 shadow-md border border-slate-200/90 flex items-center gap-3 z-10">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
              <CloudSun className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 leading-tight">
                {trip.weather.temp}°C • {trip.weather.description}
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                Mưa {trip.weather.rainProb} lúc {trip.weather.rainProbTime}
              </div>
            </div>
          </div>
        )}

        {/* Floating Vehicle Tracker Overlay Card (Bottom Left) */}
        <div className="absolute bottom-4 left-4 max-w-sm sm:max-w-md bg-[#0F172A]/95 backdrop-blur-md text-white rounded-2xl p-3.5 sm:px-4 sm:py-3.5 shadow-xl border border-slate-700/80 flex items-center justify-between gap-4 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 text-teal-400 border border-slate-700 flex items-center justify-center shrink-0">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white leading-tight">
                {trip.telematics.from} → {trip.telematics.to}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {trip.telematics.vehicleType} • Tài xế {trip.telematics.driver} • {trip.telematics.passengerCount} khách
              </div>
            </div>
          </div>

          <div className="text-right border-l border-slate-800 pl-4 shrink-0">
            <div className="text-base font-black text-white leading-tight">
              {trip.telematics.durationMinutes} phút
            </div>
            <div className="text-[11px] text-slate-400">
              Đến {trip.telematics.eta}
            </div>
          </div>
        </div>

        {/* Map Controls (Bottom Right) */}
        <div className="absolute bottom-4 right-4 flex flex-col bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden z-10">
          <button
            onClick={handleZoomIn}
            title="Phóng to"
            className="p-2 text-slate-700 hover:bg-slate-100 border-b border-slate-100 transition"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            title="Thu nhỏ"
            className="p-2 text-slate-700 hover:bg-slate-100 border-b border-slate-100 transition"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetZoom}
            title="Định vị tâm điểm đoàn"
            className="p-2 text-slate-700 hover:bg-slate-100 transition"
          >
            <LocateFixed className="w-4 h-4 text-teal-600" />
          </button>
        </div>
      </div>
    </div>
  );
};
