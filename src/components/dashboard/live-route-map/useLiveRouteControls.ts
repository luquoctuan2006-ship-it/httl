import { useState } from 'react';
import type { TripData } from '../../../types/travel';
import { getWeatherDescription } from './mapHelpers';

interface UseLiveRouteControlsOptions {
  trip: TripData;
  onUpdateTrip?: (updatedTrip: TripData, message?: string) => void;
  weatherCoords: { lat: number; lng: number } | null;
}

export function useLiveRouteControls({
  trip,
  onUpdateTrip,
  weatherCoords,
}: UseLiveRouteControlsOptions) {
  const [isRefreshingWeather, setIsRefreshingWeather] = useState(false);
  const [weatherNotice, setWeatherNotice] = useState<string | null>(null);

  const handleFetchLiveWeather = async () => {
    setIsRefreshingWeather(true);
    setWeatherNotice(null);
    try {
      const pos = weatherCoords ?? { lat: 16.0544, lng: 108.2022 };
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${pos.lat}&longitude=${pos.lng}&current=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m&timezone=Asia%2FHo_Chi_Minh`,
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
        onUpdateTrip(updatedTrip, 'Đã cập nhật thời tiết tuyến đường từ Open-Meteo!');
      }

      setWeatherNotice(`Đã đồng bộ thời tiết tuyến: ${updatedWeather.temp}°C, ${updatedWeather.description}`);
      setTimeout(() => setWeatherNotice(null), 4000);
    } catch (err) {
      console.error('Weather fetch error:', err);
      setWeatherNotice('Lỗi kết nối API thời tiết thời gian thực');
      setTimeout(() => setWeatherNotice(null), 3000);
    } finally {
      setIsRefreshingWeather(false);
    }
  };

  return {
    isRefreshingWeather,
    weatherNotice,
    setWeatherNotice,
    handleFetchLiveWeather,
  };
}
