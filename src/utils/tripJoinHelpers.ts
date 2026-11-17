import type { GuestTripData, TripData, TripMember } from '../types/travel';

const JOIN_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const STAFF_ROLES: ReadonlySet<string> = new Set(['Trưởng đoàn', 'Hướng dẫn viên', 'Tài xế']);
export const MEMBER_ROLES = ['Khách du lịch', 'Khách VIP', 'Trưởng đoàn', 'Hướng dẫn viên', 'Tài xế'] as const;
export const MAX_GUEST_COMPANIONS_PER_PASSENGER = 10;

export function isStaffRole(role: string | undefined | null): boolean {
  return Boolean(role && STAFF_ROLES.has(role));
}

export function countPassengerMembers(members: readonly Pick<TripMember, 'role'>[] | undefined | null): number {
  if (!Array.isArray(members)) return 0;
  return members.filter((m) => !isStaffRole(m.role)).length;
}

export function normalizeJoinCode(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
}

export function isValidJoinCodeFormat(code: string): boolean {
  return /^[A-Z0-9]{5,12}$/.test(code);
}

export function generateTripJoinCode(length = 6): string {
  const safeLength = Math.max(5, Math.min(10, length));
  const randomValues = new Uint8Array(safeLength);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(randomValues);
  } else {
    for (let i = 0; i < safeLength; i += 1) {
      randomValues[i] = Math.floor(Math.random() * 256);
    }
  }

  let out = '';
  for (let i = 0; i < safeLength; i += 1) {
    out += JOIN_CODE_CHARS[randomValues[i] % JOIN_CODE_CHARS.length];
  }
  return out;
}

export function getMemberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
  }
  return (name.trim().slice(0, 2) || 'HK').toUpperCase();
}

export function isUserTripOwnerOrAdmin(
  trip: Partial<TripData> | null | undefined,
  userId?: string | null,
  role?: 'user' | 'admin' | unknown,
): boolean {
  if (!trip) return false;
  if (role === 'admin') return true;
  if (!userId) return false;
  // Chuyến cũ chưa có ownerId không cho user thường tự ý sở hữu ngoài chủ chuyến thật
  return Boolean(trip.ownerId && trip.ownerId === userId);
}

export function buildGuestInviteUrl(joinCode: string, origin?: string): string {
  const cleanCode = normalizeJoinCode(joinCode);
  const baseOrigin =
    origin ||
    (typeof window !== 'undefined' && window.location ? window.location.origin : '');
  if (!cleanCode) return baseOrigin;
  return `${baseOrigin}/?guestCode=${encodeURIComponent(cleanCode)}`;
}

/**
 * Loại bỏ toàn bộ dữ liệu tài chính nội bộ, hóa đơn, UID và số điện thoại cá nhân của hành khách
 * trước khi trả về cho giao diện Hành khách không có tài khoản.
 */
export function sanitizeTripForGuest(trip: TripData): GuestTripData {
  const safeMembers: GuestTripData['members'] = (trip.members || []).map((m: TripMember) => {
    const isStaff = isStaffRole(m.role);
    return {
      id: m.id,
      name: m.name,
      avatar: m.avatar || getMemberInitials(m.name),
      role: m.role,
      status: m.status,
      attendanceStatus: m.attendanceStatus,
      ...(m.specialPreference ? { specialPreference: m.specialPreference } : {}),
      ...(m.memberType ? { memberType: m.memberType } : {}),
      ...(m.invitedByName ? { invitedByName: m.invitedByName } : {}),
      phone: isStaff ? (m.phone || '') : '',
    };
  });

  const safeDays = (trip.days || []).map((day) => ({
    ...day,
    activities: (day.activities || []).map((act) => {
      const { cost: _cost, ...restAct } = act;
      return restAct;
    }),
  }));

  const computedPassengerCount =
    Array.isArray(trip.members) && trip.members.length > 0
      ? countPassengerMembers(trip.members)
      : (trip.telematics?.passengerCount ?? 0);

  return {
    id: trip.id,
    joinCode: trip.joinCode || '',
    code: trip.code,
    title: trip.title,
    status: trip.status,
    dates: trip.dates,
    origin: trip.origin,
    originFull: trip.originFull,
    destination: trip.destination,
    destinationFull: trip.destinationFull,
    destinationsCount: trip.destinationsCount,
    totalKm: trip.totalKm,
    vehicle: trip.vehicle,
    currentDay: trip.currentDay,
    totalDays: trip.totalDays,
    totalActivities: trip.totalActivities,
    confirmedActivities: trip.confirmedActivities,
    pendingActivities: trip.pendingActivities,
    membersTotal: safeMembers.length,
    membersStatus: trip.membersStatus,
    members: safeMembers,
    weather: trip.weather,
    telematics: {
      from: trip.telematics?.from || trip.originFull,
      to: trip.telematics?.to || trip.destinationFull,
      vehicleType: trip.telematics?.vehicleType || trip.vehicle,
      licensePlate: trip.telematics?.licensePlate,
      driver: trip.telematics?.driver || 'Chưa phân công',
      driverPhone: trip.telematics?.driverPhone || '',
      passengerCount: computedPassengerCount,
    },
    waypoints: (trip.waypoints || []).filter((wp) => !wp.isHidden),
    alerts: (trip.alerts || []).filter((a) => a.category !== 'budget' && !a.id.startsWith('alert-budget-')),
    days: safeDays,
  };
}

export function guestTripToReadOnlyTripData(guestTrip: GuestTripData): TripData {
  return {
    id: guestTrip.id,
    joinCode: guestTrip.joinCode,
    joinCodeEnabled: true,
    code: guestTrip.code,
    title: guestTrip.title,
    status: guestTrip.status,
    dates: guestTrip.dates,
    origin: guestTrip.origin,
    originFull: guestTrip.originFull,
    destination: guestTrip.destination,
    destinationFull: guestTrip.destinationFull,
    destinationsCount: guestTrip.destinationsCount,
    totalKm: guestTrip.totalKm,
    vehicle: guestTrip.vehicle,
    currentDay: guestTrip.currentDay,
    totalDays: guestTrip.totalDays,
    totalActivities: guestTrip.totalActivities,
    confirmedActivities: guestTrip.confirmedActivities,
    pendingActivities: guestTrip.pendingActivities,
    budgetTotal: 0,
    budgetUsed: 0,
    budgetRemaining: 0,
    budgetUsedPercent: 0,
    membersOnline: guestTrip.members.filter((m) => m.status === 'online').length,
    membersTotal: guestTrip.membersTotal,
    membersStatus: guestTrip.membersStatus,
    members: guestTrip.members,
    weather: guestTrip.weather,
    telematics: guestTrip.telematics,
    waypoints: guestTrip.waypoints,
    alerts: guestTrip.alerts,
    aiSuggestions: [],
    aiSavingsEstimate: '0 ₫',
    aiConfidence: '',
    days: guestTrip.days,
  };
}

/**
 * Loại bỏ toàn bộ dữ liệu ngân sách, hóa đơn, chi phí hoạt động, cảnh báo ngân sách,
 * gợi ý AI nội bộ, điểm ẩn và UID của thành viên khác trước khi trả về cho Hành khách (participant).
 * Giữ lại `uid` của chính viewer và `invitedByUid` của người thân do viewer đăng ký để UI/điểm danh hoạt động đúng.
 */
export function sanitizeTripForParticipant(trip: TripData, viewerUid?: string): TripData {
  const safeMembers: TripMember[] = (trip.members || []).map((m) => {
    const isSelf = Boolean(viewerUid && m.uid === viewerUid);
    const isInvitedByViewer = Boolean(viewerUid && m.invitedByUid === viewerUid);
    const { uid: _uid, invitedByUid: _invitedByUid, ...restMember } = m;
    return {
      ...restMember,
      ...(isSelf && m.uid ? { uid: m.uid } : {}),
      ...(isInvitedByViewer && m.invitedByUid ? { invitedByUid: m.invitedByUid } : {}),
    };
  });

  const safeDays = (trip.days || []).map((day) => ({
    ...day,
    activities: (day.activities || []).map((act) => {
      const { cost: _cost, ...restAct } = act;
      return restAct;
    }),
  }));

  const {
    invoices: _invoices,
    customCategoryAllocations: _allocations,
    participantUids: _participantUids,
    ...restTrip
  } = trip;

  return {
    ...restTrip,
    budgetTotal: 0,
    budgetUsed: 0,
    budgetRemaining: 0,
    budgetUsedPercent: 0,
    members: safeMembers,
    waypoints: (trip.waypoints || []).filter((wp) => !wp.isHidden),
    alerts: (trip.alerts || []).filter(
      (a) => a.category !== 'budget' && !a.id.startsWith('alert-budget-'),
    ),
    aiSuggestions: [],
    aiSavingsEstimate: '',
    aiConfidence: '',
    days: safeDays,
  };
}
