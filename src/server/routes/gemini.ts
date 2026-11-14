import type { Express, Request, RequestHandler, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import type { GoogleGenAI } from '@google/genai';
import { createGeminiJobsRouter } from './geminiJobs';
import { ActiveGeminiJobLimitError } from '../errors/activeGeminiJobLimitError';

type AuthenticatedRequest = Request & { authUser?: DecodedIdToken };

interface GeminiRouteDependencies {
  requireAuth: RequestHandler;
  aiRateLimiter: RequestHandler;
  ai: GoogleGenAI | null;
  createGeminiCacheKey: (operation: string, payload: unknown, uid?: string) => string;
  getCachedGeminiResult: (cacheKey: string) => unknown | undefined;
  createGeminiJob: (operation: string, payload: unknown, ownerUid: string, userActor: string, cacheKey: string) => Promise<{ id: string; status: string; progress: string }>;
  buildOptimizePayload: (body: unknown, user?: DecodedIdToken) => Promise<Record<string, unknown> | null>;
  runScheduleOptimization: (payload: Record<string, unknown>, userActor: string) => Promise<unknown>;
  requireFirestore: () => Firestore;
}

export function registerGeminiRoutes(app: Express, dependencies: GeminiRouteDependencies) {
  const {
    requireAuth,
    aiRateLimiter,
    ai,
    createGeminiCacheKey,
    getCachedGeminiResult,
    createGeminiJob,
    buildOptimizePayload,
    runScheduleOptimization,
    requireFirestore,
  } = dependencies;
  // API Route: Generate personalized itinerary using Gemini (User đã đăng nhập sử dụng; Admin giám sát qua log)
  app.post('/api/gemini/generate-itinerary', requireAuth, aiRateLimiter, async (req: AuthenticatedRequest, res) => {
    if (!ai) {
      return res.status(503).json({
        success: false,
        error: 'Thiếu GEMINI_API_KEY. Hãy đặt khóa trong tệp .env ở thư mục gốc rồi khởi động lại server.',
      });
    }
  
    const { destination, days, budget, travelStyle, groupType, preferences, startLocation } = req.body;
    const normalizedDays = Number.parseInt(days, 10);
    if (!Number.isInteger(normalizedDays) || normalizedDays < 3 || normalizedDays > 7) {
      return res.status(400).json({
        success: false,
        error: 'Số ngày phải nằm trong khoảng 3–7 ngày.',
      });
    }
  
    const cacheKey = createGeminiCacheKey('generate-itinerary', {
      promptVersion: 2,
      destination,
      days: normalizedDays,
      budget,
      travelStyle,
      groupType,
      preferences,
      startLocation,
    }, req.authUser?.uid);
    const cachedResult = getCachedGeminiResult(cacheKey);
  
    if (cachedResult !== undefined) {
      return res.json({ success: true, data: cachedResult, cached: true });
    }
  
    const userActor = req.authUser?.email || 'Người dùng';
    try {
      const job = await createGeminiJob('generate-itinerary', req.body, req.authUser!.uid, userActor, cacheKey);
      return res.status(202).json({ success: true, jobId: job.id, job: { id: job.id, status: job.status, progress: job.progress } });
    } catch (err: unknown) {
      if (err instanceof ActiveGeminiJobLimitError) {
        return res.status(429).json({ success: false, error: err.message });
      }
      console.error('[Gemini Job] Không thể tạo job:', err);
      return res.status(503).json({ success: false, error: 'Không thể tạo job AI lúc này' });
    }
  });
  
  // API Route: Optimize active schedule based on real-time factors (User đã đăng nhập sử dụng; Admin giám sát qua log)
  app.post('/api/gemini/optimize-schedule', requireAuth, aiRateLimiter, async (req: AuthenticatedRequest, res) => {
    const userActor = req.authUser?.email || 'Người dùng';
    let payload: Awaited<ReturnType<typeof buildOptimizePayload>>;
    try {
      payload = await buildOptimizePayload(req.body, req.authUser);
    } catch (error) {
      console.error('[Optimize] Lỗi khi chuẩn bị dữ liệu chuyến đi:', error);
      return res.status(500).json({ success: false, error: 'Không thể chuẩn bị dữ liệu chuyến đi để tối ưu.' });
    }
    if (!payload) {
      return res.status(400).json({ success: false, error: 'Thiếu dữ liệu chuyến đi (currentTrip.days) để tối ưu lịch trình.' });
    }
  
    const cacheKey = createGeminiCacheKey('optimize-schedule', payload, req.authUser?.uid);
    const cachedResult = getCachedGeminiResult(cacheKey);
    if (cachedResult !== undefined) {
      return res.json({ success: true, data: cachedResult, cached: true });
    }
  
    if (!ai) {
      // Không có API key: chỉ bộ dự phòng chạy, nhưng vẫn qua kiểm tra khả thi và được gắn nhãn source='fallback'.
      try {
        const data = await runScheduleOptimization(payload, userActor);
        return res.json({ success: true, data });
      } catch (error) {
        console.error('[Optimize] Lỗi khi tối ưu lịch trình:', error);
        return res.status(500).json({ success: false, error: 'Không thể kiểm tra phương án tối ưu lịch trình.' });
      }
    }
  
    try {
      const job = await createGeminiJob('optimize-schedule', payload, req.authUser!.uid, userActor, cacheKey);
      return res.status(202).json({ success: true, jobId: job.id, job: { id: job.id, status: job.status, progress: job.progress } });
    } catch (err: unknown) {
      if (err instanceof ActiveGeminiJobLimitError) {
        return res.status(429).json({ success: false, error: err.message });
      }
      console.error('[Gemini Job] Không thể tạo job:', err);
      return res.status(503).json({ success: false, error: 'Không thể tạo job AI lúc này' });
    }
  });
  
  app.use('/api/gemini/jobs', createGeminiJobsRouter({
    requireAuth,
    getFirestore: requireFirestore,
  }));
}
