/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Activity, DaySchedule, TripData } from '../types/travel';
import {
  optimizeDayActivitiesByRoute,
  optimizeTripByRouteTSP,
} from './routeTspOptimizer';

export interface ScheduleConflict {
  type: 'overlap' | 'zero_buffer' | 'inverted' | 'out_of_bounds';
  activityA: Activity;
  activityB?: Activity;
  message: string;
}

export interface ActivityTimeAdjustment {
  activityId: string;
  activityTitle: string;
  originalTimeStart: string;
  originalTimeEnd: string;
  newTimeStart: string;
  newTimeEnd: string;
  reason: string;
}

export interface RouteOptimizationMetrics {
  originalKm: number;
  optimizedKm: number;
  savedKm: number;
  savedPercent: number;
  changedOrder: boolean;
  originalStopNames?: string[];
  orderedStopNames?: string[];
}

export interface AutoArrangeResult {
  updatedDay: DaySchedule;
  conflictsFound: number;
  conflicts: ScheduleConflict[];
  adjustments: ActivityTimeAdjustment[];
  summaryMessage: string;
  routeOptimization?: RouteOptimizationMetrics;
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

/**
 * Phát hiện các xung đột thời gian trong một ngày lịch trình
 */
export function detectDayScheduleConflicts(activities: Activity[], minBufferMinutes = 15): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const sorted = [...activities].sort((a, b) => parseMinutes(a.timeStart) - parseMinutes(b.timeStart));

  for (let i = 0; i < sorted.length; i++) {
    const curr = sorted[i];
    const currStart = parseMinutes(curr.timeStart);
    const currEnd = parseMinutes(curr.timeEnd);

    if (currEnd <= currStart) {
      conflicts.push({
        type: 'inverted',
        activityA: curr,
        message: `Hoạt động "${curr.title}" có giờ kết thúc (${curr.timeEnd}) nhỏ hơn hoặc bằng giờ bắt đầu (${curr.timeStart}).`,
      });
    }

    if (i < sorted.length - 1) {
      const next = sorted[i + 1];
      const nextStart = parseMinutes(next.timeStart);

      if (nextStart < currEnd) {
        conflicts.push({
          type: 'overlap',
          activityA: curr,
          activityB: next,
          message: `Chồng chéo thời gian: "${curr.title}" kết thúc lúc ${curr.timeEnd} nhưng "${next.title}" đã bắt đầu lúc ${next.timeStart}.`,
        });
      } else if (curr.location && next.location && curr.location.toLowerCase() !== next.location.toLowerCase()) {
        const gap = nextStart - currEnd;
        if (gap < minBufferMinutes) {
          conflicts.push({
            type: 'zero_buffer',
            activityA: curr,
            activityB: next,
            message: `Thiếu thời gian di chuyển: giữa "${curr.location}" và "${next.location}" chỉ có ${gap} phút (khuyến nghị tối thiểu ${minBufferMinutes} phút).`,
          });
        }
      }
    }
  }

  return conflicts;
}

/**
 * Thuật toán Tự động Lập lịch & Sắp xếp lại lịch trình thông minh (Auto-Reschedule & Buffer Arrange)
 */
export function autoArrangeDayActivities(
  activities: Activity[],
  options: {
    dayStartClock?: string; // Mặc định 08:00
    defaultBufferMinutes?: number; // Mặc định 20 phút giữa các địa điểm khác nhau
    keepCompletedAnchored?: boolean; // Giữ nguyên hoạt động đã hoàn tất
  } = {}
): {
  reorderedActivities: Activity[];
  adjustments: ActivityTimeAdjustment[];
  conflicts: ScheduleConflict[];
} {
  if (!activities || activities.length === 0) {
    return { reorderedActivities: [], adjustments: [], conflicts: [] };
  }

  const {
    dayStartClock = '08:00',
    defaultBufferMinutes = 20,
    keepCompletedAnchored = true,
  } = options;

  const conflicts = detectDayScheduleConflicts(activities, defaultBufferMinutes);

  // Sắp xếp các hoạt động theo thứ tự hợp lý:
  // Giữ thứ tự thời gian bắt đầu ban đầu, ưu tiên theo khung buổi tự nhiên
  const sorted = [...activities].sort((a, b) => {
    const aMins = parseMinutes(a.timeStart);
    const bMins = parseMinutes(b.timeStart);
    return aMins - bMins;
  });

  const adjustments: ActivityTimeAdjustment[] = [];
  const reorderedActivities: Activity[] = [];

  let currentPointer = parseMinutes(dayStartClock);
  if (sorted.length > 0 && parseMinutes(sorted[0].timeStart) > currentPointer) {
    // Nếu hoạt động đầu tiên bắt đầu muộn hơn 08:00 (ví dụ 09:30), tôn trọng giờ bắt đầu của nó
    currentPointer = parseMinutes(sorted[0].timeStart);
  }

  for (let i = 0; i < sorted.length; i++) {
    const act = sorted[i];
    const origStart = parseMinutes(act.timeStart);
    const origEnd = parseMinutes(act.timeEnd);
    let duration = origEnd > origStart ? origEnd - origStart : 60; // Tối thiểu 60 phút nếu giờ bị lỗi

    if (duration < 30) duration = 30; // Giới hạn tối thiểu 30 phút

    // Nếu là hoạt động đã hoàn tất và cấu hình giữ nguyên vị trí
    if (keepCompletedAnchored && (act.status === 'Hoàn tất' || act.status === 'Đang diễn ra')) {
      currentPointer = Math.max(currentPointer, origEnd);
      reorderedActivities.push(act);
      continue;
    }

    // Tính thời gian nghỉ/di chuyển đệm giữa hoạt động trước và hoạt động này
    let buffer = 0;
    if (i > 0) {
      const prev = reorderedActivities[reorderedActivities.length - 1];
      if (prev) {
        const isDiffLocation =
          prev.location && act.location && prev.location.trim().toLowerCase() !== act.location.trim().toLowerCase();
        buffer = isDiffLocation ? defaultBufferMinutes : 10;
      }
    }

    // Thời điểm bắt đầu mới
    let targetStart = Math.max(origStart, currentPointer + buffer);

    // Ưu tiên đặc biệt: Bữa trưa không nên bắt đầu quá muộn (ưu tiên 11:30 - 12:30)
    if (act.type === 'meal' && (act.title.toLowerCase().includes('trưa') || act.details?.toLowerCase().includes('trưa'))) {
      if (targetStart < 11 * 60 + 30) {
        // Nếu các hoạt động sáng kết thúc sớm, có thể để giờ trưa lúc 11:30 hoặc giữ nguyên
        targetStart = Math.max(targetStart, 11 * 60 + 30);
      }
    }

    // Ưu tiên check-in khách sạn thường từ 14:00
    if (act.type === 'hotel' || act.title.toLowerCase().includes('nhận phòng') || act.title.toLowerCase().includes('check-in')) {
      if (targetStart < 14 * 60) {
        targetStart = Math.max(targetStart, 14 * 60);
      }
    }

    const newStartStr = formatMinutes(targetStart);
    const newEndStr = formatMinutes(targetStart + duration);

    // Kiểm tra xem có sự thay đổi giờ so với ban đầu không
    if (newStartStr !== act.timeStart || newEndStr !== act.timeEnd) {
      let reason = 'Tự động phân bổ lại khung giờ liền mạch';
      if (origEnd <= origStart) {
        reason = 'Sửa lỗi giờ kết thúc sớm hơn giờ bắt đầu';
      } else if (origStart < currentPointer) {
        reason = 'Loại bỏ xung đột chồng chéo thời gian với hoạt động trước';
      } else if (buffer > 0) {
        reason = `Chèn thêm ${buffer} phút di chuyển an toàn giữa các điểm đến`;
      }

      adjustments.push({
        activityId: act.id,
        activityTitle: act.title,
        originalTimeStart: act.timeStart,
        originalTimeEnd: act.timeEnd,
        newTimeStart: newStartStr,
        newTimeEnd: newEndStr,
        reason,
      });
    }

    reorderedActivities.push({
      ...act,
      timeStart: newStartStr,
      timeEnd: newEndStr,
    });

    currentPointer = targetStart + duration;
  }

  return { reorderedActivities, adjustments, conflicts };
}

/**
 * Tự động sắp xếp lại lịch trình cho một ngày cụ thể trong chuyến đi
 */
export function autoArrangeDay(
  day: DaySchedule,
  defaultBuffer = 20,
  options: { optimizeRouteOrder?: boolean } = {},
): AutoArrangeResult {
  if (options.optimizeRouteOrder) {
    const conflicts = detectDayScheduleConflicts(day.activities, defaultBuffer);
    const tspRes = optimizeDayActivitiesByRoute(day, { defaultBufferMinutes: defaultBuffer });
    const origById = new Map(day.activities.map((a) => [a.id, a]));
    const adjustments: ActivityTimeAdjustment[] = [];

    tspRes.updatedDay.activities.forEach((act, newIdx) => {
      const orig = origById.get(act.id);
      if (!orig) return;
      const origIdx = day.activities.findIndex((a) => a.id === act.id);
      if (
        origIdx !== newIdx ||
        orig.timeStart !== act.timeStart ||
        orig.timeEnd !== act.timeEnd
      ) {
        adjustments.push({
          activityId: act.id,
          activityTitle: act.title,
          originalTimeStart: orig.timeStart,
          originalTimeEnd: orig.timeEnd,
          newTimeStart: act.timeStart,
          newTimeEnd: act.timeEnd,
          reason:
            tspRes.changedOrder && origIdx !== newIdx
              ? `Sắp xếp thứ tự #${origIdx + 1} → #${newIdx + 1} theo lộ trình TSP ngắn nhất`
              : `Điều chỉnh khung giờ đệm ${defaultBuffer} phút theo thứ tự tối ưu`,
        });
      }
    });

    const summaryMessage = tspRes.changedOrder
      ? `Đã tối ưu lộ trình TSP (tiết kiệm ${tspRes.savedKm} km / ${tspRes.savedPercent}%) và cập nhật khung giờ ${adjustments.length} hoạt động.`
      : 'Thứ tự điểm dừng đã ngắn nhất; các khung giờ đã được cân chỉnh liền mạch.';

    return {
      updatedDay: tspRes.updatedDay,
      conflictsFound: conflicts.length,
      conflicts,
      adjustments,
      summaryMessage,
      routeOptimization: {
        originalKm: tspRes.originalKm,
        optimizedKm: tspRes.optimizedKm,
        savedKm: tspRes.savedKm,
        savedPercent: tspRes.savedPercent,
        changedOrder: tspRes.changedOrder,
        originalStopNames: tspRes.originalStopNames,
        orderedStopNames: tspRes.orderedStopNames,
      },
    };
  }

  const { reorderedActivities, adjustments, conflicts } = autoArrangeDayActivities(day.activities, {
    defaultBufferMinutes: defaultBuffer,
  });

  const updatedDay: DaySchedule = {
    ...day,
    activities: reorderedActivities,
    hasWarning: false, // Sau khi tự động xếp lịch, các xung đột chồng chéo đã được giải quyết
  };

  let summaryMessage = '';
  if (adjustments.length === 0) {
    summaryMessage = 'Lịch trình ngày này đã rất tối ưu và không có xung đột thời gian nào.';
  } else {
    summaryMessage = `Đã tự động điều chỉnh và tối ưu ${adjustments.length} hoạt động: loại bỏ hoàn toàn chồng chéo giờ và chèn thời gian di chuyển an toàn.`;
  }

  return {
    updatedDay,
    conflictsFound: conflicts.length,
    conflicts,
    adjustments,
    summaryMessage,
  };
}

/**
 * Tự động sắp xếp lại lịch trình cho toàn bộ tất cả các ngày trong chuyến đi
 */
export function autoArrangeEntireTrip(
  trip: TripData,
  options: { defaultBuffer?: number; optimizeRouteOrder?: boolean } = {},
): {
  updatedTrip: TripData;
  totalAdjustmentsCount: number;
  dayAdjustments: { dayIndex: number; adjustments: ActivityTimeAdjustment[] }[];
  routeOptimization?: RouteOptimizationMetrics;
} {
  const { defaultBuffer = 20, optimizeRouteOrder = false } = options;

  if (optimizeRouteOrder) {
    const tspTripRes = optimizeTripByRouteTSP(trip, { defaultBufferMinutes: defaultBuffer });
    let totalAdjustmentsCount = 0;
    const dayAdjustments: { dayIndex: number; adjustments: ActivityTimeAdjustment[] }[] = [];

    trip.days.forEach((origDay, dIdx) => {
      const nextDay = tspTripRes.updatedTrip.days[dIdx];
      if (!nextDay) return;
      const origById = new Map(origDay.activities.map((a) => [a.id, a]));
      const adjs: ActivityTimeAdjustment[] = [];
      nextDay.activities.forEach((act, newIdx) => {
        const orig = origById.get(act.id);
        if (!orig) return;
        const origIdx = origDay.activities.findIndex((a) => a.id === act.id);
        if (origIdx !== newIdx || orig.timeStart !== act.timeStart || orig.timeEnd !== act.timeEnd) {
          adjs.push({
            activityId: act.id,
            activityTitle: act.title,
            originalTimeStart: orig.timeStart,
            originalTimeEnd: orig.timeEnd,
            newTimeStart: act.timeStart,
            newTimeEnd: act.timeEnd,
            reason:
              origIdx !== newIdx
                ? `Thứ tự TSP #${origIdx + 1} → #${newIdx + 1}`
                : 'Cân chỉnh giờ di chuyển',
          });
        }
      });
      if (adjs.length > 0) {
        totalAdjustmentsCount += adjs.length;
        dayAdjustments.push({ dayIndex: origDay.dayIndex, adjustments: adjs });
      }
    });

    return {
      updatedTrip: tspTripRes.updatedTrip,
      totalAdjustmentsCount,
      dayAdjustments,
      routeOptimization: {
        originalKm: tspTripRes.originalKm,
        optimizedKm: tspTripRes.optimizedKm,
        savedKm: tspTripRes.savedKm,
        savedPercent: tspTripRes.savedPercent,
        changedOrder: tspTripRes.changedDaysCount > 0,
      },
    };
  }

  let totalAdjustmentsCount = 0;
  const dayAdjustments: { dayIndex: number; adjustments: ActivityTimeAdjustment[] }[] = [];

  const updatedDays = trip.days.map((day) => {
    const res = autoArrangeDay(day, defaultBuffer);
    if (res.adjustments.length > 0) {
      totalAdjustmentsCount += res.adjustments.length;
      dayAdjustments.push({ dayIndex: day.dayIndex, adjustments: res.adjustments });
    }
    return res.updatedDay;
  });

  const updatedTrip: TripData = {
    ...trip,
    days: updatedDays,
  };

  return { updatedTrip, totalAdjustmentsCount, dayAdjustments };
}
