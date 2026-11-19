import type { DaySchedule, TripData, Waypoint } from '../../types/travel';
import { estimateRoadDistanceKm } from './routeProgress';
import { findMatchingActivityForWaypoint } from '../trip/tripHelpers';
import {
  buildAIPlanWaypoints,
  isLegacyHashedCoordinate,
  lookupCoordinates,
  type EndpointCoordinates,
} from './vietnamGeo';

const VN_WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;

function hasUsablePointCoords(lat: unknown, lng: unknown, name: string): boolean {
  const numLat = Number(lat);
  const numLng = Number(lng);
  return (
    Number.isFinite(numLat) &&
    Number.isFinite(numLng) &&
    numLat >= -90 &&
    numLat <= 90 &&
    numLng >= -180 &&
    numLng <= 180 &&
    (Math.abs(numLat) > 0.0001 || Math.abs(numLng) > 0.0001) &&
    !isLegacyHashedCoordinate(name, numLat, numLng)
  );
}

/**
 * Tạo metadata ngày dương lịch (thứ, số ngày, nhãn ngày, fullDate) từ startDate ISO YYYY-MM-DD.
 */
export function buildCalendarDayMeta(
  startDateIso: string,
  dayIndex: number,
  rawTheme?: string,
): Pick<DaySchedule, 'dayName' | 'dateNum' | 'dateLabel' | 'fullDate'> {
  const cleanTheme = String(rawTheme || '')
    .replace(/^(?:CN|T[2-7]),\s*\d{1,2}\/\d{1,2}\/\d{4}\s*(?:•|:|-)?\s*/i, '')
    .replace(/^Ngày\s*\d+\s*[:•–-]?\s*/i, '')
    .trim();

  const match = String(startDateIso || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return {
      dayName: `N${dayIndex}`,
      dateNum: dayIndex,
      dateLabel: `Ngày ${dayIndex}`,
      fullDate: cleanTheme ? `Ngày ${dayIndex}: ${cleanTheme}` : `Ngày ${dayIndex}: Lịch trình chi tiết`,
    };
  }

  const dt = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + Math.max(0, dayIndex - 1)),
  );
  const dayName = VN_WEEKDAYS[dt.getUTCDay()];
  const dateNum = dt.getUTCDate();
  const dd = String(dateNum).padStart(2, '0');
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = dt.getUTCFullYear();
  const calendarText = `${dayName}, ${dd}/${mm}/${yyyy}`;

  return {
    dayName,
    dateNum,
    dateLabel: `${dayName} ${dateNum}`,
    fullDate: cleanTheme ? `${calendarText} • ${cleanTheme}` : calendarText,
  };
}

/**
 * Cập nhật lại dayName, dateNum, dateLabel, fullDate cho toàn bộ danh sách ngày khi người dùng đổi ngày khởi hành hoặc xóa ngày.
 */
export function syncDaysWithStartDate(
  days: readonly DaySchedule[],
  startDateIso: string,
): DaySchedule[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(startDateIso || '').trim())) {
    return [...days];
  }
  return days.map((day, index) => {
    const dayIndex = day.dayIndex || index + 1;
    const meta = buildCalendarDayMeta(startDateIso, dayIndex, day.fullDate);
    return {
      ...day,
      dayIndex,
      ...meta,
    };
  });
}

function resolveExistingWaypointCoordForPlace(
  waypoints: readonly Waypoint[],
  placeName: string,
): { lat: number; lng: number } | undefined {
  const clean = placeName.trim().toLowerCase();
  if (!clean) return undefined;
  const matched = waypoints.find((wp) => wp.name.trim().toLowerCase() === clean);
  if (matched && hasUsablePointCoords(matched.lat, matched.lng, matched.name)) {
    return { lat: matched.lat, lng: matched.lng };
  }
  return undefined;
}

/**
 * Đồng bộ lại waypoints, destinationsCount và totalKm của chuyến đi từ origin/destination + days[].activities
 * mỗi khi người dùng thêm/sửa/xóa hoạt động, xóa ngày, tự sắp xếp hoặc sửa điểm đi/đến.
 */
export function syncTripRouteMetadata(
  trip: TripData,
  endpointCoords?: EndpointCoordinates,
): TripData {
  const originName = (trip.originFull || trip.origin || 'Điểm khởi hành').trim();
  const destinationName = (trip.destinationFull || trip.destination || 'Điểm đến').trim();
  const existingWaypoints = Array.isArray(trip.waypoints) ? trip.waypoints : [];

  const resolvedEndpointCoords: EndpointCoordinates = {
    origin:
      endpointCoords?.origin ??
      resolveExistingWaypointCoordForPlace(existingWaypoints, originName) ??
      lookupCoordinates(originName),
    destination:
      endpointCoords?.destination ??
      resolveExistingWaypointCoordForPlace(existingWaypoints, destinationName) ??
      lookupCoordinates(destinationName),
  };

  const orderedDays = [...(trip.days || [])].sort((a, b) => a.dayIndex - b.dayIndex);
  const allActivities = orderedDays.flatMap((day) =>
    [...(day.activities || [])].sort((a, b) => (a.timeStart || '').localeCompare(b.timeStart || '')),
  );

  const rebuiltWaypoints = buildAIPlanWaypoints(
    originName,
    destinationName,
    allActivities,
    resolvedEndpointCoords,
  );

  if (rebuiltWaypoints.length === 0) {
    return trip;
  }

  const existingByName = new Map<string, Waypoint>();
  for (const wp of existingWaypoints) {
    const key = wp.name.trim().toLowerCase();
    if (key && !existingByName.has(key)) {
      existingByName.set(key, wp);
    }
  }

  const mergedWaypoints: Waypoint[] = rebuiltWaypoints.map((wp) => {
    const oldWp = existingByName.get(wp.name.trim().toLowerCase());
    const match = findMatchingActivityForWaypoint(trip, wp);
    const derivedStatus: Waypoint['status'] = match
      ? match.activity.status === 'Hoàn tất'
        ? 'completed'
        : match.activity.status === 'Đang diễn ra'
          ? 'current'
          : 'pending'
      : oldWp?.status || wp.status;

    return {
      ...wp,
      status: derivedStatus,
      ...(oldWp?.isCustom ? { lat: oldWp.lat, lng: oldWp.lng, isCustom: true } : {}),
      ...(oldWp?.category ? { category: oldWp.category } : {}),
      ...(oldWp?.categoryLabel ? { categoryLabel: oldWp.categoryLabel } : {}),
      ...(oldWp?.openHours ? { openHours: oldWp.openHours } : {}),
      ...(oldWp?.ticketPrice ? { ticketPrice: oldWp.ticketPrice } : {}),
      ...(oldWp?.description ? { description: oldWp.description } : {}),
      ...(oldWp?.isHidden ? { isHidden: oldWp.isHidden } : {}),
    };
  });

  const mergedNames = new Set(mergedWaypoints.map((w) => w.name.trim().toLowerCase()));
  for (const wp of existingWaypoints) {
    const key = wp.name.trim().toLowerCase();
    if (wp.isCustom && key && !mergedNames.has(key)) {
      mergedNames.add(key);
      mergedWaypoints.push(wp);
    }
  }

  const locatedPoints = mergedWaypoints.filter((wp) =>
    hasUsablePointCoords(wp.lat, wp.lng, wp.name),
  );
  let estimatedKm = trip.totalKm;
  if (locatedPoints.length >= 2) {
    let sumKm = 0;
    for (let i = 1; i < locatedPoints.length; i += 1) {
      sumKm += estimateRoadDistanceKm(locatedPoints[i - 1], locatedPoints[i]);
    }
    if (sumKm > 0) {
      estimatedKm = Math.round(sumKm);
    }
  }

  return {
    ...trip,
    waypoints: mergedWaypoints,
    destinationsCount: mergedWaypoints.length || trip.totalDays,
    totalKm: estimatedKm,
  };
}
