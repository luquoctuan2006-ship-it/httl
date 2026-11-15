import type { Express, Request, RequestHandler, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { createTripSyncRouter } from './trips';
import { normalizeTripData } from '../../data/normalizeTripData';
import type { TripData, TripMember } from '../../types/travel';
import {
  canAccessTrip,
  computeAuthoritativeTripDerivedFields,
  estimateTripByteSize,
  isTripOwnerOrAdmin,
  MAX_TRIP_DOC_BYTES,
} from '../../utils/tripRepository';
import {
  generateTripJoinCode,
  getMemberInitials,
  isValidJoinCodeFormat,
  normalizeJoinCode,
} from '../../utils/tripJoinHelpers';
import { detectScheduleAndWeatherAlerts } from '../../utils/alertDetector';
import { buildRouteProgress } from '../../utils/routeProgress';
import {
  buildBatchOpenMeteoUrl,
  buildTripWeatherFromOpenMeteo,
  type RouteWeatherTarget,
} from '../../utils/weatherParser';

type AuthenticatedRequest = Request & { authUser?: DecodedIdToken };

interface TripManagementRouteDependencies {
  requireAuth: RequestHandler;
  joinRateLimiter?: RequestHandler;
  requireFirestore: () => Firestore;
  listTripsForUser: (
    user: DecodedIdToken,
    options?: { limit?: number; startAfterId?: string; summaryOnly?: boolean },
  ) => Promise<{ trips: TripData[]; hasMore: boolean; nextCursor: string | null }>;
  loadUserTrips: (user: DecodedIdToken) => Promise<TripData[]>;
  getTripById: (tripId: string) => Promise<TripData | null>;
  findTripByJoinCode?: (joinCode: string) => Promise<TripData | null>;
  generateUniqueJoinCode?: () => Promise<string>;
  createTripDoc: (trip: TripData) => Promise<void>;
  deleteTripDoc: (tripId: string) => Promise<void>;
  recordAuditLog: (user: string, action: string) => Promise<void>;
}

const TRIP_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

function isConflictError(error: unknown) {
  const code = (error as { code?: unknown })?.code;
  return code === 6 || code === 'already-exists';
}

export function registerTripManagementRoutes(app: Express, dependencies: TripManagementRouteDependencies) {
  const {
    requireAuth,
    joinRateLimiter,
    requireFirestore,
    listTripsForUser,
    loadUserTrips,
    getTripById,
    findTripByJoinCode,
    generateUniqueJoinCode,
    createTripDoc,
    deleteTripDoc,
    recordAuditLog,
  } = dependencies;

  const passThrough: RequestHandler = (_req, _res, next) => next();
  const joinLimiter = joinRateLimiter || passThrough;

  async function resolveTripByJoinCode(rawCode: string): Promise<TripData | null> {
    if (findTripByJoinCode) {
      return findTripByJoinCode(rawCode);
    }
    const code = normalizeJoinCode(rawCode);
    if (!isValidJoinCodeFormat(code)) return null;
    const db = requireFirestore();
    const snap = await db.collection('trips').where('joinCode', '==', code).limit(5).get();
    if (snap.empty) return null;
    const candidates = snap.docs.filter((d) => d.id !== 'active').map((d) => normalizeTripData(d.data()));
    return candidates.find((t) => t.joinCodeEnabled !== false) || candidates[0] || null;
  }

  async function allocateJoinCode(): Promise<string> {
    if (generateUniqueJoinCode) {
      return generateUniqueJoinCode();
    }
    return generateTripJoinCode(6);
  }

  app.get('/api/trips', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const rawLimit = Number(req.query.limit);
      const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;
      const startAfterId = typeof req.query.startAfter === 'string' && TRIP_ID_PATTERN.test(req.query.startAfter)
        ? req.query.startAfter
        : undefined;
      const isSummaryMode = req.query.mode === 'summary';

      if (isSummaryMode) {
        const { trips: summaryTrips, hasMore, nextCursor } = await listTripsForUser(req.authUser!, {
          limit,
          startAfterId,
          summaryOnly: true,
        });
        const firstId = summaryTrips[0]?.id;
        const activeTrip = firstId ? await getTripById(firstId) : null;
        const trips = activeTrip
          ? summaryTrips.map((item) => (item.id === activeTrip.id ? activeTrip : item))
          : summaryTrips;
        return res.json({ success: true, activeTrip: activeTrip || trips[0] || null, trips, hasMore, nextCursor });
      }

      const { trips, hasMore, nextCursor } = await listTripsForUser(req.authUser!, { limit, startAfterId });
      return res.json({ success: true, activeTrip: trips[0] || null, trips, hasMore, nextCursor });
    } catch (error) {
      console.error('Error loading trips:', error);
      return res.status(503).json({ success: false, error: 'Không thể tải danh sách chuyến đi' });
    }
  });
  
  // Giữ route cũ cho tương thích: "active" nay là chuyến cập nhật gần nhất CỦA CHÍNH USER ĐÓ
  const getActiveTripHandler = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const trips = await loadUserTrips(req.authUser!);
      return res.json({ success: true, trip: trips[0] || null });
    } catch (error) {
      console.error('Error loading active trip:', error);
      return res.status(503).json({ success: false, error: 'Không thể tải chuyến đi' });
    }
  };
  app.get('/api/trips/active', requireAuth, getActiveTripHandler);
  
  app.use('/api/trips', createTripSyncRouter({
    requireAuth,
    getFirestore: requireFirestore,
    cleanupOrphanReceiptsForTrip,
  }));
  
  app.post('/api/trips', requireAuth, async (req: AuthenticatedRequest, res) => {
    const body = normalizeTripData(req.body);
    if (typeof body.id !== 'string' || body.id === 'active' || !TRIP_ID_PATTERN.test(body.id) || !Array.isArray(body.days)) {
      return res.status(400).json({ success: false, error: 'Dữ liệu chuyến đi không hợp lệ' });
    }
  
    // Luôn tự tính các trường dẫn xuất phía server, cấp mã mời và ép version = 1 khi tạo mới
    const joinCode = body.joinCode && isValidJoinCodeFormat(body.joinCode)
      ? body.joinCode
      : await allocateJoinCode();
    const authoritative = computeAuthoritativeTripDerivedFields({
      ...body,
      joinCode,
      joinCodeEnabled: body.joinCodeEnabled !== false,
      participantUids: [],
    });
    const trip: TripData = {
      ...authoritative,
      ownerId: req.authUser!.uid,
      joinCode,
      joinCodeEnabled: body.joinCodeEnabled !== false,
      version: 1,
    };
    delete trip.participantUids;
  
    if (estimateTripByteSize(trip as unknown as Record<string, unknown>) > MAX_TRIP_DOC_BYTES) {
      return res.status(413).json({
        success: false,
        error: 'Dung lượng chuyến đi mới vượt giới hạn 900KB cho một tài liệu Firestore.',
      });
    }
  
    try {
      await createTripDoc(trip);
      return res.status(201).json({ success: true, trip });
    } catch (error: unknown) {
      if (isConflictError(error)) {
        return res.status(409).json({ success: false, error: 'Mã chuyến đi đã tồn tại, vui lòng tạo lại' });
      }
      console.error('Error creating trip:', error);
      return res.status(503).json({ success: false, error: 'Không thể lưu chuyến đi mới' });
    }
  });

  // Tham gia chuyến đi bằng mã mời (User B có tài khoản tham gia với tư cách Hành khách - HK)
  app.post('/api/trips/join', requireAuth, joinLimiter, async (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const body = (req.body || {}) as {
      joinCode?: unknown;
      phone?: unknown;
      specialPreference?: unknown;
      displayName?: unknown;
    };
    const joinCode = normalizeJoinCode(body.joinCode);
    if (!isValidJoinCodeFormat(joinCode)) {
      return res.status(400).json({
        success: false,
        error: 'Mã tham gia chuyến đi không hợp lệ (cần 5–12 ký tự chữ/số).',
      });
    }

    try {
      const matched = await resolveTripByJoinCode(joinCode);
      if (!matched) {
        return res.status(404).json({
          success: false,
          error: 'Không tìm thấy chuyến đi khớp với mã này.',
        });
      }
      if (matched.joinCodeEnabled === false) {
        return res.status(403).json({
          success: false,
          error: 'Chủ chuyến đi đã tạm khóa tính năng tham gia bằng mã cho chuyến này.',
        });
      }

      if (matched.ownerId === user.uid) {
        return res.json({
          success: true,
          trip: matched,
          alreadyOwner: true,
          alreadyJoined: true,
          message: 'Bạn đang là chủ sở hữu chuyến đi này.',
        });
      }

      const db = requireFirestore();
      const tripRef = db.collection('trips').doc(matched.id);
      const userNameRaw =
        typeof body.displayName === 'string' && body.displayName.trim()
          ? body.displayName.trim()
          : (typeof user.name === 'string' && user.name.trim()
              ? user.name.trim()
              : user.email?.split('@')[0] || 'Hành khách');
      const cleanName = userNameRaw.slice(0, 120);
      const cleanPhone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 30) : '';
      const cleanPref =
        typeof body.specialPreference === 'string' && body.specialPreference.trim()
          ? body.specialPreference.trim().slice(0, 200)
          : undefined;

      const txResult = await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(tripRef);
        if (!snap.exists) return { kind: 'not_found' as const };
        const latest = normalizeTripData(snap.data());
        if (latest.joinCode !== joinCode) return { kind: 'code_mismatch' as const };
        if (latest.joinCodeEnabled === false) return { kind: 'disabled' as const };
        if (latest.ownerId === user.uid) {
          return { kind: 'owner' as const, trip: latest };
        }

        const existingParticipants = Array.isArray(latest.participantUids) ? latest.participantUids : [];
        const alreadyInParticipants = existingParticipants.includes(user.uid);
        if (!alreadyInParticipants && existingParticipants.length >= 100) {
          return { kind: 'full' as const };
        }

        const nextParticipantUids = alreadyInParticipants
          ? existingParticipants
          : [...existingParticipants, user.uid];

        const existingMembers = Array.isArray(latest.members) ? latest.members : [];
        const linkedIdx = existingMembers.findIndex((m) => m.uid === user.uid);
        let nextMembers: TripMember[];
        if (linkedIdx >= 0) {
          nextMembers = existingMembers.map((m, idx) =>
            idx === linkedIdx
              ? {
                  ...m,
                  name: cleanName || m.name,
                  avatar: getMemberInitials(cleanName || m.name),
                  ...(cleanPhone ? { phone: cleanPhone } : {}),
                  ...(cleanPref ? { specialPreference: cleanPref } : {}),
                  memberType: 'account' as const,
                }
              : m,
          );
        } else {
          if (existingMembers.length >= 100) {
            return { kind: 'full' as const };
          }
          const newMember: TripMember = {
            id: `member-uid-${user.uid.slice(0, 16)}-${Date.now().toString(36)}`,
            name: cleanName,
            avatar: getMemberInitials(cleanName),
            role: 'Khách du lịch',
            phone: cleanPhone,
            status: 'online',
            attendanceStatus: 'Có mặt',
            ...(cleanPref ? { specialPreference: cleanPref } : {}),
            uid: user.uid,
            memberType: 'account',
          };
          nextMembers = [...existingMembers, newMember];
        }

        const authoritative = computeAuthoritativeTripDerivedFields({
          ...latest,
          participantUids: nextParticipantUids,
          members: nextMembers,
        });
        const nextVersion = (latest.version || 0) + 1;
        const updatedTrip: TripData = {
          ...authoritative,
          ownerId: latest.ownerId,
          participantUids: nextParticipantUids,
          version: nextVersion,
        };

        if (estimateTripByteSize(updatedTrip as unknown as Record<string, unknown>) > MAX_TRIP_DOC_BYTES) {
          return { kind: 'too_large' as const };
        }

        transaction.update(tripRef, {
          participantUids: nextParticipantUids,
          members: updatedTrip.members,
          membersTotal: updatedTrip.membersTotal,
          membersOnline: updatedTrip.membersOnline,
          membersStatus: updatedTrip.membersStatus,
          version: nextVersion,
          updatedAt: FieldValue.serverTimestamp(),
        });

        return {
          kind: 'ok' as const,
          trip: updatedTrip,
          alreadyJoined: alreadyInParticipants,
        };
      });

      if (txResult.kind === 'not_found' || txResult.kind === 'code_mismatch') {
        return res.status(404).json({ success: false, error: 'Mã tham gia không khớp hoặc chuyến đi đã thay đổi mã.' });
      }
      if (txResult.kind === 'disabled') {
        return res.status(403).json({ success: false, error: 'Chủ chuyến đi đã tạm khóa mã tham gia.' });
      }
      if (txResult.kind === 'full') {
        return res.status(400).json({ success: false, error: 'Đoàn đã đạt giới hạn tối đa 100 thành viên.' });
      }
      if (txResult.kind === 'too_large') {
        return res.status(413).json({ success: false, error: 'Dung lượng dữ liệu chuyến đi đã đạt giới hạn.' });
      }
      if (txResult.kind === 'owner') {
        return res.json({
          success: true,
          trip: txResult.trip,
          alreadyOwner: true,
          alreadyJoined: true,
          message: 'Bạn đang là chủ sở hữu chuyến đi này.',
        });
      }

      recordAuditLog(
        user.email || user.uid,
        `Tham gia chuyến đi "${txResult.trip.title}" (${txResult.trip.code}) với tư cách Hành khách bằng mã ${joinCode}`,
      );

      return res.json({
        success: true,
        trip: txResult.trip,
        alreadyJoined: txResult.alreadyJoined,
        message: txResult.alreadyJoined
          ? `Bạn đã ở trong chuyến đi "${txResult.trip.title}".`
          : `Đã tham gia chuyến đi "${txResult.trip.title}" với tư cách Hành khách (HK)!`,
      });
    } catch (error) {
      console.error('Error joining trip by code:', error);
      return res.status(503).json({ success: false, error: 'Không thể tham gia chuyến đi bằng mã lúc này.' });
    }
  });
  
  app.get('/api/trips/:tripId', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const trip = await getTripById(req.params.tripId);
      if (!trip || !canAccessTrip(trip, req.authUser)) {
        return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
      }
      return res.json({ success: true, trip });
    } catch {
      return res.status(503).json({ success: false, error: 'Không thể tải chuyến đi' });
    }
  });
  
  // Xóa chuyến đi: Chỉ chủ sở hữu (ownerId) hoặc Admin mới được xóa
  app.delete('/api/trips/:tripId', requireAuth, async (req: AuthenticatedRequest, res) => {
    const tripId = req.params.tripId;
    if (!tripId || tripId === 'active' || !TRIP_ID_PATTERN.test(tripId)) {
      return res.status(400).json({ success: false, error: 'Mã chuyến đi không hợp lệ' });
    }
  
    try {
      const existing = await getTripById(tripId);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
      }
  
      if (!isTripOwnerOrAdmin(existing, req.authUser)) {
        return res.status(403).json({ success: false, error: 'Chỉ chủ chuyến đi mới có quyền xóa chuyến đi này' });
      }
  
      await deleteTripDoc(tripId);
      recordAuditLog(
        req.authUser?.email || 'User',
        `Xóa chuyến đi: ${existing.title} (${existing.code})`
      );
  
      const remainingTrips = await loadUserTrips(req.authUser!);
      return res.json({
        success: true,
        message: `Đã xóa chuyến đi ${existing.title} thành công`,
        deletedTripId: tripId,
        remainingCount: remainingTrips.length,
        activeTrip: remainingTrips[0] || null,
        trips: remainingTrips,
      });
    } catch (error) {
      console.error('Error deleting trip:', error);
      return res.status(503).json({ success: false, error: 'Không thể xóa chuyến đi' });
    }
  });
  
  // Tải lên và đọc ảnh chứng từ hóa đơn tách khỏi document chuyến đi (tránh chạm trần 1 MiB)
  app.post('/api/trips/:tripId/receipts', requireAuth, async (req: AuthenticatedRequest, res) => {
    const tripId = req.params.tripId;
    if (!tripId || tripId === 'active' || !TRIP_ID_PATTERN.test(tripId)) {
      return res.status(400).json({ success: false, error: 'Mã chuyến đi không hợp lệ' });
    }
  
    const dataUrl = req.body?.dataUrl;
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/') || dataUrl.length > 260_000) {
      return res.status(400).json({
        success: false,
        error: 'Ảnh chứng từ không hợp lệ hoặc vượt quá giới hạn 260KB mỗi ảnh.',
      });
    }
  
    try {
      const existing = await getTripById(tripId);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
      }
      if (!isTripOwnerOrAdmin(existing, req.authUser)) {
        return res.status(403).json({ success: false, error: 'Bạn không có quyền tải ảnh lên chuyến đi này' });
      }
  
      const db = requireFirestore();
      const receiptId = `rcpt-${Date.now()}-${randomUUID().slice(0, 8)}`;
      await db.collection('trip_receipts').doc(receiptId).set({
        id: receiptId,
        tripId: existing.id,
        ownerId: existing.ownerId || req.authUser!.uid,
        dataUrl,
        createdAt: FieldValue.serverTimestamp(),
      });
  
      return res.status(201).json({ success: true, receiptId });
    } catch (error) {
      console.error('Error uploading receipt image:', error);
      return res.status(503).json({ success: false, error: 'Không thể lưu ảnh chứng từ lên máy chủ' });
    }
  });
  
  app.get('/api/trips/:tripId/receipts/:receiptId', requireAuth, async (req: AuthenticatedRequest, res) => {
    const { tripId, receiptId } = req.params;
    if (!tripId || !TRIP_ID_PATTERN.test(tripId) || !receiptId || !/^[a-zA-Z0-9_-]{4,128}$/.test(receiptId)) {
      return res.status(400).json({ success: false, error: 'Tham số chứng từ không hợp lệ' });
    }
  
    try {
      const existing = await getTripById(tripId);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
      }
      if (!isTripOwnerOrAdmin(existing, req.authUser)) {
        return res.status(403).json({ success: false, error: 'Không có quyền xem chứng từ chuyến đi này' });
      }
  
      const db = requireFirestore();
      const snap = await db.collection('trip_receipts').doc(receiptId).get();
      if (!snap.exists) {
        return res.status(404).json({ success: false, error: 'Không tìm thấy ảnh chứng từ' });
      }
      const data = snap.data() as Record<string, unknown> | undefined;
      if (!data || data.tripId !== existing.id || typeof data.dataUrl !== 'string') {
        return res.status(404).json({ success: false, error: 'Ảnh chứng từ không thuộc chuyến đi này' });
      }
  
      return res.json({ success: true, receiptId, dataUrl: data.dataUrl });
    } catch (error) {
      console.error('Error fetching receipt image:', error);
      return res.status(503).json({ success: false, error: 'Không thể tải ảnh chứng từ' });
    }
  });
  
  async function cleanupOrphanReceiptsForTrip(db: Firestore, savedTrip: TripData): Promise<void> {
    const activeIds = new Set(
      (savedTrip.invoices || [])
        .map((inv) => inv.receiptId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    );
    const snap = await db.collection('trip_receipts').where('tripId', '==', savedTrip.id).get();
    if (snap.empty) return;
    const cutoffMs = Date.now() - 2 * 60 * 1000;
    const orphans = snap.docs.filter((docSnap) => {
      if (activeIds.has(docSnap.id)) return false;
      const data = docSnap.data() as { createdAt?: { toMillis?: () => number } } | undefined;
      const createdMs = typeof data?.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : 0;
      return createdMs > 0 && createdMs < cutoffMs;
    });
    if (orphans.length === 0) return;
    for (let i = 0; i < orphans.length; i += 400) {
      const batch = db.batch();
      orphans.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
  
  app.delete('/api/trips/:tripId/receipts/:receiptId', requireAuth, async (req: AuthenticatedRequest, res) => {
    const { tripId, receiptId } = req.params;
    if (!tripId || !TRIP_ID_PATTERN.test(tripId) || !receiptId || !/^[a-zA-Z0-9_-]{4,128}$/.test(receiptId)) {
      return res.status(400).json({ success: false, error: 'Tham số chứng từ không hợp lệ' });
    }
  
    try {
      const existing = await getTripById(tripId);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
      }
      if (!isTripOwnerOrAdmin(existing, req.authUser)) {
        return res.status(403).json({ success: false, error: 'Bạn không có quyền xóa chứng từ chuyến đi này' });
      }
  
      const db = requireFirestore();
      const docRef = db.collection('trip_receipts').doc(receiptId);
      const snap = await docRef.get();
      if (!snap.exists) {
        return res.json({ success: true, deleted: false });
      }
      const data = snap.data() as Record<string, unknown> | undefined;
      if (!data || data.tripId !== existing.id) {
        return res.status(404).json({ success: false, error: 'Ảnh chứng từ không thuộc chuyến đi này' });
      }
      await docRef.delete();
      return res.json({ success: true, deleted: true, receiptId });
    } catch (error) {
      console.error('Error deleting receipt image:', error);
      return res.status(503).json({ success: false, error: 'Không thể xóa ảnh chứng từ' });
    }
  });
  
  // Chỉnh sửa thông tin cơ bản của chuyến đi (chạy trong transaction, kiểm soát version và tự tính trường dẫn xuất)
  app.patch('/api/trips/:tripId', requireAuth, async (req: AuthenticatedRequest, res) => {
    const tripId = req.params.tripId;
    if (!tripId || tripId === 'active' || !TRIP_ID_PATTERN.test(tripId)) {
      return res.status(400).json({ success: false, error: 'Mã chuyến đi không hợp lệ' });
    }
  
    try {
      const db = requireFirestore();
      const tripRef = db.collection('trips').doc(tripId);
      const body = req.body || {};
  
      const txResult = await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(tripRef);
        if (!snap.exists) return { kind: 'not_found' as const };
  
        const existing = normalizeTripData(snap.data());
        if (!isTripOwnerOrAdmin(existing, req.authUser)) {
          return { kind: 'forbidden' as const };
        }
  
        if (typeof existing.version === 'number') {
          if (typeof body.version !== 'number' || !Number.isInteger(body.version) || body.version < existing.version) {
            return { kind: 'conflict' as const, currentVersion: existing.version };
          }
        }
  
        const candidate: TripData = { ...existing };
        if (typeof body.title === 'string' && body.title.trim()) candidate.title = body.title.trim().slice(0, 200);
        if (typeof body.code === 'string' && body.code.trim()) candidate.code = body.code.trim().toUpperCase().slice(0, 50);
        if (typeof body.dates === 'string' && body.dates.trim()) candidate.dates = body.dates.trim().slice(0, 100);
        if (typeof body.originFull === 'string' && body.originFull.trim()) candidate.originFull = body.originFull.trim().slice(0, 150);
        if (typeof body.destinationFull === 'string' && body.destinationFull.trim()) candidate.destinationFull = body.destinationFull.trim().slice(0, 150);
        if (typeof body.budgetTotal === 'number' && Number.isFinite(body.budgetTotal) && body.budgetTotal > 0) {
          candidate.budgetTotal = body.budgetTotal;
        }
        if (typeof body.vehicle === 'string' && body.vehicle.trim()) candidate.vehicle = body.vehicle.trim().slice(0, 100);
  
        const VALID_TRIP_STATUSES: TripData['status'][] = ['Chuẩn bị', 'Đang vận hành', 'Hoàn thành'];
        if (typeof body.status === 'string' && VALID_TRIP_STATUSES.includes(body.status as TripData['status'])) {
          candidate.status = body.status as TripData['status'];
        }
        if (body.telematics && typeof body.telematics === 'object') {
          candidate.telematics = { ...existing.telematics, ...body.telematics };
        }
  
        const normalized = computeAuthoritativeTripDerivedFields(normalizeTripData(candidate));
        const nextVersion = (existing.version || 0) + 1;
        const updatedTrip: TripData = {
          ...normalized,
          ownerId: existing.ownerId,
          version: nextVersion,
        };
  
        if (estimateTripByteSize(updatedTrip as unknown as Record<string, unknown>) > MAX_TRIP_DOC_BYTES) {
          return { kind: 'too_large' as const };
        }
  
        transaction.set(tripRef, {
          ...updatedTrip,
          updatedAt: FieldValue.serverTimestamp(),
        });
  
        return { kind: 'ok' as const, trip: updatedTrip };
      });
  
      if (txResult.kind === 'not_found') {
        return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
      }
      if (txResult.kind === 'forbidden') {
        return res.status(403).json({ success: false, error: 'Bạn không có quyền chỉnh sửa chuyến đi này' });
      }
      if (txResult.kind === 'conflict') {
        return res.status(409).json({
          success: false,
          error: 'Dữ liệu chuyến đi đã thay đổi ở phiên khác hoặc thiếu version hợp lệ.',
          currentVersion: txResult.currentVersion,
        });
      }
      if (txResult.kind === 'too_large') {
        return res.status(413).json({ success: false, error: 'Dung lượng dữ liệu chuyến đi vượt giới hạn 900KB.' });
      }
  
      recordAuditLog(
        req.authUser?.email || 'User',
        `Cập nhật thông tin chuyến đi: ${txResult.trip.title} (${txResult.trip.code})`
      );
  
      return res.json({ success: true, trip: txResult.trip, version: txResult.trip.version });
    } catch (error) {
      console.error('Error updating trip info:', error);
      return res.status(503).json({ success: false, error: 'Không thể cập nhật chuyến đi' });
    }
  });
  
  function collectRouteWeatherTargets(trip: TripData): RouteWeatherTarget[] {
    const progress = buildRouteProgress(trip, 'all');
    const locatedStops = progress.stops.filter(
      (s): s is typeof s & { lat: number; lng: number } =>
        s.hasCoordinates && s.lat !== null && s.lng !== null,
    );
    // Prioritize current/upcoming stops first so primary summary reflects current route segment, plus other stops
    const currentIndex = progress.currentStop
      ? locatedStops.findIndex((s) => s.id === progress.currentStop?.id && s.order === progress.currentStop?.order)
      : 0;
    const orderedStops =
      currentIndex > 0
        ? [...locatedStops.slice(currentIndex), ...locatedStops.slice(0, currentIndex)]
        : locatedStops;

    const seenCoords = new Set<string>();
    const targets: RouteWeatherTarget[] = [];
    for (const stop of orderedStops) {
      const key = `${stop.lat.toFixed(3)},${stop.lng.toFixed(3)}`;
      if (seenCoords.has(key)) continue;
      seenCoords.add(key);
      targets.push({
        stopId: stop.id,
        stopName: stop.name,
        lat: stop.lat,
        lng: stop.lng,
      });
      if (targets.length >= 10) break;
    }
    return targets;
  }

  async function fetchRealtimeWeatherAlongRoute(trip: TripData): Promise<TripData['weather'] | null> {
    const targets = collectRouteWeatherTargets(trip);
    if (targets.length === 0) return null;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      const url = buildBatchOpenMeteoUrl(targets);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return null;
      const payload = (await res.json()) as unknown;
      return buildTripWeatherFromOpenMeteo(payload, targets);
    } catch (err) {
      console.warn('[Weather API] Không thể lấy thời tiết trực tuyến dọc tuyến:', err);
      return null;
    }
  }

  // Tự động quét và phát hiện cảnh báo vận hành & thời tiết thực tế cho chuyến đi (atomic transaction + version)
  app.post('/api/trips/:tripId/scan-alerts', requireAuth, async (req: AuthenticatedRequest, res) => {
    const tripId = req.params.tripId;
    try {
      const existing = tripId === 'active'
        ? (await loadUserTrips(req.authUser!))[0]
        : await getTripById(tripId);

      if (!existing) {
        return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
      }

      if (!isTripOwnerOrAdmin(existing, req.authUser)) {
        return res.status(403).json({ success: false, error: 'Chỉ chủ chuyến đi mới có quyền quét và lưu cảnh báo' });
      }

      const liveWeather = await fetchRealtimeWeatherAlongRoute(existing);
      const db = requireFirestore();
      const tripRef = db.collection('trips').doc(existing.id);
  
      const txResult = await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(tripRef);
        if (!snap.exists) return { kind: 'not_found' as const };
        const latest = normalizeTripData(snap.data());
        if (liveWeather) {
          latest.weather = liveWeather;
        }
        const detectedAlerts = detectScheduleAndWeatherAlerts(latest);
        latest.alerts = detectedAlerts;
        const authoritative = computeAuthoritativeTripDerivedFields(latest);
        const nextVersion = (latest.version || 0) + 1;
        const updatedTrip: TripData = {
          ...authoritative,
          ownerId: latest.ownerId,
          version: nextVersion,
        };
  
        transaction.update(tripRef, {
          weather: updatedTrip.weather,
          alerts: updatedTrip.alerts,
          budgetUsed: updatedTrip.budgetUsed,
          budgetRemaining: updatedTrip.budgetRemaining,
          budgetUsedPercent: updatedTrip.budgetUsedPercent,
          version: nextVersion,
          updatedAt: FieldValue.serverTimestamp(),
        });
  
        return { kind: 'ok' as const, trip: updatedTrip };
      });
  
      if (txResult.kind === 'not_found') {
        return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
      }
  
      return res.json({
        success: true,
        alerts: txResult.trip.alerts,
        weather: txResult.trip.weather,
        version: txResult.trip.version,
        trip: txResult.trip,
        message: `Đã phát hiện ${txResult.trip.alerts.length} cảnh báo vận hành thời gian thực`,
      });
    } catch (error) {
      console.error('Error scanning alerts:', error);
      return res.status(503).json({ success: false, error: 'Không thể quét cảnh báo' });
    }
  });
  
  app.patch('/api/trips/:tripId/members/:memberId/attendance', requireAuth, async (req: AuthenticatedRequest, res) => {
    const { attendanceStatus, version: clientVersion } = req.body || {};
    if (!['Có mặt', 'Vắng mặt'].includes(attendanceStatus)) {
      return res.status(400).json({ success: false, error: 'Trạng thái điểm danh không hợp lệ' });
    }
  
    try {
      const user = req.authUser!;
      const rawTripId = req.params.tripId;
      const targetTrip = rawTripId === 'active'
        ? (await loadUserTrips(user))[0]
        : await getTripById(rawTripId);
  
      if (!targetTrip || !canAccessTrip(targetTrip, user)) {
        return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
      }
  
      const db = requireFirestore();
      const tripRef = db.collection('trips').doc(targetTrip.id);
      const txResult = await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(tripRef);
        if (!snap.exists) return { kind: 'not_found' as const };
        const latest = normalizeTripData(snap.data());
  
        if (!canAccessTrip(latest, user)) {
          return { kind: 'forbidden' as const };
        }
  
        if (typeof latest.version === 'number') {
          if (typeof clientVersion !== 'number' || !Number.isInteger(clientVersion) || clientVersion < latest.version) {
            return { kind: 'conflict' as const, currentVersion: latest.version };
          }
        }
  
        const members = Array.isArray(latest.members) ? latest.members : [];
        const mIdx = members.findIndex((m) => m.id === req.params.memberId);
        if (mIdx < 0) return { kind: 'member_not_found' as const };

        const targetMember = members[mIdx];
        const isOwnerOrAdmin = isTripOwnerOrAdmin(latest, user);
        const canSelfOrInvitedToggle =
          targetMember.uid === user.uid || targetMember.invitedByUid === user.uid;
        if (!isOwnerOrAdmin && !canSelfOrInvitedToggle) {
          return { kind: 'forbidden' as const };
        }
  
        const updatedMembers = members.map((m, idx) => (idx === mIdx ? { ...m, attendanceStatus } : m));
        const authoritative = computeAuthoritativeTripDerivedFields({
          ...latest,
          members: updatedMembers,
        });
        const nextVersion = (latest.version || 0) + 1;
  
        transaction.update(tripRef, {
          members: authoritative.members,
          membersStatus: authoritative.membersStatus,
          membersTotal: authoritative.membersTotal,
          membersOnline: authoritative.membersOnline,
          version: nextVersion,
          updatedAt: FieldValue.serverTimestamp(),
        });
  
        return {
          kind: 'ok' as const,
          member: authoritative.members[mIdx],
          membersStatus: authoritative.membersStatus,
          version: nextVersion,
        };
      });
  
      if (txResult.kind === 'not_found') {
        return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
      }
      if (txResult.kind === 'forbidden') {
        return res.status(403).json({ success: false, error: 'Bạn chỉ có thể điểm danh cho bản thân hoặc người thân do mình đăng ký' });
      }
      if (txResult.kind === 'member_not_found') {
        return res.status(404).json({ success: false, error: 'Không tìm thấy thành viên' });
      }
      if (txResult.kind === 'conflict') {
        return res.status(409).json({
          success: false,
          error: 'Danh sách thành viên đã thay đổi ở phiên khác. Vui lòng đồng bộ lại.',
          currentVersion: txResult.currentVersion,
        });
      }
  
      return res.json({
        success: true,
        member: txResult.member,
        membersStatus: txResult.membersStatus,
        version: txResult.version,
      });
    } catch (error) {
      console.error('Error updating member attendance:', error);
      return res.status(503).json({ success: false, error: 'Không thể lưu trạng thái điểm danh' });
    }
  });

  // Quản lý mã mời chuyến đi (Chỉ chủ chuyến / Admin): tạo, đổi mã mới hoặc bật/tắt mã
  app.post('/api/trips/:tripId/join-code', requireAuth, async (req: AuthenticatedRequest, res) => {
    const tripId = req.params.tripId;
    if (!tripId || tripId === 'active' || !TRIP_ID_PATTERN.test(tripId)) {
      return res.status(400).json({ success: false, error: 'Mã chuyến đi không hợp lệ' });
    }

    const action = req.body?.action;
    if (action !== 'generate' && action !== 'rotate' && action !== 'toggle') {
      return res.status(400).json({ success: false, error: 'Thao tác mã tham gia không hợp lệ' });
    }

    try {
      const freshCode = action === 'rotate' || action === 'generate' ? await allocateJoinCode() : '';
      const db = requireFirestore();
      const tripRef = db.collection('trips').doc(tripId);
      const requestedEnabled = typeof req.body?.enabled === 'boolean' ? req.body.enabled : undefined;

      const txResult = await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(tripRef);
        if (!snap.exists) return { kind: 'not_found' as const };
        const latest = normalizeTripData(snap.data());
        if (!isTripOwnerOrAdmin(latest, req.authUser)) {
          return { kind: 'forbidden' as const };
        }

        const nextJoinCode =
          action === 'rotate'
            ? freshCode
            : action === 'generate'
              ? latest.joinCode || freshCode
              : latest.joinCode || freshCode;
        const nextEnabled =
          action === 'toggle'
            ? (requestedEnabled !== undefined ? requestedEnabled : latest.joinCodeEnabled === false)
            : true;
        const nextVersion = (latest.version || 0) + 1;

        transaction.update(tripRef, {
          joinCode: nextJoinCode,
          joinCodeEnabled: nextEnabled,
          version: nextVersion,
          updatedAt: FieldValue.serverTimestamp(),
        });

        const updatedTrip: TripData = {
          ...latest,
          joinCode: nextJoinCode,
          joinCodeEnabled: nextEnabled,
          version: nextVersion,
        };
        return { kind: 'ok' as const, trip: updatedTrip };
      });

      if (txResult.kind === 'not_found') {
        return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
      }
      if (txResult.kind === 'forbidden') {
        return res.status(403).json({ success: false, error: 'Chỉ chủ chuyến đi mới có quyền quản lý mã mời' });
      }

      return res.json({
        success: true,
        joinCode: txResult.trip.joinCode,
        joinCodeEnabled: txResult.trip.joinCodeEnabled,
        version: txResult.trip.version,
        trip: txResult.trip,
      });
    } catch (error) {
      console.error('Error managing join code:', error);
      return res.status(503).json({ success: false, error: 'Không thể cập nhật mã mời chuyến đi' });
    }
  });

  // Hành khách đã đăng nhập (User B) hoặc chủ chuyến đăng ký người thân KHÔNG CÓ TÀI KHOẢN vào đoàn
  app.post('/api/trips/:tripId/guest-companions', requireAuth, async (req: AuthenticatedRequest, res) => {
    const tripId = req.params.tripId;
    if (!tripId || tripId === 'active' || !TRIP_ID_PATTERN.test(tripId)) {
      return res.status(400).json({ success: false, error: 'Mã chuyến đi không hợp lệ' });
    }

    const user = req.authUser!;
    const body = (req.body || {}) as { name?: unknown; phone?: unknown; specialPreference?: unknown };
    const cleanName = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
    if (!cleanName) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập họ tên người thân / hành khách.' });
    }
    const cleanPhone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 30) : '';
    const cleanPref =
      typeof body.specialPreference === 'string' && body.specialPreference.trim()
        ? body.specialPreference.trim().slice(0, 200)
        : undefined;
    const inviterName =
      typeof user.name === 'string' && user.name.trim()
        ? user.name.trim().slice(0, 120)
        : user.email?.split('@')[0] || 'Thành viên';

    try {
      const db = requireFirestore();
      const tripRef = db.collection('trips').doc(tripId);
      const txResult = await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(tripRef);
        if (!snap.exists) return { kind: 'not_found' as const };
        const latest = normalizeTripData(snap.data());
        if (!canAccessTrip(latest, user)) {
          return { kind: 'forbidden' as const };
        }
        const members = Array.isArray(latest.members) ? latest.members : [];
        if (members.length >= 100) {
          return { kind: 'full' as const };
        }

        const companion: TripMember = {
          id: `guest-${Date.now()}-${randomUUID().slice(0, 6)}`,
          name: cleanName,
          avatar: getMemberInitials(cleanName),
          role: 'Khách du lịch',
          phone: cleanPhone,
          status: 'online',
          attendanceStatus: 'Chưa điểm danh',
          ...(cleanPref ? { specialPreference: cleanPref } : {}),
          memberType: 'guest',
          invitedByUid: user.uid,
          invitedByName: inviterName,
        };

        const authoritative = computeAuthoritativeTripDerivedFields({
          ...latest,
          members: [...members, companion],
        });
        const nextVersion = (latest.version || 0) + 1;
        const updatedTrip: TripData = {
          ...authoritative,
          ownerId: latest.ownerId,
          ...(latest.participantUids?.length ? { participantUids: latest.participantUids } : {}),
          version: nextVersion,
        };

        if (estimateTripByteSize(updatedTrip as unknown as Record<string, unknown>) > MAX_TRIP_DOC_BYTES) {
          return { kind: 'too_large' as const };
        }

        transaction.update(tripRef, {
          members: updatedTrip.members,
          membersTotal: updatedTrip.membersTotal,
          membersOnline: updatedTrip.membersOnline,
          membersStatus: updatedTrip.membersStatus,
          version: nextVersion,
          updatedAt: FieldValue.serverTimestamp(),
        });

        return { kind: 'ok' as const, trip: updatedTrip, member: companion };
      });

      if (txResult.kind === 'not_found') {
        return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
      }
      if (txResult.kind === 'forbidden') {
        return res.status(403).json({ success: false, error: 'Bạn không có quyền thêm người thân vào chuyến này' });
      }
      if (txResult.kind === 'full') {
        return res.status(400).json({ success: false, error: 'Đoàn đã đạt tối đa 100 thành viên' });
      }
      if (txResult.kind === 'too_large') {
        return res.status(413).json({ success: false, error: 'Dung lượng chuyến đi vượt giới hạn Firestore' });
      }

      return res.status(201).json({
        success: true,
        member: txResult.member,
        joinCode: txResult.trip.joinCode,
        trip: txResult.trip,
        message: `Đã thêm "${txResult.member.name}" vào danh sách hành khách.`,
      });
    } catch (error) {
      console.error('Error adding guest companion:', error);
      return res.status(503).json({ success: false, error: 'Không thể thêm người thân vào chuyến đi' });
    }
  });

  // Xóa người thân không tài khoản do chính user đăng ký (hoặc chủ chuyến / Admin)
  app.delete('/api/trips/:tripId/guest-companions/:memberId', requireAuth, async (req: AuthenticatedRequest, res) => {
    const { tripId, memberId } = req.params;
    if (!tripId || tripId === 'active' || !TRIP_ID_PATTERN.test(tripId) || !memberId) {
      return res.status(400).json({ success: false, error: 'Tham số không hợp lệ' });
    }

    const user = req.authUser!;
    try {
      const db = requireFirestore();
      const tripRef = db.collection('trips').doc(tripId);
      const txResult = await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(tripRef);
        if (!snap.exists) return { kind: 'not_found' as const };
        const latest = normalizeTripData(snap.data());
        if (!canAccessTrip(latest, user)) {
          return { kind: 'forbidden' as const };
        }
        const members = Array.isArray(latest.members) ? latest.members : [];
        const target = members.find((m) => m.id === memberId);
        if (!target) return { kind: 'member_not_found' as const };

        const canDelete = isTripOwnerOrAdmin(latest, user) || target.invitedByUid === user.uid;
        if (!canDelete) return { kind: 'forbidden' as const };

        const nextMembers = members.filter((m) => m.id !== memberId);
        const authoritative = computeAuthoritativeTripDerivedFields({
          ...latest,
          members: nextMembers,
        });
        const nextVersion = (latest.version || 0) + 1;
        const updatedTrip: TripData = {
          ...authoritative,
          ownerId: latest.ownerId,
          ...(latest.participantUids?.length ? { participantUids: latest.participantUids } : {}),
          version: nextVersion,
        };

        transaction.update(tripRef, {
          members: updatedTrip.members,
          membersTotal: updatedTrip.membersTotal,
          membersOnline: updatedTrip.membersOnline,
          membersStatus: updatedTrip.membersStatus,
          version: nextVersion,
          updatedAt: FieldValue.serverTimestamp(),
        });

        return { kind: 'ok' as const, trip: updatedTrip };
      });

      if (txResult.kind === 'not_found') {
        return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
      }
      if (txResult.kind === 'member_not_found') {
        return res.status(404).json({ success: false, error: 'Không tìm thấy thành viên' });
      }
      if (txResult.kind === 'forbidden') {
        return res.status(403).json({ success: false, error: 'Bạn không có quyền xóa thành viên này' });
      }

      return res.json({ success: true, trip: txResult.trip });
    } catch (error) {
      console.error('Error removing guest companion:', error);
      return res.status(503).json({ success: false, error: 'Không thể xóa người thân khỏi đoàn' });
    }
  });

  // Hành khách đã tham gia bằng mã chủ động rời chuyến đi
  app.post('/api/trips/:tripId/leave', requireAuth, async (req: AuthenticatedRequest, res) => {
    const tripId = req.params.tripId;
    if (!tripId || tripId === 'active' || !TRIP_ID_PATTERN.test(tripId)) {
      return res.status(400).json({ success: false, error: 'Mã chuyến đi không hợp lệ' });
    }

    const user = req.authUser!;
    try {
      const db = requireFirestore();
      const tripRef = db.collection('trips').doc(tripId);
      const txResult = await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(tripRef);
        if (!snap.exists) return { kind: 'not_found' as const };
        const latest = normalizeTripData(snap.data());
        if (latest.ownerId === user.uid) {
          return { kind: 'owner_cannot_leave' as const };
        }
        const nextParticipantUids = (latest.participantUids || []).filter((u) => u !== user.uid);
        const nextMembers = (latest.members || []).filter((m) => m.uid !== user.uid);
        const authoritative = computeAuthoritativeTripDerivedFields({
          ...latest,
          participantUids: nextParticipantUids,
          members: nextMembers,
        });
        const nextVersion = (latest.version || 0) + 1;

        transaction.update(tripRef, {
          participantUids: nextParticipantUids.length > 0 ? nextParticipantUids : FieldValue.delete(),
          members: authoritative.members,
          membersTotal: authoritative.membersTotal,
          membersOnline: authoritative.membersOnline,
          membersStatus: authoritative.membersStatus,
          version: nextVersion,
          updatedAt: FieldValue.serverTimestamp(),
        });

        return { kind: 'ok' as const, title: latest.title };
      });

      if (txResult.kind === 'not_found') {
        return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
      }
      if (txResult.kind === 'owner_cannot_leave') {
        return res.status(400).json({ success: false, error: 'Chủ chuyến đi không thể tự rời chuyến.' });
      }

      return res.json({
        success: true,
        leftTripId: tripId,
        message: `Đã rời khỏi chuyến đi "${txResult.title}".`,
      });
    } catch (error) {
      console.error('Error leaving trip:', error);
      return res.status(503).json({ success: false, error: 'Không thể rời chuyến đi' });
    }
  });
}
