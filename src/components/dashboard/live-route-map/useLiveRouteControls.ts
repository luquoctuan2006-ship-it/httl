import React, { useEffect, useRef, useState } from 'react';
import type { Map } from 'leaflet';
import type { TripData } from '../../../types/travel';
import { authenticatedFetch, safeJsonResponse } from '../../../api';
import { getWeatherDescription, type FleetVehicleOption, type LiveBusPosition } from './mapHelpers';

interface UseLiveRouteControlsOptions {
  trip: TripData;
  onUpdateTrip?: (updatedTrip: TripData, message?: string) => void;
  busPos: LiveBusPosition | null;
  mapInstanceRef: React.RefObject<Map | null>;
}

export function useLiveRouteControls({ trip, onUpdateTrip, busPos, mapInstanceRef }: UseLiveRouteControlsOptions) {
const [isRefreshingWeather, setIsRefreshingWeather] = useState(false);
  const [weatherNotice, setWeatherNotice] = useState<string | null>(null);
  const [isEditTelematicsOpen, setIsEditTelematicsOpen] = useState(false);
  const [isGpsTracking, setIsGpsTracking] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const gpsWatchIdRef = useRef<number | null>(null);
  const latestTripRef = useRef<TripData>(trip);
  latestTripRef.current = trip;

  const [fleetVehicles, setFleetVehicles] = useState<FleetVehicleOption[]>([]);

  // Telematics Form State
  const [telDriver, setTelDriver] = useState(trip.telematics.driver || '');
  const [telDriverPhone, setTelDriverPhone] = useState(trip.telematics.driverPhone || '');
  const [telDriverMemberId, setTelDriverMemberId] = useState(trip.telematics.driverMemberId || '');
  const [telVehicleType, setTelVehicleType] = useState(trip.telematics.vehicleType || '');
  const [telVehicleId, setTelVehicleId] = useState(trip.telematics.vehicleId || '');
  const [telPlate, setTelPlate] = useState(trip.telematics.licensePlate || '');
  const [telFrom, setTelFrom] = useState(trip.telematics.from || '');
  const [telTo, setTelTo] = useState(trip.telematics.to || '');
  const [telPassengers, setTelPassengers] = useState<number>(trip.telematics.passengerCount || 1);
// Dọn GPS watcher khi unmount
  useEffect(() => {
    return () => {
      if (gpsWatchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      }
    };
  }, []);

  // Tải danh sách xe từ Admin Catalog khi mở modal chỉnh sửa xe
  useEffect(() => {
    if (!isEditTelematicsOpen) return;
    let cancelled = false;
    const loadVehicles = async () => {
      try {
        const res = await authenticatedFetch('/api/vehicles');
        if (!res.ok) return;
        const data = await safeJsonResponse(res);
        if (!cancelled && Array.isArray(data?.vehicles)) {
          setFleetVehicles(data.vehicles);
        }
      } catch {
        // Bỏ qua khi offline
      }
    };
    void loadVehicles();
    return () => {
      cancelled = true;
    };
  }, [isEditTelematicsOpen]);
// Live Weather Fetching from Open-Meteo API
  const handleFetchLiveWeather = async () => {
    setIsRefreshingWeather(true);
    setWeatherNotice(null);
    try {
      // Thời tiết tại vị trí xe hiện tại của chuyến đi (mặc định Đà Nẵng nếu chưa có waypoint)
      const weatherPos = busPos ?? { lat: 16.0544, lng: 108.2022 };
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${weatherPos.lat}&longitude=${weatherPos.lng}&current=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m&timezone=Asia%2FHo_Chi_Minh`
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

  // Bật / Tắt chia sẻ tọa độ GPS thực tế từ thiết bị (trình duyệt)
  const handleToggleGpsTracking = () => {
    setGpsError(null);
    if (isGpsTracking) {
      if (gpsWatchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current);
        gpsWatchIdRef.current = null;
      }
      setIsGpsTracking(false);
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsError('Trình duyệt hoặc thiết bị này không hỗ trợ định vị GPS.');
      return;
    }

    setIsGpsTracking(true);
    let lastCommittedAt = 0;

    gpsWatchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastCommittedAt < 5000 && lastCommittedAt !== 0) return;
        lastCommittedAt = now;

        const currentLat = Number(position.coords.latitude.toFixed(6));
        const currentLng = Number(position.coords.longitude.toFixed(6));
        const speedKmh =
          typeof position.coords.speed === 'number' && Number.isFinite(position.coords.speed) && position.coords.speed >= 0
            ? Math.round(position.coords.speed * 3.6)
            : undefined;
        const gpsUpdatedAt = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        const latestTrip = latestTripRef.current;
        const updatedTrip: TripData = {
          ...latestTrip,
          telematics: {
            ...latestTrip.telematics,
            currentLat,
            currentLng,
            gpsUpdatedAt,
            gpsSource: 'gps',
            ...(speedKmh !== undefined ? { speedKmh } : {}),
          },
        };

        mapInstanceRef.current?.flyTo([currentLat, currentLng], 13, { duration: 0.8 });
        onUpdateTrip?.(updatedTrip, `Đã đồng bộ tọa độ GPS thực tế (${currentLat}, ${currentLng})`);
      },
      (err) => {
        setIsGpsTracking(false);
        if (gpsWatchIdRef.current !== null) {
          navigator.geolocation.clearWatch(gpsWatchIdRef.current);
          gpsWatchIdRef.current = null;
        }
        const msg =
          err.code === err.PERMISSION_DENIED
            ? 'Bạn đã từ chối quyền truy cập vị trí GPS trên trình duyệt.'
            : err.code === err.POSITION_UNAVAILABLE
              ? 'Thiết bị không xác định được tín hiệu GPS hiện tại.'
              : 'Quá thời gian chờ tín hiệu GPS.';
        setGpsError(msg);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10_000,
        timeout: 15_000,
      },
    );
  };

  // Mở form sửa thông tin xe với dữ liệu mới nhất của chuyến đi hiện tại
  const openTelematicsEditor = () => {
    const t = trip.telematics;
    setTelDriver(t.driver || '');
    setTelDriverPhone(t.driverPhone || '');
    setTelDriverMemberId(t.driverMemberId || '');
    setTelVehicleType(t.vehicleType || '');
    setTelVehicleId(t.vehicleId || '');
    setTelPlate(t.licensePlate || '');
    setTelFrom(t.from || '');
    setTelTo(t.to || '');
    setTelPassengers(t.passengerCount || 1);
    setIsEditTelematicsOpen(true);
  };

  // Save Telematics
  const handleSaveTelematics = (e: React.FormEvent) => {
    e.preventDefault();
    const { driverMemberId: _oldDriverMemberId, vehicleId: _oldVehicleId, ...baseTelematics } = trip.telematics;
    const updatedTelematics = {
      ...baseTelematics,
      ...(telDriverMemberId ? { driverMemberId: telDriverMemberId } : {}),
      ...(telVehicleId ? { vehicleId: telVehicleId } : {}),
      driver: telDriver.trim(),
      driverPhone: telDriverPhone.trim(),
      vehicleType: telVehicleType.trim(),
      licensePlate: telPlate.trim(),
      from: telFrom.trim(),
      to: telTo.trim(),
      passengerCount: telPassengers,
    };

    const updatedTrip: TripData = {
      ...trip,
      vehicle: telVehicleType.trim() || trip.vehicle,
      telematics: updatedTelematics,
    };

    if (onUpdateTrip) {
      onUpdateTrip(updatedTrip, 'Đã cập nhật thông tin xe!');
    }

    setIsEditTelematicsOpen(false);
  };
  return {
    isRefreshingWeather,
    weatherNotice,
    setWeatherNotice,
    isEditTelematicsOpen,
    setIsEditTelematicsOpen,
    isGpsTracking,
    gpsError,
    setGpsError,
    fleetVehicles,
    telDriver,
    setTelDriver,
    telDriverPhone,
    setTelDriverPhone,
    telDriverMemberId,
    setTelDriverMemberId,
    telVehicleType,
    setTelVehicleType,
    telVehicleId,
    setTelVehicleId,
    telPlate,
    setTelPlate,
    telFrom,
    setTelFrom,
    telTo,
    setTelTo,
    telPassengers,
    setTelPassengers,
    handleFetchLiveWeather,
    handleToggleGpsTracking,
    handleSaveTelematics,
    openTelematicsEditor,
  };
}
