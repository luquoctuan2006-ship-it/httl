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

/**
 * Tìm hoạt động và ngày tương ứng khi người dùng bấm vào một điểm dừng (waypoint) trên bản đồ.
 */
export function findMatchingActivityForWaypoint(
  trip: TripData,
  waypoint: Waypoint,
): { activity: Activity; dayIndex: number } | null {
  const wpName = (waypoint.name || '').trim().toLowerCase();
  const wpCode = (waypoint.code || '').trim().toLowerCase();
  if (!wpName && !wpCode) return null;

  for (const day of trip.days || []) {
    for (const act of day.activities || []) {
      const loc = (act.location || '').trim().toLowerCase();
      const title = (act.title || '').trim().toLowerCase();
      if (
        (wpName && (loc.includes(wpName) || wpName.includes(loc) || title.includes(wpName))) ||
        (act.coordinates &&
          Math.abs(act.coordinates.lat - waypoint.lat) < 0.01 &&
          Math.abs(act.coordinates.lng - waypoint.lng) < 0.01)
      ) {
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
