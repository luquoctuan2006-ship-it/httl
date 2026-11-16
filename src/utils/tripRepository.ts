import { normalizeTripData } from '../data/normalizeTripData';
import type { TripData } from '../types/travel';
import { computeTripBudgetSummaryFields } from './budgetAlerts';
import { countPassengerMembers } from './tripJoinHelpers';

export const MAX_TRIP_DOC_BYTES = 900 * 1024; // 900 KiB — an toàn dưới giới hạn 1 MiB của Firestore

export interface AuthTokenUser {
  uid: string;
  role?: unknown;
}

export interface FirestoreDocSnapshotLike {
  exists: boolean;
  data(): unknown;
}

export interface FirestoreDocRefLike {
  id: string;
}

export interface FirestoreTransactionLike {
  get(docRef: FirestoreDocRefLike): Promise<FirestoreDocSnapshotLike>;
  set(docRef: FirestoreDocRefLike, data: Record<string, unknown>): void;
}

export interface FirestoreDbLike {
  collection(name: string): {
    doc(id: string): FirestoreDocRefLike;
  };
  runTransaction<T>(updateFunction: (transaction: FirestoreTransactionLike) => Promise<T>): Promise<T>;
}

export function isAdminUser(user?: AuthTokenUser) {
  return user?.role === 'admin';
}

export function isTripOwnerOrAdmin(
  trip: Partial<TripData> | null | undefined,
  user?: AuthTokenUser,
) {
  if (!trip || !user) return false;
  return isAdminUser(user) || (!!trip.ownerId && trip.ownerId === user.uid);
}

// Chủ chuyến, admin hoặc hành khách đã tham gia bằng mã mới được xem chuyến đi.
// Chuyến cũ chưa có ownerId chỉ admin thấy (xem scripts/assign-trip-owner.ts để gán chủ).
export function canAccessTrip(
  trip: Partial<TripData> | null | undefined,
  user?: AuthTokenUser,
) {
  if (!trip || !user) return false;
  if (isTripOwnerOrAdmin(trip, user)) return true;
  return Array.isArray(trip.participantUids) && trip.participantUids.includes(user.uid);
}

/**
 * Tính lại toàn bộ các trường dẫn xuất phía máy chủ từ dữ liệu nguồn (days, activities, invoices, members)
 * để không tin vào con số tổng hợp do client gửi lên.
 */
export function computeAuthoritativeTripDerivedFields(trip: TripData): TripData {
  const days = (trip.days || []).map((day) => {
    const acts = day.activities || [];
    const confirmedCount = acts.filter((a) => a.status === 'Hoàn tất' || a.status === 'Đã xác nhận').length;
    const pendingCount = acts.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra' || a.status === 'Chờ duyệt').length;
    return {
      ...day,
      confirmedCount,
      pendingCount,
    };
  });

  const allActivities = days.flatMap((d) => d.activities);
  const totalActivities = allActivities.length;
  const confirmedActivities = allActivities.filter((a) => a.status === 'Hoàn tất' || a.status === 'Đã xác nhận').length;
  const pendingActivities = allActivities.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra' || a.status === 'Chờ duyệt').length;

  const members = trip.members || [];
  const membersTotal = members.length;
  const membersOnline = members.filter((m) => m.status === 'online').length;
  const presentCount = members.filter((m) => m.attendanceStatus === 'Có mặt').length;
  const membersStatus = membersTotal > 0 ? `${presentCount}/${membersTotal} đã điểm danh` : 'Chưa có thành viên';
  const passengerCount = countPassengerMembers(members);

  const budgetFields = computeTripBudgetSummaryFields({ ...trip, days });

  return {
    ...trip,
    days,
    totalDays: days.length > 0 ? days.length : Math.max(1, trip.totalDays || 1),
    totalActivities,
    confirmedActivities,
    pendingActivities,
    membersTotal,
    membersOnline,
    membersStatus,
    telematics: {
      ...trip.telematics,
      passengerCount,
    },
    ...budgetFields,
  };
}

export function estimateTripByteSize(data: Record<string, unknown>): number {
  return Buffer.byteLength(JSON.stringify(data), 'utf8');
}

export function getTripComparableJson(t: TripData | null | undefined): string {
  if (!t) return '';
  const normalized = normalizeTripData(t);
  const { version: _version, ...content } = normalized;
  return JSON.stringify(content);
}

export type UpsertTripResult =
  | { status: 'ok'; version: number; trip: TripData }
  | { status: 'forbidden' }
  | { status: 'conflict'; currentVersion: number }
  | { status: 'too_large'; byteSize: number };

/**
 * Tạo mới hoặc cập nhật chuyến đi trong Firestore transaction.
 * - `ownerId` luôn do server quyết định, không tin dữ liệu client gửi.
 * - Mọi trường dẫn xuất (`budgetUsed`, `membersTotal`, `telematics.passengerCount`, ...) được server tự tính lại.
 * - Áp dụng optimistic concurrency control chặt chẽ:
 *   nếu document đã có `version`, client BẮT BUỘC phải gửi `version >= existing.version`.
 */
export async function upsertTripForUser(
  db: FirestoreDbLike,
  input: TripData,
  user: AuthTokenUser,
  createUpdatedAt: () => unknown,
): Promise<UpsertTripResult> {
  const authoritativeInput = computeAuthoritativeTripDerivedFields(normalizeTripData(input));
  const docRef = db.collection('trips').doc(authoritativeInput.id);

  return await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(docRef);
    const existing = snap.exists ? normalizeTripData(snap.data()) : null;

    if (existing && !isTripOwnerOrAdmin(existing, user)) {
      return { status: 'forbidden' };
    }

    if (existing && typeof existing.version === 'number') {
      if (
        typeof authoritativeInput.version !== 'number' ||
        !Number.isInteger(authoritativeInput.version) ||
        authoritativeInput.version < existing.version
      ) {
        return { status: 'conflict', currentVersion: existing.version };
      }
    }

    const nextVersion = existing ? (existing.version || 0) + 1 : 1;
    const ownerId = existing ? existing.ownerId : user.uid;

    // Giữ nguyên danh sách participantUids đã được xác thực ở server;
    // nếu chủ chuyến xóa thành viên có gắn uid khỏi đoàn thì thu hồi quyền tham gia
    // và dọn sạch các người thân không tài khoản đi cùng thành viên đó để không tạo bản ghi mồ côi.
    const existingParticipantUids = existing?.participantUids || [];
    const remainingAccountUids = new Set(
      authoritativeInput.members
        .map((m) => m.uid)
        .filter((u): u is string => typeof u === 'string' && u.length > 0),
    );
    const hasLinkedMemberChanges = existing
      ? existing.members.some((m) => Boolean(m.uid) && !remainingAccountUids.has(m.uid!))
      : false;
    const participantUids = existing
      ? (hasLinkedMemberChanges
          ? existingParticipantUids.filter((u) => remainingAccountUids.has(u))
          : existingParticipantUids)
      : [];

    const activeInviterUids = new Set<string>([
      ...(ownerId ? [ownerId] : []),
      ...participantUids,
      ...Array.from(remainingAccountUids),
    ]);
    const cleanedMembers = authoritativeInput.members.filter(
      (m) => !(m.memberType === 'guest' && m.invitedByUid && !activeInviterUids.has(m.invitedByUid)),
    );
    const finalAuthoritative =
      cleanedMembers.length !== authoritativeInput.members.length
        ? computeAuthoritativeTripDerivedFields({
            ...authoritativeInput,
            members: cleanedMembers,
          })
        : authoritativeInput;

    const savedTrip: TripData = {
      ...finalAuthoritative,
      ownerId,
      ...(participantUids.length > 0 ? { participantUids } : {}),
      version: nextVersion,
    };
    if (participantUids.length === 0) {
      delete savedTrip.participantUids;
    }

    const byteSize = estimateTripByteSize(savedTrip as unknown as Record<string, unknown>);
    if (byteSize > MAX_TRIP_DOC_BYTES) {
      return { status: 'too_large', byteSize };
    }

    const tripToSave: Record<string, unknown> = {
      ...savedTrip,
      updatedAt: createUpdatedAt(),
    };
    transaction.set(docRef, tripToSave);
    return { status: 'ok', version: nextVersion, trip: savedTrip };
  });
}
