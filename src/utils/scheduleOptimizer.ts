/**
 * Điều phối tối ưu lịch trình: dựng prompt từ dữ liệu thật + quy tắc Admin,
 * gọi AI, rồi LỌC mọi kết quả qua bộ kiểm tra khả thi.
 *
 * Phụ thuộc bên ngoài (gọi Gemini, bộ dự phòng) được truyền vào để test được
 * mà không cần server hay API key.
 */

import {
  buildRulesPromptSection,
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
