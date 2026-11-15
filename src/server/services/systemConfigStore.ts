import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { ReferenceCostRecord, SystemConfig, VehicleRecord } from '../types/systemConfig';

export const ALLOWED_AI_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
];

const DEFAULT_VEHICLES: VehicleRecord[] = [
  { id: 'veh-1', type: 'Xe du lịch 29 chỗ', speedAvg: '45 km/h', capacity: '28 khách', consumption: '16L / 100km', status: 'Sẵn sàng điều phối' },
  { id: 'veh-2', type: 'Xe du lịch 16 chỗ (Transit)', speedAvg: '52 km/h', capacity: '15 khách', consumption: '11L / 100km', status: 'Sẵn sàng điều phối' },
  { id: 'veh-3', type: 'Xe du lịch 45 chỗ (Universe)', speedAvg: '40 km/h', capacity: '44 khách', consumption: '24L / 100km', status: 'Sẵn sàng điều phối' },
  { id: 'veh-4', type: 'Xe 7 chỗ cao cấp (Carnival)', speedAvg: '60 km/h', capacity: '6 khách', consumption: '9L / 100km', status: 'Bảo dưỡng định kỳ' },
];

const DEFAULT_REFERENCE_COSTS: ReferenceCostRecord[] = [
  { id: 'cost-1', category: 'Vé tham quan', item: 'Cáp treo Bà Nà Hills (Kèm Buffet)', price: '1.250.000 ₫ / vé', note: 'Bao gồm vé vào cổng & cáp treo 2 chiều' },
  { id: 'cost-2', category: 'Vé tham quan', item: 'Vé tham quan Hoàng Cung Huế', price: '200.000 ₫ / vé', note: 'Áp dụng cho người lớn' },
  { id: 'cost-3', category: 'Vé tham quan', item: 'Vé du thuyền Sông Hương nghe ca Huế', price: '150.000 ₫ / người', note: 'Chuyến tối 19:30 - 20:30' },
  { id: 'cost-4', category: 'Ăn uống', item: 'Suất ăn trưa tiêu chuẩn Tour', price: '180.000 ₫ / suất', note: 'Thực đơn đặc sản miền Trung' },
  { id: 'cost-5', category: 'Lưu trú', item: 'Khách sạn 4 sao ven biển Đà Nẵng', price: '950.000 ₫ / đêm', note: 'Phòng Deluxe 2 người kèm ăn sáng' },
  { id: 'cost-6', category: 'Phương tiện', item: 'Thuê xe 29 chỗ phục vụ trọn ngày', price: '2.500.000 ₫ / ngày', note: 'Đã gồm lái xe & xăng dầu tuyến miền Trung' },
  { id: 'cost-7', category: 'Hướng dẫn viên', item: 'Công tác phí HDV nội địa tiếng Việt', price: '600.000 ₫ / ngày', note: 'Tiêu chuẩn HDV có thẻ hành nghề quốc gia' },
];

const SYSTEM_CONFIG_SYNC_TTL_MS = 15_000;

export function createSystemConfigStore(
  getFirestoreOrNull: () => Firestore | null,
  requireFirestore: () => Firestore,
) {
  let activeVehicles: VehicleRecord[] = [...DEFAULT_VEHICLES];
  let activeReferenceCosts: ReferenceCostRecord[] = [...DEFAULT_REFERENCE_COSTS];
  let dynamicGeminiModel = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash';
  let dynamicGeminiTemperature = 0.55;
  let dynamicGeminiMaxTokens = 16000;
  let dynamicGeminiSystemPrompt = 'Bạn là chuyên gia điều phối tour du lịch cao cấp tại Việt Nam.';
  let lastSystemConfigSyncAt = 0;

  let activeSystemConfig: SystemConfig = {
    aiModel: dynamicGeminiModel,
    temperature: dynamicGeminiTemperature,
    maxTokens: dynamicGeminiMaxTokens,
    systemPrompt: dynamicGeminiSystemPrompt,
    maintenanceMode: false,
    sessionTimeout: '60 phút',
    backupAutoSchedule: 'Hằng ngày lúc 00:00',
    rules: {
      bufferMinutes: '20',
      startHour: '07:30',
      endHour: '21:30',
      budgetCapDaily: '8.000.000 ₫',
      budgetAlertThreshold: '90%',
      contingencyPercent: '10%',
      citySpeedLimit: '40 km/h',
      highwaySpeedLimit: '60 km/h',
      passSpeedLimit: '35 km/h',
      conflictChecks: {
        overlapTime: true,
        openingHoursMismatch: true,
        impossibleTransit: true,
        hotelCheckinConflict: true,
      },
      optimizationPriorities: {
        costSaving: true,
        transitTimeMinimization: true,
        avoidHotNoonSun: true,
        elderlyPacing: false,
      },
    },
    vehicles: activeVehicles,
    referenceCosts: activeReferenceCosts,
  };

  function applySnapshot(data: Partial<SystemConfig>): void {
    if (typeof data.aiModel === 'string' && ALLOWED_AI_MODELS.includes(data.aiModel.trim())) {
      dynamicGeminiModel = data.aiModel.trim();
    }
    if (typeof data.temperature === 'number' && Number.isFinite(data.temperature) && data.temperature >= 0 && data.temperature <= 1) {
      dynamicGeminiTemperature = data.temperature;
    }
    if (typeof data.maxTokens === 'number' && Number.isInteger(data.maxTokens) && data.maxTokens >= 256 && data.maxTokens <= 16384) {
      dynamicGeminiMaxTokens = data.maxTokens;
    }
    if (typeof data.systemPrompt === 'string' && data.systemPrompt.trim().length > 0) {
      dynamicGeminiSystemPrompt = data.systemPrompt.trim().slice(0, 5000);
    }
    if (typeof data.maintenanceMode === 'boolean') {
      activeSystemConfig.maintenanceMode = data.maintenanceMode;
    }
    if (typeof data.sessionTimeout === 'string' && data.sessionTimeout.trim().length > 0) {
      activeSystemConfig.sessionTimeout = data.sessionTimeout.trim().slice(0, 50);
    }
    if (typeof data.backupAutoSchedule === 'string' && data.backupAutoSchedule.trim().length > 0) {
      activeSystemConfig.backupAutoSchedule = data.backupAutoSchedule.trim().slice(0, 100);
    }
    if (data.rules && typeof data.rules === 'object' && !Array.isArray(data.rules)) {
      const loadedRules = { ...activeSystemConfig.rules };
      if (typeof data.rules.bufferMinutes === 'string' && !isNaN(parseInt(data.rules.bufferMinutes, 10))) {
        const b = parseInt(data.rules.bufferMinutes, 10);
        if (b >= 5 && b <= 120) loadedRules.bufferMinutes = String(b);
      }
      if (typeof data.rules.startHour === 'string' && /^\d{1,2}:\d{2}$/.test(data.rules.startHour.trim())) {
        loadedRules.startHour = data.rules.startHour.trim();
      }
      if (typeof data.rules.endHour === 'string' && /^\d{1,2}:\d{2}$/.test(data.rules.endHour.trim())) {
        loadedRules.endHour = data.rules.endHour.trim();
      }
      if (typeof data.rules.budgetCapDaily === 'string') loadedRules.budgetCapDaily = data.rules.budgetCapDaily.slice(0, 50);
      if (typeof data.rules.budgetAlertThreshold === 'string') loadedRules.budgetAlertThreshold = data.rules.budgetAlertThreshold.slice(0, 20);
      if (typeof data.rules.contingencyPercent === 'string') loadedRules.contingencyPercent = data.rules.contingencyPercent.slice(0, 20);
      if (typeof data.rules.citySpeedLimit === 'string') loadedRules.citySpeedLimit = data.rules.citySpeedLimit.slice(0, 30);
      if (typeof data.rules.highwaySpeedLimit === 'string') loadedRules.highwaySpeedLimit = data.rules.highwaySpeedLimit.slice(0, 30);
      if (typeof data.rules.passSpeedLimit === 'string') loadedRules.passSpeedLimit = data.rules.passSpeedLimit.slice(0, 30);
      if (data.rules.conflictChecks && typeof data.rules.conflictChecks === 'object') {
        for (const [k, v] of Object.entries(data.rules.conflictChecks)) {
          if (typeof v === 'boolean') loadedRules.conflictChecks[k] = v;
        }
      }
      if (data.rules.optimizationPriorities && typeof data.rules.optimizationPriorities === 'object') {
        for (const [k, v] of Object.entries(data.rules.optimizationPriorities)) {
          if (typeof v === 'boolean') loadedRules.optimizationPriorities[k] = v;
        }
      }
      activeSystemConfig.rules = loadedRules;
    }
    if (Array.isArray(data.vehicles)) {
      activeVehicles = data.vehicles.filter((v: unknown) => {
        const rec = v as Partial<VehicleRecord>;
        return rec && typeof rec.id === 'string' && typeof rec.type === 'string';
      }) as VehicleRecord[];
    }
    if (Array.isArray(data.referenceCosts)) {
      activeReferenceCosts = data.referenceCosts.filter((c: unknown) => {
        const rec = c as Partial<ReferenceCostRecord>;
        return rec && typeof rec.id === 'string' && typeof rec.item === 'string';
      }) as ReferenceCostRecord[];
    }

    activeSystemConfig = {
      ...activeSystemConfig,
      aiModel: dynamicGeminiModel,
      temperature: dynamicGeminiTemperature,
      maxTokens: dynamicGeminiMaxTokens,
      systemPrompt: dynamicGeminiSystemPrompt,
      vehicles: activeVehicles,
      referenceCosts: activeReferenceCosts,
    };
  }

  async function loadSystemConfig(): Promise<void> {
    const db = getFirestoreOrNull();
    if (!db) return;
    try {
      const docRef = db.collection('system_config').doc('admin_settings');
      const snap = await docRef.get();
      if (snap.exists) {
        applySnapshot(snap.data() as Partial<SystemConfig>);
        lastSystemConfigSyncAt = Date.now();
        console.log('[SystemConfig] Loaded and validated admin settings from Firestore.');
      } else {
        await docRef.set({
          ...activeSystemConfig,
          updatedAt: FieldValue.serverTimestamp(),
        });
        lastSystemConfigSyncAt = Date.now();
        console.log('[SystemConfig] Initialized default admin settings in Firestore.');
      }
    } catch (err) {
      console.warn('[SystemConfig] Error reading from Firestore:', err);
    }
  }

  async function syncSystemConfigIfStale(force = false): Promise<void> {
    const db = getFirestoreOrNull();
    if (!db) return;
    if (!force && Date.now() - lastSystemConfigSyncAt < SYSTEM_CONFIG_SYNC_TTL_MS) return;
    try {
      const snap = await db.collection('system_config').doc('admin_settings').get();
      if (snap.exists) {
        applySnapshot(snap.data() as Partial<SystemConfig>);
      }
      lastSystemConfigSyncAt = Date.now();
    } catch (err) {
      console.warn('[SystemConfig] Sync from Firestore failed:', err);
    }
  }

  async function saveSystemConfig(config: SystemConfig): Promise<void> {
    const db = requireFirestore();
    await db.collection('system_config').doc('admin_settings').set({
      ...config,
      updatedAt: FieldValue.serverTimestamp(),
    });
    lastSystemConfigSyncAt = Date.now();
  }

  return {
    loadSystemConfig,
    syncSystemConfigIfStale,
    saveSystemConfig,
    getSystemConfig: () => activeSystemConfig,
    getVehicles: () => activeVehicles,
    getReferenceCosts: () => activeReferenceCosts,
    getConfigState: () => ({
      activeSystemConfig,
      dynamicGeminiModel,
      dynamicGeminiTemperature,
      dynamicGeminiMaxTokens,
      dynamicGeminiSystemPrompt,
      activeVehicles,
      activeReferenceCosts,
    }),
    setConfigState: (config: SystemConfig) => {
      dynamicGeminiModel = config.aiModel;
      dynamicGeminiTemperature = config.temperature;
      dynamicGeminiMaxTokens = config.maxTokens;
      dynamicGeminiSystemPrompt = config.systemPrompt;
      activeVehicles = config.vehicles;
      activeReferenceCosts = config.referenceCosts;
      activeSystemConfig = config;
    },
    setFleetSystemConfig: (config: SystemConfig) => {
      activeSystemConfig = config;
      activeVehicles = config.vehicles;
      activeReferenceCosts = config.referenceCosts;
    },
    getGeminiSettings: () => ({
      model: dynamicGeminiModel,
      temperature: dynamicGeminiTemperature,
      maxTokens: dynamicGeminiMaxTokens,
    }),
  };
}
