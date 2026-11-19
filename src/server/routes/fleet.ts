import type { Express, Request, RequestHandler } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { ReferenceCostRecord, SystemConfig } from '../types/systemConfig';

type AuthenticatedRequest = Request & { authUser?: DecodedIdToken };

interface FleetRouteDependencies {
  requireAuth: RequestHandler;
  requireAdmin: RequestHandler;
  getSystemConfig: () => SystemConfig;
  getReferenceCosts: () => ReferenceCostRecord[];
  setSystemConfig: (config: SystemConfig) => void;
  syncSystemConfigIfStale: (force?: boolean) => Promise<void>;
  saveSystemConfig: (config: SystemConfig) => Promise<void>;
  recordAuditLog: (user: string, action: string) => Promise<void>;
}

export function registerFleetRoutes(app: Express, dependencies: FleetRouteDependencies) {
  const {
    requireAuth,
    requireAdmin,
    getSystemConfig,
    getReferenceCosts,
    setSystemConfig,
    syncSystemConfigIfStale,
    saveSystemConfig,
    recordAuditLog,
  } = dependencies;

  // ==================== REFERENCE COSTS MANAGEMENT ====================
  app.get('/api/admin/reference-costs', requireAuth, requireAdmin, async (_req, res) => {
    await syncSystemConfigIfStale(true);
    return res.json({
      success: true,
      costs: getReferenceCosts(),
    });
  });
  
  app.post('/api/admin/reference-costs', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
    const { category, item, price, note } = req.body;
    if (!item || !price) {
      return res.status(400).json({ success: false, error: 'Thiếu tên hạng mục hoặc đơn giá' });
    }

    await syncSystemConfigIfStale(true);
  
    const newCost: ReferenceCostRecord = {
      id: `cost-${Date.now()}`,
      category: String(category || 'Vé tham quan').trim().slice(0, 50),
      item: String(item).trim().slice(0, 150),
      price: String(price).trim().slice(0, 50),
      note: String(note || '').trim().slice(0, 200),
    };
  
    const nextCosts = [newCost, ...getReferenceCosts()];
    const nextConfig: SystemConfig = { ...getSystemConfig(), referenceCosts: nextCosts };
    try {
      await saveSystemConfig(nextConfig);
    } catch (err) {
      console.error('[ReferenceCosts] Failed to persist to Firestore:', err);
      return res.status(503).json({ success: false, error: 'Không thể lưu định mức chi phí vào Firestore' });
    }
  
    setSystemConfig(nextConfig);
    recordAuditLog(req.authUser?.email || 'Admin', `Thêm định mức chi phí mới: [${newCost.category}] ${newCost.item} - ${newCost.price}`);
  
    return res.json({
      success: true,
      cost: newCost,
      costs: getReferenceCosts(),
    });
  });
  
  app.patch('/api/admin/reference-costs/:costId', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
    await syncSystemConfigIfStale(true);
    const { costId } = req.params;
    const idx = getReferenceCosts().findIndex((c) => c.id === costId);
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy định mức chi phí' });
    }
  
    const { category, item, price, note } = req.body;
    const updatedCost: ReferenceCostRecord = {
      ...getReferenceCosts()[idx],
      ...(category ? { category: String(category).trim().slice(0, 50) } : {}),
      ...(item ? { item: String(item).trim().slice(0, 150) } : {}),
      ...(price ? { price: String(price).trim().slice(0, 50) } : {}),
      ...(note !== undefined ? { note: String(note).trim().slice(0, 200) } : {}),
    };
  
    const nextCosts = getReferenceCosts().map((c, i) => (i === idx ? updatedCost : c));
    const nextConfig: SystemConfig = { ...getSystemConfig(), referenceCosts: nextCosts };
    try {
      await saveSystemConfig(nextConfig);
    } catch (err) {
      console.error('[ReferenceCosts] Failed to update in Firestore:', err);
      return res.status(503).json({ success: false, error: 'Không thể cập nhật định mức chi phí vào Firestore' });
    }
  
    setSystemConfig(nextConfig);
    recordAuditLog(req.authUser?.email || 'Admin', `Cập nhật định mức chi phí: ${updatedCost.item} -> ${updatedCost.price}`);
  
    return res.json({
      success: true,
      cost: updatedCost,
      costs: getReferenceCosts(),
    });
  });
  
  app.delete('/api/admin/reference-costs/:costId', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
    await syncSystemConfigIfStale(true);
    const { costId } = req.params;
    const target = getReferenceCosts().find((c) => c.id === costId);
    if (!target) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy định mức chi phí' });
    }
  
    const nextCosts = getReferenceCosts().filter((c) => c.id !== costId);
    const nextConfig: SystemConfig = { ...getSystemConfig(), referenceCosts: nextCosts };
    try {
      await saveSystemConfig(nextConfig);
    } catch (err) {
      console.error('[ReferenceCosts] Failed to delete in Firestore:', err);
      return res.status(503).json({ success: false, error: 'Không thể xóa định mức chi phí khỏi Firestore' });
    }
  
    setSystemConfig(nextConfig);
    recordAuditLog(req.authUser?.email || 'Admin', `Xóa định mức chi phí: ${target.item}`);
  
    return res.json({
      success: true,
      costs: getReferenceCosts(),
    });
  });
}
