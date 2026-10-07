import React, { useState, useEffect, useRef } from 'react';
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
  ChevronDown,
  RefreshCw,
  Edit3,
  X,
  Radio,
  Wind,
  Droplets,
  Gauge,
  Phone,
  Clock,
  Car
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Waypoint, TripData } from '../types/travel';

interface LiveRouteMapProps {
  trip: TripData;
  onSelectWaypoint?: (wp: Waypoint) => void;
  onUpdateTrip?: (updatedTrip: TripData, message?: string) => void;
  searchQuery?: string;
  onClearSearch?: () => void;
}

// Weather Code translation to Vietnamese
function getWeatherDescription(code: number): string {
  if (code === 0) return 'Trời quang, nắng đẹp';
  if (code === 1) return 'Ít mây, trời trong';
  if (code === 2) return 'Mây rải rác';
  if (code === 3) return 'Nhiều mây';
  if (code === 45 || code === 48) return 'Có sương mù nhẹ';
  if (code >= 51 && code <= 55) return 'Mưa phùn nhẹ';
  if (code >= 61 && code <= 65) return 'Mưa rào';
  if (code >= 80 && code <= 82) return 'Mưa rào rải rác';
  if (code >= 95) return 'Dông sét đèo Hải Vân';
  return 'Thời tiết ổn định';
}

export const LiveRouteMap: React.FC<LiveRouteMapProps> = ({
  trip,
  onSelectWaypoint,
  onUpdateTrip,
  searchQuery = '',
  onClearSearch,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const busMarkerRef = useRef<L.Marker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  const [mapLayer, setMapLayer] = useState<'streets' | 'satellite'>('streets');
  const [layerDropdownOpen, setLayerDropdownOpen] = useState(false);
  const [isRefreshingWeather, setIsRefreshingWeather] = useState(false);
  const [weatherNotice, setWeatherNotice] = useState<string | null>(null);
  const [isEditTelematicsOpen, setIsEditTelematicsOpen] = useState(false);

  // Telematics Form State
  const [telDriver, setTelDriver] = useState(trip.telematics.driver || 'Trần Bình');
  const [telDriverPhone, setTelDriverPhone] = useState(trip.telematics.driverPhone || '0905 123 456');
  const [telVehicleType, setTelVehicleType] = useState(trip.telematics.vehicleType || 'Xe 29 chỗ Universe');
  const [telPlate, setTelPlate] = useState(trip.telematics.licensePlate || '43B-028.99');
  const [telFrom, setTelFrom] = useState(trip.telematics.from || 'Sơn Trà');
  const [telTo, setTelTo] = useState(trip.telematics.to || 'Bà Nà Hills');
  const [telDuration, setTelDuration] = useState<number>(trip.telematics.durationMinutes || 42);
  const [telEta, setTelEta] = useState(trip.telematics.eta || '10:24');
  const [telPassengers, setTelPassengers] = useState<number>(trip.telematics.passengerCount || 18);
  const [telSpeed, setTelSpeed] = useState<number>(trip.telematics.speedKmH || 54);
  const [telGpsStatus, setTelGpsStatus] = useState(trip.telematics.gpsStatus || 'GPS ổn định');
  const [telTrafficStatus, setTelTrafficStatus] = useState(trip.telematics.trafficStatus || 'Lưu thông tốt');

  // Real coordinates for central Vietnam route
  const defaultWaypoints = [
    { id: 'wp-1', code: '01', name: 'Sân bay Quốc tế Đà Nẵng', lat: 16.0544, lng: 108.2022, time: '09:00 - 10:30', status: 'Hoàn tất' },
    { id: 'wp-2', code: '02', name: 'Bán đảo Sơn Trà - Chùa Linh Ứng', lat: 16.1044, lng: 108.2755, time: '07:30 - 09:30', status: 'Hoàn tất' },
    { id: 'wp-3', code: '03', name: 'Bà Nà Hills (Đang di chuyển)', lat: 15.9988, lng: 107.9868, time: '09:45 - 13:00', status: 'Đang diễn ra' },
    { id: 'wp-4', code: '04', name: 'Đèo Hải Vân & Lăng Cô Retreat', lat: 16.2300, lng: 108.0100, time: '14:30 - 17:30', status: 'Chờ đến' },
    { id: 'wp-5', code: '05', name: 'Cố đô Huế - Hoàng Thành Đại Nội', lat: 16.4637, lng: 107.5909, time: '08:00 - 17:30', status: 'Chờ đến' },
  ];

  // Bus current position: near Ba Na Hills / Da Nang bypass
  const busLat = 16.0350;
  const busLng = 108.0850;

  // Initialize or update Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [16.18, 108.12],
        zoom: 10,
        zoomControl: false,
      });

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Remove existing tile layer if any
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    // Add Tile Layer
    if (mapLayer === 'satellite') {
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri &mdash; Satellite Imagery',
        maxZoom: 18,
      }).addTo(map);
    } else {
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
    }

    // Polyline connecting the route
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
    }
    const routeCoords: [number, number][] = defaultWaypoints.map((wp) => [wp.lat, wp.lng]);
    const routeLine = L.polyline(routeCoords, {
      color: '#0F766E',
      weight: 4,
      opacity: 0.85,
      dashArray: '6, 8',
    }).addTo(map);
    polylineRef.current = routeLine;

    // Waypoint Markers
    Object.values(markersRef.current).forEach((m) => map.removeLayer(m));
    markersRef.current = {};

    defaultWaypoints.forEach((wp) => {
      const isCurrent = wp.id === 'wp-3';
      const isCompleted = wp.status === 'Hoàn tất';
      const bgColor = isCurrent ? '#0D9488' : isCompleted ? '#059669' : '#7C3AED';

      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
          <div style="
            background: ${bgColor};
            color: white;
            font-size: 11px;
            font-weight: 800;
            width: 28px;
            height: 28px;
            border-radius: 9999px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid white;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.25);
            cursor: pointer;
            transform: translate(-50%, -50%);
          ">
            ${wp.code}
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([wp.lat, wp.lng], { icon: customIcon }).addTo(map);
      marker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; padding: 2px;">
          <strong style="color: #0F172A; font-size: 13px;">${wp.name}</strong><br/>
          <span style="color: #0D9488; font-weight: 700;">Điểm #${wp.code} • ${wp.status}</span><br/>
          <span style="color: #64748B;">Khung giờ: ${wp.time}</span>
        </div>
      `);

      marker.on('click', () => {
        const found = trip.waypoints.find((w) => w.code === wp.code);
        if (found && onSelectWaypoint) {
          onSelectWaypoint(found);
        }
      });

      markersRef.current[wp.id] = marker;
    });

    // Vehicle Bus Marker
    if (busMarkerRef.current) {
      map.removeLayer(busMarkerRef.current);
    }

    const busIcon = L.divIcon({
      className: 'custom-bus-marker',
      html: `
        <div style="position: relative; cursor: pointer;">
          <div style="
            position: absolute;
            width: 44px;
            height: 44px;
            border-radius: 9999px;
            background: rgba(13, 148, 136, 0.3);
            animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
            top: -22px;
            left: -22px;
          "></div>
          <div style="
            width: 36px;
            height: 36px;
            border-radius: 12px;
            background: #0F172A;
            color: #2DD4BF;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid #2DD4BF;
            box-shadow: 0 10px 15px -3px rgba(0,0,0,0.4);
            transform: translate(-50%, -50%);
          ">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 6v6"></path>
              <path d="M15 6v6"></path>
              <path d="M2 12h19.6"></path>
              <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-3.3-2.7-6-6-6H7c-3.3 0-6 2.7-6 6 0 .4.1.8.2 1.2.3 1.1.8 2.8.8 2.8h3"></path>
              <circle cx="7" cy="18" r="2"></circle>
              <circle cx="17" cy="18" r="2"></circle>
            </svg>
          </div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    const busMarker = L.marker([busLat, busLng], { icon: busIcon }).addTo(map);
    busMarker.bindPopup(`
      <div style="font-family: sans-serif; font-size: 12px; padding: 2px;">
        <strong style="color: #0F172A; font-size: 13px;">${trip.telematics.vehicleType} (${trip.telematics.licensePlate || '43B-028.99'})</strong><br/>
        <span style="color: #0D9488; font-weight: 700;">Tài xế: ${trip.telematics.driver} • ${trip.telematics.speedKmH || 54} km/h</span><br/>
        <span style="color: #64748B;">Lộ trình: ${trip.telematics.from} → ${trip.telematics.to} (ETA ${trip.telematics.eta})</span>
      </div>
    `);
    busMarkerRef.current = busMarker;

    return () => {
      // Map stays attached or is cleaned up on unmount
    };
  }, [mapLayer, trip]);

  // Handle Search Query Pan
  useEffect(() => {
    if (!searchQuery.trim() || !mapInstanceRef.current) return;
    const q = searchQuery.toLowerCase();
    const matched = defaultWaypoints.find(
      (wp) => wp.name.toLowerCase().includes(q) || wp.code.toLowerCase().includes(q)
    );
    if (matched) {
      mapInstanceRef.current.flyTo([matched.lat, matched.lng], 13, { duration: 1.2 });
      markersRef.current[matched.id]?.openPopup();
    }
  }, [searchQuery]);

  // Live Weather Fetching from Open-Meteo API
  const handleFetchLiveWeather = async () => {
    setIsRefreshingWeather(true);
    setWeatherNotice(null);
    try {
      // Coordinates for Da Nang (16.0544, 108.2022)
      const res = await fetch(
        'https://api.open-meteo.com/v1/forecast?latitude=16.0544&longitude=108.2022&current=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m&timezone=Asia%2FHo_Chi_Minh'
      );
      if (!res.ok) throw new Error('Không thể tải dữ liệu thời tiết');
      const data = await res.json();
      const current = data.current;

      const updatedWeather = {
        temp: Math.round(current.temperature_2m),
        description: getWeatherDescription(current.weather_code),
        rainProb: `${current.precipitation_probability || 15}%`,
        rainProbTime: '15:00 - 17:00',
        humidity: current.relative_humidity_2m,
        windSpeed: `${Math.round(current.wind_speed_10m)} km/h`,
        isLive: true,
        lastFetched: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };

      const updatedTrip: TripData = {
        ...trip,
        weather: updatedWeather,
      };

      if (onUpdateTrip) {
        onUpdateTrip(updatedTrip, 'Đã cập nhật thời tiết thời gian thực từ Open-Meteo!');
      }

      setWeatherNotice(`Đã đồng bộ thời tiết trực tiếp: ${updatedWeather.temp}°C, ${updatedWeather.description}`);
      setTimeout(() => setWeatherNotice(null), 4000);
    } catch (err) {
      console.error('Weather fetch error:', err);
      setWeatherNotice('Lỗi kết nối API thời tiết thời gian thực');
      setTimeout(() => setWeatherNotice(null), 3000);
    } finally {
      setIsRefreshingWeather(false);
    }
  };

  // Zoom helpers
  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();
  const handleResetFocus = () => {
    mapInstanceRef.current?.flyTo([busLat, busLng], 12, { duration: 1 });
    busMarkerRef.current?.openPopup();
  };

  // Save Telematics
  const handleSaveTelematics = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedTelematics = {
      ...trip.telematics,
      driver: telDriver.trim(),
      driverPhone: telDriverPhone.trim(),
      vehicleType: telVehicleType.trim(),
      licensePlate: telPlate.trim(),
      from: telFrom.trim(),
      to: telTo.trim(),
      durationMinutes: telDuration,
      eta: telEta.trim(),
      passengerCount: telPassengers,
      speedKmH: telSpeed,
      gpsStatus: telGpsStatus,
      trafficStatus: telTrafficStatus,
      lastUpdated: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedTrip: TripData = {
      ...trip,
      telematics: updatedTelematics,
    };

    if (onUpdateTrip) {
      onUpdateTrip(updatedTrip, 'Đã cập nhật thông tin viễn thông xe lên Firestore!');
    }

    setIsEditTelematicsOpen(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col relative">
      {/* Map Header */}
      <div className="p-4 sm:px-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center shrink-0">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-slate-900 leading-tight">
                Bản đồ tuyến đường số tương tác (Leaflet &amp; OpenStreetMap)
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <Radio className="w-2.5 h-2.5 animate-pulse" />
                Live GPS
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Cập nhật vị trí lúc {trip.telematics.lastUpdated} • {trip.telematics.gpsStatus} • Tốc độ {trip.telematics.speedKmH || 54} km/h
            </p>
          </div>
        </div>

        {/* Right Map Controls: Layer Selector & Weather Live Button */}
        <div className="flex items-center gap-2 flex-wrap">
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
            onClick={() => setIsEditTelematicsOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-500" />
            <span>Sửa viễn thông xe</span>
          </button>
        </div>
      </div>

      {/* Weather toast notification if updated */}
      {weatherNotice && (
        <div className="bg-teal-600 text-white text-xs px-4 py-2 flex items-center justify-between z-20">
          <span>{weatherNotice}</span>
          <button type="button" onClick={() => setWeatherNotice(null)} className="font-bold">✕</button>
        </div>
      )}

      {/* Interactive Map Canvas Container */}
      <div className="relative w-full h-[400px] md:h-[440px] bg-slate-100 overflow-hidden">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

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
                <span className="text-[10px] bg-teal-900/80 text-teal-300 font-mono px-1.5 py-0.5 rounded border border-teal-700 font-bold">
                  {trip.telematics.licensePlate || '43B-028.99'}
                </span>
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5">
                Tài xế {trip.telematics.driver} ({trip.telematics.driverPhone || '0905 123 456'}) • {trip.telematics.passengerCount} khách
              </div>
            </div>
          </div>

          <div className="text-right border-l border-slate-800 pl-3 shrink-0">
            <div className="text-sm font-black text-emerald-400 font-mono">
              {trip.telematics.speedKmH || 54} km/h
            </div>
            <div className="text-[10px] text-slate-400 font-medium">
              ETA {trip.telematics.eta}
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
      {isEditTelematicsOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-teal-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bus className="w-4 h-4" />
                <h3 className="text-sm font-extrabold">Cập nhật Viễn thông &amp; Giám sát xe</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditTelematicsOpen(false)}
                className="p-1 rounded-full hover:bg-white/20 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTelematics} className="p-6 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tài xế phụ trách *</label>
                  <input
                    type="text"
                    required
                    value={telDriver}
                    onChange={(e) => setTelDriver(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:border-teal-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">SĐT tài xế *</label>
                  <input
                    type="tel"
                    required
                    value={telDriverPhone}
                    onChange={(e) => setTelDriverPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:border-teal-500 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Loại phương tiện</label>
                  <input
                    type="text"
                    value={telVehicleType}
                    onChange={(e) => setTelVehicleType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:border-teal-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Biển số xe</label>
                  <input
                    type="text"
                    value={telPlate}
                    onChange={(e) => setTelPlate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-slate-900 focus:border-teal-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Điểm xuất phát chặng</label>
                  <input
                    type="text"
                    value={telFrom}
                    onChange={(e) => setTelFrom(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:border-teal-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Điểm đến tiếp theo</label>
                  <input
                    type="text"
                    value={telTo}
                    onChange={(e) => setTelTo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:border-teal-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tốc độ (km/h)</label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={telSpeed}
                    onChange={(e) => setTelSpeed(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-slate-900 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Dự kiến ETA</label>
                  <input
                    type="text"
                    value={telEta}
                    onChange={(e) => setTelEta(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-slate-900 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Khách trên xe</label>
                  <input
                    type="number"
                    min={1}
                    value={telPassengers}
                    onChange={(e) => setTelPassengers(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-slate-900 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Trạng thái GPS</label>
                  <select
                    value={telGpsStatus}
                    onChange={(e) => setTelGpsStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 outline-none"
                  >
                    <option value="GPS ổn định">GPS ổn định</option>
                    <option value="Đang hiệu chỉnh">Đang hiệu chỉnh</option>
                    <option value="Mất sóng hầm Hải Vân">Mất sóng hầm Hải Vân</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Giao thông</label>
                  <select
                    value={telTrafficStatus}
                    onChange={(e) => setTelTrafficStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 outline-none"
                  >
                    <option value="Lưu thông tốt">Lưu thông tốt</option>
                    <option value="Mật độ cao">Mật độ cao</option>
                    <option value="Ùn tắc nhẹ">Ùn tắc nhẹ</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditTelematicsOpen(false)}
                  className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-xs transition"
                >
                  Lưu &amp; Đồng bộ Firestore
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
