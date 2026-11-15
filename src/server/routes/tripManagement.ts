import type { Express, Request, RequestHandler, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { createTripSyncRouter } from './trips';
import { normalizeTripData } from '../../data/normalizeTripData';
import type { TripData } from '../../types/travel';
import {
  canAccessTrip,
  computeAuthoritativeTripDerivedFields,
  estimateTripByteSize,
  MAX_TRIP_DOC_BYTES,
} from '../../utils/tripRepository';
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
  requireFirestore: () => Firestore;
  listTripsForUser: (
    user: DecodedIdToken,
    options?: { limit?: number; startAfterId?: string; summaryOnly?: boolean },
  ) => Promise<{ trips: TripData[]; hasMore: boolean; nextCursor: string | null }>;
  loadUserTrips: (user: DecodedIdToken) => Promise<TripData[]>;
  getTripById: (tripId: string) => Promise<TripData | null>;
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
    requireFirestore,
    listTripsForUser,
    loadUserTrips,
    getTripById,
    createTripDoc,
    deleteTripDoc,
    recordAuditLog,
  } = dependencies;

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
  
    // Luôn tự tính các trường dẫn xuất phía server và ép version = 1 khi tạo mới
    const authoritative = computeAuthoritativeTripDerivedFields(body);
    const trip: TripData = { ...authoritative, ownerId: req.authUser!.uid, version: 1 };
  
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
  
      if (!canAccessTrip(existing, req.authUser)) {
        return res.status(403).json({ success: false, error: 'Bạn không có quyền xóa chuyến đi này' });
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
      if (!canAccessTrip(existing, req.authUser)) {
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
      if (!canAccessTrip(existing, req.authUser)) {
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
      if (!canAccessTrip(existing, req.authUser)) {
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
        if (!canAccessTrip(existing, req.authUser)) {
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

      if (!canAccessTrip(existing, req.authUser)) {
        return res.status(403).json({ success: false, error: 'Không có quyền truy cập chuyến đi này' });
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
        return res.status(403).json({ success: false, error: 'Không có quyền truy cập chuyến đi này' });
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
}
