/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { OperationalAlert, TripData } from '../types/travel';

function parseClock(timeStr: string): number | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function createAiRiskAlerts(tripId: string, value: unknown): OperationalAlert[] {
  if (!Array.isArray(value)) return [];

  return value.slice(0, 20).flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const risk = item as Record<string, unknown>;
    const title = typeof risk.title === 'string' ? risk.title.trim().slice(0, 160) : '';
    if (!title) return [];

    const level = typeof risk.level === 'string' ? risk.level.trim().toLowerCase() : '';
    const severity: OperationalAlert['severity'] =
      ['error', 'critical', 'high', 'cao', 'nghiêm trọng'].includes(level)
        ? 'error'
        : ['info', 'low', 'thấp'].includes(level)
          ? 'info'
          : 'warning';
    const details = `${title} ${typeof risk.advice === 'string' ? risk.advice : ''}`.toLowerCase();
    const category: OperationalAlert['category'] =
      /mưa|dông|bão|nắng|thời tiết|weather|storm/.test(details)
        ? 'weather'
        : /khách sạn|nhận phòng|check.?in|hotel/.test(details)
          ? 'hotel'
          : /giao thông|kẹt xe|ùn tắc|di chuyển|đường|traffic/.test(details)
            ? 'traffic'
            : 'schedule';
    const advice = typeof risk.advice === 'string' ? risk.advice.trim().slice(0, 500) : '';

    return [{
      id: `alert-ai-risk-${tripId}-${index + 1}`,
      title,
      timeAgo: 'Phân tích AI',
      description: advice || 'Gemini nhận diện rủi ro tiềm ẩn cần được điều phối viên kiểm tra.',
      severity,
      category,
    }];
  });
}

/**
 * Tự động phân tích lịch trình và dữ liệu khí tượng thời gian thực
 * để phát hiện các xung đột, rủi ro thời tiết, giao thông và đệm thời gian.
 */
export function detectScheduleAndWeatherAlerts(trip: TripData): OperationalAlert[] {
  const alerts: OperationalAlert[] = [];

  if (!trip.days || !Array.isArray(trip.days)) {
    return alerts;
  }

  // 1. Quét rủi ro thời tiết từ thông tin khí tượng dọc tuyến của chuyến đi
  const weather = trip.weather;
  const stopForecasts = weather?.stopForecasts || [];
  const riskyStop = stopForecasts
    .map((sf) => ({
      sf,
      prob: sf.rainProb ? Number.parseInt(sf.rainProb.replace(/\D/g, ''), 10) : 0,
    }))
    .filter(({ sf, prob }) => prob >= 40 || /mưa|dông|giông|bão/i.test(sf.description || ''))
    .sort((a, b) => b.prob - a.prob)[0];

  const rainProbNum = weather?.rainProb ? Number.parseInt(weather.rainProb.replace(/\D/g, ''), 10) : 0;

  if (riskyStop || rainProbNum >= 40 || /mưa|dông|giông|bão/i.test(weather?.description || '')) {
    const targetDay = trip.days.find((d) => d.dayIndex === trip.currentDay) || trip.days[0];
    const outdoorOrPassAct = targetDay?.activities?.find((a) =>
      /đèo|sơn trà|biển|thuyền|bà nà|hải vân/i.test(`${a.title} ${a.location}`),
    ) || targetDay?.activities?.[0];

    const alertLocation = riskyStop?.sf.stopName || outdoorOrPassAct?.location || trip.destinationFull || 'Khu vực tour';
    const effectiveProbText = riskyStop?.sf.rainProb || weather.rainProb || 'cao';
    const effectiveTimeText = riskyStop?.sf.rainProbTime || weather.rainProbTime || 'trong ngày';
    const effectiveTemp = riskyStop ? riskyStop.sf.temp : weather.temp;
    const alertId = `alert-weather-${trip.id}-day-${trip.currentDay || 1}`;

    alerts.push({
      id: alertId,
      title: `Dự báo mưa dông & đường trơn trượt tại ${alertLocation}`,
      timeAgo: 'Vừa cập nhật',
      description: `Khả năng mưa đạt ${effectiveProbText} (${effectiveTimeText}), nhiệt độ ${effectiveTemp}°C. Nguy cơ trơn trượt hoặc gián đoạn hoạt động ngoài trời. Cần rà soát lịch trình hoặc chuẩn bị phương án dự phòng trong nhà.`,
      severity: 'warning',
      category: 'weather',
    });
  }

  // 2. Quét xung đột lịch trình trong từng ngày
  for (const day of trip.days) {
    const activities = day.activities || [];
    if (activities.length === 0) continue;

    for (let i = 0; i < activities.length; i++) {
      const act = activities[i];
      const timeStartRaw = act.timeStart || (act as any).time?.split('-')[0]?.trim() || '';
      const timeEndRaw = act.timeEnd || (act as any).time?.split('-')[1]?.trim() || '';
      const startMin = parseClock(timeStartRaw);
      const endMin = parseClock(timeEndRaw);

      if (startMin === null || endMin === null) continue;

      // 2.1 Cảnh báo nắng nóng đỉnh điểm giữa trưa (11:30 - 13:45)
      const isNoon = startMin >= 11 * 60 + 30 && startMin <= 13 * 60 + 45;
      const isOutdoor =
        (act.type === 'sightseeing' ||
          /tham quan|khám phá|leo|biển|bộ|núi|chùa|lăng|phố cổ|sơn trà|đèo/i.test(`${act.title} ${act.location}`)) &&
        !/ăn|nghỉ|khách sạn|nhà hàng|buffet/i.test(`${act.title} ${act.details || ''}`);
      if (isNoon && isOutdoor) {
        alerts.push({
          id: `alert-noon-${day.dayIndex}-${act.id}`,
          title: `Cảnh báo nhiệt độ cao giữa trưa: ${act.title}`,
          timeAgo: `Ngày ${day.dayIndex}`,
          description: `Hoạt động xếp lúc ${act.timeStart} tại ${act.location} rơi vào khung giờ nắng gắt nhất trong ngày. Dễ gây say nắng cho đoàn khách, khuyến nghị chuyển sang buổi sáng sớm hoặc chiều mát.`,
          severity: 'warning',
          category: 'weather',
        });
      }

      // 2.2 Cảnh báo kết thúc tour quá muộn sau 21:30
      if (endMin > 21 * 60 + 30) {
        alerts.push({
          id: `alert-late-${day.dayIndex}-${act.id}`,
          title: `Lịch trình kết thúc muộn: ${act.title}`,
          timeAgo: `Ngày ${day.dayIndex}`,
          description: `Hoạt động kéo dài đến ${act.timeEnd}, vượt khung giờ vận hành chuẩn (21:30). Tài xế và khách có nguy cơ quá tải mệt mỏi cho chặng ngày hôm sau.`,
          severity: 'info',
          category: 'schedule',
        });
      }

      // 2.3 Quét khoảng cách thời gian đệm với hoạt động kế tiếp
      if (i < activities.length - 1) {
        const nextAct = activities[i + 1];
        const nextStartMin = parseClock(nextAct.timeStart);
        if (nextStartMin !== null) {
          const bufferMinutes = nextStartMin - endMin;
          const isDifferentLocation = act.location.trim().toLowerCase() !== nextAct.location.trim().toLowerCase();

          // Chồng giờ hoặc thiếu đệm giữa hai điểm khác nhau
          if (bufferMinutes < 0) {
            alerts.push({
              id: `alert-overlap-${day.dayIndex}-${act.id}-${nextAct.id}`,
              title: `Xung đột chồng chéo giờ: ${act.title} & ${nextAct.title}`,
              timeAgo: `Ngày ${day.dayIndex}`,
              description: `'${act.title}' kết thúc lúc ${act.timeEnd} nhưng '${nextAct.title}' bắt đầu lúc ${nextAct.timeStart} (chồng lấn ${Math.abs(bufferMinutes)} phút). Cần điều phối lại giờ bắt đầu.`,
              severity: 'error',
              category: 'schedule',
            });
          } else if (bufferMinutes < 15 && isDifferentLocation) {
            alerts.push({
              id: `alert-buffer-${day.dayIndex}-${act.id}-${nextAct.id}`,
              title: `Thời gian đệm di chuyển quá gấp (${bufferMinutes} phút)`,
              timeAgo: `Ngày ${day.dayIndex}`,
              description: `Khoảng nghỉ giữa '${act.title}' (${act.location}) và '${nextAct.title}' (${nextAct.location}) chỉ có ${bufferMinutes} phút. Có nguy cơ cao bị tắc đường hoặc trễ chặng.`,
              severity: 'warning',
              category: 'traffic',
            });
          }
        }
      }

      // 2.4 Cảnh báo nhận phòng khách sạn bị dời hoặc trễ
      if (act.type === 'checkin' || /nhận phòng|check-in/i.test(act.title)) {
        if (startMin < 13 * 60) {
          alerts.push({
            id: `alert-checkin-early-${day.dayIndex}-${act.id}`,
            title: `Lưu ý giờ nhận phòng: ${act.title}`,
            timeAgo: `Ngày ${day.dayIndex}`,
            description: `Khách sạn thường chỉ cho nhận phòng từ 14:00. Lịch nhận phòng lúc ${act.timeStart} cần được điều phối viên liên hệ xác nhận phòng trống trước với lễ tân.`,
            severity: 'info',
            category: 'hotel',
          });
        }
      }
    }
  }

  // Kết hợp cảnh báo mới phát hiện nhưng không lặp trùng lặp
  const mergedAlerts: OperationalAlert[] = [...trip.alerts];
  for (const newAlert of alerts) {
    const isDuplicate = mergedAlerts.some(
      (a) => a.title.toLowerCase() === newAlert.title.toLowerCase() || a.id === newAlert.id
    );
    if (!isDuplicate) {
      mergedAlerts.push(newAlert);
    }
  }

  return mergedAlerts;
}
