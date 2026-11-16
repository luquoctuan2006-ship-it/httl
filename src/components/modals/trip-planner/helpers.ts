import type {
  Activity,
  AISuggestion,
  DaySchedule,
  TripData,
  TripMember,
  Waypoint,
} from '../../../types/travel';
import { estimateRoadDistanceKm } from '../../../utils/routeProgress';
import { getMemberInitials } from '../../../utils/tripJoinHelpers';
import { formatTripDatesRange } from '../../../utils/tripSyncHelpers';
import { isLegacyHashedCoordinate, lookupCoordinates } from '../../../utils/vietnamGeo';

export interface TripCreatorOwner {
  uid?: string;
  name?: string;
}

const VALID_ACTIVITY_TYPES: Activity['type'][] = [
  'transport',
  'meal',
  'sightseeing',
  'hotel',
  'checkin',
  'briefing',
];

const VN_WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;

export function parseGroupSize(groupType: string): number {
  const match =
    groupType.match(/(\d{1,3})\s*(?:người|khách|pax|thành viên)/i) ||
    groupType.match(/(\d{1,3})/);
  const count = match ? parseInt(match[1], 10) : 10;
  return Math.min(Math.max(Number.isFinite(count) ? count : 10, 1), 100);
}

export function buildMembers(count: number, owner?: TripCreatorOwner): TripMember[] {
  const safeCount = Math.min(Math.max(Math.round(count) || 1, 1), 100);
  const stamp = Date.now();
  const hasOwner = Boolean(owner && (owner.uid?.trim() || owner.name?.trim()));

  return Array.from({ length: safeCount }, (_, index) => {
    if (index === 0 && hasOwner) {
      const ownerName = owner?.name?.trim() || 'Trưởng đoàn';
      const ownerUid = owner?.uid?.trim();
      return {
        id: `member-${stamp}-1`,
        name: ownerName,
        avatar: getMemberInitials(ownerName),
        role: 'Trưởng đoàn',
        phone: '',
        status: 'online' as const,
        attendanceStatus: 'Chưa điểm danh' as const,
        memberType: 'account' as const,
        ...(ownerUid ? { uid: ownerUid } : {}),
      };
    }

    return {
      id: `member-${stamp}-${index + 1}`,
      name: `Thành viên ${index + 1}`,
      avatar: String((index % 10) + 1),
      role: index === 0 ? 'Trưởng đoàn' : 'Khách du lịch',
      phone: '',
      status: 'offline' as const,
      attendanceStatus: 'Chưa điểm danh' as const,
      ...(hasOwner ? { memberType: 'manual' as const } : {}),
    };
  });
}

export function getStartLocation(destination: string): string {
  const first = destination.split(/\s*(?:-|–|—|→|>)\s*/)[0]?.trim();
  return first || 'Hà Nội';
}

export function getEndLocation(destination: string): string {
  const parts = destination.split(/\s*(?:-|–|—|→|>)\s*/).map((part) => part.trim()).filter(Boolean);
  return parts[parts.length - 1] || 'Hà Nội';
}

export function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export function getTodayISODate(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function computeEndDateIso(startDateIso: string, totalDays: number): string {
  const match = String(startDateIso || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return startDateIso;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dt = new Date(Date.UTC(year, month - 1, day + Math.max(0, totalDays - 1)));
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function buildTripDatesLabel(startDateIso: string, totalDays: number): string {
  const cleanStart = String(startDateIso || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStart)) {
    const endIso = computeEndDateIso(cleanStart, Math.max(1, totalDays));
    const formatted = formatTripDatesRange(cleanStart, endIso);
    if (formatted) return formatted;
  }
  return `${formatDateDisplay(cleanStart)} (${Math.max(1, totalDays)} ngày)`.trim();
}

export function buildDayCalendarMetadata(
  startDateIso: string,
  dayIndex: number,
  rawTheme?: string,
): Pick<DaySchedule, 'dayName' | 'dateNum' | 'dateLabel' | 'fullDate'> {
  const cleanTheme = String(rawTheme || '')
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

export function computeEstimatedRouteKm(
  waypoints: readonly Waypoint[],
  fallbackKm: number,
): number {
  const located = waypoints.filter(
    (wp) =>
      typeof wp.lat === 'number' &&
      typeof wp.lng === 'number' &&
      Number.isFinite(wp.lat) &&
      Number.isFinite(wp.lng) &&
      (Math.abs(wp.lat) > 0.0001 || Math.abs(wp.lng) > 0.0001) &&
      !isLegacyHashedCoordinate(wp.name || '', wp.lat, wp.lng),
  );

  if (located.length < 2) {
    return Math.max(0, Math.round(fallbackKm));
  }

  let totalKm = 0;
  for (let i = 1; i < located.length; i += 1) {
    totalKm += estimateRoadDistanceKm(located[i - 1], located[i]);
  }

  return totalKm > 0 ? Math.round(totalKm) : Math.max(0, Math.round(fallbackKm));
}

export function normalizeActivityType(rawType: unknown): Activity['type'] {
  if (typeof rawType === 'string' && VALID_ACTIVITY_TYPES.includes(rawType as Activity['type'])) {
    return rawType as Activity['type'];
  }
  return 'sightseeing';
}

export function normalizeAiMoney(value: unknown, unitHint?: string): number {
  let num = NaN;
  if (typeof value === 'number') {
    num = value;
  } else if (typeof value === 'string') {
    const raw = value.trim();
    if (/^\d{1,3}([.,]\d{3})+$/.test(raw)) {
      num = Number(raw.replace(/[.,]/g, ''));
    } else {
      const cleaned = raw.replace(/[^0-9.,-]/g, '').replace(',', '.');
      num = Number(cleaned);
    }
  }

  if (!Number.isFinite(num) || num <= 0) return 0;

  const isMillionHint =
    (typeof unitHint === 'string' && /triệu|trieu|million|\btr\b/i.test(unitHint)) ||
    (typeof value === 'string' && /triệu|trieu|million|\btr\b/i.test(value));
  if (isMillionHint && num < 1000) {
    num *= 1_000_000;
  }

  return Math.round(num);
}

export function mapAiBudgetBreakdownToAllocations(
  rawBreakdown: unknown,
  unitHint?: string,
): TripData['customCategoryAllocations'] | undefined {
  if (!rawBreakdown || typeof rawBreakdown !== 'object' || Array.isArray(rawBreakdown)) {
    return undefined;
  }

  const totals: NonNullable<TripData['customCategoryAllocations']> = {};
  const addTo = (key: keyof NonNullable<TripData['customCategoryAllocations']>, amount: number) => {
    if (amount <= 0) return;
    totals[key] = (totals[key] || 0) + amount;
  };

  for (const [rawKey, rawVal] of Object.entries(rawBreakdown as Record<string, unknown>)) {
    const amount = normalizeAiMoney(rawVal, unitHint);
    if (amount <= 0) continue;
    const key = rawKey.toLowerCase();

    if (/transport|vehicle|car|bus|flight|xe|di\s*chuy|v[aậ]n\s*chuy|vé\s*máy\s*bay/.test(key)) {
      addTo('transport', amount);
    } else if (/hotel|stay|resort|accommodation|room|l[uư]u\s*tr|kh[aá]ch\s*s[aạ]n|ph[oò]ng/.test(key)) {
      addTo('hotel', amount);
    } else if (/meal|food|dining|restaurant|[aă]n\s*u|[aẩ]m\s*th|nh[aà]\s*h[aà]ng/.test(key)) {
      addTo('meal', amount);
    } else if (/sightseeing|ticket|attraction|experience|tour|activity|activities|tham\s*quan|v[eé]|tr[aả]i\s*nghi/.test(key)) {
      addTo('sightseeing', amount);
    } else if (/contingency|reserve|insurance|other|misc|d[uự]\s*ph|b[aả]o\s*hi|kh[aá]c/.test(key)) {
      addTo('contingency', amount);
    }
  }

  return Object.keys(totals).length > 0 ? totals : undefined;
}

export function normalizeAiSuggestions(
  rawSuggestions: unknown,
  fallbackSavings?: unknown,
  fallbackConfidence?: unknown,
): {
  aiSuggestions: AISuggestion[];
  aiSavingsEstimate: string;
  aiConfidence: string;
} {
  const stamp = Date.now();
  const list = Array.isArray(rawSuggestions) ? rawSuggestions : [];

  const normalized: AISuggestion[] = list.slice(0, 10).flatMap((rawItem, idx) => {
    if (!rawItem || typeof rawItem !== 'object') return [];
    const item = rawItem as Record<string, unknown>;
    const title = typeof item.title === 'string' ? item.title.trim().slice(0, 160) : '';
    const description = typeof item.description === 'string' ? item.description.trim().slice(0, 300) : '';
    if (!title && !description) return [];

    const badgeRaw =
      (typeof item.badge === 'string' && item.badge.trim()) ||
      (typeof item.impact === 'string' && item.impact.trim()) ||
      'Đề xuất AI';
    const costSavedRaw =
      (typeof item.costSaved === 'string' && item.costSaved.trim()) ||
      (typeof item.savingEstimate === 'string' && item.savingEstimate.trim()) ||
      undefined;
    const confidenceRaw =
      typeof item.confidence === 'string' && item.confidence.trim()
        ? item.confidence.trim()
        : undefined;
    const timeSavedRaw =
      typeof item.timeSaved === 'string' && item.timeSaved.trim()
        ? item.timeSaved.trim()
        : undefined;

    return [
      {
        id:
          typeof item.id === 'string' && item.id.trim()
            ? `sug-ai-${stamp}-${idx + 1}-${item.id.trim().slice(0, 40)}`
            : `sug-ai-${stamp}-${idx + 1}`,
        title: title || 'Gợi ý tối ưu lịch trình',
        badge: badgeRaw.slice(0, 40),
        description: description || 'Điều chỉnh khung giờ và điểm dừng để tối ưu lộ trình.',
        ...(timeSavedRaw ? { timeSaved: timeSavedRaw } : {}),
        ...(costSavedRaw ? { costSaved: costSavedRaw } : {}),
        ...(confidenceRaw ? { confidence: confidenceRaw } : {}),
      },
    ];
  });

  const aiSuggestions: AISuggestion[] =
    normalized.length > 0
      ? normalized
      : [
          {
            id: `sug-ai-${stamp}-1`,
            title: 'Lịch trình được sắp xếp tự động',
            badge: 'Tự động',
            description: 'Lộ trình và các chặng đã được tính toán cân bằng thời gian tham quan và di chuyển.',
          },
        ];

  const topSavings = typeof fallbackSavings === 'string' ? fallbackSavings.trim() : '';
  const firstSaving = aiSuggestions.find((s) => s.costSaved)?.costSaved || '';
  const aiSavingsEstimate = (topSavings || firstSaving).slice(0, 50);

  const topConfidence = typeof fallbackConfidence === 'string' ? fallbackConfidence.trim() : '';
  const firstConfidence = aiSuggestions.find((s) => s.confidence)?.confidence || '';
  const aiConfidence = (topConfidence || firstConfidence).slice(0, 20);

  return { aiSuggestions, aiSavingsEstimate, aiConfidence };
}

function isUsableCoordinatePair(coords: unknown): coords is { lat: number; lng: number } {
  if (!coords || typeof coords !== 'object') return false;
  const c = coords as { lat?: unknown; lng?: unknown };
  const lat = Number(c.lat);
  const lng = Number(c.lng);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 8 &&
    lat <= 24 &&
    lng >= 102 &&
    lng <= 110
  );
}

export function resolveActivityCoordinatesWithFallback(
  location: string,
  title: string,
  existing?: unknown,
): { lat: number; lng: number } | undefined {
  if (
    isUsableCoordinatePair(existing) &&
    !isLegacyHashedCoordinate(location || title, existing.lat, existing.lng)
  ) {
    return {
      lat: Number(Number(existing.lat).toFixed(5)),
      lng: Number(Number(existing.lng).toFixed(5)),
    };
  }
  const lookedUp = lookupCoordinates(location) || lookupCoordinates(title);
  return lookedUp ? { lat: lookedUp.lat, lng: lookedUp.lng } : undefined;
}

export function normalizeAiGeneratedDays(
  rawDays: unknown,
  startDateIso: string,
  unitHint?: string,
  stamp = Date.now(),
): DaySchedule[] {
  const daysArray = Array.isArray(rawDays) ? rawDays : [];
  return daysArray.map((rawDay, dayIdx) => {
    const d = (rawDay && typeof rawDay === 'object' ? rawDay : {}) as Record<string, unknown>;
    const dayIndex = dayIdx + 1;
    const rawActs = Array.isArray(d.activities) ? d.activities : [];

    const activities: Activity[] = rawActs
      .map((rawAct, actIdx): Activity => {
        const act = (rawAct && typeof rawAct === 'object' ? rawAct : {}) as Record<string, unknown>;
        const title =
          typeof act.title === 'string' && act.title.trim()
            ? act.title.trim().slice(0, 200)
            : `Hoạt động ${actIdx + 1}`;
        const location =
          typeof act.location === 'string' && act.location.trim()
            ? act.location.trim().slice(0, 200)
            : 'Điểm tham quan';
        const timeStart =
          typeof act.timeStart === 'string' && /^\d{1,2}:\d{2}$/.test(act.timeStart.trim())
            ? act.timeStart.trim().padStart(5, '0')
            : '08:00';
        const timeEnd =
          typeof act.timeEnd === 'string' && /^\d{1,2}:\d{2}$/.test(act.timeEnd.trim())
            ? act.timeEnd.trim().padStart(5, '0')
            : '09:30';
        const coordinates = resolveActivityCoordinatesWithFallback(location, title, act.coordinates);

        return {
          id: `act-ai-${stamp}-${dayIndex}-${actIdx + 1}`,
          timeStart,
          timeEnd,
          title,
          location,
          status: 'Đã xác nhận',
          type: normalizeActivityType(act.type),
          details:
            typeof act.details === 'string' && act.details.trim()
              ? act.details.trim().slice(0, 500)
              : 'Hoạt động theo lộ trình gợi ý tự động',
          cost: normalizeAiMoney(act.cost, unitHint),
          ...(coordinates ? { coordinates } : {}),
        };
      })
      .sort((a, b) => a.timeStart.localeCompare(b.timeStart));

    const calendarMeta = buildDayCalendarMetadata(
      startDateIso,
      dayIndex,
      typeof d.fullDate === 'string' && d.fullDate.trim()
        ? d.fullDate
        : typeof d.summary === 'string'
          ? d.summary
          : undefined,
    );

    return {
      dayIndex,
      ...calendarMeta,
      confirmedCount: activities.length,
      pendingCount: 0,
      dispatcherNote:
        (typeof d.summary === 'string' && d.summary.trim()) ||
        (typeof d.dispatcherNote === 'string' && d.dispatcherNote.trim()) ||
        'Theo dõi hành trình',
      activities,
    };
  });
}
