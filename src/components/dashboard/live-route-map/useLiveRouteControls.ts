import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TripData } from '../../../types/travel';
import type { RouteStopItem } from '../../../utils/routeProgress';
import {
  buildBatchOpenMeteoUrl,
  buildTripWeatherFromOpenMeteo,
} from '../../../utils/weatherParser';
import {
  buildWeatherCoordsSignature,
  collectRouteWeatherTargets,
  getWeatherSignature,
  selectEffectiveWeather,
  type LocalLiveWeatherState,
} from './weatherControlHelpers';

const WEATHER_CACHE_TTL_MS = 5 * 60 * 1000;
const WEATHER_AUTO_REFRESH_MS = 10 * 60 * 1000;

interface CachedWeatherEntry {
  fetchedAtMs: number;
  weather: TripData['weather'];
}

const routeWeatherCache = new Map<string, CachedWeatherEntry>();

interface UseLiveRouteControlsOptions {
  trip: TripData;
  onUpdateTrip?: (updatedTrip: TripData, message?: string) => void;
  stops: RouteStopItem[];
  currentStop: RouteStopItem | null;
}

export function useLiveRouteControls({
  trip,
  onUpdateTrip,
  stops,
  currentStop,
}: UseLiveRouteControlsOptions) {
  const [isRefreshingWeather, setIsRefreshingWeather] = useState(false);
  const [weatherNotice, setWeatherNotice] = useState<string | null>(null);
  const [liveState, setLiveState] = useState<LocalLiveWeatherState | null>(null);

  // Signature based strictly on stop IDs & coordinates (status toggles do not re-fetch weather)
  const coordsSignature = useMemo(() => buildWeatherCoordsSignature(stops), [stops]);
  const tripWeatherSig = useMemo(() => getWeatherSignature(trip.weather), [trip.weather]);

  const stopsRef = useRef(stops);
  stopsRef.current = stops;
  const currentStopRef = useRef(currentStop);
  currentStopRef.current = currentStop;
  const tripRef = useRef(trip);
  tripRef.current = trip;
  const coordsSignatureRef = useRef(coordsSignature);
  coordsSignatureRef.current = coordsSignature;
  const tripWeatherSigRef = useRef(tripWeatherSig);
  tripWeatherSigRef.current = tripWeatherSig;
  const onUpdateTripRef = useRef(onUpdateTrip);
  onUpdateTripRef.current = onUpdateTrip;

  const requestSeqRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Clear local override if external trip.weather changed (e.g., server scan or another collaborator saved)
  useEffect(() => {
    setLiveState((prev) => {
      if (!prev) return null;
      if (prev.tripId !== trip.id || prev.coordsSignature !== coordsSignature) return null;
      if (tripWeatherSig !== prev.baseTripWeatherSig) return null;
      return prev;
    });
  }, [trip.id, coordsSignature, tripWeatherSig]);

  const fetchWeatherInternal = useCallback(
    async ({ silent, force }: { silent: boolean; force: boolean }) => {
      const requestTripId = tripRef.current.id;
      const requestCoordsSig = coordsSignatureRef.current;
      const requestBaseWeatherSig = tripWeatherSigRef.current;
      const targets = collectRouteWeatherTargets(stopsRef.current, currentStopRef.current);

      if (targets.length === 0) {
        if (!silent) {
          setWeatherNotice('Chuyến đi chưa có điểm dừng có tọa độ để lấy dự báo thời tiết dọc tuyến.');
          setTimeout(() => setWeatherNotice(null), 4000);
        }
        return;
      }

      if (silent && typeof navigator !== 'undefined' && !navigator.onLine) {
        return;
      }
      if (silent && typeof document !== 'undefined' && document.hidden) {
        return;
      }

      const cacheKey = `${requestTripId}::${requestCoordsSig}`;
      if (!force) {
        const cached = routeWeatherCache.get(cacheKey);
        if (cached && Date.now() - cached.fetchedAtMs < WEATHER_CACHE_TTL_MS) {
          if (
            tripRef.current.id === requestTripId &&
            coordsSignatureRef.current === requestCoordsSig
          ) {
            setLiveState({
              tripId: requestTripId,
              coordsSignature: requestCoordsSig,
              baseTripWeatherSig: requestBaseWeatherSig,
              weather: cached.weather,
            });
          }
          return;
        }
      }

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const requestSeq = ++requestSeqRef.current;

      const isStillActiveRequest = () =>
        !controller.signal.aborted &&
        requestSeq === requestSeqRef.current &&
        tripRef.current.id === requestTripId &&
        coordsSignatureRef.current === requestCoordsSig;

      setIsRefreshingWeather(true);
      if (!silent) setWeatherNotice(null);

      try {
        const res = await fetch(buildBatchOpenMeteoUrl(targets), { signal: controller.signal });
        if (!res.ok) throw new Error('Không thể tải dữ liệu thời tiết');
        const payload = (await res.json()) as unknown;

        if (!isStillActiveRequest()) return;

        const updatedWeather = buildTripWeatherFromOpenMeteo(payload, targets);
        if (!updatedWeather) {
          throw new Error('Phản hồi Open-Meteo không có dữ liệu nhiệt độ hợp lệ');
        }

        routeWeatherCache.set(cacheKey, {
          fetchedAtMs: Date.now(),
          weather: updatedWeather,
        });

        if (!isStillActiveRequest()) return;

        setLiveState({
          tripId: requestTripId,
          coordsSignature: requestCoordsSig,
          baseTripWeatherSig: requestBaseWeatherSig,
          weather: updatedWeather,
        });

        if (!silent && onUpdateTripRef.current) {
          onUpdateTripRef.current(
            {
              ...tripRef.current,
              weather: updatedWeather,
            },
            `Đã cập nhật thời tiết hiện tại dọc tuyến (${updatedWeather.stopForecasts?.length ?? 1} điểm) từ Open-Meteo!`,
          );
        }

        if (!silent) {
          setWeatherNotice(
            `Đã đồng bộ ${updatedWeather.stopForecasts?.length ?? 1} điểm dọc tuyến • ${targets[0].stopName}: ${updatedWeather.temp}°C (${updatedWeather.description})`,
          );
          setTimeout(() => setWeatherNotice(null), 4500);
        }
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError' || !isStillActiveRequest()) {
          return;
        }
        console.error('Weather fetch error:', err);
        if (!silent) {
          setWeatherNotice('Lỗi kết nối API thời tiết Open-Meteo');
          setTimeout(() => setWeatherNotice(null), 3500);
        }
      } finally {
        if (requestSeq === requestSeqRef.current) {
          setIsRefreshingWeather(false);
        }
      }
    },
    [],
  );

  // Cancel stale in-flight weather fetches and reset notice when switching trips/routes
  useEffect(() => {
    setWeatherNotice(null);
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [trip.id]);

  useEffect(() => {
    if (!coordsSignature) return;
    void fetchWeatherInternal({ silent: true, force: false });

    const intervalId = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void fetchWeatherInternal({ silent: true, force: true });
    }, WEATHER_AUTO_REFRESH_MS);

    const handleOnline = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void fetchWeatherInternal({ silent: true, force: true });
    };

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        // Uses 5-min TTL cache if still fresh; refreshes automatically if stale while tab was hidden
        void fetchWeatherInternal({ silent: true, force: false });
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      abortControllerRef.current?.abort();
      window.clearInterval(intervalId);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [trip.id, coordsSignature, fetchWeatherInternal]);

  const handleFetchLiveWeather = useCallback(async () => {
    await fetchWeatherInternal({ silent: false, force: true });
  }, [fetchWeatherInternal]);

  const effectiveWeather = useMemo(
    () => selectEffectiveWeather(trip.id, coordsSignature, trip.weather, liveState),
    [trip.id, coordsSignature, trip.weather, liveState],
  );

  return {
    weather: effectiveWeather,
    isRefreshingWeather,
    weatherNotice,
    setWeatherNotice,
    handleFetchLiveWeather,
  };
}
