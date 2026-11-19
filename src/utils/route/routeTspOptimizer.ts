import type { Activity, DaySchedule, TripData } from '../../types/travel';
import { formatClock, parseClock } from '../schedule/scheduleValidator';
import { estimateRoadDistanceKm, haversineDistanceKm } from './routeProgress';
import { syncTripRouteMetadata } from './tripRouteSync';
import { isLegacyHashedCoordinate, lookupCoordinates } from './vietnamGeo';

export interface TspRoutePoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  locked?: boolean;
}

export interface TspSequenceResult {
  orderedIds: string[];
  orderedPoints: TspRoutePoint[];
  originalKm: number;
  optimizedKm: number;
  savedKm: number;
  savedPercent: number;
  changedOrder: boolean;
}

export interface DayRouteTspResult {
  updatedDay: DaySchedule;
  orderedStopNames: string[];
  originalStopNames: string[];
  originalKm: number;
  optimizedKm: number;
  savedKm: number;
  savedPercent: number;
  changedOrder: boolean;
  reorderedCount: number;
}

export interface TripRouteTspResult {
  updatedTrip: TripData;
  originalKm: number;
  optimizedKm: number;
  savedKm: number;
  savedPercent: number;
  changedDaysCount: number;
  dayResults: {
    dayIndex: number;
    originalKm: number;
    optimizedKm: number;
    savedKm: number;
    changedOrder: boolean;
    orderedStopNames: string[];
  }[];
}

const parseMinutes = (timeStr?: string): number => parseClock(timeStr) ?? 0;

function isUsableCoord(lat: unknown, lng: unknown): lat is number {
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

export function resolveActivityCoordinate(activity: Activity): { lat: number; lng: number } | null {
  if (
    activity.coordinates &&
    isUsableCoord(activity.coordinates.lat, activity.coordinates.lng) &&
    !isLegacyHashedCoordinate(
      activity.location || activity.title,
      activity.coordinates.lat,
      activity.coordinates.lng,
    )
  ) {
    return { lat: activity.coordinates.lat, lng: activity.coordinates.lng };
  }
  return lookupCoordinates(activity.location || activity.title);
}

export function computePointSequenceKm(
  points: readonly Pick<TspRoutePoint, 'lat' | 'lng'>[],
  mode: 'road_estimate' | 'haversine' = 'road_estimate',
): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total +=
      mode === 'haversine'
        ? haversineDistanceKm(points[i - 1], points[i])
        : estimateRoadDistanceKm(points[i - 1], points[i]);
  }
  return Number(total.toFixed(1));
}

/**
 * Thuật toán TSP (Nearest Neighbor + 2-opt Local Search) tối ưu thứ tự tham quan theo khoảng cách ngắn nhất.
 * Giữ cố định điểm xuất phát (chỉ số 0) và các điểm đầu đã khóa (nếu có) để giữ ngữ cảnh thực tế của hành trình.
 */
export function optimizeStopSequenceTSP(
  points: readonly TspRoutePoint[],
  options: { anchorFirst?: boolean } = {},
): TspSequenceResult {
  const { anchorFirst = true } = options;
  if (points.length <= 2) {
    const km = computePointSequenceKm(points, 'road_estimate');
    return {
      orderedIds: points.map((p) => p.id),
      orderedPoints: [...points],
      originalKm: km,
      optimizedKm: km,
      savedKm: 0,
      savedPercent: 0,
      changedOrder: false,
    };
  }

  const isAnchor = (idx: number) => (anchorFirst && idx === 0) || Boolean(points[idx]?.locked);
  const path = [...points];
  let idx = 0;
  let anyOptimized = false;

  while (idx < path.length) {
    if (isAnchor(idx)) {
      idx += 1;
      continue;
    }
    const segStart = idx;
    while (idx < path.length && !isAnchor(idx)) idx += 1;
    const segEnd = idx - 1;
    const segLen = segEnd - segStart + 1;
    if (segLen < 2) continue;

    const leftAnchor = segStart > 0 ? path[segStart - 1] : null;
    const rightAnchor = segEnd + 1 < path.length ? path[segEnd + 1] : null;

    // Bước 1: Nearest Neighbor trên đoạn [segStart .. segEnd]
    const remaining = path.slice(segStart, segEnd + 1);
    const bestRun: TspRoutePoint[] = [];
    while (remaining.length > 0) {
      const last = bestRun[bestRun.length - 1] ?? leftAnchor;
      let bestIdx = 0;
      if (last) {
        let bestDist = Infinity;
        for (let k = 0; k < remaining.length; k += 1) {
          const d = haversineDistanceKm(last, remaining[k]);
          if (d < bestDist - 1e-6) {
            bestDist = d;
            bestIdx = k;
          }
        }
      }
      bestRun.push(remaining.splice(bestIdx, 1)[0]);
    }

    // Bước 2: 2-opt Local Search trên đoạn di động, xét khoảng cách với neo hai đầu
    let improved = true;
    let guard = 0;
    while (improved && guard < 120) {
      improved = false;
      guard += 1;
      for (let i = 0; i < bestRun.length - 1; i += 1) {
        for (let j = i + 1; j < bestRun.length; j += 1) {
          const beforeA = i > 0 ? bestRun[i - 1] : leftAnchor;
          const afterB = j + 1 < bestRun.length ? bestRun[j + 1] : rightAnchor;
          const currentEdges =
            (beforeA ? haversineDistanceKm(beforeA, bestRun[i]) : 0) +
            (afterB ? haversineDistanceKm(bestRun[j], afterB) : 0);
          const swappedEdges =
            (beforeA ? haversineDistanceKm(beforeA, bestRun[j]) : 0) +
            (afterB ? haversineDistanceKm(bestRun[i], afterB) : 0);

          if (swappedEdges + 1e-4 < currentEdges) {
            let left = i;
            let right = j;
            while (left < right) {
              const tmp = bestRun[left];
              bestRun[left] = bestRun[right];
              bestRun[right] = tmp;
              left += 1;
              right -= 1;
            }
            improved = true;
          }
        }
      }
    }

    path.splice(segStart, segLen, ...bestRun);
    anyOptimized = true;
  }

  const originalKm = computePointSequenceKm(points, 'road_estimate');
  if (!anyOptimized) {
    return {
      orderedIds: points.map((p) => p.id),
      orderedPoints: [...points],
      originalKm,
      optimizedKm: originalKm,
      savedKm: 0,
      savedPercent: 0,
      changedOrder: false,
    };
  }

  const nnOptimizedKm = computePointSequenceKm(path, 'road_estimate');

  // Chỉ nhận lộ trình mới nếu thực sự ngắn hơn lộ trình ban đầu
  const acceptNewOrder = nnOptimizedKm + 0.05 < originalKm;
  const finalPoints = acceptNewOrder ? path : [...points];
  const optimizedKm = acceptNewOrder ? nnOptimizedKm : originalKm;
  const savedKm = Number(Math.max(0, originalKm - optimizedKm).toFixed(1));
  const savedPercent = originalKm > 0 ? Math.round((savedKm / originalKm) * 100) : 0;
  const changedOrder = finalPoints.some((p, i) => p.id !== points[i].id);

  return {
    orderedIds: finalPoints.map((p) => p.id),
    orderedPoints: finalPoints,
    originalKm,
    optimizedKm,
    savedKm,
    savedPercent,
    changedOrder,
  };
}

/**
 * Tối ưu thứ tự các hoạt động trong 1 ngày bằng TSP (Nearest Neighbor + 2-opt),
 * sau đó phân bổ lại khung giờ tuần tự liền mạch để không bị chồng chéo thời gian.
 */
export function optimizeDayActivitiesByRoute(
  day: DaySchedule,
  options: {
    defaultBufferMinutes?: number;
    keepCompletedAnchored?: boolean;
  } = {},
): DayRouteTspResult {
  const { defaultBufferMinutes = 20, keepCompletedAnchored = true } = options;
  const originalActivities = [...(day.activities || [])].sort(
    (a, b) => parseMinutes(a.timeStart) - parseMinutes(b.timeStart),
  );

  if (originalActivities.length < 2) {
    return {
      updatedDay: { ...day, activities: originalActivities },
      orderedStopNames: originalActivities.map((a) => a.location?.trim() || a.title),
      originalStopNames: originalActivities.map((a) => a.location?.trim() || a.title),
      originalKm: 0,
      optimizedKm: 0,
      savedKm: 0,
      savedPercent: 0,
      changedOrder: false,
      reorderedCount: 0,
    };
  }

  const locatedEntries: { activity: Activity; point: TspRoutePoint; originalPos: number }[] = [];

  originalActivities.forEach((act, idx) => {
    const coords = resolveActivityCoordinate(act);
    const isLocked =
      keepCompletedAnchored &&
      (act.status === 'Hoàn tất' || act.status === 'Đang diễn ra');
    if (coords) {
      locatedEntries.push({
        activity: act,
        originalPos: idx,
        point: {
          id: act.id,
          name: act.location?.trim() || act.title,
          lat: coords.lat,
          lng: coords.lng,
          locked: isLocked,
        },
      });
    }
  });

  const tspResult = optimizeStopSequenceTSP(
    locatedEntries.map((entry) => entry.point),
    { anchorFirst: true },
  );

  const entryById = new Map(locatedEntries.map((e) => [e.activity.id, e]));
  const orderedLocatedActivities = tspResult.orderedIds
    .map((id) => entryById.get(id)?.activity)
    .filter((act): act is Activity => Boolean(act));

  let locCursor = 0;
  const combinedSequence = tspResult.changedOrder
    ? originalActivities.map((act) =>
        resolveActivityCoordinate(act) ? (orderedLocatedActivities[locCursor++] || act) : act,
      )
    : originalActivities;

  const firstOrigStart = parseMinutes(originalActivities[0]?.timeStart);
  let pointer = firstOrigStart > 0 && firstOrigStart < 8 * 60 ? firstOrigStart : Math.max(8 * 60, firstOrigStart || 8 * 60);
  let reorderedCount = 0;

  const finalActivities = combinedSequence.map((act, idx) => {
    const origStart = parseMinutes(act.timeStart);
    const origEnd = parseMinutes(act.timeEnd);
    const duration = origEnd > origStart ? Math.max(30, origEnd - origStart) : 60;

    if (keepCompletedAnchored && (act.status === 'Hoàn tất' || act.status === 'Đang diễn ra')) {
      pointer = Math.max(pointer, origEnd);
      return act;
    }

    if (idx > 0) {
      const prev = combinedSequence[idx - 1];
      const isSamePlace =
        prev.location &&
        act.location &&
        prev.location.trim().toLowerCase() === act.location.trim().toLowerCase();
      pointer += isSamePlace ? 10 : defaultBufferMinutes;
    }

    const startMin = tspResult.changedOrder || origEnd <= origStart || origStart < pointer ? pointer : origStart;
    const newStart = formatClock(startMin);
    const newEnd = formatClock(startMin + duration);
    pointer = startMin + duration;

    if (originalActivities[idx]?.id !== act.id || newStart !== act.timeStart || newEnd !== act.timeEnd) {
      reorderedCount += 1;
    }

    return newStart !== act.timeStart || newEnd !== act.timeEnd
      ? { ...act, timeStart: newStart, timeEnd: newEnd }
      : act;
  });

  return {
    updatedDay: {
      ...day,
      activities: finalActivities,
      hasWarning: false,
    },
    orderedStopNames: finalActivities.map((a) => a.location?.trim() || a.title),
    originalStopNames: originalActivities.map((a) => a.location?.trim() || a.title),
    originalKm: tspResult.originalKm,
    optimizedKm: tspResult.optimizedKm,
    savedKm: tspResult.savedKm,
    savedPercent: tspResult.savedPercent,
    changedOrder: tspResult.changedOrder,
    reorderedCount,
  };
}

/**
 * Tối ưu lộ trình cho toàn bộ các ngày trong chuyến đi bằng TSP (Nearest Neighbor + 2-opt),
 * đồng thời cập nhật lại danh sách waypoints và tổng quãng đường `totalKm`.
 */
export function optimizeTripByRouteTSP(
  trip: TripData,
  options: { defaultBufferMinutes?: number } = {},
): TripRouteTspResult {
  const { defaultBufferMinutes = 20 } = options;
  const dayResults: TripRouteTspResult['dayResults'] = [];
  let totalOriginalKm = 0;
  let totalOptimizedKm = 0;
  let changedDaysCount = 0;

  const updatedDays = (trip.days || []).map((day) => {
    const res = optimizeDayActivitiesByRoute(day, { defaultBufferMinutes });
    totalOriginalKm += res.originalKm;
    totalOptimizedKm += res.optimizedKm;
    if (res.changedOrder) changedDaysCount += 1;
    dayResults.push({
      dayIndex: day.dayIndex,
      originalKm: res.originalKm,
      optimizedKm: res.optimizedKm,
      savedKm: res.savedKm,
      changedOrder: res.changedOrder,
      orderedStopNames: res.orderedStopNames,
    });
    return res.updatedDay;
  });

  const syncedTrip = syncTripRouteMetadata({
    ...trip,
    days: updatedDays,
  });

  const roundedOrig = Number(totalOriginalKm.toFixed(1));
  const roundedOpt = Number(totalOptimizedKm.toFixed(1));
  const savedKm = Number(Math.max(0, roundedOrig - roundedOpt).toFixed(1));
  const savedPercent = roundedOrig > 0 ? Math.round((savedKm / roundedOrig) * 100) : 0;

  return {
    updatedTrip: syncedTrip,
    originalKm: roundedOrig,
    optimizedKm: roundedOpt,
    savedKm,
    savedPercent,
    changedDaysCount,
    dayResults,
  };
}
