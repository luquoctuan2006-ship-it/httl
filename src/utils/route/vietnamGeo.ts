/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Waypoint } from '../../types/travel';

export interface LocalPlaceSuggestion {
  id: string;
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  source: 'local';
}

export function normalizeVietnameseText(input: string): string {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s.,/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
  'thanh hóa': { lat: 19.8075, lng: 105.776 },
  'thanh hoa': { lat: 19.8075, lng: 105.776 },
  'sam son': { lat: 19.7329, lng: 105.9094 },
  'sầm sơn': { lat: 19.7329, lng: 105.9094 },
  'pù luông': { lat: 20.4433, lng: 105.1689 },
  'pu luong': { lat: 20.4433, lng: 105.1689 },
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
 * Tra cứu tọa độ địa lý cho tên địa điểm tiếng Việt.
 * Trả về null nếu không xác định được địa điểm để tránh tạo tọa độ giả.
 */
export function lookupCoordinates(placeName: string): { lat: number; lng: number } | null {
  if (!placeName || typeof placeName !== 'string') {
    return null;
  }

  const clean = placeName.trim().toLowerCase();
  if (!clean) {
    return null;
  }

  // 1. Khớp trực tiếp
  if (VIETNAM_LOCATIONS[clean]) {
    return VIETNAM_LOCATIONS[clean];
  }

  // 2. Khớp chuỗi con an toàn (tránh chuỗi quá ngắn khớp nhầm)
  for (const [key, coords] of Object.entries(VIETNAM_LOCATIONS)) {
    if (clean.includes(key) || (clean.length >= 4 && key.includes(clean))) {
      return coords;
    }
  }

  return null;
}

function formatPlaceDisplayName(key: string): string {
  if (key === 'tp.hồ chí minh' || key === 'tp.hcm' || key === 'tp hcm' || key === 'hồ chí minh') {
    return 'TP. Hồ Chí Minh';
  }
  return key
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const CANONICAL_LOCAL_PLACES: LocalPlaceSuggestion[] = (() => {
  const byCoords = new Map<string, { key: string; lat: number; lng: number; hasAccent: boolean }>();
  for (const [key, coords] of Object.entries(VIETNAM_LOCATIONS)) {
    const coordKey = `${coords.lat.toFixed(4)},${coords.lng.toFixed(4)}`;
    const hasAccent = key !== normalizeVietnameseText(key);
    const existing = byCoords.get(coordKey);
    if (!existing || (!existing.hasAccent && hasAccent) || (existing.hasAccent === hasAccent && key.length > existing.key.length)) {
      byCoords.set(coordKey, { key, lat: coords.lat, lng: coords.lng, hasAccent });
    }
  }
  return Array.from(byCoords.entries()).map(([coordKey, item]) => {
    const title = formatPlaceDisplayName(item.key);
    return {
      id: `local-${coordKey}`,
      name: title,
      displayName: `${title}, Việt Nam`,
      lat: item.lat,
      lng: item.lng,
      source: 'local' as const,
    };
  });
})();

export function searchLocalPlaces(rawQuery: string, limit = 5): LocalPlaceSuggestion[] {
  const cleanNormalized = normalizeVietnameseText(rawQuery);
  if (cleanNormalized.length < 2) return [];

  const scored: { item: LocalPlaceSuggestion; score: number }[] = [];
  for (const place of CANONICAL_LOCAL_PLACES) {
    const placeNorm = normalizeVietnameseText(place.name);
    if (placeNorm === cleanNormalized) {
      scored.push({ item: place, score: 100 });
    } else if (placeNorm.startsWith(cleanNormalized)) {
      scored.push({ item: place, score: 85 });
    } else if (placeNorm.includes(cleanNormalized)) {
      scored.push({ item: place, score: 70 });
    } else if (cleanNormalized.includes(placeNorm) && placeNorm.length >= 4) {
      scored.push({ item: place, score: 55 });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name, 'vi'));
  return scored.slice(0, limit).map((entry) => entry.item);
}

/**
 * Tính lại tọa độ giả lập theo công thức hash cũ để nhận diện dữ liệu cũ bị băm ngẫu nhiên.
 */
export function computeLegacyHashedCoordinate(placeName: string): { lat: number; lng: number } | null {
  const clean = typeof placeName === 'string' ? placeName.trim().toLowerCase() : '';
  if (!clean) return null;

  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash << 5) - hash + clean.charCodeAt(i);
    hash |= 0;
  }
  const latOffset = ((Math.abs(hash) % 1000) / 1000) * 8;
  const lngOffset = ((Math.abs(hash >> 3) % 1000) / 1000) * 4;

  return {
    lat: Number((10.5 + latOffset).toFixed(4)),
    lng: Number((104.5 + lngOffset).toFixed(4)),
  };
}

/**
 * Kiểm tra xem cặp tọa độ đã lưu có phải do thuật toán hash cũ tạo ra khi không tìm thấy địa danh hay không.
 */
export function isLegacyHashedCoordinate(placeName: string, lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lookupCoordinates(placeName) !== null) return false;
  const hashed = computeLegacyHashedCoordinate(placeName);
  if (!hashed) return false;
  return Math.abs(lat - hashed.lat) < 0.0005 && Math.abs(lng - hashed.lng) < 0.0005;
}

function isValidExplicitCoords(
  placeName: string,
  coords: unknown,
): coords is { lat: number; lng: number } {
  if (!coords || typeof coords !== 'object') return false;
  const c = coords as { lat?: unknown; lng?: unknown };
  const lat = Number(c.lat);
  const lng = Number(c.lng);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    (Math.abs(lat) > 0.0001 || Math.abs(lng) > 0.0001) &&
    !isLegacyHashedCoordinate(placeName, lat, lng)
  );
}

export interface EndpointCoordinates {
  origin?: { lat: number; lng: number } | null;
  destination?: { lat: number; lng: number } | null;
}

/**
 * Xây dựng danh sách Waypoints động cho chuyến đi từ điểm đi, điểm đến và các hoạt động có tọa độ xác thực
 */
export function buildDynamicWaypoints(
  origin: string,
  destination: string,
  activityLocations: readonly (string | { location: string; coordinates?: { lat: number; lng: number } })[] = [],
  endpointCoords?: EndpointCoordinates,
): Waypoint[] {
  const pointsMap = new Map<string, { lat: number; lng: number }>();

  // Thêm điểm xuất phát nếu xác định được tọa độ (ưu tiên tọa độ đã chọn từ autocomplete)
  const origName = origin.trim() || 'Điểm khởi hành';
  const origCoords = isValidExplicitCoords(origName, endpointCoords?.origin)
    ? { lat: Number(endpointCoords!.origin!.lat), lng: Number(endpointCoords!.origin!.lng) }
    : lookupCoordinates(origName);
  if (origCoords) {
    pointsMap.set(origName, origCoords);
  }

  // Thêm các điểm hoạt động có tọa độ xác thực (ưu tiên tọa độ gắn từ bản đồ/geocoding)
  for (const item of activityLocations) {
    const rawLoc = typeof item === 'string' ? item : item?.location || '';
    const trimmed = rawLoc.trim();
    if (trimmed && !pointsMap.has(trimmed)) {
      const explicit =
        typeof item === 'object' && item !== null && isValidExplicitCoords(trimmed, item.coordinates)
          ? { lat: Number(item.coordinates.lat), lng: Number(item.coordinates.lng) }
          : null;
      const coords = explicit || lookupCoordinates(trimmed);
      if (coords) {
        pointsMap.set(trimmed, coords);
        if (pointsMap.size >= 8) break; // Tối đa 8 điểm chính trên bản đồ
      }
    }
  }

  // Thêm điểm đến nếu chưa có và xác định được tọa độ
  const destName = destination.trim() || 'Điểm đến';
  if (!pointsMap.has(destName)) {
    const destCoords = isValidExplicitCoords(destName, endpointCoords?.destination)
      ? { lat: Number(endpointCoords!.destination!.lat), lng: Number(endpointCoords!.destination!.lng) }
      : lookupCoordinates(destName);
    if (destCoords) {
      pointsMap.set(destName, destCoords);
    }
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
  endpointCoords?: EndpointCoordinates,
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
  const originCoords = isValidExplicitCoords(cleanOrigin, endpointCoords?.origin)
    ? { lat: Number(endpointCoords!.origin!.lat), lng: Number(endpointCoords!.origin!.lng) }
    : lookupCoordinates(cleanOrigin);
  if (originCoords) {
    addPoint(cleanOrigin, originCoords, undefined, Boolean(endpointCoords?.origin));
  }

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
    const hasValidCoordinates = isValidExplicitCoords(name, { lat, lng });
    const resolvedCoords = hasValidCoordinates ? { lat, lng } : lookupCoordinates(name);
    if (!resolvedCoords) continue;

    const arrivalTime = typeof activity.timeStart === 'string' ? activity.timeStart : undefined;

    addPoint(
      name,
      resolvedCoords,
      arrivalTime,
      hasValidCoordinates,
    );
    if (points.size >= 49) break;
  }

  const destCoords = isValidExplicitCoords(cleanDestination, endpointCoords?.destination)
    ? { lat: Number(endpointCoords!.destination!.lat), lng: Number(endpointCoords!.destination!.lng) }
    : lookupCoordinates(cleanDestination);
  if (destCoords) {
    addPoint(cleanDestination, destCoords, undefined, Boolean(endpointCoords?.destination));
  }

  const entries = Array.from(points.values());
  if (entries.length === 0) {
    return [];
  }
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

