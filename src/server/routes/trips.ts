import { Router, type Request, type RequestHandler, type Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { MAX_INVOICES_PER_TRIP, normalizeTripData } from '../../utils/trip/normalizeTripData';
import type { TripData } from '../../types/travel';
import { upsertTripForUser } from '../../utils/trip/tripRepository';
import { TRIP_ID_PATTERN } from '../services/tripStore';

type AuthenticatedRequest = Request & { authUser?: DecodedIdToken };

type TripSyncRouterOptions = {
  requireAuth: RequestHandler;
  getFirestore: () => Firestore;
  cleanupOrphanReceiptsForTrip: (db: Firestore, trip: TripData) => Promise<void>;
};

export function createTripSyncRouter({
  requireAuth,
  getFirestore,
  cleanupOrphanReceiptsForTrip,
}: TripSyncRouterOptions) {
  const router = Router();

  const saveTripHandler = async (req: AuthenticatedRequest, res: Response) => {
    if (req.body && typeof req.body === 'object' && (req.body as { isSummary?: unknown }).isSummary === true) {
      return res.status(400).json({ success: false, error: 'Không thể ghi đè chuyến đi bằng dữ liệu tóm tắt' });
    }
    const rawInvoices = (req.body as { invoices?: unknown } | undefined)?.invoices;
    if (Array.isArray(rawInvoices) && rawInvoices.length > MAX_INVOICES_PER_TRIP) {
      return res.status(400).json({
        success: false,
        error: `Mỗi chuyến đi chỉ hỗ trợ tối đa ${MAX_INVOICES_PER_TRIP} hóa đơn (hiện gửi ${rawInvoices.length}). Vui lòng gộp hoặc xóa bớt hóa đơn cũ.`,
      });
    }
    const trip = normalizeTripData(req.body);
    const routeId = req.params.tripId;
    if (routeId && routeId !== 'active') trip.id = routeId;

    if (typeof trip.id !== 'string' || trip.id === 'active' || !TRIP_ID_PATTERN.test(trip.id) || !Array.isArray(trip.days)) {
      return res.status(400).json({ success: false, error: 'Dữ liệu chuyến đi không hợp lệ' });
    }

    try {
      const db = getFirestore();
      const result = await upsertTripForUser(db, trip, req.authUser!, () => FieldValue.serverTimestamp());
      if (result.status === 'forbidden') {
        return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
      }
      if (result.status === 'too_large') {
        return res.status(413).json({
          success: false,
          error: 'Dung lượng dữ liệu chuyến đi vượt giới hạn 900KB của một tài liệu Firestore. Vui lòng bớt ảnh chứng từ hoặc chia nhỏ dữ liệu.',
        });
      }
      if (result.status === 'conflict') {
        return res.status(409).json({
          success: false,
          error: 'Chuyến đi đã được cập nhật từ phiên bản mới hơn hoặc thiếu mã phiên bản (version). Vui lòng tải lại dữ liệu.',
          currentVersion: result.currentVersion,
        });
      }
      if (result.status === 'ok') {
        void cleanupOrphanReceiptsForTrip(db, result.trip).catch((error) => {
          console.warn('[Trip Sync] Không thể dọn chứng từ mồ côi:', error);
        });
        return res.json({ success: true, version: result.version, trip: result.trip });
      }
      return res.status(500).json({ success: false, error: 'Không thể lưu chuyến đi' });
    } catch (error) {
      console.error('Error saving trip:', error);
      return res.status(503).json({ success: false, error: 'Không thể lưu chuyến đi' });
    }
  };

  router.put('/active', requireAuth, saveTripHandler);
  router.put('/:tripId', requireAuth, saveTripHandler);
  return router;
}
