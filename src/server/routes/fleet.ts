import type { Express, Request, RequestHandler } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { ReferenceCostRecord, SystemConfig, VehicleRecord } from '../types/systemConfig';

type AuthenticatedRequest = Request & { authUser?: DecodedIdToken };

interface FleetRouteDependencies {
  requireAuth: RequestHandler;
  requireAdmin: RequestHandler;
  getSystemConfig: () => SystemConfig;
  getVehicles: () => VehicleRecord[];
  getReferenceCosts: () => ReferenceCostRecord[];
  setSystemConfig: (config: SystemConfig) => void;
  syncSystemConfigIfStale: () => Promise<void>;
  saveSystemConfig: (config: SystemConfig) => Promise<void>;
  recordAuditLog: (user: string, action: string) => Promise<void>;
}

export function registerFleetRoutes(app: Express, dependencies: FleetRouteDependencies) {
  const {
    requireAuth,
    requireAdmin,
    getSystemConfig,
    getVehicles,
    getReferenceCosts,
    setSystemConfig,
    syncSystemConfigIfStale,
    saveSystemConfig,
    recordAuditLog,
  } = dependencies;
  // ==================== VEHICLES MANAGEMENT ====================
  // Danh sách đội xe dùng cho cả điều phối viên & người dùng tạo/gán xe vào chuyến đi
  app.get('/api/vehicles', requireAuth, async (_req, res) => {
    await syncSystemConfigIfStale();
    return res.json({
      success: true,
      vehicles: getVehicles(),
    });
  });
  
  app.get('/api/admin/vehicles', requireAuth, requireAdmin, async (_req, res) => {
    await syncSystemConfigIfStale();
    return res.json({
      success: true,
      vehicles: getVehicles(),
    });
  });
  
  app.post('/api/admin/vehicles', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
    const { type, speedAvg, capacity, consumption, status } = req.body;
    if (!type) {
      return res.status(400).json({ success: false, error: 'Thiếu loại phương tiện' });
    }
  
    const newVeh: VehicleRecord = {
      id: `veh-${Date.now()}`,
      type: String(type).trim().slice(0, 100),
      speedAvg: String(speedAvg || '45 km/h').trim().slice(0, 30),
      capacity: String(capacity || '16 khách').trim().slice(0, 30),
      consumption: String(consumption || '12L / 100km').trim().slice(0, 30),
      status: status || 'Sẵn sàng điều phối',
    };
  
    const nextVehicles = [newVeh, ...getVehicles()];
    const nextConfig: SystemConfig = { ...getSystemConfig(), vehicles: nextVehicles };
    try {
      await saveSystemConfig(nextConfig);
    } catch (err) {
      console.error('[Vehicles] Failed to persist to Firestore:', err);
      return res.status(503).json({ success: false, error: 'Không thể lưu danh sách xe vào Firestore' });
    }
  
    setSystemConfig(nextConfig);
    recordAuditLog(req.authUser?.email || 'Admin', `Thêm phương tiện mới: ${newVeh.type} (${newVeh.capacity})`);
  
    return res.json({
      success: true,
      vehicle: newVeh,
      vehicles: getVehicles(),
    });
  });
  
  app.patch('/api/admin/vehicles/:vehicleId', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
    const { vehicleId } = req.params;
    const idx = getVehicles().findIndex((v) => v.id === vehicleId);
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy phương tiện' });
    }
  
    const { type, speedAvg, capacity, consumption, status } = req.body;
    const updatedVeh: VehicleRecord = {
      ...getVehicles()[idx],
      ...(type ? { type: String(type).trim().slice(0, 100) } : {}),
      ...(speedAvg ? { speedAvg: String(speedAvg).trim().slice(0, 30) } : {}),
      ...(capacity ? { capacity: String(capacity).trim().slice(0, 30) } : {}),
      ...(consumption ? { consumption: String(consumption).trim().slice(0, 30) } : {}),
      ...(status ? { status } : {}),
    };
  
    const nextVehicles = getVehicles().map((v, i) => (i === idx ? updatedVeh : v));
    const nextConfig: SystemConfig = { ...getSystemConfig(), vehicles: nextVehicles };
    try {
      await saveSystemConfig(nextConfig);
    } catch (err) {
      console.error('[Vehicles] Failed to update in Firestore:', err);
      return res.status(503).json({ success: false, error: 'Không thể cập nhật phương tiện vào Firestore' });
    }
  
    setSystemConfig(nextConfig);
    recordAuditLog(req.authUser?.email || 'Admin', `Cập nhật thông số phương tiện: ${updatedVeh.type} - Trạng thái: ${updatedVeh.status}`);
  
    return res.json({
      success: true,
      vehicle: updatedVeh,
      vehicles: getVehicles(),
    });
  });
  
  app.delete('/api/admin/vehicles/:vehicleId', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
    const { vehicleId } = req.params;
    const target = getVehicles().find((v) => v.id === vehicleId);
    if (!target) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy phương tiện' });
    }
  
    const nextVehicles = getVehicles().filter((v) => v.id !== vehicleId);
    const nextConfig: SystemConfig = { ...getSystemConfig(), vehicles: nextVehicles };
    try {
      await saveSystemConfig(nextConfig);
    } catch (err) {
      console.error('[Vehicles] Failed to delete in Firestore:', err);
      return res.status(503).json({ success: false, error: 'Không thể xóa phương tiện khỏi Firestore' });
    }
  
    setSystemConfig(nextConfig);
    recordAuditLog(req.authUser?.email || 'Admin', `Xóa phương tiện: ${target.type}`);
  
    return res.json({
      success: true,
      vehicles: getVehicles(),
    });
  });
  
  // ==================== REFERENCE COSTS MANAGEMENT ====================
  app.get('/api/admin/reference-costs', requireAuth, requireAdmin, async (_req, res) => {
    await syncSystemConfigIfStale();
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
