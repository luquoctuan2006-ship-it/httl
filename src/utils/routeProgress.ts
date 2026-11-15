import type { Activity, TripData, Waypoint } from '../types/travel';
import { findMatchingActivityForWaypoint, findMatchingWaypointForActivity } from './tripHelpers';
import { isLegacyHashedCoordinate, lookupCoordinates } from './vietnamGeo';

export type RouteStopStatus = 'completed' | 'current' | 'pending';
type PendingActivityStatus = 'Đã xác nhận' | 'Cần xử lý' | 'Chờ duyệt';

export interface RouteStopItem {
  id: string;
  order: number;
  code: string;
  name: string;
  lat: number | null;
  lng: number | null;
  hasCoordinates: boolean;
  status: RouteStopStatus;
  dayIndex?: number;
  timeLabel?: string;
  activityId?: string;
  activityTitle?: string;
  categoryLabel?: string;
  distanceFromPrevKm: number;
  travelMinutesFromPrev: number;
  cumulativeKm: number;
  cumulativeTravelMinutes: number;
  waypointRef?: Waypoint;
}

export interface RouteProgressSummary {
  stops: RouteStopItem[];
  totalStops: number;
  locatedStopsCount: number;
  unlocatedStopsCount: number;
  completedStops: number;
  currentStop: RouteStopItem | null;
  nextStop: RouteStopItem | null;
  nextLegDistanceKm: number;
  nextLegMinutes: number;
  totalRouteKm: number;
  totalTravelMinutes: number;
  remainingKm: number;
  remainingMinutes: number;
  stopProgressPercent: number;
  /** Tiến độ thực hiện: chỉ tính hoạt động có trạng thái "Hoàn tất" */
  activityProgressPercent: number;
  completedActivitiesCount: number;
  /** Mức sẵn sàng: tính các hoạt động "Đã xác nhận" hoặc "Hoàn tất" */
  confirmedActivitiesPercent: number;
  confirmedActivitiesCount: number;
  totalActivitiesCount: number;
}

const ROAD_FACTOR = 1.25;
const CITY_SPEED_KMH = 38;
const HIGHWAY_SPEED_KMH = 55;

export function haversineDistanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function estimateRoadDistanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const straightKm = haversineDistanceKm(from, to);
  if (!Number.isFinite(straightKm) || straightKm < 0.05) return 0;
  return Number((straightKm * ROAD_FACTOR).toFixed(1));
}

export function estimateSegmentTravelMinutes(roadKm: number): number {
  if (!Number.isFinite(roadKm) || roadKm <= 0) return 0;
  const speedKmh = roadKm > 30 ? HIGHWAY_SPEED_KMH : CITY_SPEED_KMH;
  return Math.max(2, Math.round((roadKm / speedKmh) * 60));
}

export function formatTravelDuration(minutes: number): string {
  const safeMinutes = Math.max(0, Math.round(minutes));
  if (safeMinutes === 0) return '0 phút';
  if (safeMinutes < 60) return `${safeMinutes} phút`;
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return mins > 0 ? `${hours}g ${mins}p` : `${hours} giờ`;
}

function mapActivityStatusToStopStatus(
  actStatus: Activity['status'] | undefined,
  fallbackStatus: RouteStopStatus = 'pending',
): RouteStopStatus {
  if (actStatus === 'Hoàn tất') return 'completed';
  if (actStatus === 'Đang diễn ra') return 'current';
  return fallbackStatus;
}

function isValidCoordinatePair(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    (Math.abs(lat) > 0.0001 || Math.abs(lng) > 0.0001)
  );
}

function isPendingActivityStatus(status: Activity['status']): status is PendingActivityStatus {
  return status === 'Đã xác nhận' || status === 'Cần xử lý' || status === 'Chờ duyệt';
}

function hasTrustedWaypointCoordinates(wp: Waypoint): boolean {
  return (
    isValidCoordinatePair(wp.lat, wp.lng) &&
    !isLegacyHashedCoordinate(wp.name || '', wp.lat, wp.lng)
  );
}

function resolveActivityCoords(
  activity: Activity,
  matchedWp?: Waypoint,
): { lat: number; lng: number } | null {
  if (
    activity.coordinates &&
    isValidCoordinatePair(activity.coordinates.lat, activity.coordinates.lng) &&
    !isLegacyHashedCoordinate(activity.location || activity.title, activity.coordinates.lat, activity.coordinates.lng)
  ) {
    return { lat: activity.coordinates.lat, lng: activity.coordinates.lng };
  }
  if (matchedWp && hasTrustedWaypointCoordinates(matchedWp)) {
    return { lat: matchedWp.lat, lng: matchedWp.lng };
  }
  return lookupCoordinates(activity.location || activity.title);
}

export function buildRouteProgress(
  trip: TripData,
  dayFilter: number | 'all' = 'all',
): RouteProgressSummary {
  const visibleWaypoints = (trip.waypoints || []).filter((w) => !w.isHidden);

  type RawStop = Omit<
    RouteStopItem,
    'order' | 'code' | 'distanceFromPrevKm' | 'travelMinutesFromPrev' | 'cumulativeKm' | 'cumulativeTravelMinutes'
  >;

  const rawStops: RawStop[] = [];

  if (typeof dayFilter === 'number') {
    const targetDay = (trip.days || []).find((d) => d.dayIndex === dayFilter);
    const activities = [...(targetDay?.activities || [])].sort((a, b) =>
      (a.timeStart || '').localeCompare(b.timeStart || ''),
    );

    for (const act of activities) {
      const matchedWp = findMatchingWaypointForActivity(visibleWaypoints, act);
      const coords = resolveActivityCoords(act, matchedWp);
      const timeLabel = [act.timeStart, act.timeEnd].filter(Boolean).join(' - ') || undefined;
      rawStops.push({
        id: matchedWp?.id || act.id,
        name: act.location?.trim() || act.title,
        lat: coords ? coords.lat : null,
        lng: coords ? coords.lng : null,
        hasCoordinates: coords !== null,
        status: mapActivityStatusToStopStatus(act.status, matchedWp?.status || 'pending'),
        dayIndex: dayFilter,
        timeLabel,
        activityId: act.id,
        activityTitle: act.title,
        categoryLabel: matchedWp?.categoryLabel,
        waypointRef: matchedWp,
      });
    }
  } else if (visibleWaypoints.length > 0) {
    for (const wp of visibleWaypoints) {
      const match = findMatchingActivityForWaypoint(trip, wp);
      const matchedTime = match
        ? [match.activity.timeStart, match.activity.timeEnd].filter(Boolean).join(' - ')
        : '';
      const wpTime = [wp.arrivalTime, wp.departureTime].filter(Boolean).join(' - ');
      const timeLabel = matchedTime || wpTime || undefined;
      const trustedWpCoords = hasTrustedWaypointCoordinates(wp)
        ? { lat: Number(wp.lat), lng: Number(wp.lng) }
        : match
          ? resolveActivityCoords(match.activity)
          : lookupCoordinates(wp.name);
      rawStops.push({
        id: wp.id,
        name: wp.name,
        lat: trustedWpCoords ? trustedWpCoords.lat : null,
        lng: trustedWpCoords ? trustedWpCoords.lng : null,
        hasCoordinates: trustedWpCoords !== null,
        status: match
          ? mapActivityStatusToStopStatus(match.activity.status, wp.status)
          : wp.status,
        ...(match ? { dayIndex: match.dayIndex, activityId: match.activity.id, activityTitle: match.activity.title } : {}),
        timeLabel,
        categoryLabel: wp.categoryLabel,
        waypointRef: wp,
      });
    }
  } else {
    for (const day of trip.days || []) {
      const sortedActs = [...(day.activities || [])].sort((a, b) =>
        (a.timeStart || '').localeCompare(b.timeStart || ''),
      );
      for (const act of sortedActs) {
        const coords = resolveActivityCoords(act);
        const timeLabel = [act.timeStart, act.timeEnd].filter(Boolean).join(' - ') || undefined;
        rawStops.push({
          id: act.id,
          name: act.location?.trim() || act.title,
          lat: coords ? coords.lat : null,
          lng: coords ? coords.lng : null,
          hasCoordinates: coords !== null,
          status: mapActivityStatusToStopStatus(act.status, 'pending'),
          dayIndex: day.dayIndex,
          timeLabel,
          activityId: act.id,
          activityTitle: act.title,
        });
      }
    }
  }

  let cumulativeKm = 0;
  let cumulativeTravelMinutes = 0;
  let prevLocatedStop: { lat: number; lng: number } | null = null;

  const stops: RouteStopItem[] = rawStops.map((stop, index) => {
    let distanceFromPrevKm = 0;
    let travelMinutesFromPrev = 0;

    if (stop.hasCoordinates && stop.lat !== null && stop.lng !== null) {
      const currentCoords = { lat: stop.lat, lng: stop.lng };
      if (prevLocatedStop) {
        distanceFromPrevKm = estimateRoadDistanceKm(prevLocatedStop, currentCoords);
        travelMinutesFromPrev = estimateSegmentTravelMinutes(distanceFromPrevKm);
        cumulativeKm = Number((cumulativeKm + distanceFromPrevKm).toFixed(1));
        cumulativeTravelMinutes += travelMinutesFromPrev;
      }
      prevLocatedStop = currentCoords;
    }

    return {
      ...stop,
      order: index + 1,
      code: stop.waypointRef?.code || String(index + 1).padStart(2, '0'),
      distanceFromPrevKm,
      travelMinutesFromPrev,
      cumulativeKm,
      cumulativeTravelMinutes,
    };
  });

  const totalStops = stops.length;
  const locatedStopsCount = stops.filter((s) => s.hasCoordinates).length;
  const unlocatedStopsCount = totalStops - locatedStopsCount;
  const completedStops = stops.filter((s) => s.status === 'completed').length;
  const currentStop =
    stops.find((s) => s.status === 'current') ||
    stops.find((s) => s.status === 'pending') ||
    stops[stops.length - 1] ||
    null;

  const currentIdx = currentStop
    ? stops.findIndex((s) => s.id === currentStop.id && s.order === currentStop.order)
    : -1;
  const nextStop =
    currentIdx >= 0 && currentIdx + 1 < stops.length
      ? stops[currentIdx + 1]
      : null;

  const nextLegDistanceKm = nextStop && nextStop.hasCoordinates ? nextStop.distanceFromPrevKm : 0;
  const nextLegMinutes = nextStop && nextStop.hasCoordinates ? nextStop.travelMinutesFromPrev : 0;

  const totalRouteKm = stops.length > 0 ? stops[stops.length - 1].cumulativeKm : 0;
  const totalTravelMinutes = stops.length > 0 ? stops[stops.length - 1].cumulativeTravelMinutes : 0;

  const completedOrCurrentKm = currentStop ? currentStop.cumulativeKm : 0;
  const completedOrCurrentMinutes = currentStop ? currentStop.cumulativeTravelMinutes : 0;
  const remainingKm = Number(Math.max(0, totalRouteKm - completedOrCurrentKm).toFixed(1));
  const remainingMinutes = Math.max(0, totalTravelMinutes - completedOrCurrentMinutes);

  const stopProgressPercent =
    totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;

  const relevantActivities =
    typeof dayFilter === 'number'
      ? (trip.days || []).find((d) => d.dayIndex === dayFilter)?.activities || []
      : (trip.days || []).flatMap((d) => d.activities || []);

  const totalActivitiesCount = relevantActivities.length;
  const completedActivitiesCount = relevantActivities.filter(
    (a) => a.status === 'Hoàn tất',
  ).length;
  const confirmedActivitiesCount = relevantActivities.filter(
    (a) => a.status === 'Hoàn tất' || a.status === 'Đã xác nhận',
  ).length;

  const activityProgressPercent =
    totalActivitiesCount > 0
      ? Math.round((completedActivitiesCount / totalActivitiesCount) * 100)
      : 0;
  const confirmedActivitiesPercent =
    totalActivitiesCount > 0
      ? Math.round((confirmedActivitiesCount / totalActivitiesCount) * 100)
      : 0;

  return {
    stops,
    totalStops,
    locatedStopsCount,
    unlocatedStopsCount,
    completedStops,
    currentStop,
    nextStop,
    nextLegDistanceKm,
    nextLegMinutes,
    totalRouteKm,
    totalTravelMinutes,
    remainingKm,
    remainingMinutes,
    stopProgressPercent,
    activityProgressPercent,
    completedActivitiesCount,
    confirmedActivitiesPercent,
    confirmedActivitiesCount,
    totalActivitiesCount,
  };
}

export function applyStopStatusUpdate(
  trip: TripData,
  stop: RouteStopItem,
  nextStatus: RouteStopStatus,
): TripData {
  const targetWpId = stop.waypointRef?.id || stop.id;
  const updatedWaypoints = (trip.waypoints || []).map((wp) =>
    wp.id === targetWpId ? { ...wp, status: nextStatus } : wp,
  );

  let updatedDays = trip.days || [];
  if (stop.activityId) {
    updatedDays = updatedDays.map((day) => {
      const hasAct = (day.activities || []).some((a) => a.id === stop.activityId);
      if (!hasAct) return day;
      const activities = day.activities.map((a): Activity => {
        if (a.id !== stop.activityId) return a;

        if (nextStatus === 'completed' || nextStatus === 'current') {
          const targetStatus: Activity['status'] =
            nextStatus === 'completed' ? 'Hoàn tất' : 'Đang diễn ra';
          const preservedPrevious: PendingActivityStatus | undefined = isPendingActivityStatus(a.status)
            ? a.status
            : a.previousStatus;
          return {
            ...a,
            status: targetStatus,
            ...(preservedPrevious ? { previousStatus: preservedPrevious } : {}),
          };
        }

        // nextStatus === 'pending': giữ nguyên Cần xử lý / Chờ duyệt / Đã xác nhận hiện tại,
        // hoặc khôi phục lại trạng thái trước đó nếu đang lùi từ Hoàn tất / Đang diễn ra
        if (isPendingActivityStatus(a.status)) {
          return a;
        }
        const restoredStatus: PendingActivityStatus = a.previousStatus ?? 'Đã xác nhận';
        const { previousStatus: _removed, ...rest } = a;
        return {
          ...rest,
          status: restoredStatus,
        };
      });

      return {
        ...day,
        activities,
        confirmedCount: activities.filter((a) => a.status === 'Hoàn tất' || a.status === 'Đã xác nhận').length,
        pendingCount: activities.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra' || a.status === 'Chờ duyệt').length,
      };
    });
  }

  const allActivities = updatedDays.flatMap((d) => d.activities || []);
  const confirmedActivities = allActivities.filter(
    (a) => a.status === 'Hoàn tất' || a.status === 'Đã xác nhận',
  ).length;
  const pendingActivities = allActivities.filter(
    (a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra' || a.status === 'Chờ duyệt',
  ).length;

  return {
    ...trip,
    waypoints: updatedWaypoints,
    days: updatedDays,
    confirmedActivities,
    pendingActivities,
  };
}
