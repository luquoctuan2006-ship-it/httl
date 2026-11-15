import type { NextFunction, Request, Response } from 'express';
import type { Auth as FirebaseAdminAuth, DecodedIdToken } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';

export type AuthenticatedRequest = Request & { authUser?: DecodedIdToken };

interface AuthMiddlewareOptions {
  firebaseAuth: FirebaseAdminAuth | null;
  firestore: Firestore | null;
  hasServiceAccountCredentials: boolean;
  syncSystemConfigIfStale: (force?: boolean) => Promise<void>;
  isMaintenanceMode: () => boolean;
}

export function createAuthMiddleware({
  firebaseAuth,
  firestore,
  hasServiceAccountCredentials,
  syncSystemConfigIfStale,
  isMaintenanceMode,
}: AuthMiddlewareOptions) {
  async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const authorization = req.header('authorization');
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!token) return res.status(401).json({ success: false, error: 'Vui lòng đăng nhập' });

    if (!firebaseAuth || !firestore) {
      return res.status(503).json({
        success: false,
        error: 'Máy chủ chưa cấu hình Firebase Admin / Firestore (secrets/firebase-service-account.json) nên không thể xác thực.',
      });
    }

    try {
      await syncSystemConfigIfStale();
      const decoded = await firebaseAuth.verifyIdToken(token, hasServiceAccountCredentials);
      const role = decoded.role === 'admin' ? 'admin' : 'user';

      if (isMaintenanceMode() && role !== 'admin') {
        return res.status(503).json({
          success: false,
          error: 'Hệ thống đang trong chế độ bảo trì để nâng cấp định kỳ. Vui lòng quay lại sau ít phút.',
        });
      }

      req.authUser = {
        ...decoded,
        role,
      } as DecodedIdToken;
      return next();
    } catch (err: unknown) {
      const errCode = (err as { code?: string })?.code;
      if (errCode === 'auth/user-disabled') {
        return res.status(403).json({
          success: false,
          error: 'Tài khoản của bạn đã bị vô hiệu hóa hoặc tạm khóa bởi Quản trị viên. Vui lòng liên hệ hỗ trợ.',
        });
      }
      return res.status(401).json({ success: false, error: 'Token không hợp lệ, đã hết hạn hoặc đã bị thu hồi' });
    }
  }

  function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    if (req.authUser?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Chỉ tài khoản Quản trị viên (Admin) điều phối mới có quyền thực hiện thao tác này.',
      });
    }
    return next();
  }

  return { requireAuth, requireAdmin };
}
