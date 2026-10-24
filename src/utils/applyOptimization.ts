/**
 * Quản lý áp dụng đề xuất tối ưu hóa lịch trình, tính toán Diff và Hoàn tác (Undo).
 * Tuân thủ nghiêm ngặt:
 *  - Ghép thay đổi CHỈ theo activityId duy nhất (không ghép theo tiêu đề hay giờ cũ).
 *  - Chỉ xóa các cảnh báo mà đề xuất thực sự xử lý; giữ nguyên các cảnh báo khác.
 *  - Cung cấp dữ liệu so sánh Diff (Trước / Sau) trực quan.
 */

import { Activity, DaySchedule, OperationalAlert, TripData } from '../types/travel';
import { parseClock } from './scheduleValidator';

export interface ScheduleChangeDetail {
  activityId?: string;
  activityTitle?: string;
  oldTime?: string;
  newTime: string;
  action?: string;
  status?: string;
}

export interface OptimizationRecommendationLike {
  id?: string;
  actionTitle?: string;
  reason?: string;
  timeSaved?: string;
  costSaved?: string;
  confidence?: string;
  targetDayIndex?: number;
  scheduleChanges?: ScheduleChangeDetail[];
  resolvedAlertIds?: string[];
  resolvedAlertCategories?: string[];
}

export interface ActivityDiff {
  activityId: string;
  title: string;
  location: string;
  isChanged: boolean;
  before: {
    timeStart: string;
    timeEnd: string;
    status: string;
    details: string;
  };
  after: {
    timeStart: string;
    timeEnd: string;
    status: string;
    details: string;
  };
  timeDeltaMinutes: number | null;
  action?: string;
}

export interface AlertDiff {
  alert: OperationalAlert;
  isResolved: boolean;
  resolveReason?: string;
}

export interface OptimizationDiff {
  targetDayIndex: number;
  activityDiffs: ActivityDiff[];
  changedCount: number;
  alertDiffs: AlertDiff[];
  resolvedAlertsCount: number;
  remainingAlertsCount: number;
  costSaved?: string;
  timeSaved?: string;
  actionTitle: string;
  actionReason: string;
}

/**
 * Kiểm tra xem một cảnh báo có được đề xuất xử lý hay không.
 */
export function isAlertResolvedByRecommendation(
  alert: OperationalAlert,
  recommendation: OptimizationRecommendationLike,
  changedActivities: Activity[],
  targetDayIndex?: number,
): { resolved: boolean; reason?: string } {
  // 1. Kiểm tra ID cảnh báo trực tiếp nếu đề xuất chỉ định
  if (Array.isArray(recommendation.resolvedAlertIds) && recommendation.resolvedAlertIds.includes(alert.id)) {
    return { resolved: true, reason: 'Đề xuất đã giải quyết trực tiếp cảnh báo này.' };
  }

  const recText = `${recommendation.actionTitle ?? ''} ${recommendation.reason ?? ''} ${(recommendation.scheduleChanges ?? []).map((c) => c.action ?? '').join(' ')}`.toLowerCase();
  const alertText = `${alert.title} ${alert.description}`.toLowerCase();

  // 2. Kiểm tra theo địa điểm và hoạt động bị ảnh hưởng
  for (const act of changedActivities) {
    const actLoc = (act.location || '').toLowerCase();
    const actTitle = (act.title || '').toLowerCase();

    // Hoạt động đèo Hải Vân / Lăng Cô & cảnh báo thời tiết / mưa / đèo
    const isPassOrWeather =
      (actLoc.includes('hải vân') || actLoc.includes('lăng cô') || actTitle.includes('hải vân') || actTitle.includes('lăng cô')) &&
      (alertText.includes('hải vân') || alertText.includes('lăng cô') || alertText.includes('mưa') || alertText.includes('thời tiết'));

    if (isPassOrWeather && (recText.includes('mưa') || recText.includes('đèo') || recText.includes('hải vân') || recText.includes('thời tiết') || recText.includes('sớm') || recText.includes('dời'))) {
      return {
        resolved: true,
        reason: `Đã điều chỉnh lịch trình hoạt động "${act.title}" tại ${act.location} để khắc phục cảnh báo.`,
      };
    }

    // Hoạt động nhận phòng / khách sạn & cảnh báo xung đột giờ checkin
    const isHotelCheckin =
      (act.type === 'hotel' || act.type === 'checkin' || actTitle.includes('nhận phòng') || actTitle.includes('check-in')) &&
      (alert.category === 'hotel' || alertText.includes('nhận phòng') || alertText.includes('check-in') || alertText.includes('xung đột'));

    if (isHotelCheckin && (recText.includes('nhận phòng') || recText.includes('check-in') || recText.includes('khách sạn') || recText.includes('dời') || recText.includes('giờ'))) {
      return {
        resolved: true,
        reason: `Đã đồng bộ lại thời gian nhận phòng của "${act.title}".`,
      };
    }

    // Hoạt động di chuyển & cảnh báo giao thông / ùn tắc
    const isTraffic =
      (act.type === 'transport' || actTitle.includes('khởi hành') || actTitle.includes('di chuyển')) &&
      (alert.category === 'traffic' || alertText.includes('ùn tắc') || alertText.includes('lưu lượng') || alertText.includes('mật độ'));

    if (isTraffic && (recText.includes('khởi hành') || recText.includes('sớm') || recText.includes('ùn tắc') || recText.includes('giao thông') || recText.includes('lưu lượng'))) {
      return {
        resolved: true,
        reason: `Đã dời giờ xuất phát cho chặng di chuyển "${act.title}" tránh giờ cao điểm.`,
      };
    }
  }

  return { resolved: false };
}

/**
 * Lọc danh sách cảnh báo, CHỈ xóa những cảnh báo mà đề xuất giải quyết.
 */
export function filterAlertsByRecommendation(
  currentAlerts: OperationalAlert[],
  recommendation: OptimizationRecommendationLike,
  changedActivities: Activity[],
  targetDayIndex?: number,
): { remainingAlerts: OperationalAlert[]; resolvedAlerts: { alert: OperationalAlert; reason?: string }[] } {
  const remainingAlerts: OperationalAlert[] = [];
  const resolvedAlerts: { alert: OperationalAlert; reason?: string }[] = [];

  for (const alert of currentAlerts) {
    const verdict = isAlertResolvedByRecommendation(alert, recommendation, changedActivities, targetDayIndex);
    if (verdict.resolved) {
      resolvedAlerts.push({ alert, reason: verdict.reason });
    } else {
      remainingAlerts.push(alert);
    }
  }

  return { remainingAlerts, resolvedAlerts };
}

/**
 * Áp dụng các thay đổi lịch trình vào ngày chỉ định theo STRICT activityId matching.
 * TUYỆT ĐỐI KHÔNG GHÉP THEO TIÊU ĐỀ HOẶC GIỜ CŨ.
 */
export function applyScheduleChangesStrict(
  day: DaySchedule,
  scheduleChanges: ScheduleChangeDetail[],
  actionTitle?: string,
  actionReason?: string,
): { updatedDay: DaySchedule; changedActivities: Activity[] } {
  const changedActivities: Activity[] = [];

  const updatedActivities = day.activities.map((act) => {
    // GHÉP DUY NHẤT THEO activityId
    const change = scheduleChanges.find((c) => c.activityId && c.activityId.trim() === act.id);
    if (!change) {
      // Hoạt động không bị đề xuất chạm vào -> GIỮ NGUYÊN HOÀN TOÀN
      return act;
    }

    let newStart = act.timeStart;
    let newEnd = act.timeEnd;
    if (change.newTime) {
      const parts = change.newTime.split(/—|–|-/).map((s) => s.trim());
      if (parts[0] && parts[0].includes(':')) newStart = parts[0].slice(0, 5);
      if (parts[1] && parts[1].includes(':')) newEnd = parts[1].slice(0, 5);
    }

    const updatedAct: Activity = {
      ...act,
      timeStart: newStart,
      timeEnd: newEnd,
      status: 'Đã xác nhận',
      details: change.action ? `${change.action} • ${act.details}` : act.details,
    };

    changedActivities.push(updatedAct);
    return updatedAct;
  });

  // Sắp xếp các hoạt động theo giờ bắt đầu
  updatedActivities.sort((a, b) => (a.timeStart || '').localeCompare(b.timeStart || ''));

  const confirmedCount = updatedActivities.filter(
    (a) => a.status === 'Đã xác nhận' || a.status === 'Hoàn tất',
  ).length;
  const pendingCount = updatedActivities.filter(
    (a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra',
  ).length;

  const noteAddition = `Đã điều phối: ${actionTitle || 'Lộ trình tối ưu'}${actionReason ? ` • ${actionReason}` : ''}`;
  const dispatcherNote = day.dispatcherNote
    ? `${day.dispatcherNote}\n[Điều phối] ${noteAddition}`
    : noteAddition;

  const updatedDay: DaySchedule = {
    ...day,
    confirmedCount,
    pendingCount,
    dispatcherNote,
    activities: updatedActivities,
  };

  return { updatedDay, changedActivities };
}

/**
 * Tính toán bảng Diff so sánh chi tiết giữa lịch trình ban đầu và lịch trình sau điều phối.
 */
export function computeOptimizationDiff(
  originalTrip: TripData,
  recommendation: OptimizationRecommendationLike,
): OptimizationDiff {
  const targetDayIndex =
    recommendation.targetDayIndex ??
    originalTrip.days.find((d) => d.hasWarning || d.pendingCount > 0)?.dayIndex ??
    originalTrip.days[0]?.dayIndex ??
    1;

  const originalDay = originalTrip.days.find((d) => d.dayIndex === targetDayIndex);
  const changes = recommendation.scheduleChanges ?? [];

  const activityDiffs: ActivityDiff[] = [];
  const changedActivities: Activity[] = [];

  if (originalDay) {
    for (const act of originalDay.activities) {
      const change = changes.find((c) => c.activityId && c.activityId.trim() === act.id);
      if (change) {
        let newStart = act.timeStart;
        let newEnd = act.timeEnd;
        if (change.newTime) {
          const parts = change.newTime.split(/—|–|-/).map((s) => s.trim());
          if (parts[0] && parts[0].includes(':')) newStart = parts[0].slice(0, 5);
          if (parts[1] && parts[1].includes(':')) newEnd = parts[1].slice(0, 5);
        }

        const oldStartMin = parseClock(act.timeStart) ?? 0;
        const newStartMin = parseClock(newStart) ?? 0;
        const delta = newStartMin - oldStartMin;

        const updatedAct: Activity = {
          ...act,
          timeStart: newStart,
          timeEnd: newEnd,
          status: 'Đã xác nhận',
          details: change.action ? `${change.action} • ${act.details}` : act.details,
        };
        changedActivities.push(updatedAct);

        activityDiffs.push({
          activityId: act.id,
          title: act.title,
          location: act.location,
          isChanged: true,
          before: {
            timeStart: act.timeStart,
            timeEnd: act.timeEnd,
            status: act.status,
            details: act.details,
          },
          after: {
            timeStart: newStart,
            timeEnd: newEnd,
            status: 'Đã xác nhận',
            details: updatedAct.details,
          },
          timeDeltaMinutes: delta,
          action: change.action,
        });
      } else {
        activityDiffs.push({
          activityId: act.id,
          title: act.title,
          location: act.location,
          isChanged: false,
          before: {
            timeStart: act.timeStart,
            timeEnd: act.timeEnd,
            status: act.status,
            details: act.details,
          },
          after: {
            timeStart: act.timeStart,
            timeEnd: act.timeEnd,
            status: act.status,
            details: act.details,
          },
          timeDeltaMinutes: 0,
        });
      }
    }
  }

  const alertDiffs: AlertDiff[] = (originalTrip.alerts || []).map((alert) => {
    const check = isAlertResolvedByRecommendation(alert, recommendation, changedActivities, targetDayIndex);
    return {
      alert,
      isResolved: check.resolved,
      resolveReason: check.reason,
    };
  });

  return {
    targetDayIndex,
    activityDiffs,
    changedCount: activityDiffs.filter((d) => d.isChanged).length,
    alertDiffs,
    resolvedAlertsCount: alertDiffs.filter((a) => a.isResolved).length,
    remainingAlertsCount: alertDiffs.filter((a) => !a.isResolved).length,
    costSaved: recommendation.costSaved,
    timeSaved: recommendation.timeSaved,
    actionTitle: recommendation.actionTitle || 'Phương án điều phối lịch trình',
    actionReason: recommendation.reason || '',
  };
}
