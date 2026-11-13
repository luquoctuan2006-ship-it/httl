import { Router, type Request, type RequestHandler, type Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import { isAdminUser } from '../../utils/tripRepository';

type AuthenticatedRequest = Request & { authUser?: DecodedIdToken };

type GeminiJobsRouterOptions = {
  requireAuth: RequestHandler;
  getFirestore: () => Firestore;
};

export function createGeminiJobsRouter({ requireAuth, getFirestore }: GeminiJobsRouterOptions) {
  const router = Router();

  router.get('/:jobId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const snapshot = await getFirestore().collection('gemini_jobs').doc(req.params.jobId).get();
      if (!snapshot.exists) {
        return res.status(404).json({ success: false, error: 'Không tìm thấy job AI' });
      }

      const job = snapshot.data() as {
        ownerUid: string;
        id: string;
        status: string;
        progress: string;
        createdAt: number;
        updatedAt: number;
        slotIndex: number;
        result?: unknown;
        error?: string;
      };
      if (job.ownerUid !== req.authUser!.uid && !isAdminUser(req.authUser)) {
        return res.status(404).json({ success: false, error: 'Không tìm thấy job AI' });
      }

      const { ownerUid: _ownerUid, slotIndex: _slotIndex, ...publicJob } = job;
      return res.json({ success: true, job: publicJob });
    } catch (error) {
      console.error('[Gemini Job] Không thể đọc job từ Firestore:', error);
      return res.status(503).json({ success: false, error: 'Không thể kiểm tra tiến độ job AI' });
    }
  });

  return router;
}
