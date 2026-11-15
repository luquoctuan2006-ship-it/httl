import type { Express, RequestHandler } from 'express';
import type { TripData } from '../../types/travel';
import {
  isValidJoinCodeFormat,
  normalizeJoinCode,
  sanitizeTripForGuest,
} from '../../utils/tripJoinHelpers';
import { computeRoadRouteLegs } from './routing';

interface GuestRouteDependencies {
  findTripByJoinCode: (joinCode: string) => Promise<TripData | null>;
  rateLimiter: RequestHandler;
}

export function registerGuestRoutes(app: Express, dependencies: GuestRouteDependencies) {
  const { findTripByJoinCode, rateLimiter } = dependencies;

  app.post('/api/guest/access', rateLimiter, async (req, res) => {
    const rawCode = (req.body as { joinCode?: unknown })?.joinCode;
    const rawGuestName = (req.body as { guestName?: unknown })?.guestName;
    const joinCode = normalizeJoinCode(rawCode);

    if (!isValidJoinCodeFormat(joinCode)) {
      return res.status(400).json({
        success: false,
        error: 'Mã tham gia chuyến đi phải gồm 5–12 ký tự chữ hoặc số.',
      });
    }

    try {
      const trip = await findTripByJoinCode(joinCode);
      if (!trip) {
        return res.status(404).json({
          success: false,
          error: 'Không tìm thấy chuyến đi với mã này. Vui lòng kiểm tra lại với trưởng đoàn hoặc người thân.',
        });
      }
      if (trip.joinCodeEnabled === false) {
        return res.status(403).json({
          success: false,
          error: 'Chủ chuyến đi đã tạm khóa quyền vào bằng mã cho chuyến này.',
        });
      }

      const guestName =
        typeof rawGuestName === 'string' && rawGuestName.trim()
          ? rawGuestName.trim().slice(0, 80)
          : 'Hành khách';

      return res.json({
        success: true,
        joinCode: trip.joinCode || joinCode,
        guestName,
        trip: sanitizeTripForGuest(trip),
      });
    } catch (error) {
      console.error('[Guest Access] Error looking up trip by code:', error);
      return res.status(503).json({
        success: false,
        error: 'Không thể kết nối máy chủ để tra cứu chuyến đi.',
      });
    }
  });

  app.get('/api/guest/trip', rateLimiter, async (req, res) => {
    const joinCode = normalizeJoinCode(req.query.code);
    if (!isValidJoinCodeFormat(joinCode)) {
      return res.status(400).json({ success: false, error: 'Mã chuyến đi không hợp lệ.' });
    }

    try {
      const trip = await findTripByJoinCode(joinCode);
      if (!trip) {
        return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi với mã này.' });
      }
      if (trip.joinCodeEnabled === false) {
        return res.status(403).json({ success: false, error: 'Quyền truy cập bằng mã đã bị tạm khóa.' });
      }
      return res.json({
        success: true,
        joinCode: trip.joinCode || joinCode,
        trip: sanitizeTripForGuest(trip),
      });
    } catch (error) {
      console.error('[Guest Trip Refresh] Error:', error);
      return res.status(503).json({ success: false, error: 'Không thể làm mới dữ liệu chuyến đi.' });
    }
  });

  app.post('/api/guest/routing/road', rateLimiter, async (req, res) => {
    const body = (req.body || {}) as { joinCode?: unknown; points?: unknown };
    const joinCode = normalizeJoinCode(body.joinCode);
    if (!isValidJoinCodeFormat(joinCode)) {
      return res.status(400).json({ success: false, error: 'Thiếu mã tham gia chuyến đi hợp lệ.' });
    }

    try {
      const trip = await findTripByJoinCode(joinCode);
      if (!trip || trip.joinCodeEnabled === false) {
        return res.status(403).json({ success: false, error: 'Mã tham gia không còn hiệu lực.' });
      }
      const result = await computeRoadRouteLegs(body.points);
      if (result.status === 400) {
        return res.status(400).json({ success: false, error: result.error });
      }
      return res.json({
        success: true,
        source: result.source,
        cached: Boolean(result.cached),
        legs: result.legs,
      });
    } catch (error) {
      console.error('[Guest Routing] Error:', error);
      return res.status(503).json({ success: false, error: 'Không thể tính tuyến đường bộ.' });
    }
  });
}
