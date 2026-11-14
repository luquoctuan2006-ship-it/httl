import express, { NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import helmet from 'helmet';
import { App as FirebaseAdminApp, cert, getApps, initializeApp } from 'firebase-admin/app';
import { Auth as FirebaseAdminAuth, DecodedIdToken, getAuth, UserRecord } from 'firebase-admin/auth';
import { FieldValue, Firestore, getFirestore } from 'firebase-admin/firestore';
import { GoogleGenAI } from '@google/genai';
import rateLimit from 'express-rate-limit';
import { FirestoreRateLimitStore } from './src/server/middleware/firestoreRateLimitStore';
import { registerTripManagementRoutes } from './src/server/routes/tripManagement';
import { registerAdminUserRoutes } from './src/server/routes/adminUsers';
import { registerGeminiRoutes } from './src/server/routes/gemini';
import { registerFleetRoutes } from './src/server/routes/fleet';
import { registerAdminMonitoringRoutes } from './src/server/routes/adminMonitoring';
import { registerAdminConfigRoutes } from './src/server/routes/adminConfig';
import { ActiveGeminiJobLimitError } from './src/server/errors/activeGeminiJobLimitError';
import type { ReferenceCostRecord, SystemConfig, VehicleRecord } from './src/server/types/systemConfig';
export type { ReferenceCostRecord, SystemConfig, VehicleRecord };
import {
  listAILogs,
  listAuditLogs,
  recordAIErrorLog,
  recordAIRequestLog,
  recordAuditLog as persistAuditLog,
} from './src/server/services/systemLogs';
import { normalizeTripData } from './src/data/normalizeTripData';
import type { ManagedUserRecord } from './src/types/auth';
import { TripData, TripMember, OperationalAlert } from './src/types/travel';
import { parseGeminiJson } from './src/utils/geminiJson';
import { buildRuleBasedScheduleOptimization, pickTripForOptimization, runOptimization } from './src/utils/scheduleOptimizer';
import { detectScheduleAndWeatherAlerts } from './src/utils/alertDetector';
import { ALLOWED_CONFLICT_CHECK_KEYS, ALLOWED_PRIORITY_KEYS } from './src/utils/scheduleValidator';
import {
  canAccessTrip,
  computeAuthoritativeTripDerivedFields,
  estimateTripByteSize,
  isAdminUser,
  MAX_TRIP_DOC_BYTES,
} from './src/utils/tripRepository';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const portArgIdx = process.argv.indexOf('--port');
const cliPort = portArgIdx !== -1 ? Number(process.argv[portArgIdx + 1]) : NaN;
const envPort = Number(process.env.PORT);
const port =
  Number.isInteger(cliPort) && cliPort > 0
    ? cliPort
    : Number.isInteger(envPort) && envPort > 0 && String(envPort) !== process.env.NGINX_PORT
      ? envPort
      : 3000;

app.set('trust proxy', 1);
const isProduction = process.env.NODE_ENV === 'production';

app.use(
  helmet({
    frameguard: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: isProduction
          ? ["'self'"]
          : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://unpkg.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: [
          "'self'",
          'data:',
          'blob:',
          'https://*.basemaps.cartocdn.com',
          'https://server.arcgisonline.com',
          'https://*.googleusercontent.com',
          'https://unpkg.com',
        ],
        workerSrc: ["'self'", 'blob:'],
        manifestSrc: ["'self'"],
        connectSrc: [
          "'self'",
          'https://*.googleapis.com',
          'https://*.firebaseio.com',
          'https://*.basemaps.cartocdn.com',
          'https://api.open-meteo.com',
          'https://identitytoolkit.googleapis.com',
          'https://securetoken.googleapis.com',
          ...(isProduction ? [] : ['ws://localhost:*', 'wss://localhost:*', 'ws://127.0.0.1:*', 'wss://127.0.0.1:*']),
        ],
        frameSrc: ["'self'"],
        frameAncestors: [
          "'self'",
          'https://*.google.com',
          'https://*.run.app',
          ...(isProduction ? [] : ['http://localhost:*']),
        ],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: null,
      },
    },
  })
);
app.use(express.json({ limit: '2mb' }));

const aiRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 10,
  store: new FirestoreRateLimitStore(() => requireFirestore()),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Bạn đã vượt quá giới hạn yêu cầu AI. Vui lòng đợi 5 phút rồi thử lại.',
  },
  // Giới hạn theo từng tài khoản để một user không làm nghẽn các user khác.
  // Middleware này luôn chạy sau requireAuth nên req.authUser đã có.
  keyGenerator: (req) => `uid:${(req as AuthenticatedRequest).authUser?.uid ?? 'anonymous'}`,
});

const serviceAccountPath = path.resolve(
  __dirname,
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 'secrets/firebase-service-account.json',
);

let firebaseApp: FirebaseAdminApp | null = null;
let firestore: Firestore | null = null;
let firebaseAuth: FirebaseAdminAuth | null = null;

if (existsSync(serviceAccountPath)) {
  try {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    firebaseApp = getApps()[0] || initializeApp({ credential: cert(serviceAccount) });
    firestore = getFirestore(firebaseApp);
    try { firestore.settings({ ignoreUndefinedProperties: true }); } catch { /* đã được khởi tạo */ }
    firebaseAuth = getAuth(firebaseApp);
  } catch (err) {
    console.warn('[Firebase Admin] Could not be initialized:', err);
  }
} else {
  console.warn('[Firebase Admin] Service account not found — API routes requiring auth will return 503');
}

export const ALLOWED_AI_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
];

let activeVehicles: VehicleRecord[] = [
  { id: 'veh-1', type: 'Xe du lịch 29 chỗ', speedAvg: '45 km/h', capacity: '28 khách', consumption: '16L / 100km', status: 'Sẵn sàng điều phối' },
  { id: 'veh-2', type: 'Xe du lịch 16 chỗ (Transit)', speedAvg: '52 km/h', capacity: '15 khách', consumption: '11L / 100km', status: 'Sẵn sàng điều phối' },
  { id: 'veh-3', type: 'Xe du lịch 45 chỗ (Universe)', speedAvg: '40 km/h', capacity: '44 khách', consumption: '24L / 100km', status: 'Sẵn sàng điều phối' },
  { id: 'veh-4', type: 'Xe 7 chỗ cao cấp (Carnival)', speedAvg: '60 km/h', capacity: '6 khách', consumption: '9L / 100km', status: 'Bảo dưỡng định kỳ' },
];

let activeReferenceCosts: ReferenceCostRecord[] = [
  { id: 'cost-1', category: 'Vé tham quan', item: 'Cáp treo Bà Nà Hills (Kèm Buffet)', price: '1.250.000 ₫ / vé', note: 'Bao gồm vé vào cổng & cáp treo 2 chiều' },
  { id: 'cost-2', category: 'Vé tham quan', item: 'Vé tham quan Hoàng Cung Huế', price: '200.000 ₫ / vé', note: 'Áp dụng cho người lớn' },
  { id: 'cost-3', category: 'Vé tham quan', item: 'Vé du thuyền Sông Hương nghe ca Huế', price: '150.000 ₫ / người', note: 'Chuyến tối 19:30 - 20:30' },
  { id: 'cost-4', category: 'Ăn uống', item: 'Suất ăn trưa tiêu chuẩn Tour', price: '180.000 ₫ / suất', note: 'Thực đơn đặc sản miền Trung' },
  { id: 'cost-5', category: 'Lưu trú', item: 'Khách sạn 4 sao ven biển Đà Nẵng', price: '950.000 ₫ / đêm', note: 'Phòng Deluxe 2 người kèm ăn sáng' },
  { id: 'cost-6', category: 'Phương tiện', item: 'Thuê xe 29 chỗ phục vụ trọn ngày', price: '2.500.000 ₫ / ngày', note: 'Đã gồm lái xe & xăng dầu tuyến miền Trung' },
  { id: 'cost-7', category: 'Hướng dẫn viên', item: 'Công tác phí HDV nội địa tiếng Việt', price: '600.000 ₫ / ngày', note: 'Tiêu chuẩn HDV có thẻ hành nghề quốc gia' },
];

let dynamicGeminiModel = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash';
let dynamicGeminiTemperature = 0.55;
let dynamicGeminiMaxTokens = 16000;
let dynamicGeminiSystemPrompt = 'Bạn là chuyên gia điều phối tour du lịch cao cấp tại Việt Nam.';

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

const SYSTEM_CONFIG_SYNC_TTL_MS = 15_000;
let lastSystemConfigSyncAt = 0;

function applySystemConfigSnapshot(data: Partial<SystemConfig>): void {
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
    const filtered = data.vehicles.filter((v: unknown) => {
      const rec = v as Partial<VehicleRecord>;
      return rec && typeof rec.id === 'string' && typeof rec.type === 'string';
    }) as VehicleRecord[];
    activeVehicles = filtered;
  }
  if (Array.isArray(data.referenceCosts)) {
    const filtered = data.referenceCosts.filter((c: unknown) => {
      const rec = c as Partial<ReferenceCostRecord>;
      return rec && typeof rec.id === 'string' && typeof rec.item === 'string';
    }) as ReferenceCostRecord[];
    activeReferenceCosts = filtered;
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
  if (!firestore) return;
  try {
    const docRef = firestore.collection('system_config').doc('admin_settings');
    const snap = await docRef.get();
    if (snap.exists) {
      applySystemConfigSnapshot(snap.data() as Partial<SystemConfig>);
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

// Đồng bộ lại cấu hình giữa các instance Cloud Run theo TTL ngắn (15s)
async function syncSystemConfigIfStale(force = false): Promise<void> {
  if (!firestore) return;
  if (!force && Date.now() - lastSystemConfigSyncAt < SYSTEM_CONFIG_SYNC_TTL_MS) return;
  try {
    const snap = await firestore.collection('system_config').doc('admin_settings').get();
    if (snap.exists) {
      applySystemConfigSnapshot(snap.data() as Partial<SystemConfig>);
    }
    lastSystemConfigSyncAt = Date.now();
  } catch (err) {
    console.warn('[SystemConfig] Sync from Firestore failed:', err);
  }
}

// Bắt buộc ném lỗi nếu lưu Firestore thất bại để API trả 503 thay vì báo thành công giả
async function saveSystemConfig(config: SystemConfig): Promise<void> {
  const db = requireFirestore();
  await db.collection('system_config').doc('admin_settings').set({
    ...config,
    updatedAt: FieldValue.serverTimestamp(),
  });
  lastSystemConfigSyncAt = Date.now();
}

async function recordAuditLog(user: string, action: string, status: 'Thành công' | 'Cảnh báo' | 'Thất bại' = 'Thành công') {
  if (!firestore) {
    console.error('[Audit Log] Firestore chưa sẵn sàng; không thể ghi nhật ký.');
    return;
  }
  try {
    await persistAuditLog(firestore, user, action, status);
  } catch (error) {
    console.error('[Audit Log] Không thể ghi nhật ký vào Firestore:', error);
  }
}

type AuthenticatedRequest = Request & { authUser?: DecodedIdToken };

async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authorization = req.header('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return res.status(401).json({ success: false, error: 'Vui lòng đăng nhập' });

  // Chỉ chấp nhận ID token Firebase đã được xác minh chữ ký.
  // Quyền admin chỉ đến từ custom claim `role` (đặt bằng scripts/set-role.ts).
  if (!firebaseAuth || !firestore) {
    return res.status(503).json({
      success: false,
      error: 'Máy chủ chưa cấu hình Firebase Admin / Firestore (secrets/firebase-service-account.json) nên không thể xác thực.',
    });
  }

  try {
    await syncSystemConfigIfStale();
    const decoded = await firebaseAuth.verifyIdToken(token, true);
    const role = decoded.role === 'admin' ? 'admin' : 'user';

    // Kiểm tra chế độ bảo trì: chỉ Admin mới được phép thao tác khi bảo trì
    if (activeSystemConfig.maintenanceMode && role !== 'admin') {
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

// ===== Chuyến đi: mỗi chuyến thuộc về một user (ownerId) =====
const TRIP_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

function requireFirestore(): Firestore {
  if (!firestore) {
    throw new Error('Firestore chưa được khởi tạo');
  }
  return firestore;
}

function isConflictError(error: unknown) {
  const code = (error as { code?: unknown })?.code;
  return code === 6 || code === 'already-exists';
}

async function getTripById(tripId: string): Promise<TripData | null> {
  const db = requireFirestore();
  const snap = await db.collection('trips').doc(tripId).get();
  return snap.exists ? normalizeTripData(snap.data()) : null;
}

async function listTripsForUser(
  user: DecodedIdToken,
  options: { limit?: number; startAfterId?: string } = {},
): Promise<{ trips: TripData[]; hasMore: boolean; nextCursor: string | null }> {
  const isValid = (t: TripData) => typeof t.id === 'string' && Array.isArray(t.days);
  const db = requireFirestore();
  const safeLimit = Math.min(Math.max(1, options.limit || 50), 200);

  const col = db.collection('trips');
  let query = isAdminUser(user)
    ? col.orderBy('updatedAt', 'desc')
    : col.where('ownerId', '==', user.uid);

  if (isAdminUser(user) && options.startAfterId) {
    const cursorSnap = await col.doc(options.startAfterId).get();
    if (cursorSnap.exists) {
      query = query.startAfter(cursorSnap);
    }
  }

  let docs;
  try {
    const snapshot = await query.limit(safeLimit + 1).get();
    docs = snapshot.docs;
  } catch {
    // Fallback nếu chưa có trường updatedAt đồng nhất hoặc chưa có index
    const fallbackSnap = isAdminUser(user)
      ? await col.limit(safeLimit + 1).get()
      : await col.where('ownerId', '==', user.uid).limit(safeLimit + 1).get();
    docs = [...fallbackSnap.docs].sort((a, b) => b.updateTime.toMillis() - a.updateTime.toMillis());
  }

  const hasMore = docs.length > safeLimit;
  const pageDocs = docs.slice(0, safeLimit);
  if (!isAdminUser(user)) {
    pageDocs.sort((a, b) => b.updateTime.toMillis() - a.updateTime.toMillis());
  }

  const trips = pageDocs
    .filter((d) => d.id !== 'active') // doc dùng chung cũ, bỏ qua
    .map((d) => normalizeTripData(d.data()))
    .filter(isValid);

  const lastDoc = pageDocs[pageDocs.length - 1];
  return {
    trips,
    hasMore,
    nextCursor: hasMore && lastDoc ? lastDoc.id : null,
  };
}

async function createTripDoc(trip: TripData): Promise<void> {
  const db = requireFirestore();
  await db.collection('trips').doc(trip.id).create({
    ...trip,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function deleteTripDoc(tripId: string): Promise<void> {
  const db = requireFirestore();
  const receiptSnap = await db.collection('trip_receipts').where('tripId', '==', tripId).get();
  if (!receiptSnap.empty) {
    const CHUNK = 400;
    for (let i = 0; i < receiptSnap.docs.length; i += CHUNK) {
      const batch = db.batch();
      receiptSnap.docs.slice(i, i + CHUNK).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
  await db.collection('trips').doc(tripId).delete();
}

// Người dùng mới bắt đầu với danh sách chuyến đi trống, không tạo chuyến mẫu giả
async function loadUserTrips(user: DecodedIdToken): Promise<TripData[]> {
  const { trips } = await listTripsForUser(user);
  return trips;
}

registerTripManagementRoutes(app, {
  requireAuth,
  requireFirestore,
  listTripsForUser,
  loadUserTrips,
  getTripById,
  createTripDoc,
  deleteTripDoc,
  recordAuditLog,
});

const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
const geminiFallbackModel = process.env.GEMINI_FALLBACK_MODEL?.trim() || 'gemini-3.1-flash-lite';
const geminiCacheTtlMs = Math.max(0, Number.parseInt(process.env.GEMINI_CACHE_TTL_MS || '300000', 10));
const geminiRequestTimeoutMs = Math.max(30_000, Number.parseInt(process.env.GEMINI_TIMEOUT_MS || '30000', 10));
const GEMINI_JOB_TTL_MS = 15 * 60 * 1000;


const ai = geminiApiKey
  ? new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        timeout: geminiRequestTimeoutMs,
        retryOptions: { attempts: 1 },
      },
    })
  : null;

type GeminiCacheEntry = {
  expiresAt: number;
  value: unknown;
};

const geminiCache = new Map<string, GeminiCacheEntry>();
const maxGeminiCacheEntries = 200;
const inFlightGeminiRequests = new Map<string, Promise<unknown>>();

type GeminiJobStatus = 'queued' | 'running' | 'completed' | 'failed';

type GeminiJob = {
  id: string;
  ownerUid: string;
  slotIndex: number;
  status: GeminiJobStatus;
  progress: string;
  createdAt: number;
  updatedAt: number;
  result?: unknown;
  error?: string;
};

// Tự động dọn dẹp gemini_jobs (15 phút) và audit_logs (30 ngày) tránh phình dữ liệu Firestore
const jobCleanupInterval = setInterval(async () => {
  const now = Date.now();
  if (firestore) {
    try {
      const snap = await firestore.collection('gemini_jobs')
        .where('createdAt', '<=', now - GEMINI_JOB_TTL_MS)
        .limit(25)
        .get();
      if (!snap.empty) {
        for (const doc of snap.docs) {
          const job = doc.data() as GeminiJob;
          if (job.ownerUid && Number.isInteger(job.slotIndex)) {
            await releaseGeminiJobSlot(job);
          }
          await doc.ref.delete();
        }
      }
    } catch (error) {
      console.error('[Gemini Job] Không thể dọn job hết hạn:', error);
    }

    try {
      const expiredLogsSnap = await firestore.collection('audit_logs')
        .where('expiresAt', '<', now)
        .limit(50)
        .get();
      if (!expiredLogsSnap.empty) {
        const batch = firestore.batch();
        expiredLogsSnap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }
    } catch (error) {
      console.error('[Audit Log] Không thể dọn nhật ký hết hạn:', error);
    }

    for (const collectionName of ['rate_limits', 'ai_request_logs', 'ai_error_logs']) {
      try {
        const expired = await firestore.collection(collectionName)
          .where('expiresAt', '<=', new Date(now))
          .limit(100)
          .get();
        if (!expired.empty) {
          const batch = firestore.batch();
          expired.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }
      } catch (error) {
        console.error(`[${collectionName}] Không thể dọn dữ liệu hết hạn:`, error);
      }
    }
  }
}, 60_000);
jobCleanupInterval.unref();

function geminiJobSlotRef(uid: string, slotIndex: number) {
  return requireFirestore().collection('gemini_job_slots').doc(`${uid}_${slotIndex}`);
}

async function releaseGeminiJobSlot(job: Pick<GeminiJob, 'id' | 'ownerUid' | 'slotIndex'>): Promise<void> {
  const db = requireFirestore();
  const slotRef = db.collection('gemini_job_slots').doc(`${job.ownerUid}_${job.slotIndex}`);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(slotRef);
    if (snapshot.exists && snapshot.data()?.jobId === job.id) {
      transaction.delete(slotRef);
    }
  });
}

async function updateGeminiJob(job: GeminiJob, updates: Partial<GeminiJob>, terminal = false): Promise<GeminiJob> {
  const db = requireFirestore();
  const jobRef = db.collection('gemini_jobs').doc(job.id);
  const slotRef = geminiJobSlotRef(job.ownerUid, job.slotIndex);

  return db.runTransaction(async (transaction) => {
    const [jobSnapshot, slotSnapshot] = await Promise.all([transaction.get(jobRef), transaction.get(slotRef)]);
    if (!jobSnapshot.exists) throw new Error(`Gemini job ${job.id} không còn tồn tại`);
    const currentJob = jobSnapshot.data() as GeminiJob;
    const updatedJob = { ...currentJob, ...updates, updatedAt: Date.now() };
    transaction.set(jobRef, updatedJob);

    if (terminal && slotSnapshot.exists && slotSnapshot.data()?.jobId === job.id) {
      transaction.delete(slotRef);
    } else if (!terminal && slotSnapshot.exists && slotSnapshot.data()?.jobId === job.id) {
      transaction.set(slotRef, { jobId: job.id, leaseUntil: Date.now() + 5 * 60 * 1000 });
    }
    return updatedJob;
  });
}

function createJobId(): string {
  return `gemini-${randomUUID()}`;
}

// Cache được định danh chính xác theo User UID
function createGeminiCacheKey(operation: string, payload: unknown, uid?: string): string {
  const userPrefix = uid ? `${uid}:` : '';
  return `${userPrefix}${operation}:${JSON.stringify(payload)}`;
}

function getCachedGeminiResult(cacheKey: string): unknown | undefined {
  const cached = geminiCache.get(cacheKey);
  if (!cached) return undefined;

  if (cached.expiresAt <= Date.now()) {
    geminiCache.delete(cacheKey);
    return undefined;
  }

  return cached.value;
}

function setCachedGeminiResult(cacheKey: string, value: unknown): void {
  geminiCache.set(cacheKey, { expiresAt: Date.now() + geminiCacheTtlMs, value });

  while (geminiCache.size > maxGeminiCacheEntries) {
    const oldestKey = geminiCache.keys().next().value;
    if (oldestKey === undefined) break;
    geminiCache.delete(oldestKey);
  }
}

async function generateWithGemini(prompt: string, userWhoInvoked = 'Hệ thống'): Promise<any> {
  if (!ai) {
    throw new Error('Thiếu GEMINI_API_KEY. Hãy đặt khóa trong tệp .env ở thư mục gốc rồi khởi động lại server.');
  }

  const selectedModel = dynamicGeminiModel || 'gemini-3.5-flash';
  const models = [selectedModel, geminiFallbackModel].filter((model, index, values) => model && values.indexOf(model) === index);
  const startTime = Date.now();

  for (let index = 0; index < models.length; index += 1) {
    try {
      const modelId = models[index];
      // Gemini 3.x dùng thinkingLevel; Gemini 2.5 Flash dùng thinkingBudget (0 = tắt);
      // 2.5 Pro và các model khác không cho tắt thinking nên không gửi tham số này.
      const isGemini3 = /^gemini-3/.test(modelId);
      const isGemini25Flash = /^gemini-2\.5-flash/.test(modelId);
      const thinkingConfig = isGemini3
        ? { thinkingLevel: 'LOW' as any }
        : isGemini25Flash
          ? { thinkingBudget: 0 }
          : undefined;

      const result = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          systemInstruction: dynamicGeminiSystemPrompt,
          maxOutputTokens: dynamicGeminiMaxTokens,
          temperature: dynamicGeminiTemperature,
          ...(thinkingConfig ? { thinkingConfig } : {}),
        },
      });

      const latency = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
      void recordAIRequestLog(requireFirestore(), {
        id: `req-${randomUUID()}`,
        time: `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')} Hôm nay`,
        user: userWhoInvoked,
        model: models[index],
        prompt: prompt.slice(0, 80) + '...',
        status: 'Hoàn thành',
        latency,
      }).catch((logError) => console.error('[AI Log] Không thể ghi yêu cầu AI:', logError));

      return result;
    } catch (error: unknown) {
      const errObj = error as { status?: unknown; response?: { status?: unknown }; message?: unknown };
      const status = Number(errObj?.status ?? errObj?.response?.status ?? 0);
      const message = String(errObj?.message || errObj?.status || error || '');
      // 400 cũng thử model dự phòng (thường do model/tham số không tương thích)
      const retryable = status === 400 || status === 503 || status === 504 || status === 500;
      const isRateLimit = status === 429 || /RATE_LIMIT|RESOURCE_EXHAUSTED/i.test(message);
      console.error('[Gemini]', models[index], status || '', message.slice(0, 500));

      if (isRateLimit || !retryable || index === models.length - 1) {
        void recordAIErrorLog(requireFirestore(), {
          id: `err-${randomUUID()}`,
          time: `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')} Hôm nay`,
          code: `ERR_${status || 500}`,
          detail: message.slice(0, 100) || 'Lỗi gọi Gemini API',
          resolved: false,
        }).catch((logError) => console.error('[AI Log] Không thể ghi lỗi AI:', logError));
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  throw new Error('Gemini không phản hồi sau khi thử model dự phòng.');
}

function getOrCreateGeminiRequest(cacheKey: string, request: () => Promise<unknown>): Promise<unknown> {
  const existingRequest = inFlightGeminiRequests.get(cacheKey);
  if (existingRequest) return existingRequest;

  const newRequest = request();
  inFlightGeminiRequests.set(cacheKey, newRequest);
  void newRequest.catch(() => undefined).finally(() => {
    inFlightGeminiRequests.delete(cacheKey);
  });
  return newRequest;
}

function buildFallbackScheduleOptimization(payload: Parameters<typeof buildRuleBasedScheduleOptimization>[0]) {
  return buildRuleBasedScheduleOptimization(payload);
}


async function createGeminiJob(
  operation: string,
  payload: unknown,
  ownerUid: string,
  userActor = 'Hệ thống',
  cacheKey?: string,
): Promise<GeminiJob> {
  const db = requireFirestore();
  const now = Date.now();
  const job: GeminiJob = {
    id: createJobId(),
    ownerUid,
    slotIndex: -1,
    status: 'queued',
    progress: 'Đang chuẩn bị yêu cầu',
    createdAt: now,
    updatedAt: now,
  };

  const jobRef = db.collection('gemini_jobs').doc(job.id);
  const slotRefs = [0, 1].map((slotIndex) => db.collection('gemini_job_slots').doc(`${ownerUid}_${slotIndex}`));
  const reservedJob = await db.runTransaction(async (transaction) => {
    const first = await transaction.get(slotRefs[0]);
    const second = await transaction.get(slotRefs[1]);
    const snapshots = [first, second];
    const slotIndex = snapshots.findIndex((snapshot) =>
      !snapshot.exists || Number(snapshot.data()?.leaseUntil || 0) <= now,
    );
    if (slotIndex < 0) {
      throw new ActiveGeminiJobLimitError('Bạn đang có 2 tác vụ AI đang được xử lý. Vui lòng chờ hoàn tất trước khi tạo mới.');
    }

    const reserved = { ...job, slotIndex };
    transaction.set(jobRef, reserved);
    transaction.set(slotRefs[slotIndex], { jobId: job.id, leaseUntil: now + 5 * 60 * 1000 });
    return reserved;
  });

  void (async () => {
    try {
      await updateGeminiJob(reservedJob, {
        status: 'running',
        progress: 'Gemini đang xử lý',
      });
      const result = await executeGeminiOperation(operation, payload, userActor);
      await updateGeminiJob(reservedJob, {
        status: 'completed',
        progress: 'Đã hoàn tất',
        result,
        error: undefined,
      }, true);
      if (cacheKey && result) setCachedGeminiResult(cacheKey, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi xử lý Gemini';
      try {
        await updateGeminiJob(reservedJob, {
          status: 'failed',
          progress: 'Xảy ra lỗi',
          error: message,
        }, true);
      } catch (storageError) {
        console.error('[Gemini Job] Không thể lưu trạng thái lỗi:', storageError);
      }
    }
  })();
  return reservedJob;
}

// Lấy text JSON từ phản hồi Gemini, báo lỗi rõ ràng nếu bị cắt cụt hoặc rỗng
function extractJsonText(response: unknown): string {
  const resp = response as { candidates?: Array<{ finishReason?: string }>; text?: string };
  const finishReason = resp?.candidates?.[0]?.finishReason;
  const text = typeof resp?.text === 'string' ? resp.text : '';
  if (finishReason === 'MAX_TOKENS') {
    throw new Error('Phản hồi AI bị cắt do vượt giới hạn token. Hãy tăng Max Output Tokens hoặc giảm số ngày.');
  }
  if (!text.trim()) {
    throw new Error(`Gemini không trả nội dung (finishReason: ${finishReason ?? 'unknown'}).`);
  }
  return text;
}

// ==========================================
// TỐI ƯU LỊCH TRÌNH: dữ liệu thật + quy tắc Admin + kiểm tra khả thi
// ==========================================

// Ưu tiên dữ liệu chuyến đi lưu ở server (đầy đủ, client không giả mạo được);
// chỉ khi không tìm thấy/không có quyền mới dùng dữ liệu client gửi lên.
async function buildOptimizePayload(body: unknown, user?: DecodedIdToken) {
  const bodyObj = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const clientTrip = bodyObj.currentTrip && typeof bodyObj.currentTrip === 'object' ? (bodyObj.currentTrip as Partial<TripData>) : null;
  const tripId = typeof clientTrip?.id === 'string' ? clientTrip.id : '';

  let storedTrip: TripData | null = null;
  if (tripId && tripId !== 'active' && TRIP_ID_PATTERN.test(tripId)) {
    try {
      const found = await getTripById(tripId);
      if (found && canAccessTrip(found, user)) storedTrip = found;
    } catch (error) {
      console.warn('[Optimize] Không đọc được chuyến đi từ server, dùng dữ liệu client:', error);
    }
  }

  const source = storedTrip ?? clientTrip;
  if (!source || !Array.isArray(source.days)) return null;

  const alerts = storedTrip ? storedTrip.alerts : (bodyObj.alertDetails as unknown[]);
  return {
    tripSource: (storedTrip ? 'server' : 'client') as 'server' | 'client',
    currentTrip: pickTripForOptimization(source),
    alertDetails: (Array.isArray(alerts) ? (alerts as OperationalAlert[]) : []).slice(0, 10),
    userGoal: typeof bodyObj.userGoal === 'string' ? bodyObj.userGoal.slice(0, 300) : '',
    // Quy tắc Admin hiện hành nằm trong payload nên đổi quy tắc sẽ đổi khóa cache.
    rules: activeSystemConfig.rules,
  };
}

// Mọi đề xuất (Gemini hoặc dự phòng) đều phải qua bộ kiểm tra khả thi trước khi trả về.
function runScheduleOptimization(payload: Parameters<typeof runOptimization>[0], userActor = 'Hệ thống') {
  return runOptimization(payload, {
    ask: async (prompt, dedupeKey) => {
      const response = dedupeKey
        ? await getOrCreateGeminiRequest(dedupeKey, () => generateWithGemini(prompt, userActor))
        : await generateWithGemini(prompt, userActor);
      return parseGeminiJson(extractJsonText(response));
    },
    fallback: buildFallbackScheduleOptimization,
    defaultRules: activeSystemConfig.rules,
    warn: (message, error) => console.warn(message, error),
  });
}

async function executeGeminiOperation(operation: string, payload: unknown, userActor = 'Hệ thống'): Promise<unknown> {
  if (operation === 'generate-itinerary') {
    const raw = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
    const destination = typeof raw.destination === 'string' ? raw.destination.trim().slice(0, 100) : 'Đà Nẵng - Huế - Hội An';
    const normalizedDays = Math.min(Math.max(Number.parseInt(String(raw.days), 10) || 3, 3), 7);
    const budget = typeof raw.budget === 'string' ? raw.budget.trim().slice(0, 50) : 'Tiêu chuẩn';
    const travelStyle = typeof raw.travelStyle === 'string' ? raw.travelStyle.trim().slice(0, 50) : 'Khám phá văn hóa & ẩm thực';
    const groupType = typeof raw.groupType === 'string' ? raw.groupType.trim().slice(0, 50) : 'Nhóm du khách';
    const startLocation = typeof raw.startLocation === 'string' ? raw.startLocation.trim().slice(0, 50) : 'Đà Nẵng';
    const preferences = typeof raw.preferences === 'string' ? raw.preferences.trim().slice(0, 150) : 'Tránh nắng gắt buổi trưa';

    const prompt = `Lập kế hoạch du lịch Việt Nam dưới đây. Chỉ trả về một JSON hợp lệ, không markdown hoặc văn bản ngoài JSON.
Điểm đến: ${destination}
Số ngày: ${normalizedDays}
Ngân sách: ${budget}
Phong cách: ${travelStyle}
Đối tượng: ${groupType}
Xuất phát: ${startLocation}
Sở thích: ${preferences}
Lộ trình phải bắt đầu từ điểm xuất phát, đi đúng các điểm đến người dùng yêu cầu và không tự thay bằng địa điểm khác.
Trả về chính xác ${normalizedDays} ngày liên tiếp; mỗi ngày phải có từ 1 đến 3 hoạt động, không được để days hoặc activities rỗng.
Mỗi hoạt động phải có giờ HH:mm, title, location, status, type, details, cost và coordinates {lat,lng}. Tọa độ phải là số thập phân WGS84 thực tế tại đúng địa điểm ở Việt Nam; không dùng chuỗi, null, tọa độ mặc định hoặc tự bịa. Nếu không xác định được tọa độ điểm cụ thể, dùng tọa độ trung tâm đã biết của địa danh gần nhất.
Mỗi chuỗi mô tả tối đa 15 từ. status chỉ nhận "Đã xác nhận"; type chỉ nhận "transport", "meal", "sightseeing", "hotel", "checkin" hoặc "briefing".
Chỉ nêu rủi ro có căn cứ trong potentialRisks; level chỉ nhận "error", "warning" hoặc "info", advice nêu cách xử lý ngắn gọn; nếu không có rủi ro rõ ràng thì trả mảng rỗng.
Schema: {tripCode,title,routeSummary:{origin,destination,totalKm,vehicle,destinationsCount},budget:{total,used,unit,breakdown},days:[{dayIndex,dateLabel,fullDate,summary,activities:[{id,timeStart,timeEnd,title,location,status,type,details,cost,coordinates:{lat,lng}}]}],aiOperationalSuggestions:[{id,title,impact,description,savingEstimate,confidence}],potentialRisks:[{title,level,advice}]}.`;

    const sanitizedKey = { promptVersion: 2, destination, days: normalizedDays, budget, travelStyle, groupType, preferences, startLocation };
    const response = await getOrCreateGeminiRequest(`generate-itinerary:${JSON.stringify(sanitizedKey)}`, () => generateWithGemini(prompt, userActor));
    const parsed = parseGeminiJson(extractJsonText(response));
    const parsedPlan = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
    const generatedDays = parsedPlan?.days;
    if (
      !Array.isArray(generatedDays) ||
      generatedDays.length !== normalizedDays ||
      generatedDays.some((day) => {
        if (!day || typeof day !== 'object') return true;
        const activities = (day as Record<string, unknown>).activities;
        return !Array.isArray(activities) || activities.length === 0;
      })
    ) {
      throw new Error('Gemini trả về lịch trình thiếu ngày hoặc hoạt động. Vui lòng tạo lại.');
    }
    return parsedPlan;
  }

  return runScheduleOptimization(payload as Parameters<typeof runOptimization>[0], userActor);
}

registerGeminiRoutes(app, {
  requireAuth,
  aiRateLimiter,
  ai,
  createGeminiCacheKey,
  getCachedGeminiResult,
  createGeminiJob,
  buildOptimizePayload,
  runScheduleOptimization,
  requireFirestore,
});

// ==========================================
// ADMIN API ENDPOINTS: Dynamic Models, Config, Users, Logs
// ==========================================

registerAdminConfigRoutes(app, {
  requireAuth,
  requireAdmin,
  allowedModels: ALLOWED_AI_MODELS,
  getConfigState: () => ({ activeSystemConfig, dynamicGeminiModel, dynamicGeminiTemperature, dynamicGeminiMaxTokens, dynamicGeminiSystemPrompt, activeVehicles, activeReferenceCosts }),
  setConfigState: (config) => {
    dynamicGeminiModel = config.aiModel;
    dynamicGeminiTemperature = config.temperature;
    dynamicGeminiMaxTokens = config.maxTokens;
    dynamicGeminiSystemPrompt = config.systemPrompt;
    activeVehicles = config.vehicles;
    activeReferenceCosts = config.referenceCosts;
    activeSystemConfig = config;
  },
  syncSystemConfigIfStale,
  saveSystemConfig,
  recordAuditLog,
});

registerAdminMonitoringRoutes(app, {
  requireAuth,
  requireAdmin,
  requireFirestore,
  getGeminiSettings: () => ({ model: dynamicGeminiModel, temperature: dynamicGeminiTemperature, maxTokens: dynamicGeminiMaxTokens }),
  generateWithGemini,
  recordAuditLog,
});

registerFleetRoutes(app, {
  requireAuth,
  requireAdmin,
  getSystemConfig: () => activeSystemConfig,
  getVehicles: () => activeVehicles,
  getReferenceCosts: () => activeReferenceCosts,
  setSystemConfig: (config) => {
    activeSystemConfig = config;
    activeVehicles = config.vehicles;
    activeReferenceCosts = config.referenceCosts;
  },
  syncSystemConfigIfStale: () => syncSystemConfigIfStale(),
  saveSystemConfig,
  recordAuditLog,
});

// ==================== USERS & RBAC MANAGEMENT ====================
// Get Managed Users (Firebase Auth + Firestore)
registerAdminUserRoutes(app, {
  requireAuth,
  requireAdmin,
  firebaseAuth,
  firestore,
  recordAuditLog,
});

app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Đường dẫn API không tồn tại: ${req.method} ${req.originalUrl || req.path}`,
  });
});

app.all('/api', (_req, res) => {
  res.status(404).json({ success: false, error: 'Đường dẫn API không tồn tại' });
});

// Setup Vite middlewares for development or serve dist in production
async function startServer() {
  await loadSystemConfig();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(port), '0.0.0.0', () => {
    console.log(`Voyager Travel Ops server running on http://0.0.0.0:${port}`);
  });
}

const isMainModule =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isMainModule) {
  startServer();
}