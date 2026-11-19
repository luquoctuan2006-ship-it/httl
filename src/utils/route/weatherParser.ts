import type { RouteStopWeather, TripData } from '../../types/travel';

export function getWeatherDescription(code: number): string {
  if (code === 0) return 'Trời quang, nắng đẹp';
  if (code === 1) return 'Ít mây, trời trong';
  if (code === 2) return 'Mây rải rác';
  if (code === 3) return 'Nhiều mây';
  if (code === 45 || code === 48) return 'Có sương mù nhẹ';
  if (code >= 51 && code <= 55) return 'Mưa phùn nhẹ';
  if (code >= 61 && code <= 65) return 'Mưa rào';
  if (code >= 80 && code <= 82) return 'Mưa rào rải rác';
  if (code >= 95) return 'Dông sét / Mưa bão mạnh';
  return 'Thời tiết ổn định';
}

function extractHourLabel(isoTime: unknown): string | null {
  if (typeof isoTime !== 'string') return null;
  const match = isoTime.match(/T(\d{2}):(\d{2})/);
  if (!match) return null;
  return `${match[1]}:${match[2]}`;
}

export interface ParsedPointForecast {
  temp: number;
  description: string;
  rainProb: string;
  rainProbTime: string;
  humidity?: number;
  windSpeed?: string;
  weatherCode: number;
}

export function parseOpenMeteoPoint(raw: unknown): ParsedPointForecast | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const current =
    data.current && typeof data.current === 'object'
      ? (data.current as Record<string, unknown>)
      : null;
  if (!current) return null;

  const rawTemp = Number(current.temperature_2m);
  if (!Number.isFinite(rawTemp)) return null;

  const rawCode = Number(current.weather_code);
  const weatherCode = Number.isFinite(rawCode) ? rawCode : 0;
  const description = getWeatherDescription(weatherCode);

  const humidityRaw = Number(current.relative_humidity_2m);
  const humidity = Number.isFinite(humidityRaw) ? Math.round(humidityRaw) : undefined;

  const windRaw = Number(current.wind_speed_10m);
  const windSpeed = Number.isFinite(windRaw) ? `${Math.round(windRaw)} km/h` : undefined;

  const currentProbRaw = current.precipitation_probability;
  const hasCurrentProb =
    typeof currentProbRaw === 'number' && Number.isFinite(currentProbRaw) && currentProbRaw >= 0;

  const hourly =
    data.hourly && typeof data.hourly === 'object'
      ? (data.hourly as Record<string, unknown>)
      : null;
  const rawHourlyProbs = Array.isArray(hourly?.precipitation_probability)
    ? hourly.precipitation_probability
    : [];
  const rawHourlyTimes = Array.isArray(hourly?.time) ? hourly.time : [];

  let maxHourlyProb: number | null = null;
  let peakStartIdx = -1;
  let peakEndIdx = -1;

  for (let i = 0; i < rawHourlyProbs.length; i += 1) {
    const val = rawHourlyProbs[i];
    if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) continue;
    if (maxHourlyProb === null || val > maxHourlyProb) {
      maxHourlyProb = val;
      peakStartIdx = i;
      peakEndIdx = i;
    } else if (val === maxHourlyProb && i === peakEndIdx + 1) {
      peakEndIdx = i;
    }
  }

  let rainProb = '';
  let rainProbTime = '';

  if (maxHourlyProb !== null) {
    const effectiveProb = hasCurrentProb
      ? Math.max(Math.round(currentProbRaw), Math.round(maxHourlyProb))
      : Math.round(maxHourlyProb);
    rainProb = `${effectiveProb}%`;
    if (maxHourlyProb > 0 && peakStartIdx >= 0) {
      const startLabel = extractHourLabel(rawHourlyTimes[peakStartIdx]);
      const endLabel = extractHourLabel(rawHourlyTimes[peakEndIdx]);
      if (startLabel && endLabel) {
        rainProbTime = startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
      } else if (startLabel) {
        rainProbTime = startLabel;
      }
    }
  } else if (hasCurrentProb) {
    rainProb = `${Math.round(currentProbRaw)}%`;
  }

  return {
    temp: Math.round(rawTemp),
    description,
    rainProb,
    rainProbTime,
    ...(humidity !== undefined ? { humidity } : {}),
    ...(windSpeed ? { windSpeed } : {}),
    weatherCode,
  };
}

export interface RouteWeatherTarget {
  stopId: string;
  stopName: string;
  lat: number;
  lng: number;
}

export function buildBatchOpenMeteoUrl(targets: RouteWeatherTarget[]): string {
  const lats = targets.map((t) => t.lat.toFixed(4)).join(',');
  const lngs = targets.map((t) => t.lng.toFixed(4)).join(',');
  return (
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lats}&longitude=${lngs}` +
    `&current=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m` +
    `&hourly=precipitation_probability` +
    `&timezone=Asia%2FHo_Chi_Minh&forecast_days=1`
  );
}

export function buildTripWeatherFromOpenMeteo(
  rawPayload: unknown,
  targets: RouteWeatherTarget[],
  fetchedAt?: string,
): TripData['weather'] | null {
  if (targets.length === 0) return null;
  const items = Array.isArray(rawPayload) ? rawPayload : [rawPayload];
  const stopForecasts: RouteStopWeather[] = [];

  for (let i = 0; i < targets.length; i += 1) {
    const parsed = parseOpenMeteoPoint(items[i]);
    if (!parsed) continue;
    const target = targets[i];
    stopForecasts.push({
      stopId: target.stopId,
      stopName: target.stopName,
      lat: target.lat,
      lng: target.lng,
      temp: parsed.temp,
      description: parsed.description,
      rainProb: parsed.rainProb,
      rainProbTime: parsed.rainProbTime,
      ...(parsed.humidity !== undefined ? { humidity: parsed.humidity } : {}),
      ...(parsed.windSpeed ? { windSpeed: parsed.windSpeed } : {}),
      weatherCode: parsed.weatherCode,
    });
  }

  if (stopForecasts.length === 0) return null;

  const primary = stopForecasts[0];
  return {
    temp: primary.temp,
    description: primary.description,
    rainProb: primary.rainProb,
    rainProbTime: primary.rainProbTime,
    ...(primary.humidity !== undefined ? { humidity: primary.humidity } : {}),
    ...(primary.windSpeed ? { windSpeed: primary.windSpeed } : {}),
    isLive: true,
    lastFetched:
      fetchedAt ||
      new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    stopForecasts,
  };
}
