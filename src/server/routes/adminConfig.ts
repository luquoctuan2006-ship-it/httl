import type { Express, Request, RequestHandler } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { ALLOWED_CONFLICT_CHECK_KEYS, ALLOWED_PRIORITY_KEYS } from '../../utils/schedule/scheduleValidator';
import type { ReferenceCostRecord, SystemConfig } from '../types/systemConfig';

type AuthenticatedRequest = Request & { authUser?: DecodedIdToken };

interface AdminConfigState {
  activeSystemConfig: SystemConfig;
  dynamicGeminiModel: string;
  dynamicGeminiTemperature: number;
  dynamicGeminiMaxTokens: number;
  dynamicGeminiSystemPrompt: string;
  activeReferenceCosts: ReferenceCostRecord[];
}

interface AdminConfigRouteDependencies {
  requireAuth: RequestHandler;
  requireAdmin: RequestHandler;
  allowedModels: string[];
  getConfigState: () => AdminConfigState;
  setConfigState: (config: SystemConfig) => void;
  syncSystemConfigIfStale: (force?: boolean) => Promise<void>;
  saveSystemConfig: (config: SystemConfig) => Promise<void>;
  recordAuditLog: (user: string, action: string) => Promise<void>;
}

export function registerAdminConfigRoutes(app: Express, dependencies: AdminConfigRouteDependencies) {
  const { requireAuth, requireAdmin, allowedModels, getConfigState, setConfigState, syncSystemConfigIfStale, saveSystemConfig, recordAuditLog } = dependencies;
  // Get System & AI Configuration
  app.get('/api/admin/config', requireAuth, requireAdmin, async (_req, res) => {
    await syncSystemConfigIfStale(true);
    const { activeSystemConfig } = getConfigState();
    return res.json({
      success: true,
      config: activeSystemConfig,
      availableModels: allowedModels.map((id) => ({
        id,
        label: id === 'gemini-3.5-flash' ? `${id} (Khuyến nghị)` : id === 'gemini-3.1-flash-lite' ? `${id} (Nhanh & kinh tế)` : id,
      })),
    });
  });
  
  // Update System & AI Configuration
  app.post('/api/admin/config', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
    await syncSystemConfigIfStale(true);
    const { activeSystemConfig, dynamicGeminiModel, dynamicGeminiTemperature, dynamicGeminiMaxTokens, dynamicGeminiSystemPrompt, activeReferenceCosts } = getConfigState();
    const body = req.body || {};
    const { aiModel, temperature, maxTokens, systemPrompt, maintenanceMode, sessionTimeout, backupAutoSchedule, rules, auditAction } = body;
  
    const hasConfigChanges =
      aiModel !== undefined ||
      temperature !== undefined ||
      maxTokens !== undefined ||
      systemPrompt !== undefined ||
      maintenanceMode !== undefined ||
      sessionTimeout !== undefined ||
      backupAutoSchedule !== undefined ||
      rules !== undefined ||
      body.referenceCosts !== undefined;
  
    if (!hasConfigChanges && typeof auditAction === 'string' && auditAction.trim()) {
      const actor = req.authUser?.email || 'Admin';
      recordAuditLog(actor, auditAction.trim().slice(0, 300));
      return res.json({
        success: true,
        config: activeSystemConfig,
        message: 'Đã ghi nhận nhật ký quản trị',
      });
    }
  
    let newAiModel = dynamicGeminiModel;
    let newTemperature = dynamicGeminiTemperature;
    let newMaxTokens = dynamicGeminiMaxTokens;
    let newSystemPrompt = dynamicGeminiSystemPrompt;
    let newMaintenanceMode = activeSystemConfig.maintenanceMode;
    let newSessionTimeout = activeSystemConfig.sessionTimeout;
    let newBackupAutoSchedule = activeSystemConfig.backupAutoSchedule;
    let newRules = { ...activeSystemConfig.rules };
    let newReferenceCosts = activeReferenceCosts;
  
    if (aiModel !== undefined) {
      if (typeof aiModel !== 'string' || !allowedModels.includes(aiModel.trim())) {
        return res.status(400).json({
          success: false,
          error: `Mô hình AI không hợp lệ. Chỉ chấp nhận các mô hình: ${allowedModels.join(', ')}`,
        });
      }
      newAiModel = aiModel.trim();
    }
  
    if (temperature !== undefined) {
      const parsedTemp = parseFloat(String(temperature));
      if (isNaN(parsedTemp) || !Number.isFinite(parsedTemp) || parsedTemp < 0 || parsedTemp > 1) {
        return res.status(400).json({
          success: false,
          error: 'Temperature phải là số thực từ 0.0 đến 1.0.',
        });
      }
      newTemperature = parsedTemp;
    }
  
    if (maxTokens !== undefined) {
      const parsedTokens = parseInt(String(maxTokens), 10);
      if (isNaN(parsedTokens) || !Number.isInteger(parsedTokens) || parsedTokens < 256 || parsedTokens > 16384) {
        return res.status(400).json({
          success: false,
          error: 'Max Tokens phải là số nguyên trong khoảng 256 đến 16,384.',
        });
      }
      newMaxTokens = parsedTokens;
    }
  
    if (systemPrompt !== undefined) {
      if (typeof systemPrompt !== 'string' || systemPrompt.trim().length === 0 || systemPrompt.length > 5000) {
        return res.status(400).json({
          success: false,
          error: 'System Prompt phải là chuỗi không rỗng và không vượt quá 5,000 ký tự.',
        });
      }
      newSystemPrompt = systemPrompt.trim();
    }
  
    if (maintenanceMode !== undefined) {
      if (typeof maintenanceMode !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'maintenanceMode phải là giá trị boolean (true/false).',
        });
      }
      newMaintenanceMode = maintenanceMode;
    }
  
    if (sessionTimeout !== undefined) {
      if (typeof sessionTimeout !== 'string' || sessionTimeout.trim().length === 0 || sessionTimeout.length > 50) {
        return res.status(400).json({
          success: false,
          error: 'sessionTimeout không hợp lệ (tối đa 50 ký tự).',
        });
      }
      newSessionTimeout = sessionTimeout.trim();
    }
  
    if (backupAutoSchedule !== undefined) {
      if (typeof backupAutoSchedule !== 'string' || backupAutoSchedule.trim().length === 0 || backupAutoSchedule.length > 100) {
        return res.status(400).json({
          success: false,
          error: 'backupAutoSchedule không hợp lệ (tối đa 100 ký tự).',
        });
      }
      newBackupAutoSchedule = backupAutoSchedule.trim();
    }
  
    if (rules !== undefined) {
      if (!rules || typeof rules !== 'object' || Array.isArray(rules)) {
        return res.status(400).json({
          success: false,
          error: 'rules phải là một đối tượng cấu hình quy tắc.',
        });
      }
      const validatedRules = { ...newRules };
      if (rules.bufferMinutes !== undefined) {
        const buf = parseInt(String(rules.bufferMinutes), 10);
        if (isNaN(buf) || buf < 5 || buf > 120) {
          return res.status(400).json({ success: false, error: 'bufferMinutes phải là số nguyên từ 5 đến 120 phút.' });
        }
        validatedRules.bufferMinutes = String(buf);
      }
      if (rules.startHour !== undefined) {
        if (typeof rules.startHour !== 'string' || !/^\d{1,2}:\d{2}$/.test(rules.startHour.trim())) {
          return res.status(400).json({ success: false, error: 'startHour phải có định dạng HH:mm.' });
        }
        validatedRules.startHour = rules.startHour.trim();
      }
      if (rules.endHour !== undefined) {
        if (typeof rules.endHour !== 'string' || !/^\d{1,2}:\d{2}$/.test(rules.endHour.trim())) {
          return res.status(400).json({ success: false, error: 'endHour phải có định dạng HH:mm.' });
        }
        validatedRules.endHour = rules.endHour.trim();
      }
      if (rules.budgetCapDaily !== undefined) {
        if (typeof rules.budgetCapDaily !== 'string' || rules.budgetCapDaily.length > 50) {
          return res.status(400).json({ success: false, error: 'budgetCapDaily không hợp lệ (tối đa 50 ký tự).' });
        }
        validatedRules.budgetCapDaily = rules.budgetCapDaily.trim();
      }
      if (rules.budgetAlertThreshold !== undefined) {
        if (typeof rules.budgetAlertThreshold !== 'string' || rules.budgetAlertThreshold.length > 20) {
          return res.status(400).json({ success: false, error: 'budgetAlertThreshold không hợp lệ.' });
        }
        validatedRules.budgetAlertThreshold = rules.budgetAlertThreshold.trim();
      }
      if (rules.contingencyPercent !== undefined) {
        if (typeof rules.contingencyPercent !== 'string' || rules.contingencyPercent.length > 20) {
          return res.status(400).json({ success: false, error: 'contingencyPercent không hợp lệ.' });
        }
        validatedRules.contingencyPercent = rules.contingencyPercent.trim();
      }
      if (rules.citySpeedLimit !== undefined) {
        if (typeof rules.citySpeedLimit !== 'string' || rules.citySpeedLimit.length > 30) {
          return res.status(400).json({ success: false, error: 'citySpeedLimit không hợp lệ.' });
        }
        validatedRules.citySpeedLimit = rules.citySpeedLimit.trim();
      }
      if (rules.highwaySpeedLimit !== undefined) {
        if (typeof rules.highwaySpeedLimit !== 'string' || rules.highwaySpeedLimit.length > 30) {
          return res.status(400).json({ success: false, error: 'highwaySpeedLimit không hợp lệ.' });
        }
        validatedRules.highwaySpeedLimit = rules.highwaySpeedLimit.trim();
      }
      if (rules.passSpeedLimit !== undefined) {
        if (typeof rules.passSpeedLimit !== 'string' || rules.passSpeedLimit.length > 30) {
          return res.status(400).json({ success: false, error: 'passSpeedLimit không hợp lệ.' });
        }
        validatedRules.passSpeedLimit = rules.passSpeedLimit.trim();
      }
      const allowedConflictKeysSet = new Set<string>(ALLOWED_CONFLICT_CHECK_KEYS);
      if (rules.conflictChecks !== undefined) {
        if (!rules.conflictChecks || typeof rules.conflictChecks !== 'object') {
          return res.status(400).json({ success: false, error: 'conflictChecks phải là object boolean.' });
        }
        const safeChecks: Record<string, boolean> = { ...validatedRules.conflictChecks };
        for (const [k, v] of Object.entries(rules.conflictChecks)) {
          if (!allowedConflictKeysSet.has(k)) {
            return res.status(400).json({ success: false, error: `Key kiểm tra xung đột '${k}' không hợp lệ.` });
          }
          if (typeof v === 'boolean') safeChecks[k] = v;
        }
        validatedRules.conflictChecks = safeChecks;
      }
  
      const allowedPriorityKeysSet = new Set<string>(ALLOWED_PRIORITY_KEYS);
      if (rules.optimizationPriorities !== undefined) {
        if (!rules.optimizationPriorities || typeof rules.optimizationPriorities !== 'object') {
          return res.status(400).json({ success: false, error: 'optimizationPriorities phải là object boolean.' });
        }
        const safePriorities: Record<string, boolean> = { ...validatedRules.optimizationPriorities };
        for (const [k, v] of Object.entries(rules.optimizationPriorities)) {
          if (!allowedPriorityKeysSet.has(k)) {
            return res.status(400).json({ success: false, error: `Ưu tiên tối ưu '${k}' không hợp lệ.` });
          }
          if (typeof v === 'boolean') safePriorities[k] = v;
        }
        validatedRules.optimizationPriorities = safePriorities;
      }
      newRules = validatedRules;
    }
  
    if (body.referenceCosts !== undefined) {
      if (!Array.isArray(body.referenceCosts)) {
        return res.status(400).json({ success: false, error: 'referenceCosts phải là danh sách mảng.' });
      }
      const validatedCosts: ReferenceCostRecord[] = [];
      for (let i = 0; i < body.referenceCosts.length; i++) {
        const c = body.referenceCosts[i];
        if (!c || typeof c !== 'object') {
          return res.status(400).json({ success: false, error: `Định mức chi phí thứ ${i + 1} không hợp lệ.` });
        }
        const id = typeof c.id === 'string' && c.id.trim() ? c.id.trim().slice(0, 64) : '';
        const item = typeof c.item === 'string' && c.item.trim() ? c.item.trim().slice(0, 150) : '';
        const price = typeof c.price === 'string' && c.price.trim() ? c.price.trim().slice(0, 50) : '';
        if (!id || !item || !price) {
          return res.status(400).json({ success: false, error: `Định mức chi phí thứ ${i + 1} thiếu id, hạng mục hoặc giá.` });
        }
        const category = typeof c.category === 'string' ? c.category.slice(0, 50) : 'Vé tham quan';
        const note = typeof c.note === 'string' ? c.note.slice(0, 200) : '';
        validatedCosts.push({ id, category, item, price, note });
      }
      newReferenceCosts = validatedCosts;
    }
  
    const nextSystemConfig: SystemConfig = {
      ...activeSystemConfig,
      aiModel: newAiModel,
      temperature: newTemperature,
      maxTokens: newMaxTokens,
      systemPrompt: newSystemPrompt,
      maintenanceMode: newMaintenanceMode,
      sessionTimeout: newSessionTimeout,
      backupAutoSchedule: newBackupAutoSchedule,
      rules: newRules,
      referenceCosts: newReferenceCosts,
    };
  
    // Lưu Firestore trước — nếu ghi DB thất bại, trả lỗi 503 và không cập nhật RAM sai lệch
    try {
      await saveSystemConfig(nextSystemConfig);
    } catch (err) {
      console.error('[SystemConfig] Failed to save admin settings to Firestore:', err);
      return res.status(503).json({
        success: false,
        error: 'Không thể lưu cấu hình vào cơ sở dữ liệu Firestore. Vui lòng thử lại.',
      });
    }
  
    setConfigState(nextSystemConfig);
  
    const actor = req.authUser?.email || 'Admin';
    recordAuditLog(
      actor,
      `Cập nhật cấu hình quản trị: Model=${nextSystemConfig.aiModel}, MaxTokens=${nextSystemConfig.maxTokens}, Temp=${nextSystemConfig.temperature}, Bảo trì=${nextSystemConfig.maintenanceMode ? 'BẬT' : 'TẮT'}`
    );
  
    return res.json({
      success: true,
      config: nextSystemConfig,
      message: 'Cập nhật cấu hình thành công',
    });
  });
}
