/**
 * Bộ kiểm tra tính khả thi cho đề xuất tối ưu lịch trình.
 *
 * Module thuần (không I/O) để chạy được cả ở server lẫn trong test. Nó:
 *  - đọc `rules` của Admin (chuỗi như '20', '07:30', '40 km/h') thành số;
 *  - mô phỏng đúng thay đổi mà client sẽ áp dụng lên ngày mục tiêu;
 *  - loại đề xuất vi phạm quy tắc cứng (lỗi) và gắn cảnh báo cho vi phạm mềm;
 *  - chuẩn hóa `scheduleChanges` để client chỉ cần áp dụng, không phải đoán.
 *
 * Chỉ các vi phạm MỚI phát sinh do đề xuất mới bị tính: vi phạm đã có sẵn trong
 * lịch trình gốc không làm đề xuất bị loại.
 */

import type { Activity, DaySchedule, Waypoint } from '../types/travel';

// ───────────────────────────── Kiểu dữ liệu ─────────────────────────────

export interface ConflictChecks {
  overlapTime: boolean;
  openingHoursMismatch: boolean;
  impossibleTransit: boolean;
  hotelCheckinConflict: boolean;
}

export interface OptimizationPriorities {
  costSaving: boolean;
  transitTimeMinimization: boolean;
  avoidHotNoonSun: boolean;
  elderlyPacing: boolean;
}

export interface ScheduleRules {
  bufferMinutes: number;
  /** Phút kể từ 00:00 */
  dayStartMinutes: number;
  dayEndMinutes: number;
  citySpeedKmh: number;
  highwaySpeedKmh: number;
  passSpeedKmh: number;
  conflictChecks: ConflictChecks;
  priorities: OptimizationPriorities;
}

export type Severity = 'error' | 'warning';

export interface Violation {
  code: string;
  severity: Severity;
  message: string;
  activityId?: string;
}

export interface NormalizedScheduleChange {
  activityId: string;
  activityTitle: string;
  oldTime: string;
  newTime: string;
  action: string;
  status: 'Đã xác nhận';
}

export interface RejectedRecommendation {
  id?: string;
  actionTitle: string;
  violations: Violation[];
}

export interface ScheduleActivityInput extends Omit<Partial<Activity>, 'status' | 'type'> {
  status?: string;
  type?: string;
}

export interface ScheduleDayInput extends Omit<Partial<DaySchedule>, 'activities'> {
  activities?: ScheduleActivityInput[];
}

export interface ScheduleTripInput {
  days?: ScheduleDayInput[];
  waypoints?: Partial<Waypoint>[];
}



export interface OptimizationOutcome {
  accepted: any[];
  rejected: RejectedRecommendation[];
  checked: number;
}

// ───────────────────────────── Hằng số ─────────────────────────────

/** Đường đi thực tế thường dài hơn đường chim bay. */
export const ROAD_FACTOR = 1.3;
const ELDERLY_MIN_BUFFER = 30;
const ELDERLY_MAX_SIGHTSEEING_MIN = 180;
const NOON_START = 11 * 60 + 30;
const NOON_END = 13 * 60 + 30;
const NOON_TOLERANCE_MIN = 30;
const MAX_CHANGES_PER_RECOMMENDATION = 12;

const DEFAULT_RULES: ScheduleRules = {
  bufferMinutes: 20,
  dayStartMinutes: 7 * 60 + 30,
  dayEndMinutes: 21 * 60 + 30,
  citySpeedKmh: 40,
  highwaySpeedKmh: 60,
  passSpeedKmh: 35,
  conflictChecks: {
    overlapTime: true,
    openingHoursMismatch: true,
    impossibleTransit: true,
    hotelCheckinConflict: true,
  },
  priorities: {
    costSaving: true,
    transitTimeMinimization: true,
    avoidHotNoonSun: true,
    elderlyPacing: false,
  },
};

// ───────────────────────────── Thời gian ─────────────────────────────

/** '08:30' | '8:30' | '8h30' → phút trong ngày; null nếu không hợp lệ. */
export function parseClock(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{1,2})\s*[:h]\s*(\d{2})$/i);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function formatClock(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(totalMinutes)));
  const hh = String(Math.floor(clamped / 60)).padStart(2, '0');
  const mm = String(clamped % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

const RANGE_SEPARATOR = /\s*[—–-]\s*/;

/** '08:30 — 10:30' → {start, end}; '14:10' → {start, end: null}. */
export function parseTimeRange(value: unknown): { start: number; end: number | null } | null {
  if (typeof value !== 'string') return null;
  const parts = value.trim().split(RANGE_SEPARATOR).filter((part) => part.length > 0);
  if (parts.length === 0 || parts.length > 2) return null;
  const start = parseClock(parts[0]);
  if (start === null) return null;
  if (parts.length === 1) return { start, end: null };
  const end = parseClock(parts[1]);
  if (end === null) return null;
  return { start, end };
}

// ───────────────────────────── Rules ─────────────────────────────

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const match = value.replace(/,/g, '.').match(/-?\d+(\.\d+)?/);
    if (match) {
      const parsed = Number(match[0]);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return fallback;
}

function toBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Đọc cấu hình Admin (chuỗi) thành số, thiếu/sai thì dùng mặc định. */
export function parseRules(raw: any): ScheduleRules {
  const source = raw && typeof raw === 'object' ? raw : {};
  const checks = source.conflictChecks && typeof source.conflictChecks === 'object' ? source.conflictChecks : {};
  const priorities = source.optimizationPriorities && typeof source.optimizationPriorities === 'object'
    ? source.optimizationPriorities
    : {};

  const dayStart = parseClock(source.startHour) ?? DEFAULT_RULES.dayStartMinutes;
  const dayEnd = parseClock(source.endHour) ?? DEFAULT_RULES.dayEndMinutes;
  const positive = (value: unknown, fallback: number) => {
    const n = toNumber(value, fallback);
    return n > 0 ? n : fallback;
  };

  return {
    bufferMinutes: Math.max(0, toNumber(source.bufferMinutes, DEFAULT_RULES.bufferMinutes)),
    // Khung giờ ngược (kết thúc <= bắt đầu) là cấu hình hỏng → dùng mặc định.
    dayStartMinutes: dayEnd > dayStart ? dayStart : DEFAULT_RULES.dayStartMinutes,
    dayEndMinutes: dayEnd > dayStart ? dayEnd : DEFAULT_RULES.dayEndMinutes,
    citySpeedKmh: positive(source.citySpeedLimit, DEFAULT_RULES.citySpeedKmh),
    highwaySpeedKmh: positive(source.highwaySpeedLimit, DEFAULT_RULES.highwaySpeedKmh),
    passSpeedKmh: positive(source.passSpeedLimit, DEFAULT_RULES.passSpeedKmh),
    conflictChecks: {
      overlapTime: toBool(checks.overlapTime, true),
      openingHoursMismatch: toBool(checks.openingHoursMismatch, true),
      impossibleTransit: toBool(checks.impossibleTransit, true),
      hotelCheckinConflict: toBool(checks.hotelCheckinConflict, true),
    },
    priorities: {
      costSaving: toBool(priorities.costSaving, DEFAULT_RULES.priorities.costSaving),
      transitTimeMinimization: toBool(priorities.transitTimeMinimization, DEFAULT_RULES.priorities.transitTimeMinimization),
      avoidHotNoonSun: toBool(priorities.avoidHotNoonSun, DEFAULT_RULES.priorities.avoidHotNoonSun),
      elderlyPacing: toBool(priorities.elderlyPacing, DEFAULT_RULES.priorities.elderlyPacing),
    },
  };
}

export function effectiveBufferMinutes(rules: ScheduleRules): number {
  return rules.priorities.elderlyPacing
    ? Math.max(rules.bufferMinutes, ELDERLY_MIN_BUFFER)
    : rules.bufferMinutes;
}

/** Đoạn mô tả quy tắc để đưa vào prompt Gemini. */
export function buildRulesPromptSection(rules: ScheduleRules): string {
  const lines: string[] = [];
  lines.push(`- Khung giờ hoạt động mỗi ngày: ${formatClock(rules.dayStartMinutes)} – ${formatClock(rules.dayEndMinutes)}. Không đặt hoạt động ngoài khung này.`);
  if (rules.conflictChecks.overlapTime) {
    lines.push(`- Không để hai hoạt động chồng giờ; giữa hai hoạt động liên tiếp phải cách nhau tối thiểu ${effectiveBufferMinutes(rules)} phút.`);
  }
  if (rules.conflictChecks.impossibleTransit) {
    lines.push(`- Thời gian giữa hai điểm dừng phải đủ để di chuyển (đường thực tế ≈ ${ROAD_FACTOR} × đường chim bay). Tốc độ trung bình: nội thành ${rules.citySpeedKmh} km/h, đường dài ${rules.highwaySpeedKmh} km/h, qua đèo ${rules.passSpeedKmh} km/h.`);
  }
  if (rules.conflictChecks.hotelCheckinConflict) {
    lines.push('- Không dời hoạt động nhận phòng/khách sạn sớm hơn giờ ban đầu.');
  }
  if (rules.conflictChecks.openingHoursMismatch) {
    lines.push('- Hoạt động tại điểm có giờ mở cửa phải nằm trong giờ mở cửa.');
  }
  lines.push('- Không dời hoạt động đã "Hoàn tất".');

  const goals: string[] = [];
  if (rules.priorities.costSaving) goals.push('giảm chi phí phát sinh');
  if (rules.priorities.transitTimeMinimization) goals.push('giảm tối đa thời gian di chuyển');
  if (rules.priorities.avoidHotNoonSun) goals.push('tránh hoạt động ngoài trời lúc nắng gắt 11:30–13:30');
  if (rules.priorities.elderlyPacing) goals.push(`nhịp độ chậm cho người lớn tuổi (nghỉ ≥ ${ELDERLY_MIN_BUFFER} phút giữa hoạt động, mỗi điểm tham quan ≤ ${ELDERLY_MAX_SIGHTSEEING_MIN / 60} giờ)`);
  const goalLine = goals.length > 0 ? `Ưu tiên tối ưu (theo cấu hình Admin): ${goals.join('; ')}.` : 'Không có ưu tiên tối ưu bổ sung.';

  return `Quy tắc vận hành BẮT BUỘC (đề xuất vi phạm sẽ bị hệ thống loại):\n${lines.join('\n')}\n${goalLine}`;
}

// ───────────────────────────── Mô phỏng ngày ─────────────────────────────

interface Slot {
  id: string;
  title: string;
  location: string;
  type: string;
  status: string;
  start: number;
  end: number;
  coords: { lat: number; lng: number } | null;
}

function isCoords(value: any): value is { lat: number; lng: number } {
  return !!value && typeof value.lat === 'number' && typeof value.lng === 'number'
    && Number.isFinite(value.lat) && Number.isFinite(value.lng);
}

function resolveCoordinates(activity: ScheduleActivityInput, waypoints: Partial<Waypoint>[]) {
  if (isCoords(activity.coordinates)) return activity.coordinates;
  const haystack = `${activity.title ?? ''} ${activity.location ?? ''}`.toLowerCase();
  for (const waypoint of waypoints) {
    const name = typeof waypoint.name === 'string' ? waypoint.name.trim().toLowerCase() : '';
    if (name.length >= 2 && haystack.includes(name) && isCoords({ lat: waypoint.lat, lng: waypoint.lng })) {
      return { lat: waypoint.lat as number, lng: waypoint.lng as number };
    }
  }
  return null;
}

function toSlots(activities: ScheduleActivityInput[], waypoints: Partial<Waypoint>[]): Slot[] {
  const slots: Slot[] = [];
  for (const activity of activities) {
    if (!activity || typeof activity.id !== 'string') continue;
    const start = parseClock(activity.timeStart);
    const end = parseClock(activity.timeEnd);
    if (start === null || end === null) continue; // dữ liệu gốc hỏng: bỏ qua, không đổ lỗi cho đề xuất
    slots.push({
      id: activity.id,
      title: String(activity.title ?? ''),
      location: String(activity.location ?? ''),
      type: String(activity.type ?? ''),
      status: String(activity.status ?? ''),
      start,
      end,
      coords: resolveCoordinates(activity, waypoints),
    });
  }
  return slots;
}

function sortSlots(slots: Slot[]): Slot[] {
  return [...slots].sort((a, b) => a.start - b.start || a.end - b.end || a.id.localeCompare(b.id));
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function estimateTravelMinutes(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  rules: ScheduleRules,
  isMountainPass: boolean,
): number {
  const roadKm = haversineKm(from, to) * ROAD_FACTOR;
  const speed = isMountainPass
    ? rules.passSpeedKmh
    : roadKm > 30 ? rules.highwaySpeedKmh : rules.citySpeedKmh;
  return (roadKm / speed) * 60;
}

interface KeyedViolation extends Violation {
  key: string;
}

function span(slot: Slot) {
  return `"${slot.title}" (${formatClock(slot.start)}–${formatClock(slot.end)})`;
}

/** Mọi vi phạm bố cục của một trạng thái ngày, mỗi vi phạm có khóa ổn định để so sánh trước/sau. */
function collectLayoutIssues(slots: Slot[], rules: ScheduleRules): KeyedViolation[] {
  const issues: KeyedViolation[] = [];
  const sorted = sortSlots(slots);
  const buffer = effectiveBufferMinutes(rules);

  if (rules.conflictChecks.overlapTime) {
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        if (sorted[j].start < sorted[i].end) {
          issues.push({
            key: `overlap:${sorted[i].id}:${sorted[j].id}`,
            code: 'OVERLAP',
            severity: 'error',
            activityId: sorted[j].id,
            message: `Chồng giờ: ${span(sorted[i])} và ${span(sorted[j])}.`,
          });
        }
      }
    }
    for (let i = 0; i + 1 < sorted.length; i += 1) {
      const gap = sorted[i + 1].start - sorted[i].end;
      if (gap >= 0 && gap < buffer) {
        issues.push({
          key: `buffer:${sorted[i].id}:${sorted[i + 1].id}`,
          code: 'BUFFER_TOO_SHORT',
          severity: 'error',
          activityId: sorted[i + 1].id,
          message: `Thiếu thời gian đệm (${gap} phút < ${buffer} phút) giữa ${span(sorted[i])} và ${span(sorted[i + 1])}.`,
        });
      }
    }
  }

  if (rules.conflictChecks.impossibleTransit) {
    let previousStop: Slot | null = null;
    let between: Slot[] = [];
    for (const slot of sorted) {
      if (slot.type === 'transport') {
        between.push(slot); // chặng di chuyển nằm trong khoảng trống giữa hai điểm dừng
        continue;
      }
      if (previousStop && previousStop.coords && slot.coords) {
        const context = [previousStop, slot, ...between].map((s) => `${s.title} ${s.location}`).join(' ');
        const isPass = /đèo/i.test(context);
        const need = estimateTravelMinutes(previousStop.coords, slot.coords, rules, isPass);
        const gap = slot.start - previousStop.end;
        if (gap < need) {
          issues.push({
            key: `transit:${previousStop.id}:${slot.id}`,
            code: 'TRANSIT_TOO_SHORT',
            severity: 'error',
            activityId: slot.id,
            message: `Không đủ thời gian di chuyển từ ${span(previousStop)} đến ${span(slot)}: cần ≈ ${Math.ceil(need)} phút${isPass ? ' (qua đèo)' : ''}, chỉ có ${Math.max(0, gap)} phút.`,
          });
        }
      }
      previousStop = slot;
      between = [];
    }
  }

  return issues;
}

/** Số cặp điểm dừng liền kề mà không đủ tọa độ để kiểm tra di chuyển. */
function countUnverifiableTransit(slots: Slot[], changedIds: Set<string>): number {
  const stops = sortSlots(slots).filter((s) => s.type !== 'transport');
  let count = 0;
  for (let i = 1; i < stops.length; i += 1) {
    const pairTouched = changedIds.has(stops[i - 1].id) || changedIds.has(stops[i].id);
    if (pairTouched && (!stops[i - 1].coords || !stops[i].coords)) count += 1;
  }
  return count;
}

function parseOpenHours(value: unknown): { start: number; end: number } | null {
  const range = parseTimeRange(typeof value === 'string' ? value.replace(/\s*(đến|to)\s*/i, ' - ') : value);
  if (!range || range.end === null || range.end <= range.start) return null;
  return { start: range.start, end: range.end };
}

function findWaypointFor(activity: ScheduleActivityInput | undefined, waypoints: Partial<Waypoint>[]) {
  if (!activity) return undefined;
  const haystack = `${activity.title ?? ''} ${activity.location ?? ''}`.toLowerCase();
  return waypoints.find((w) => typeof w.name === 'string' && w.name.trim().length >= 2 && haystack.includes(w.name.trim().toLowerCase()));
}

// ───────────────────────────── Kiểm tra một đề xuất ─────────────────────────────

export interface RecommendationVerdict {
  accepted: boolean;
  errors: Violation[];
  warnings: Violation[];
  /** Bản đã chuẩn hóa (chỉ có khi accepted). */
  recommendation: any | null;
}

function fail(errors: Violation[]): RecommendationVerdict {
  return { accepted: false, errors, warnings: [], recommendation: null };
}

export function validateRecommendation(
  recommendation: any,
  trip: ScheduleTripInput,
  rules: ScheduleRules,
): RecommendationVerdict {
  if (!recommendation || typeof recommendation !== 'object') {
    return fail([{ code: 'MALFORMED', severity: 'error', message: 'Đề xuất không phải đối tượng hợp lệ.' }]);
  }

  const errors: Violation[] = [];
  const warnings: Violation[] = [];
  const days = Array.isArray(trip?.days) ? trip.days : [];
  const waypoints = Array.isArray(trip?.waypoints) ? trip.waypoints : [];

  if (typeof recommendation.actionTitle !== 'string' || recommendation.actionTitle.trim() === '') {
    errors.push({ code: 'MISSING_TITLE', severity: 'error', message: 'Đề xuất thiếu tiêu đề (actionTitle).' });
  }

  // Ngày mục tiêu: phải ghi rõ và tồn tại — không đoán.
  const targetDayIndex = Number(recommendation.targetDayIndex);
  const day = Number.isFinite(targetDayIndex) ? days.find((d) => Number(d?.dayIndex) === targetDayIndex) : undefined;
  if (!day) {
    errors.push({
      code: 'UNKNOWN_DAY',
      severity: 'error',
      message: `Ngày mục tiêu "${recommendation.targetDayIndex}" không tồn tại trong chuyến đi.`,
    });
    return fail(errors);
  }

  const changes: any[] = Array.isArray(recommendation.scheduleChanges) ? recommendation.scheduleChanges : [];
  if (changes.length === 0) {
    errors.push({ code: 'EMPTY_CHANGES', severity: 'error', message: 'Đề xuất không có thay đổi lịch trình cụ thể.' });
    return fail(errors);
  }
  if (changes.length > MAX_CHANGES_PER_RECOMMENDATION) {
    errors.push({ code: 'TOO_MANY_CHANGES', severity: 'error', message: `Quá nhiều thay đổi (${changes.length} > ${MAX_CHANGES_PER_RECOMMENDATION}).` });
    return fail(errors);
  }

  const activities: ScheduleActivityInput[] = Array.isArray(day.activities) ? day.activities : [];
  const beforeSlots = toSlots(activities, waypoints);
  const slotById = new Map(beforeSlots.map((slot) => [slot.id, slot]));
  const activityById = new Map(activities.filter((a) => a && typeof a.id === 'string').map((a) => [a.id as string, a]));

  const normalized: NormalizedScheduleChange[] = [];
  const nextTimes = new Map<string, { start: number; end: number }>();

  changes.forEach((change, index) => {
    const label = `Thay đổi #${index + 1}`;
    const activityId = typeof change?.activityId === 'string' ? change.activityId.trim() : '';
    if (!activityId) {
      errors.push({ code: 'MISSING_ACTIVITY_ID', severity: 'error', message: `${label}: thiếu activityId (không ghép theo tên).` });
      return;
    }
    const before = slotById.get(activityId);
    if (!before) {
      errors.push({
        code: 'UNKNOWN_ACTIVITY',
        severity: 'error',
        activityId,
        message: `${label}: hoạt động "${activityId}" không có trong ngày ${targetDayIndex}.`,
      });
      return;
    }
    if (nextTimes.has(activityId)) {
      errors.push({ code: 'DUPLICATE_CHANGE', severity: 'error', activityId, message: `${label}: hoạt động "${activityId}" bị đổi nhiều lần.` });
      return;
    }
    if (before.status === 'Hoàn tất') {
      errors.push({ code: 'COMPLETED_ACTIVITY', severity: 'error', activityId, message: `${label}: "${before.title}" đã hoàn tất, không thể dời giờ.` });
      return;
    }

    const range = parseTimeRange(change.newTime);
    if (!range) {
      errors.push({ code: 'INVALID_TIME', severity: 'error', activityId, message: `${label}: giờ mới "${String(change.newTime)}" sai định dạng (cần "HH:MM — HH:MM").` });
      return;
    }
    // Chỉ có giờ bắt đầu → giữ nguyên thời lượng cũ.
    const duration = before.end - before.start;
    const start = range.start;
    const end = range.end ?? start + duration;
    if (end <= start) {
      errors.push({ code: 'INVALID_RANGE', severity: 'error', activityId, message: `${label}: giờ kết thúc ${formatClock(end)} không sau giờ bắt đầu ${formatClock(start)}.` });
      return;
    }
    if (end > 24 * 60 - 1) {
      errors.push({ code: 'INVALID_RANGE', severity: 'error', activityId, message: `${label}: hoạt động kéo qua nửa đêm.` });
      return;
    }

    nextTimes.set(activityId, { start, end });
    if (start === before.start && end === before.end) {
      warnings.push({ code: 'NO_CHANGE', severity: 'warning', activityId, message: `${label}: "${before.title}" giữ nguyên giờ, đã bỏ qua.` });
      return;
    }
    normalized.push({
      activityId,
      activityTitle: before.title,
      oldTime: `${formatClock(before.start)} — ${formatClock(before.end)}`,
      newTime: `${formatClock(start)} — ${formatClock(end)}`,
      action: typeof change.action === 'string' && change.action.trim() ? change.action.trim() : 'Điều phối lại lịch trình',
      status: 'Đã xác nhận',
    });
  });

  if (errors.length > 0) return fail(errors);
  if (normalized.length === 0) {
    return fail([{ code: 'EMPTY_CHANGES', severity: 'error', message: 'Mọi thay đổi đều giữ nguyên giờ cũ — đề xuất không làm gì.' }]);
  }

  // Trạng thái sau khi áp dụng (đúng những gì client sẽ thực hiện).
  const afterSlots = beforeSlots.map((slot) => {
    const next = nextTimes.get(slot.id);
    return next ? { ...slot, start: next.start, end: next.end } : slot;
  });
  const changedIds = new Set(normalized.map((c) => c.activityId));

  // 1) Quy tắc theo từng hoạt động bị đổi.
  for (const change of normalized) {
    const before = slotById.get(change.activityId)!;
    const after = afterSlots.find((s) => s.id === change.activityId)!;
    const activity = activityById.get(change.activityId);

    if (after.start < rules.dayStartMinutes || after.end > rules.dayEndMinutes) {
      errors.push({
        code: 'OUT_OF_DAY_WINDOW',
        severity: 'error',
        activityId: change.activityId,
        message: `${span(after)} nằm ngoài khung giờ hoạt động ${formatClock(rules.dayStartMinutes)}–${formatClock(rules.dayEndMinutes)}.`,
      });
    }

    if (rules.conflictChecks.hotelCheckinConflict && (after.type === 'hotel' || after.type === 'checkin') && after.start < before.start) {
      errors.push({
        code: 'HOTEL_CHECKIN_EARLY',
        severity: 'error',
        activityId: change.activityId,
        message: `Không thể dời "${after.title}" sớm hơn giờ nhận phòng ban đầu ${formatClock(before.start)}.`,
      });
    }

    if (rules.conflictChecks.openingHoursMismatch) {
      const open = parseOpenHours(findWaypointFor(activity, waypoints)?.openHours);
      if (open && (after.start < open.start || after.end > open.end)) {
        errors.push({
          code: 'OUTSIDE_OPENING_HOURS',
          severity: 'error',
          activityId: change.activityId,
          message: `${span(after)} nằm ngoài giờ mở cửa ${formatClock(open.start)}–${formatClock(open.end)}.`,
        });
      }
    }

    if (rules.priorities.avoidHotNoonSun && after.type === 'sightseeing') {
      const overlap = (s: { start: number; end: number }) => Math.max(0, Math.min(s.end, NOON_END) - Math.max(s.start, NOON_START));
      if (overlap(after) > NOON_TOLERANCE_MIN && overlap(after) > overlap(before)) {
        warnings.push({
          code: 'HOT_NOON',
          severity: 'warning',
          activityId: change.activityId,
          message: `${span(after)} bị đẩy vào khung nắng gắt 11:30–13:30.`,
        });
      }
    }

    if (rules.priorities.elderlyPacing && after.type === 'sightseeing') {
      const length = after.end - after.start;
      if (length > ELDERLY_MAX_SIGHTSEEING_MIN && length > before.end - before.start) {
        warnings.push({
          code: 'ELDERLY_LONG_BLOCK',
          severity: 'warning',
          activityId: change.activityId,
          message: `${span(after)} kéo dài ${Math.round(length / 60 * 10) / 10} giờ, vượt mức phù hợp người lớn tuổi (${ELDERLY_MAX_SIGHTSEEING_MIN / 60} giờ).`,
        });
      }
    }
  }

  // 2) Bố cục cả ngày: chỉ tính vi phạm MỚI so với lịch gốc.
  const beforeKeys = new Set(collectLayoutIssues(beforeSlots, rules).map((issue) => issue.key));
  for (const issue of collectLayoutIssues(afterSlots, rules)) {
    if (!beforeKeys.has(issue.key)) {
      const { key: _key, ...violation } = issue;
      errors.push(violation);
    }
  }

  if (rules.conflictChecks.impossibleTransit) {
    const unverifiable = countUnverifiableTransit(afterSlots, changedIds);
    if (unverifiable > 0) {
      warnings.push({
        code: 'TRANSIT_UNVERIFIED',
        severity: 'warning',
        message: `${unverifiable} chặng liên quan chưa có tọa độ nên chưa kiểm tra được thời gian di chuyển.`,
      });
    }
  }

  if (errors.length > 0) return { accepted: false, errors, warnings, recommendation: null };

  return {
    accepted: true,
    errors: [],
    warnings,
    recommendation: {
      ...recommendation,
      targetDayIndex,
      scheduleChanges: normalized,
      warnings: warnings.map(({ code, message, activityId }) => ({ code, message, activityId })),
    },
  };
}

// ───────────────────────────── Lọc kết quả AI ─────────────────────────────

export function validateOptimizationResult(
  result: any,
  trip: ScheduleTripInput,
  rules: ScheduleRules,
): OptimizationOutcome {
  const list: any[] = Array.isArray(result?.recommendations) ? result.recommendations : [];
  const accepted: any[] = [];
  const rejected: RejectedRecommendation[] = [];

  for (const item of list) {
    let verdict: RecommendationVerdict;
    try {
      verdict = validateRecommendation(item, trip, rules);
    } catch (error) {
      // Lỗi bất ngờ khi kiểm tra: coi như KHÔNG đạt (không bao giờ cho qua khi chưa kiểm tra được).
      verdict = fail([{
        code: 'VALIDATOR_ERROR',
        severity: 'error',
        message: `Không kiểm tra được đề xuất: ${error instanceof Error ? error.message : 'lỗi không xác định'}.`,
      }]);
    }
    if (verdict.accepted) {
      accepted.push(verdict.recommendation);
    } else {
      rejected.push({
        id: typeof item?.id === 'string' ? item.id : undefined,
        actionTitle: typeof item?.actionTitle === 'string' ? item.actionTitle : '(không có tiêu đề)',
        violations: verdict.errors,
      });
    }
  }

  // Ít cảnh báo hơn xếp trước; giữ nguyên thứ tự AI khi bằng nhau.
  accepted.sort((a, b) => (a.warnings?.length ?? 0) - (b.warnings?.length ?? 0));
  return { accepted, rejected, checked: list.length };
}

/** Tóm tắt lý do bị loại để đưa lại cho Gemini sửa (1 lần thử lại). */
export function summarizeRejectionsForRetry(rejected: RejectedRecommendation[], maxItems = 6): string {
  return rejected
    .slice(0, maxItems)
    .map((r, i) => `${i + 1}. "${r.actionTitle}": ${r.violations.slice(0, 3).map((v) => v.message).join(' | ')}`)
    .join('\n');
}
