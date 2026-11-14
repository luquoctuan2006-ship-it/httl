import type { Express, Request, RequestHandler } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import { listAILogs, listAuditLogs } from '../services/systemLogs';

type AuthenticatedRequest = Request & { authUser?: DecodedIdToken };

interface AdminMonitoringDependencies {
  requireAuth: RequestHandler;
  requireAdmin: RequestHandler;
  requireFirestore: () => Firestore;
  getGeminiSettings: () => { model: string; temperature: number; maxTokens: number };
  generateWithGemini: (prompt: string, userActor: string) => Promise<{ text?: string }>;
  recordAuditLog: (user: string, action: string) => Promise<void>;
}

export function registerAdminMonitoringRoutes(app: Express, dependencies: AdminMonitoringDependencies) {
  const { requireAuth, requireAdmin, requireFirestore, getGeminiSettings, generateWithGemini, recordAuditLog } = dependencies;
  // Get AI Logs & Error Monitor
  app.get('/api/admin/ai-logs', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const { requests, errors } = await listAILogs(requireFirestore());
      return res.json({
        success: true,
        requests,
        errors,
        currentModel: getGeminiSettings().model,
        temperature: getGeminiSettings().temperature,
        maxTokens: getGeminiSettings().maxTokens,
      });
    } catch (error) {
      console.error('[AI Logs] Không thể đọc nhật ký từ Firestore:', error);
      return res.status(503).json({ success: false, error: 'Không thể tải nhật ký AI' });
    }
  });
  
  // Get Audit Logs
  app.get('/api/admin/audit-logs', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const logs = await listAuditLogs(requireFirestore());
      return res.json({ success: true, logs });
    } catch (error) {
      console.error('[Audit Logs] Không thể đọc nhật ký từ Firestore:', error);
      return res.status(503).json({ success: false, error: 'Không thể tải nhật ký hoạt động' });
    }
  });
  
  // Test AI Connection & Latency
  app.post('/api/admin/test-ai', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
    const actor = req.authUser?.email || 'Admin';
    const start = Date.now();
    try {
      const model = getGeminiSettings().model;
      const prompt = 'Hãy trả về một phản hồi JSON đơn giản xác nhận hệ thống Voyager hoạt động tốt: {"status": "ok", "message": "Kết nối Gemini API thành công", "model": "' + model + '"}';
      const result = await generateWithGemini(prompt, actor);
      const latency = `${((Date.now() - start) / 1000).toFixed(2)}s`;
      recordAuditLog(actor, `Kiểm tra kết nối AI thành công qua ${model} (Độ trễ: ${latency})`);
      return res.json({
        success: true,
        model,
        latency,
        output: result.text || 'OK',
      });
    } catch (error: unknown) {
      const latency = `${((Date.now() - start) / 1000).toFixed(2)}s`;
      const errMsg = error instanceof Error ? error.message : String(error);
      const model = getGeminiSettings().model;
      recordAuditLog(actor, `Kiểm tra kết nối AI thất bại qua ${model}: ${errMsg}`);
      return res.status(502).json({
        success: false,
        model,
        latency,
        error: errMsg || 'Lỗi khi gọi AI',
      });
    }
  });
}
