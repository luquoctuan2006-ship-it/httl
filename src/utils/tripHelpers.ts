import { normalizeTripData } from '../data/normalizeTripData';
import type { Activity, TripData, Waypoint } from '../types/travel';

/**
 * Nhân bản một chuyến đi hiện có thành chuyến đi mới (tour mẫu mới).
 */
export function cloneTripForTemplate(source: TripData, ownerUid?: string): TripData {
  const stamp = Date.now();
  const suffix = Math.floor(100 + Math.random() * 900);
  const baseCode = source.code ? `${source.code}-COPY` : `VN-${suffix}`;
  const cleanDays = (source.days || []).map((day, dIdx) => ({
    ...day,
    activities: (day.activities || []).map((act, aIdx) => ({
      ...act,
      id: `act-${stamp}-${dIdx + 1}-${aIdx + 1}`,
      status: act.status === 'Hoàn tất' || act.status === 'Đang diễn ra' ? ('Đã xác nhận' as const) : act.status,
    })),
  }));

  const cloned: TripData = {
    ...structuredClone(source),
    id: `trip-${stamp}-${suffix}`,
    ...(ownerUid ? { ownerId: ownerUid } : {}),
    code: baseCode.slice(0, 32),
    title: `${source.title} (Bản sao)`,
    status: 'Chuẩn bị',
    currentDay: 1,
    alerts: [],
    invoices: [],
    budgetUsed: 0,
    budgetRemaining: source.budgetTotal || 0,
    budgetUsedPercent: 0,
    days: cleanDays,
    waypoints: (source.waypoints || []).map((wp, idx) => ({
      ...wp,
      id: `wp-${stamp}-${idx + 1}`,
      status: idx === 0 ? 'current' : 'pending',
    })),
    members: (source.members || []).map((m, idx) => ({
      ...m,
      id: `member-${stamp}-${idx + 1}`,
      attendanceStatus: 'Chưa điểm danh',
    })),
    telematics: {
      ...source.telematics,
      currentLat: undefined,
      currentLng: undefined,
      gpsUpdatedAt: undefined,
      gpsSource: undefined,
      speedKmh: undefined,
    },
    version: undefined,
  };

  return normalizeTripData(cloned);
}

function hasNonZeroCoordinatePair(lat: unknown, lng: unknown): lat is number {
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

/**
 * Quy tắc khớp duy nhất giữa hoạt động và điểm dừng (theo tên địa điểm/tiêu đề hoặc tọa độ thực).
 */
export function doesActivityMatchWaypoint(activity: Activity, waypoint: Waypoint): boolean {
  const wpName = (waypoint.name || '').trim().toLowerCase();
  const loc = (activity.location || '').trim().toLowerCase();
  const title = (activity.title || '').trim().toLowerCase();

  if (
    wpName &&
    ((loc && (loc.includes(wpName) || wpName.includes(loc))) ||
      (title && title.includes(wpName)))
  ) {
    return true;
  }

  if (
    hasNonZeroCoordinatePair(waypoint.lat, waypoint.lng) &&
    activity.coordinates &&
    hasNonZeroCoordinatePair(activity.coordinates.lat, activity.coordinates.lng) &&
    Math.abs(activity.coordinates.lat - waypoint.lat) < 0.01 &&
    Math.abs(activity.coordinates.lng - waypoint.lng) < 0.01
  ) {
    return true;
  }

  return false;
}

/**
 * Tìm điểm dừng tương ứng với một hoạt động.
 */
export function findMatchingWaypointForActivity(
  waypoints: readonly Waypoint[],
  activity: Activity,
): Waypoint | undefined {
  return waypoints.find((wp) => doesActivityMatchWaypoint(activity, wp));
}

/**
 * Tìm hoạt động và ngày tương ứng khi người dùng bấm vào một điểm dừng (waypoint) trên bản đồ.
 */
export function findMatchingActivityForWaypoint(
  trip: TripData,
  waypoint: Waypoint,
): { activity: Activity; dayIndex: number } | null {
  const wpName = (waypoint.name || '').trim().toLowerCase();
  const wpCode = (waypoint.code || '').trim().toLowerCase();
  if (!wpName && !wpCode && !hasNonZeroCoordinatePair(waypoint.lat, waypoint.lng)) return null;

  for (const day of trip.days || []) {
    for (const act of day.activities || []) {
      if (doesActivityMatchWaypoint(act, waypoint)) {
        return { activity: act, dayIndex: day.dayIndex };
      }
    }
  }
  return null;
}

const CATEGORY_LABELS: Record<string, string> = {
  transport: 'Vận chuyển & Xe',
  hotel: 'Khách sạn & Lưu trú',
  meal: 'Ẩm thực & Nhà hàng',
  sightseeing: 'Vé tham quan & Trải nghiệm',
  contingency: 'Dự phòng & Khác',
};

function escapeCsvCell(value: unknown): string {
  const str = String(value ?? '').replace(/\r?\n/g, ' ');
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Xuất báo cáo chi tiêu chuyến đi dạng CSV (UTF-8 BOM tương thích Excel).
 */
export function buildExpenseReportCsv(trip: TripData): string {
  const header = [
    'Loại mục',
    'Ngày / Tour',
    'Hạng mục',
    'Nội dung',
    'Đơn vị cung cấp / Địa điểm',
    'Số hóa đơn',
    'Số tiền (VNĐ)',
    'Chứng từ ảnh',
    'Ghi chú',
  ];

  const rows: string[][] = [header];

  for (const inv of trip.invoices || []) {
    rows.push([
      'Hóa đơn thực tế',
      inv.dayIndex ? `Ngày ${inv.dayIndex} (${inv.date || ''})` : inv.date || '',
      CATEGORY_LABELS[inv.category] || inv.category,
      inv.title,
      inv.vendor || '',
      inv.invoiceNumber || '',
      String(inv.amount || 0),
      inv.receiptImage || inv.receiptId ? 'Có ảnh đính kèm' : 'Không',
      inv.note || '',
    ]);
  }

  for (const day of trip.days || []) {
    for (const act of day.activities || []) {
      if (!act.cost || act.cost <= 0) continue;
      rows.push([
        'Chi phí lịch trình',
        `Ngày ${day.dayIndex}`,
        act.type,
        act.title,
        act.location || '',
        '',
        String(act.cost),
        'Không',
        `${act.timeStart}-${act.timeEnd}`,
      ]);
    }
  }

  const totalInvoices = (trip.invoices || []).reduce((s, i) => s + (i.amount || 0), 0);
  const totalActivities = (trip.days || []).flatMap((d) => d.activities || []).reduce((s, a) => s + (a.cost || 0), 0);
  rows.push(['TỔNG CỘNG', trip.code, '', trip.title, '', '', String(totalInvoices + totalActivities), '', `Ngân sách: ${trip.budgetTotal}`]);

  return '\uFEFF' + rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
}
