import type { Activity, DaySchedule, TripData, Waypoint } from '../types/travel';
import { estimateRoadDistanceKm, haversineDistanceKm } from './routeProgress';
import { buildAIPlanWaypoints, isLegacyHashedCoordinate, lookupCoordinates } from './vietnamGeo';

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

function parseMinutes(timeStr?: string): number {
  if (!timeStr) return 0;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

function formatMinutes(totalMins: number): string {
  const safeMins = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMins)));
  const h = Math.floor(safeMins / 60);
  const m = safeMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

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

  // Xác định đoạn tiền tố cố định: ít nhất giữ điểm xuất phát (index 0) nếu anchorFirst=true
  let lockedPrefixCount = anchorFirst ? 1 : 0;
  while (lockedPrefixCount < points.length && points[lockedPrefixCount].locked) {
    lockedPrefixCount += 1;
  }

  // Nếu phần còn lại để hoán vị < 2 điểm thì thứ tự đã tối ưu sẵn
  if (points.length - lockedPrefixCount < 2) {
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

  const fixedPrefix = points.slice(0, lockedPrefixCount);
  const movablePool = points.slice(lockedPrefixCount);

  // Bước 1: Nearest Neighbor — từ điểm hiện tại luôn chọn điểm kế tiếp gần nhất chưa đi qua
  const nnPath: TspRoutePoint[] = [...fixedPrefix];
  const remaining = [...movablePool];

  while (remaining.length > 0) {
    const last = nnPath[nnPath.length - 1];
    let bestIdx = 0;
    if (last) {
      let bestDist = Infinity;
      for (let i = 0; i < remaining.length; i += 1) {
        const d = haversineDistanceKm(last, remaining[i]);
        if (d < bestDist - 1e-6) {
          bestDist = d;
          bestIdx = i;
        }
      }
    }
    nnPath.push(remaining.splice(bestIdx, 1)[0]);
  }

  // Bước 2: 2-opt Local Search trên đoạn di động [startMovable .. n-1] để gỡ mọi đường chéo thừa
  const bestPath = [...nnPath];
  const startMovable = Math.max(1, lockedPrefixCount);
  let improved = true;
  let guard = 0;

  while (improved && guard < 120) {
    improved = false;
    guard += 1;
    for (let i = startMovable; i < bestPath.length - 1; i += 1) {
      for (let j = i + 1; j < bestPath.length; j += 1) {
        const beforeA = bestPath[i - 1];
        const firstSeg = bestPath[i];
        const lastSeg = bestPath[j];
        const afterB = j + 1 < bestPath.length ? bestPath[j + 1] : null;

        const currentEdges =
          haversineDistanceKm(beforeA, firstSeg) +
          (afterB ? haversineDistanceKm(lastSeg, afterB) : 0);
        const swappedEdges =
          haversineDistanceKm(beforeA, lastSeg) +
          (afterB ? haversineDistanceKm(firstSeg, afterB) : 0);

        if (swappedEdges + 1e-4 < currentEdges) {
          let left = i;
          let right = j;
          while (left < right) {
            const tmp = bestPath[left];
            bestPath[left] = bestPath[right];
            bestPath[right] = tmp;
            left += 1;
            right -= 1;
          }
          improved = true;
        }
      }
    }
  }

  const originalKm = computePointSequenceKm(points, 'road_estimate');
  const nnOptimizedKm = computePointSequenceKm(bestPath, 'road_estimate');

  // Chỉ nhận lộ trình mới nếu thực sự ngắn hơn lộ trình ban đầu
  const acceptNewOrder = nnOptimizedKm + 0.05 < originalKm;
  const finalPoints = acceptNewOrder ? bestPath : [...points];
  const optimizedKm = acceptNewOrder ? nnOptimizedKm : originalKm;
  const savedKm = Number(Math.max(0, originalKm - optimizedKm).toFixed(1));
  const savedPercent = originalKm > 0 ? Math.round((savedKm / originalKm) * 100) : 0;
  const changedOrder = finalPoints.some((p, idx) => p.id !== points[idx].id);

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
  const unlocatedEntries: { activity: Activity; originalPos: number }[] = [];

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
    } else {
      unlocatedEntries.push({ activity: act, originalPos: idx });
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

  // Nếu có hoạt động chưa có tọa độ, chèn giữ nguyên ở cuối để không làm mất hoạt động người dùng
  const combinedSequence = tspResult.changedOrder
    ? [...orderedLocatedActivities, ...unlocatedEntries.map((e) => e.activity)]
    : originalActivities;

  let finalActivities = combinedSequence;
  let reorderedCount = 0;

  if (tspResult.changedOrder) {
    let pointer = Math.max(8 * 60, parseMinutes(originalActivities[0]?.timeStart) || 8 * 60);
    // Nếu hoạt động đầu tiên bắt đầu sớm hơn 08:00 (ví dụ 06:30), giữ nguyên giờ khởi hành sớm đó
    const firstOrigStart = parseMinutes(originalActivities[0]?.timeStart);
    if (firstOrigStart > 0 && firstOrigStart < 8 * 60) {
      pointer = firstOrigStart;
    }

    finalActivities = combinedSequence.map((act, idx) => {
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

      const newStart = formatMinutes(pointer);
      const newEnd = formatMinutes(pointer + duration);
      pointer += duration;

      if (originalActivities[idx]?.id !== act.id || newStart !== act.timeStart || newEnd !== act.timeEnd) {
        reorderedCount += 1;
      }

      return {
        ...act,
        timeStart: newStart,
        timeEnd: newEnd,
      };
    });
  }

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

  const allActivities = updatedDays.flatMap((d) => d.activities || []);
  const rebuiltWaypoints = buildAIPlanWaypoints(
    trip.originFull || trip.origin || 'Điểm khởi hành',
    trip.destinationFull || trip.destination || 'Điểm đến',
    allActivities,
  );
  const nextWaypoints: Waypoint[] =
    rebuiltWaypoints.length >= 2 ? rebuiltWaypoints : (trip.waypoints || []);

  // Tính tổng quãng đường toàn tuyến trên toàn bộ waypoint có tọa độ
  const locatedWaypoints = nextWaypoints.filter(
    (wp) =>
      isUsableCoord(wp.lat, wp.lng) &&
      !isLegacyHashedCoordinate(wp.name || '', wp.lat, wp.lng),
  );
  const routeKm =
    locatedWaypoints.length >= 2
      ? Math.round(computePointSequenceKm(locatedWaypoints, 'road_estimate'))
      : trip.totalKm;

  const roundedOrig = Number(totalOriginalKm.toFixed(1));
  const roundedOpt = Number(totalOptimizedKm.toFixed(1));
  const savedKm = Number(Math.max(0, roundedOrig - roundedOpt).toFixed(1));
  const savedPercent = roundedOrig > 0 ? Math.round((savedKm / roundedOrig) * 100) : 0;

  return {
    updatedTrip: {
      ...trip,
      days: updatedDays,
      waypoints: nextWaypoints,
      destinationsCount: nextWaypoints.length || trip.destinationsCount,
      totalKm: routeKm,
    },
    originalKm: roundedOrig,
    optimizedKm: roundedOpt,
    savedKm,
    savedPercent,
    changedDaysCount,
    dayResults,
  };
}
