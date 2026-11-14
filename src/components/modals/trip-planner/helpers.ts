import type { TripMember } from '../../../types/travel';

export function parseGroupSize(groupType: string): number {
  const match =
    groupType.match(/(\d{1,3})\s*(?:người|khách|pax|thành viên)/i) ||
    groupType.match(/(\d{1,3})/);
  const count = match ? parseInt(match[1], 10) : 10;
  return Math.min(Math.max(Number.isFinite(count) ? count : 10, 1), 100);
}

export function buildMembers(count: number): TripMember[] {
  const stamp = Date.now();
  return Array.from({ length: count }, (_, index) => ({
    id: `member-${stamp}-${index + 1}`,
    name: `Thành viên ${index + 1}`,
    avatar: String((index % 10) + 1),
    role: index === 0 ? 'Trưởng đoàn' : 'Khách du lịch',
    phone: '',
    status: 'offline' as const,
    attendanceStatus: 'Chưa điểm danh' as const,
  }));
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
