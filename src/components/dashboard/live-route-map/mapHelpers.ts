import type { RouteStopWeather } from '../../../types/travel';
import type { RouteStopItem } from '../../../utils/routeProgress';

export { getWeatherDescription } from '../../../utils/weatherParser';

export const escapeHtml = (value: unknown): string =>
  String(value ?? '').replace(/[&<>"']/g, (character) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[character],
  );

export const STATUS_LABEL: Record<string, string> = {
  completed: 'Đã tham quan',
  current: 'Đang tham quan',
  pending: 'Sắp tới',
};

export function findStopWeather(
  stop: Pick<RouteStopItem, 'id' | 'lat' | 'lng' | 'hasCoordinates'>,
  stopForecasts?: RouteStopWeather[],
): RouteStopWeather | undefined {
  if (!stopForecasts || stopForecasts.length === 0) return undefined;
  const direct = stopForecasts.find((sf) => sf.stopId === stop.id);
  if (direct) return direct;
  if (stop.hasCoordinates && stop.lat !== null && stop.lng !== null) {
    const coordKey = `${stop.lat.toFixed(3)},${stop.lng.toFixed(3)}`;
    return stopForecasts.find((sf) => `${sf.lat.toFixed(3)},${sf.lng.toFixed(3)}` === coordKey);
  }
  return undefined;
}
