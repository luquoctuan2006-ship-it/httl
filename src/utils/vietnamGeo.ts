/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Waypoint } from '../types/travel';

export interface LocationGeo {
  name: string;
  lat: number;
  lng: number;
  region?: string;
}

export const VIETNAM_LOCATIONS: Record<string, { lat: number; lng: number }> = {
  // Miền Bắc
  'hà nội': { lat: 21.0285, lng: 105.8542 },
  'ha noi': { lat: 21.0285, lng: 105.8542 },
  'hạ long': { lat: 20.9505, lng: 107.0734 },
  'ha long': { lat: 20.9505, lng: 107.0734 },
  'quảng ninh': { lat: 21.0064, lng: 107.2925 },
  'sa pa': { lat: 22.3364, lng: 103.8438 },
  'sapa': { lat: 22.3364, lng: 103.8438 },
  'lào cai': { lat: 22.4856, lng: 103.9707 },
  'ninh bình': { lat: 20.2506, lng: 105.9745 },
  'ninh binh': { lat: 20.2506, lng: 105.9745 },
  'hải phòng': { lat: 20.8449, lng: 106.6881 },
  'hà giang': { lat: 22.8233, lng: 104.9839 },
  'cao bằng': { lat: 22.6666, lng: 106.2639 },
  'bắc kạn': { lat: 22.147, lng: 105.8348 },
  'lạng sơn': { lat: 21.8537, lng: 106.7618 },
  'mai châu': { lat: 20.6698, lng: 105.083 },
  'mộc châu': { lat: 20.8524, lng: 104.6469 },

  // Miền Trung
  'đà nẵng': { lat: 16.0544, lng: 108.2022 },
  'da nang': { lat: 16.0544, lng: 108.2022 },
  'hội an': { lat: 15.8801, lng: 108.338 },
  'hoi an': { lat: 15.8801, lng: 108.338 },
  'huế': { lat: 16.4637, lng: 107.5909 },
  'hue': { lat: 16.4637, lng: 107.5909 },
  'thừa thiên huế': { lat: 16.4637, lng: 107.5909 },
  'quảng nam': { lat: 15.5898, lng: 108.2384 },
  'quảng bình': { lat: 17.469, lng: 106.622 },
  'đồng hới': { lat: 17.4764, lng: 106.6227 },
  'phong nha': { lat: 17.5855, lng: 106.2847 },
  'quảng trị': { lat: 16.75, lng: 107.1856 },
  'quy nhơn': { lat: 13.782, lng: 109.2197 },
  'quy nhon': { lat: 13.782, lng: 109.2197 },
  'bình định': { lat: 14.1667, lng: 108.9 },
  'phú yên': { lat: 13.0882, lng: 109.3174 },
  'tuy hòa': { lat: 13.0882, lng: 109.3174 },
  'nha trang': { lat: 12.2388, lng: 109.1967 },
  'khánh hòa': { lat: 12.25, lng: 109.1833 },
  'phan thiết': { lat: 10.9804, lng: 108.2615 },
  'mũi né': { lat: 10.9333, lng: 108.2833 },
  'bình thuận': { lat: 11.0904, lng: 108.0722 },
  'ninh thuận': { lat: 11.6969, lng: 108.9247 },
  'phan rang': { lat: 11.5667, lng: 108.9833 },

  // Tây Nguyên
  'đà lạt': { lat: 11.9404, lng: 108.4583 },
  'da lat': { lat: 11.9404, lng: 108.4583 },
  'lâm đồng': { lat: 11.65, lng: 108.15 },
  'buôn ma thuột': { lat: 12.6667, lng: 108.0383 },
  'đắk lắk': { lat: 12.8333, lng: 108.25 },
  'pleiku': { lat: 13.9833, lng: 108.0 },
  'gia lai': { lat: 13.75, lng: 108.25 },
  'kon tum': { lat: 14.35, lng: 108.0 },
  'măng đen': { lat: 14.5936, lng: 108.2938 },

  // Miền Nam & Miền Tây
  'hồ chí minh': { lat: 10.8231, lng: 106.6297 },
  'tp.hồ chí minh': { lat: 10.8231, lng: 106.6297 },
  'tp.hcm': { lat: 10.8231, lng: 106.6297 },
  'tp hcm': { lat: 10.8231, lng: 106.6297 },
  'sài gòn': { lat: 10.8231, lng: 106.6297 },
  'sai gon': { lat: 10.8231, lng: 106.6297 },
  'vũng tàu': { lat: 10.346, lng: 107.0843 },
  'bà rịa': { lat: 10.4967, lng: 107.1683 },
  'cần thơ': { lat: 10.0452, lng: 105.7469 },
  'can tho': { lat: 10.0452, lng: 105.7469 },
  'phú quốc': { lat: 10.2899, lng: 103.984 },
  'phu quoc': { lat: 10.2899, lng: 103.984 },
  'kiên giang': { lat: 10.0167, lng: 105.0833 },
  'côn đảo': { lat: 8.6835, lng: 106.6074 },
  'an giang': { lat: 10.5216, lng: 105.1259 },
  'châu đốc': { lat: 10.7067, lng: 105.1167 },
  'tiền giang': { lat: 10.4167, lng: 106.3333 },
  'mỹ tho': { lat: 10.36, lng: 106.36 },
  'bến tre': { lat: 10.2333, lng: 106.3833 },
  'đồng tháp': { lat: 10.4678, lng: 105.6328 },
  'cà mau': { lat: 9.1769, lng: 105.1524 },
  'bạc liêu': { lat: 9.2941, lng: 105.7278 },
  'tây ninh': { lat: 11.3103, lng: 106.0983 },
};

/**
 * Tra cứu tọa độ địa lý cho tên địa điểm tiếng Việt
 */
export function lookupCoordinates(placeName: string): { lat: number; lng: number } {
  if (!placeName || typeof placeName !== 'string') {
    return { lat: 16.0544, lng: 108.2022 };
  }

  const clean = placeName.trim().toLowerCase();

  // 1. Khớp trực tiếp
  if (VIETNAM_LOCATIONS[clean]) {
    return VIETNAM_LOCATIONS[clean];
  }

  // 2. Khớp chuỗi con
  for (const [key, coords] of Object.entries(VIETNAM_LOCATIONS)) {
    if (clean.includes(key) || key.includes(clean)) {
      return coords;
    }
  }

  // 3. Fallback: hash tên địa điểm tạo offset nhẹ trong bản đồ Việt Nam
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash << 5) - hash + clean.charCodeAt(i);
    hash |= 0;
  }
  const latOffset = ((Math.abs(hash) % 1000) / 1000) * 8; // 10.0 to 18.0
  const lngOffset = ((Math.abs(hash >> 3) % 1000) / 1000) * 4; // 104.0 to 108.0

  return {
    lat: 10.5 + latOffset,
    lng: 104.5 + lngOffset,
  };
}

/**
 * Xây dựng danh sách Waypoints động cho chuyến đi từ điểm đi, điểm đến và các hoạt động
 */
export function buildDynamicWaypoints(
  origin: string,
  destination: string,
  activityLocations: string[] = []
): Waypoint[] {
  const pointsMap = new Map<string, { lat: number; lng: number }>();

  // Thêm điểm xuất phát
  const origName = origin.trim() || 'Điểm khởi hành';
  pointsMap.set(origName, lookupCoordinates(origName));

  // Thêm các điểm hoạt động thực tế
  for (const loc of activityLocations) {
    const trimmed = loc.trim();
    if (trimmed && !pointsMap.has(trimmed)) {
      pointsMap.set(trimmed, lookupCoordinates(trimmed));
      if (pointsMap.size >= 8) break; // Tối đa 8 điểm chính trên bản đồ
    }
  }

  // Thêm điểm đến nếu chưa có
  const destName = destination.trim() || 'Điểm đến';
  if (!pointsMap.has(destName)) {
    pointsMap.set(destName, lookupCoordinates(destName));
  }

  const entries = Array.from(pointsMap.entries());
  if (entries.length === 0) {
    return [];
  }

  const lats = entries.map(([, c]) => c.lat);
  const lngs = entries.map(([, c]) => c.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = maxLat - minLat || 0.1;
  const lngSpan = maxLng - minLng || 0.1;

  return entries.map(([name, coords], idx) => {
    // Tính phần trăm tọa độ trên bản đồ tổng quan
    const xPercent = Math.round(15 + (70 * (coords.lng - minLng)) / lngSpan);
    const yPercent = Math.round(15 + (70 * (maxLat - coords.lat)) / latSpan);

    return {
      id: `wp-${idx + 1}`,
      code: String(idx + 1).padStart(2, '0'),
      name,
      status: idx === 0 ? 'current' : 'pending',
      lat: Number(coords.lat.toFixed(4)),
      lng: Number(coords.lng.toFixed(4)),
      xPercent: Math.max(10, Math.min(90, xPercent)),
      yPercent: Math.max(10, Math.min(90, yPercent)),
    };
  });
}

export function buildAIPlanWaypoints(
  origin: string,
  destination: string,
  activities: readonly {
    location?: unknown;
    title?: unknown;
    timeStart?: unknown;
    coordinates?: unknown;
  }[] = [],
): Waypoint[] {
  const points = new Map<string, { name: string; lat: number; lng: number; arrivalTime?: string }>();

  const addPoint = (
    name: string,
    coordinates: { lat: number; lng: number },
    arrivalTime?: string,
    preferCoordinates = false,
  ) => {
    const key = name.trim().toLocaleLowerCase();
    const existing = points.get(key);
    if (existing) {
      if (preferCoordinates) {
        existing.lat = coordinates.lat;
        existing.lng = coordinates.lng;
      }
      if (!existing.arrivalTime && arrivalTime) existing.arrivalTime = arrivalTime;
      return;
    }
    points.set(key, { name, ...coordinates, ...(arrivalTime ? { arrivalTime } : {}) });
  };

  const cleanOrigin = origin.trim() || 'Điểm khởi hành';
  const cleanDestination = destination.trim() || 'Điểm đến';
  addPoint(cleanOrigin, lookupCoordinates(cleanOrigin));

  for (const activity of activities) {
    if (!activity || typeof activity !== 'object') continue;
    const location = typeof activity.location === 'string' ? activity.location.trim() : '';
    const title = typeof activity.title === 'string' ? activity.title.trim() : '';
    const name = location || title;
    if (!name) continue;

    const rawCoordinates = activity.coordinates;
    const coords = rawCoordinates && typeof rawCoordinates === 'object'
      ? rawCoordinates as { lat?: unknown; lng?: unknown }
      : {};
    const lat = Number(coords.lat);
    const lng = Number(coords.lng);
    const hasValidCoordinates =
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= 8 &&
      lat <= 24 &&
      lng >= 102 &&
      lng <= 110;
    const arrivalTime = typeof activity.timeStart === 'string' ? activity.timeStart : undefined;

    addPoint(
      name,
      hasValidCoordinates ? { lat, lng } : lookupCoordinates(name),
      arrivalTime,
      hasValidCoordinates,
    );
    if (points.size >= 49) break;
  }

  addPoint(cleanDestination, lookupCoordinates(cleanDestination));
  const entries = Array.from(points.values());
  const lats = entries.map((point) => point.lat);
  const lngs = entries.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = maxLat - minLat || 0.1;
  const lngSpan = maxLng - minLng || 0.1;

  return entries.map((point, index) => ({
    id: `wp-${index + 1}`,
    code: String(index + 1).padStart(2, '0'),
    name: point.name,
    status: index === 0 ? 'current' : 'pending',
    lat: Number(point.lat.toFixed(4)),
    lng: Number(point.lng.toFixed(4)),
    xPercent: Math.max(10, Math.min(90, Math.round(15 + (70 * (point.lng - minLng)) / lngSpan))),
    yPercent: Math.max(10, Math.min(90, Math.round(15 + (70 * (maxLat - point.lat)) / latSpan))),
    ...(point.arrivalTime ? { arrivalTime: point.arrivalTime } : {}),
  }));
}

export function dedupeWaypointsForMap(waypoints: readonly Waypoint[]): Waypoint[] {
  const seenCoordinates = new Set<string>();
  return waypoints.filter((waypoint) => {
    const key = `${waypoint.lat.toFixed(4)},${waypoint.lng.toFixed(4)}`;
    if (seenCoordinates.has(key)) return false;
    seenCoordinates.add(key);
    return true;
  });
}
