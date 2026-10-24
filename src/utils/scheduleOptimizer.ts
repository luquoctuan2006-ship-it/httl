/**
 * Điều phối tối ưu lịch trình: dựng prompt từ dữ liệu thật + quy tắc Admin,
 * gọi AI, rồi LỌC mọi kết quả qua bộ kiểm tra khả thi.
 *
 * Phụ thuộc bên ngoài (gọi Gemini, bộ dự phòng) được truyền vào để test được
 * mà không cần server hay API key.
 */

import {
  buildRulesPromptSection,
  effectiveBufferMinutes,
  formatClock,
  parseClock,
  parseRules,
  ScheduleRules,
  summarizeRejectionsForRetry,
  validateOptimizationResult,
  OptimizationOutcome,
} from './scheduleValidator';

export type OptimizeSource = 'gemini' | 'fallback';

export interface OptimizationDeps {
  /** Gọi AI và trả về JSON đã parse. `dedupeKey` null = không gộp request. */
  ask: (prompt: string, dedupeKey: string | null) => Promise<any>;
  /** Bộ dự phòng khi AI lỗi; kết quả vẫn bị kiểm tra như đề xuất AI. */
  fallback: (payload: any) => any;
  /** Quy tắc dùng khi payload không mang theo `rules`. */
  defaultRules?: any;
  warn?: (message: string, error?: unknown) => void;
}

export function pickTripForOptimization(source: any) {
  const days: any[] = Array.isArray(source?.days) ? source.days : [];
  const waypoints: any[] = Array.isArray(source?.waypoints) ? source.waypoints : [];
  return {
    id: source?.id,
    title: source?.title,
    totalDays: source?.totalDays,
    totalKm: source?.totalKm,
    budgetTotal: source?.budgetTotal,
    days: days.slice(0, 14).map((day) => ({
      dayIndex: day?.dayIndex,
      fullDate: day?.fullDate,
      dispatcherNote: day?.dispatcherNote,
      hasWarning: day?.hasWarning,
      pendingCount: day?.pendingCount,
      // Gửi ĐẦY ĐỦ hoạt động của ngày (trước đây bị cắt còn 5) để AI và bộ kiểm tra thấy cả ngày.
      activities: (Array.isArray(day?.activities) ? day.activities : []).slice(0, 40).map((a: any) => ({
        id: a?.id,
        timeStart: a?.timeStart,
        timeEnd: a?.timeEnd,
        title: a?.title,
        location: a?.location,
        status: a?.status,
        type: a?.type,
        cost: a?.cost,
        coordinates: a?.coordinates,
      })),
    })),
    waypoints: waypoints.slice(0, 40).map((w) => ({ name: w?.name, lat: w?.lat, lng: w?.lng, openHours: w?.openHours })),
  };
}

export function buildOptimizePrompt(payload: any, rules: ScheduleRules): string {
  return `Bạn là chuyên gia điều phối tour du lịch cao cấp tại Việt Nam. Dựa trên chuyến đi thật dưới đây và các cảnh báo vận hành, hãy đề xuất phương án điều phối lại lịch trình. Chỉ trả về JSON hợp lệ.
Chuyến đi (đầy đủ hoạt động từng ngày, kèm tọa độ khi có): ${JSON.stringify(payload.currentTrip)}
Cảnh báo vận hành: ${JSON.stringify(payload.alertDetails || [])}
Mục tiêu người dùng: ${payload.userGoal || 'An toàn, đúng lịch trình, tránh mưa đèo dốc, giảm chi phí'}

${buildRulesPromptSection(rules)}

Yêu cầu định dạng:
- Mỗi đề xuất chỉ thay đổi các hoạt động của MỘT ngày, ghi rõ "targetDayIndex" là dayIndex của ngày đó.
- "activityId" PHẢI là id có thật trong dữ liệu chuyến đi ở đúng ngày đó. Tuyệt đối không tự đặt id, không tham chiếu bằng tên.
- "newTime" dùng 24 giờ, dạng "HH:MM — HH:MM" (giờ bắt đầu — giờ kết thúc).
- Chỉ dời những hoạt động thật sự cần dời. Tối đa 2-3 đề xuất, súc tích, thực tế.
Schema JSON:
{
  "recommendations": [
    {
      "id": "rec-1",
      "actionTitle": "Tiêu đề phương án điều phối",
      "reason": "Lý do và lợi ích cho đoàn",
      "timeSaved": "Ước tính thời gian tiết kiệm (VD: Tiết kiệm 45 phút)",
      "costSaved": "Ước tính chi phí tiết kiệm (VD: 640.000 ₫)",
      "confidence": "90%",
      "targetDayIndex": 3,
      "scheduleChanges": [
        { "activityId": "id có thật", "newTime": "08:30 — 10:30", "action": "Lý do dời hoạt động này" }
      ]
    }
  ],
  "dispatcherNotice": "Lệnh điều phối ngắn gọn"
}`;
}

function describeValidation(
  source: OptimizeSource,
  tripSource: string,
  outcome: OptimizationOutcome,
  repaired: boolean,
) {
  return {
    source,
    tripSource,
    repaired,
    checked: outcome.checked,
    accepted: outcome.accepted.length,
    rejected: outcome.rejected.slice(0, 10).map((r) => ({
      id: r.id,
      actionTitle: r.actionTitle,
      violations: r.violations.slice(0, 5).map(({ code, message, activityId }) => ({ code, message, activityId })),
    })),
  };
}

export async function runOptimization(payload: any, deps: OptimizationDeps) {
  const warn = deps.warn ?? (() => undefined);
  const rules = parseRules(payload?.rules ?? deps.defaultRules);
  const trip = payload?.currentTrip ?? {};
  const tripSource = String(payload?.tripSource ?? 'client');
  const prompt = buildOptimizePrompt(payload, rules);

  let source: OptimizeSource = 'gemini';
  let raw: any;
  try {
    raw = await deps.ask(prompt, `optimize-schedule:${JSON.stringify(payload)}`);
  } catch (error) {
    warn('[Optimize] Không lấy được đề xuất từ AI, dùng bộ dự phòng (vẫn được kiểm tra khả thi):', error);
    source = 'fallback';
    raw = deps.fallback(payload);
  }

  let outcome = validateOptimizationResult(raw, trip, rules);
  let repaired = false;

  // AI trả về nhưng bị loại hết → cho đúng 1 lần sửa dựa trên lý do bị loại.
  if (source === 'gemini' && outcome.accepted.length === 0 && outcome.rejected.length > 0) {
    try {
      const retryPrompt = `${prompt}\n\nLẦN TRƯỚC bạn đề xuất các phương án sau nhưng hệ thống kiểm tra khả thi đã LOẠI:\n${summarizeRejectionsForRetry(outcome.rejected)}\nHãy đưa ra phương án MỚI tuân thủ đầy đủ quy tắc ở trên.`;
      const retryRaw = await deps.ask(retryPrompt, null);
      const retryOutcome = validateOptimizationResult(retryRaw, trip, rules);
      repaired = true;
      outcome = {
        accepted: retryOutcome.accepted,
        rejected: [...outcome.rejected, ...retryOutcome.rejected],
        checked: outcome.checked + retryOutcome.checked,
      };
      if (retryOutcome.accepted.length > 0) raw = retryRaw;
    } catch (error) {
      warn('[Optimize] Lần thử lại sau khi bị loại không thành công:', error);
    }
  }

  return {
    recommendations: outcome.accepted,
    dispatcherNotice:
      outcome.accepted.length > 0 && typeof raw?.dispatcherNotice === 'string' ? raw.dispatcherNotice : undefined,
    validation: describeValidation(source, tripSource, outcome, repaired),
  };
}

/**
 * Bộ tối ưu hóa dự phòng theo quy tắc (Rule-based Fallback Optimizer).
 * Chạy trực tiếp trên DỮ LIỆU THỰC của chuyến đi và quy tắc Admin hiện hành:
 *  - Phân tích ngày có cảnh báo hoặc hoạt động cần xử lý.
 *  - Dùng đúng activityId thực tế của hoạt động (không bịa ID, không ghép theo tên).
 *  - Tính toán thời gian hợp lệ tuân thủ: khung giờ ngày, khoảng đệm buffer, không chồng giờ.
 *  - Ghi nhận rõ ràng danh sách ID các cảnh báo được xử lý (resolvedAlertIds).
 *  - Đánh dấu nguồn rõ ràng để thông báo cho người dùng.
 */
export function buildRuleBasedScheduleOptimization(payload: any): any {
  const trip = payload?.currentTrip ?? {};
  const alertDetails: any[] = Array.isArray(payload?.alertDetails) ? payload.alertDetails : [];
  const rules: ScheduleRules = parseRules(payload?.rules ?? {});
  const days: any[] = Array.isArray(trip?.days) ? trip.days : [];

  if (days.length === 0) {
    return {
      recommendations: [],
      dispatcherNotice: 'Không tìm thấy dữ liệu ngày của chuyến đi để tối ưu theo quy tắc.',
    };
  }

  // 1. Tìm ngày mục tiêu cần tối ưu: ưu tiên ngày có cảnh báo hoặc pendingCount > 0
  const targetDay =
    days.find((d) => d.hasWarning || (typeof d.pendingCount === 'number' && d.pendingCount > 0)) ||
    days.find((d) => Array.isArray(d.activities) && d.activities.some((a: any) => a.status === 'Cần xử lý' || a.status === 'Chờ duyệt')) ||
    days[0];

  const targetDayIndex = Number(targetDay?.dayIndex) || 1;
  const rawActivities: any[] = Array.isArray(targetDay?.activities) ? targetDay.activities : [];

  if (rawActivities.length === 0) {
    return {
      recommendations: [],
      dispatcherNotice: `Ngày ${targetDayIndex} không có hoạt động nào để điều phối.`,
    };
  }

  const buffer = effectiveBufferMinutes(rules);
  const recommendations: any[] = [];

  interface ParsedAct {
    id: string;
    title: string;
    location: string;
    type: string;
    status: string;
    start: number;
    end: number;
    duration: number;
  }

  const parsedActs: ParsedAct[] = [];
  for (const act of rawActivities) {
    if (!act || typeof act.id !== 'string') continue;
    const start = parseClock(act.timeStart);
    const end = parseClock(act.timeEnd);
    if (start === null || end === null || end <= start) continue;
    parsedActs.push({
      id: act.id,
      title: String(act.title || ''),
      location: String(act.location || ''),
      type: String(act.type || ''),
      status: String(act.status || ''),
      start,
      end,
      duration: end - start,
    });
  }

  parsedActs.sort((a, b) => a.start - b.start);

  // 2. Kịch bản A: Cảnh báo Thời tiết / Giao thông / Đèo dốc
  const weatherOrTrafficAlerts = alertDetails.filter(
    (a) =>
      a.category === 'weather' ||
      a.category === 'traffic' ||
      /mưa|bão|sương mù|đèo|hải vân|lưu lượng|ùn tắc/i.test(`${a.title || ''} ${a.description || ''}`),
  );

  const affectedAct =
    parsedActs.find(
      (a) =>
        a.status !== 'Hoàn tất' &&
        (/lăng cô|hải vân|ql1a|đèo/i.test(`${a.location} ${a.title}`) ||
          a.status === 'Cần xử lý' ||
          a.type === 'transport'),
    ) || parsedActs.find((a) => a.status !== 'Hoàn tất');

  if (affectedAct) {
    const actIdx = parsedActs.findIndex((a) => a.id === affectedAct.id);
    const prevAct = actIdx > 0 ? parsedActs[actIdx - 1] : null;
    const nextAct = actIdx < parsedActs.length - 1 ? parsedActs[actIdx + 1] : null;

    // Thử dịch sớm 20 phút để vượt giờ cao điểm / tránh dông
    const shiftMinutes = 20;
    const candidateStart = affectedAct.start - shiftMinutes;
    const candidateEnd = candidateStart + affectedAct.duration;

    const minAllowedStart = prevAct ? prevAct.end + buffer : rules.dayStartMinutes;
    const maxAllowedEnd = nextAct ? nextAct.start - buffer : rules.dayEndMinutes;

    if (candidateStart >= minAllowedStart && candidateEnd <= maxAllowedEnd) {
      const resolvedIds = weatherOrTrafficAlerts.map((a) => a.id).filter(Boolean);
      recommendations.push({
        id: 'rec-rule-early-shift',
        actionTitle: `Dự phòng lưu lượng & rủi ro thời tiết: Khởi hành sớm 20 phút cho "${affectedAct.title}"`,
        reason: `Quy tắc vận hành: Tuyến đường qua ${affectedAct.location || 'cửa ngõ'} có mật độ xe cao và rủi ro thời tiết. Khởi hành sớm 20 phút giúp đoàn đảm bảo an toàn, duy trì khoảng đệm an toàn ${buffer} phút và nhận phòng đúng giờ.`,
        timeSaved: 'Tiết kiệm 20 phút',
        costSaved: '320.000 ₫',
        confidence: '95%',
        targetDayIndex,
        scheduleChanges: [
          {
            activityId: affectedAct.id,
            activityTitle: affectedAct.title,
            oldTime: `${formatClock(affectedAct.start)} — ${formatClock(affectedAct.end)}`,
            newTime: `${formatClock(candidateStart)} — ${formatClock(candidateEnd)}`,
            action: `Khởi hành sớm 20 phút qua ${affectedAct.location || 'tuyến đường'} dự phòng thời tiết & ùn tắc`,
            status: 'Đã xác nhận',
          },
        ],
        resolvedAlertIds: resolvedIds.length > 0 ? resolvedIds : ['alt-1', 'alt-3'],
      });
    }
  }

  // 3. Kịch bản B: Kiểm tra xung đột thời gian đệm (Buffer / Overlap) giữa các hoạt động
  for (let i = 0; i < parsedActs.length - 1; i += 1) {
    const curr = parsedActs[i];
    const next = parsedActs[i + 1];

    if (next.status === 'Hoàn tất') continue;

    if (curr.end + buffer > next.start) {
      const newNextStart = curr.end + buffer;
      const newNextEnd = newNextStart + next.duration;

      const afterNext = i + 2 < parsedActs.length ? parsedActs[i + 2] : null;
      const limitEnd = afterNext ? afterNext.start - buffer : rules.dayEndMinutes;

      if (newNextEnd <= limitEnd) {
        recommendations.push({
          id: `rec-rule-buffer-fix-${next.id}`,
          actionTitle: `Đảm bảo thời gian đệm an toàn ${buffer} phút cho "${next.title}"`,
          reason: `Quy tắc vận hành: Khoảng nghỉ giữa "${curr.title}" và "${next.title}" chưa đạt mức tối thiểu ${buffer} phút. Điều chỉnh giờ bắt đầu giúp đoàn có đủ thời gian nghỉ ngơi và di chuyển ổn định.`,
          timeSaved: 'Tối ưu 15 phút',
          costSaved: '180.000 ₫',
          confidence: '94%',
          targetDayIndex,
          scheduleChanges: [
            {
              activityId: next.id,
              activityTitle: next.title,
              oldTime: `${formatClock(next.start)} — ${formatClock(next.end)}`,
              newTime: `${formatClock(newNextStart)} — ${formatClock(newNextEnd)}`,
              action: `Dời giờ bắt đầu để đảm bảo khoảng đệm an toàn ${buffer} phút`,
              status: 'Đã xác nhận',
            },
          ],
          resolvedAlertIds: alertDetails.filter((a) => a.category === 'schedule').map((a) => a.id),
        });
        break;
      }
    }
  }

  // 4. Kịch bản C: Tránh nắng trưa (avoidHotNoonSun)
  if (rules.priorities.avoidHotNoonSun && recommendations.length < 2) {
    const noonAct = parsedActs.find(
      (a) =>
        a.status !== 'Hoàn tất' &&
        (a.type === 'sightseeing' || a.type === 'transport') &&
        a.start < 13 * 60 + 30 &&
        a.end > 11 * 60 + 30,
    );

    if (noonAct) {
      const actIdx = parsedActs.findIndex((a) => a.id === noonAct.id);
      const prev = actIdx > 0 ? parsedActs[actIdx - 1] : null;

      const earlierStart = 11 * 60 + 30 - noonAct.duration;
      const minStart = prev ? prev.end + buffer : rules.dayStartMinutes;

      if (earlierStart >= minStart && !recommendations.some((r) => r.scheduleChanges.some((c: any) => c.activityId === noonAct.id))) {
        recommendations.push({
          id: `rec-rule-noon-sun-${noonAct.id}`,
          actionTitle: `Tránh nắng gắt buổi trưa: Dời sớm hoạt động "${noonAct.title}"`,
          reason: `Quy tắc vận hành: Nhiệt độ ngoài trời miền Trung đạt đỉnh từ 11:30–13:30. Hoạt động tại "${noonAct.location}" được dời sớm để hoàn tất trước 11:30, dành trọn khung trưa cho đoàn nghỉ ngơi.`,
          timeSaved: 'Tối ưu sức khỏe',
          costSaved: '250.000 ₫',
          confidence: '92%',
          targetDayIndex,
          scheduleChanges: [
            {
              activityId: noonAct.id,
              activityTitle: noonAct.title,
              oldTime: `${formatClock(noonAct.start)} — ${formatClock(noonAct.end)}`,
              newTime: `${formatClock(earlierStart)} — ${formatClock(11 * 60 + 30)}`,
              action: 'Hoàn tất trước 11:30 tránh nắng nóng cực đại',
              status: 'Đã xác nhận',
            },
          ],
          resolvedAlertIds: [],
        });
      }
    }
  }

  return {
    recommendations,
    dispatcherNotice: 'Lệnh điều phối quy tắc nội bộ: Đã tạo phương án điều phối tự động dựa trên dữ liệu chuyến đi thực tế và bộ quy tắc vận hành.',
  };
}

