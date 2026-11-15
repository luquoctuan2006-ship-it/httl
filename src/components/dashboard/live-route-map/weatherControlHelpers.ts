import type { TripData } from '../../../types/travel';
import type { RouteStopItem } from '../../../utils/routeProgress';
import type { RouteWeatherTarget } from '../../../utils/weatherParser';

export interface LocalLiveWeatherState {
  tripId: string;
  coordsSignature: string;
  baseTripWeatherSig: string;
  weather: TripData['weather'];
}

export function getWeatherSignature(weather: TripData['weather'] | undefined): string {
  if (!weather) return '';
  return JSON.stringify({
    temp: weather.temp,
    description: weather.description,
    rainProb: weather.rainProb,
    rainProbTime: weather.rainProbTime,
    humidity: weather.humidity ?? null,
    windSpeed: weather.windSpeed ?? null,
    isLive: Boolean(weather.isLive),
    lastFetched: weather.lastFetched ?? '',
    stopForecasts: (weather.stopForecasts || []).map((s) => `${s.stopId}:${s.temp}:${s.rainProb}`),
  });
}

export function buildWeatherCoordsSignature(stops: RouteStopItem[]): string {
  return stops
    .filter(
      (s): s is RouteStopItem & { lat: number; lng: number } =>
        s.hasCoordinates && s.lat !== null && s.lng !== null,
    )
    .map((s) => `${s.id}@${s.lat.toFixed(3)},${s.lng.toFixed(3)}`)
    .join('|');
}

export function collectRouteWeatherTargets(
  stops: RouteStopItem[],
  currentStop: RouteStopItem | null,
  maxStops = 12,
): RouteWeatherTarget[] {
  const locatedStops = stops.filter(
    (s): s is RouteStopItem & { lat: number; lng: number } =>
      s.hasCoordinates && s.lat !== null && s.lng !== null,
  );
  if (locatedStops.length === 0) return [];

  const currentIdx = currentStop
    ? locatedStops.findIndex((s) => s.id === currentStop.id && s.order === currentStop.order)
    : 0;
  const orderedStops =
    currentIdx > 0
      ? [...locatedStops.slice(currentIdx), ...locatedStops.slice(0, currentIdx)]
      : locatedStops;

  const seenCoords = new Set<string>();
  const targets: RouteWeatherTarget[] = [];
  for (const stop of orderedStops) {
    const coordKey = `${stop.lat.toFixed(3)},${stop.lng.toFixed(3)}`;
    if (seenCoords.has(coordKey)) continue;
    seenCoords.add(coordKey);
    targets.push({
      stopId: stop.id,
      stopName: stop.name,
      lat: stop.lat,
      lng: stop.lng,
    });
    if (targets.length >= maxStops) break;
  }
  return targets;
}

/**
 * Selects effective weather to display:
 * - Rejects local override if it belongs to a different trip or different route coordinates.
 * - Yields to `trip.weather` whenever saved trip weather has changed externally since `liveWeather` was fetched.
 */
export function selectEffectiveWeather(
  tripId: string,
  coordsSignature: string,
  tripWeather: TripData['weather'],
  liveState: LocalLiveWeatherState | null,
): TripData['weather'] {
  if (!liveState) return tripWeather;
  if (liveState.tripId !== tripId || liveState.coordsSignature !== coordsSignature) {
    return tripWeather;
  }
  const currentSavedSig = getWeatherSignature(tripWeather);
  if (currentSavedSig !== liveState.baseTripWeatherSig) {
    // External save or server scan updated trip.weather -> prefer authoritative saved weather
    return tripWeather;
  }
  return liveState.weather;
}
