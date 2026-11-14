export interface FleetVehicleOption {
  id: string;
  type: string;
  capacity: string;
  status: string;
}

export interface LiveBusPosition {
  lat: number;
  lng: number;
  isLiveGps: boolean;
}

export type MapLayer = 'streets' | 'satellite';

export function getWeatherDescription(code: number): string {
  if (code === 0) return 'Trời quang, nắng đẹp';
  if (code === 1) return 'Ít mây, trời trong';
  if (code === 2) return 'Mây rải rác';
  if (code === 3) return 'Nhiều mây';
  if (code === 45 || code === 48) return 'Có sương mù nhẹ';
  if (code >= 51 && code <= 55) return 'Mưa phùn nhẹ';
  if (code >= 61 && code <= 65) return 'Mưa rào';
  if (code >= 80 && code <= 82) return 'Mưa rào rải rác';
  if (code >= 95) return 'Dông sét đèo Hải Vân';
  return 'Thời tiết ổn định';
}

export const escapeHtml = (value: unknown): string =>
  String(value ?? '').replace(/[&<>"']/g, (character) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[character],
  );

export const STATUS_LABEL: Record<string, string> = {
  completed: 'Hoàn tất',
  current: 'Đang diễn ra',
  pending: 'Chờ đến',
};
