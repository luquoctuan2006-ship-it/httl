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
import { createGeminiJobsRouter } from './src/server/routes/geminiJobs';
import { createTripSyncRouter } from './src/server/routes/trips';
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

export interface VehicleRecord {
  id: string;
  type: string;
  speedAvg: string;
  capacity: string;
  consumption: string;
  status: 'Sẵn sàng điều phối' | 'Đang chạy tour' | 'Bảo dưỡng định kỳ';
}

export interface ReferenceCostRecord {
  id: string;
  category: string;
  item: string;
  price: string;
  note: string;
}

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

export interface SystemConfig {
  aiModel: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  maintenanceMode: boolean;
  sessionTimeout: string;
  backupAutoSchedule: string;
  rules: {
    bufferMinutes: string;
    startHour: string;
    endHour: string;
    budgetCapDaily: string;
    budgetAlertThreshold: string;
    contingencyPercent: string;
    citySpeedLimit: string;
    highwaySpeedLimit: string;
    passSpeedLimit: string;
    conflictChecks: Record<string, boolean>;
    optimizationPriorities: Record<string, boolean>;
  };
  vehicles: VehicleRecord[];
  referenceCosts: ReferenceCostRecord[];
}

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

app.get('/api/trips', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const rawLimit = Number(req.query.limit);
    const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;
    const startAfterId = typeof req.query.startAfter === 'string' && TRIP_ID_PATTERN.test(req.query.startAfter)
      ? req.query.startAfter
      : undefined;

    const { trips, hasMore, nextCursor } = await listTripsForUser(req.authUser!, { limit, startAfterId });
    return res.json({ success: true, activeTrip: trips[0] || null, trips, hasMore, nextCursor });
  } catch (error) {
    console.error('Error loading trips:', error);
    return res.status(503).json({ success: false, error: 'Không thể tải danh sách chuyến đi' });
  }
});

// Giữ route cũ cho tương thích: "active" nay là chuyến cập nhật gần nhất CỦA CHÍNH USER ĐÓ
const getActiveTripHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const trips = await loadUserTrips(req.authUser!);
    return res.json({ success: true, trip: trips[0] || null });
  } catch (error) {
    console.error('Error loading active trip:', error);
    return res.status(503).json({ success: false, error: 'Không thể tải chuyến đi' });
  }
};
app.get('/api/trips/active', requireAuth, getActiveTripHandler);

app.use('/api/trips', createTripSyncRouter({
  requireAuth,
  getFirestore: requireFirestore,
  cleanupOrphanReceiptsForTrip,
}));

app.post('/api/trips', requireAuth, async (req: AuthenticatedRequest, res) => {
  const body = normalizeTripData(req.body);
  if (typeof body.id !== 'string' || body.id === 'active' || !TRIP_ID_PATTERN.test(body.id) || !Array.isArray(body.days)) {
    return res.status(400).json({ success: false, error: 'Dữ liệu chuyến đi không hợp lệ' });
  }

  // Luôn tự tính các trường dẫn xuất phía server và ép version = 1 khi tạo mới
  const authoritative = computeAuthoritativeTripDerivedFields(body);
  const trip: TripData = { ...authoritative, ownerId: req.authUser!.uid, version: 1 };

  if (estimateTripByteSize(trip as unknown as Record<string, unknown>) > MAX_TRIP_DOC_BYTES) {
    return res.status(413).json({
      success: false,
      error: 'Dung lượng chuyến đi mới vượt giới hạn 900KB cho một tài liệu Firestore.',
    });
  }

  try {
    await createTripDoc(trip);
    return res.status(201).json({ success: true, trip });
  } catch (error: unknown) {
    if (isConflictError(error)) {
      return res.status(409).json({ success: false, error: 'Mã chuyến đi đã tồn tại, vui lòng tạo lại' });
    }
    console.error('Error creating trip:', error);
    return res.status(503).json({ success: false, error: 'Không thể lưu chuyến đi mới' });
  }
});

app.get('/api/trips/:tripId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const trip = await getTripById(req.params.tripId);
    if (!trip || !canAccessTrip(trip, req.authUser)) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
    }
    return res.json({ success: true, trip });
  } catch {
    return res.status(503).json({ success: false, error: 'Không thể tải chuyến đi' });
  }
});

// Xóa chuyến đi: Chỉ chủ sở hữu (ownerId) hoặc Admin mới được xóa
app.delete('/api/trips/:tripId', requireAuth, async (req: AuthenticatedRequest, res) => {
  const tripId = req.params.tripId;
  if (!tripId || tripId === 'active' || !TRIP_ID_PATTERN.test(tripId)) {
    return res.status(400).json({ success: false, error: 'Mã chuyến đi không hợp lệ' });
  }

  try {
    const existing = await getTripById(tripId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
    }

    if (!canAccessTrip(existing, req.authUser)) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền xóa chuyến đi này' });
    }

    await deleteTripDoc(tripId);
    recordAuditLog(
      req.authUser?.email || 'User',
      `Xóa chuyến đi: ${existing.title} (${existing.code})`
    );

    const remainingTrips = await loadUserTrips(req.authUser!);
    return res.json({
      success: true,
      message: `Đã xóa chuyến đi ${existing.title} thành công`,
      deletedTripId: tripId,
      remainingCount: remainingTrips.length,
      activeTrip: remainingTrips[0] || null,
      trips: remainingTrips,
    });
  } catch (error) {
    console.error('Error deleting trip:', error);
    return res.status(503).json({ success: false, error: 'Không thể xóa chuyến đi' });
  }
});

// Tải lên và đọc ảnh chứng từ hóa đơn tách khỏi document chuyến đi (tránh chạm trần 1 MiB)
app.post('/api/trips/:tripId/receipts', requireAuth, async (req: AuthenticatedRequest, res) => {
  const tripId = req.params.tripId;
  if (!tripId || tripId === 'active' || !TRIP_ID_PATTERN.test(tripId)) {
    return res.status(400).json({ success: false, error: 'Mã chuyến đi không hợp lệ' });
  }

  const dataUrl = req.body?.dataUrl;
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/') || dataUrl.length > 260_000) {
    return res.status(400).json({
      success: false,
      error: 'Ảnh chứng từ không hợp lệ hoặc vượt quá giới hạn 260KB mỗi ảnh.',
    });
  }

  try {
    const existing = await getTripById(tripId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
    }
    if (!canAccessTrip(existing, req.authUser)) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền tải ảnh lên chuyến đi này' });
    }

    const db = requireFirestore();
    const receiptId = `rcpt-${Date.now()}-${randomUUID().slice(0, 8)}`;
    await db.collection('trip_receipts').doc(receiptId).set({
      id: receiptId,
      tripId: existing.id,
      ownerId: existing.ownerId || req.authUser!.uid,
      dataUrl,
      createdAt: FieldValue.serverTimestamp(),
    });

    return res.status(201).json({ success: true, receiptId });
  } catch (error) {
    console.error('Error uploading receipt image:', error);
    return res.status(503).json({ success: false, error: 'Không thể lưu ảnh chứng từ lên máy chủ' });
  }
});

app.get('/api/trips/:tripId/receipts/:receiptId', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { tripId, receiptId } = req.params;
  if (!tripId || !TRIP_ID_PATTERN.test(tripId) || !receiptId || !/^[a-zA-Z0-9_-]{4,128}$/.test(receiptId)) {
    return res.status(400).json({ success: false, error: 'Tham số chứng từ không hợp lệ' });
  }

  try {
    const existing = await getTripById(tripId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
    }
    if (!canAccessTrip(existing, req.authUser)) {
      return res.status(403).json({ success: false, error: 'Không có quyền xem chứng từ chuyến đi này' });
    }

    const db = requireFirestore();
    const snap = await db.collection('trip_receipts').doc(receiptId).get();
    if (!snap.exists) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy ảnh chứng từ' });
    }
    const data = snap.data() as Record<string, unknown> | undefined;
    if (!data || data.tripId !== existing.id || typeof data.dataUrl !== 'string') {
      return res.status(404).json({ success: false, error: 'Ảnh chứng từ không thuộc chuyến đi này' });
    }

    return res.json({ success: true, receiptId, dataUrl: data.dataUrl });
  } catch (error) {
    console.error('Error fetching receipt image:', error);
    return res.status(503).json({ success: false, error: 'Không thể tải ảnh chứng từ' });
  }
});

async function cleanupOrphanReceiptsForTrip(db: Firestore, savedTrip: TripData): Promise<void> {
  const activeIds = new Set(
    (savedTrip.invoices || [])
      .map((inv) => inv.receiptId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  );
  const snap = await db.collection('trip_receipts').where('tripId', '==', savedTrip.id).get();
  if (snap.empty) return;
  const cutoffMs = Date.now() - 2 * 60 * 1000;
  const orphans = snap.docs.filter((docSnap) => {
    if (activeIds.has(docSnap.id)) return false;
    const data = docSnap.data() as { createdAt?: { toMillis?: () => number } } | undefined;
    const createdMs = typeof data?.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : 0;
    return createdMs > 0 && createdMs < cutoffMs;
  });
  if (orphans.length === 0) return;
  for (let i = 0; i < orphans.length; i += 400) {
    const batch = db.batch();
    orphans.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

app.delete('/api/trips/:tripId/receipts/:receiptId', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { tripId, receiptId } = req.params;
  if (!tripId || !TRIP_ID_PATTERN.test(tripId) || !receiptId || !/^[a-zA-Z0-9_-]{4,128}$/.test(receiptId)) {
    return res.status(400).json({ success: false, error: 'Tham số chứng từ không hợp lệ' });
  }

  try {
    const existing = await getTripById(tripId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
    }
    if (!canAccessTrip(existing, req.authUser)) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền xóa chứng từ chuyến đi này' });
    }

    const db = requireFirestore();
    const docRef = db.collection('trip_receipts').doc(receiptId);
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.json({ success: true, deleted: false });
    }
    const data = snap.data() as Record<string, unknown> | undefined;
    if (!data || data.tripId !== existing.id) {
      return res.status(404).json({ success: false, error: 'Ảnh chứng từ không thuộc chuyến đi này' });
    }
    await docRef.delete();
    return res.json({ success: true, deleted: true, receiptId });
  } catch (error) {
    console.error('Error deleting receipt image:', error);
    return res.status(503).json({ success: false, error: 'Không thể xóa ảnh chứng từ' });
  }
});

// Chỉnh sửa thông tin cơ bản của chuyến đi (chạy trong transaction, kiểm soát version và tự tính trường dẫn xuất)
app.patch('/api/trips/:tripId', requireAuth, async (req: AuthenticatedRequest, res) => {
  const tripId = req.params.tripId;
  if (!tripId || tripId === 'active' || !TRIP_ID_PATTERN.test(tripId)) {
    return res.status(400).json({ success: false, error: 'Mã chuyến đi không hợp lệ' });
  }

  try {
    const db = requireFirestore();
    const tripRef = db.collection('trips').doc(tripId);
    const body = req.body || {};

    const txResult = await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(tripRef);
      if (!snap.exists) return { kind: 'not_found' as const };

      const existing = normalizeTripData(snap.data());
      if (!canAccessTrip(existing, req.authUser)) {
        return { kind: 'forbidden' as const };
      }

      if (typeof existing.version === 'number') {
        if (typeof body.version !== 'number' || !Number.isInteger(body.version) || body.version < existing.version) {
          return { kind: 'conflict' as const, currentVersion: existing.version };
        }
      }

      const candidate: TripData = { ...existing };
      if (typeof body.title === 'string' && body.title.trim()) candidate.title = body.title.trim().slice(0, 200);
      if (typeof body.code === 'string' && body.code.trim()) candidate.code = body.code.trim().toUpperCase().slice(0, 50);
      if (typeof body.dates === 'string' && body.dates.trim()) candidate.dates = body.dates.trim().slice(0, 100);
      if (typeof body.originFull === 'string' && body.originFull.trim()) candidate.originFull = body.originFull.trim().slice(0, 150);
      if (typeof body.destinationFull === 'string' && body.destinationFull.trim()) candidate.destinationFull = body.destinationFull.trim().slice(0, 150);
      if (typeof body.budgetTotal === 'number' && Number.isFinite(body.budgetTotal) && body.budgetTotal > 0) {
        candidate.budgetTotal = body.budgetTotal;
      }
      if (typeof body.vehicle === 'string' && body.vehicle.trim()) candidate.vehicle = body.vehicle.trim().slice(0, 100);

      const VALID_TRIP_STATUSES: TripData['status'][] = ['Chuẩn bị', 'Đang vận hành', 'Hoàn thành'];
      if (typeof body.status === 'string' && VALID_TRIP_STATUSES.includes(body.status as TripData['status'])) {
        candidate.status = body.status as TripData['status'];
      }
      if (body.telematics && typeof body.telematics === 'object') {
        candidate.telematics = { ...existing.telematics, ...body.telematics };
      }

      const normalized = computeAuthoritativeTripDerivedFields(normalizeTripData(candidate));
      const nextVersion = (existing.version || 0) + 1;
      const updatedTrip: TripData = {
        ...normalized,
        ownerId: existing.ownerId,
        version: nextVersion,
      };

      if (estimateTripByteSize(updatedTrip as unknown as Record<string, unknown>) > MAX_TRIP_DOC_BYTES) {
        return { kind: 'too_large' as const };
      }

      transaction.set(tripRef, {
        ...updatedTrip,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { kind: 'ok' as const, trip: updatedTrip };
    });

    if (txResult.kind === 'not_found') {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
    }
    if (txResult.kind === 'forbidden') {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền chỉnh sửa chuyến đi này' });
    }
    if (txResult.kind === 'conflict') {
      return res.status(409).json({
        success: false,
        error: 'Dữ liệu chuyến đi đã thay đổi ở phiên khác hoặc thiếu version hợp lệ.',
        currentVersion: txResult.currentVersion,
      });
    }
    if (txResult.kind === 'too_large') {
      return res.status(413).json({ success: false, error: 'Dung lượng dữ liệu chuyến đi vượt giới hạn 900KB.' });
    }

    recordAuditLog(
      req.authUser?.email || 'User',
      `Cập nhật thông tin chuyến đi: ${txResult.trip.title} (${txResult.trip.code})`
    );

    return res.json({ success: true, trip: txResult.trip, version: txResult.trip.version });
  } catch (error) {
    console.error('Error updating trip info:', error);
    return res.status(503).json({ success: false, error: 'Không thể cập nhật chuyến đi' });
  }
});

async function fetchRealtimeWeather(lat: number, lng: number): Promise<TripData['weather'] | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&hourly=precipitation_probability&timezone=Asia%2FBangkok&forecast_days=1`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    const current = (data?.current && typeof data.current === 'object' ? data.current : {}) as Record<string, unknown>;
    const temp = Math.round(Number(current.temperature_2m) || 28);
    const code = Number(current.weather_code ?? 0);
    let description = 'Nắng ấm';
    if (code >= 95) description = 'Dông bão mạnh';
    else if (code >= 80) description = 'Mưa rào nặng hạt';
    else if (code >= 61) description = 'Mưa rào rải rác';
    else if (code >= 51) description = 'Mưa phùn nhẹ';
    else if (code >= 3) description = 'Trời nhiều mây';
    else if (code >= 1) description = 'Nắng ráo có mây';

    const hourly = (data?.hourly && typeof data.hourly === 'object' ? data.hourly : {}) as Record<string, unknown>;
    const hourlyProb = Array.isArray(hourly.precipitation_probability) ? (hourly.precipitation_probability as number[]) : [];
    const maxProb = hourlyProb.length > 0 ? Math.max(...hourlyProb) : 10;
    const peakHourIdx = hourlyProb.indexOf(maxProb);
    const rainProbTime = peakHourIdx >= 0 ? `${peakHourIdx.toString().padStart(2, '0')}:00` : '14:00';
    const humidity = Number.isFinite(Number(current.relative_humidity_2m))
      ? Math.round(Number(current.relative_humidity_2m))
      : undefined;
    const windSpeed = Number.isFinite(Number(current.wind_speed_10m))
      ? `${Math.round(Number(current.wind_speed_10m))} km/h`
      : undefined;

    return {
      temp,
      description,
      rainProb: `${maxProb}%`,
      rainProbTime,
      ...(humidity !== undefined ? { humidity } : {}),
      ...(windSpeed ? { windSpeed } : {}),
      isLive: true,
      lastFetched: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };
  } catch (err) {
    console.warn('[Weather API] Không thể lấy thời tiết trực tuyến, sử dụng dữ liệu chuyến đi:', err);
    return null;
  }
}

// Tự động quét và phát hiện cảnh báo vận hành & thời tiết thực tế cho chuyến đi (atomic transaction + version)
app.post('/api/trips/:tripId/scan-alerts', requireAuth, async (req: AuthenticatedRequest, res) => {
  const tripId = req.params.tripId;
  try {
    const existing = tripId === 'active'
      ? (await loadUserTrips(req.authUser!))[0]
      : await getTripById(tripId);

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
    }

    if (!canAccessTrip(existing, req.authUser)) {
      return res.status(403).json({ success: false, error: 'Không có quyền truy cập chuyến đi này' });
    }

    // Ưu tiên tọa độ GPS thực tế trên xe nếu có, sau đó tới tọa độ hoạt động hoặc waypoint
    let lat = 16.0544;
    let lng = 108.2022;
    const currentDaySchedule = existing.days?.find((d) => d.dayIndex === existing.currentDay);
    const actWithCoords = currentDaySchedule?.activities?.find((a) => a.coordinates?.lat && a.coordinates?.lng)
      || existing.days?.flatMap((d) => d.activities || []).find((a) => a.coordinates?.lat && a.coordinates?.lng);
    const wpWithCoords = existing.waypoints?.find((w) => typeof w.lat === 'number' && typeof w.lng === 'number');

    if (typeof existing.telematics?.currentLat === 'number' && typeof existing.telematics?.currentLng === 'number') {
      lat = existing.telematics.currentLat;
      lng = existing.telematics.currentLng;
    } else if (actWithCoords?.coordinates) {
      lat = actWithCoords.coordinates.lat;
      lng = actWithCoords.coordinates.lng;
    } else if (wpWithCoords) {
      lat = wpWithCoords.lat;
      lng = wpWithCoords.lng;
    }

    const liveWeather = await fetchRealtimeWeather(lat, lng);
    const db = requireFirestore();
    const tripRef = db.collection('trips').doc(existing.id);

    const txResult = await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(tripRef);
      if (!snap.exists) return { kind: 'not_found' as const };
      const latest = normalizeTripData(snap.data());
      if (liveWeather) {
        latest.weather = liveWeather;
      }
      const detectedAlerts = detectScheduleAndWeatherAlerts(latest);
      latest.alerts = detectedAlerts;
      const authoritative = computeAuthoritativeTripDerivedFields(latest);
      const nextVersion = (latest.version || 0) + 1;
      const updatedTrip: TripData = {
        ...authoritative,
        ownerId: latest.ownerId,
        version: nextVersion,
      };

      transaction.update(tripRef, {
        weather: updatedTrip.weather,
        alerts: updatedTrip.alerts,
        budgetUsed: updatedTrip.budgetUsed,
        budgetRemaining: updatedTrip.budgetRemaining,
        budgetUsedPercent: updatedTrip.budgetUsedPercent,
        version: nextVersion,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { kind: 'ok' as const, trip: updatedTrip };
    });

    if (txResult.kind === 'not_found') {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
    }

    return res.json({
      success: true,
      alerts: txResult.trip.alerts,
      weather: txResult.trip.weather,
      version: txResult.trip.version,
      trip: txResult.trip,
      message: `Đã phát hiện ${txResult.trip.alerts.length} cảnh báo vận hành thời gian thực`,
    });
  } catch (error) {
    console.error('Error scanning alerts:', error);
    return res.status(503).json({ success: false, error: 'Không thể quét cảnh báo' });
  }
});

app.patch('/api/trips/:tripId/members/:memberId/attendance', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { attendanceStatus, version: clientVersion } = req.body || {};
  if (!['Có mặt', 'Vắng mặt'].includes(attendanceStatus)) {
    return res.status(400).json({ success: false, error: 'Trạng thái điểm danh không hợp lệ' });
  }

  try {
    const user = req.authUser!;
    const rawTripId = req.params.tripId;
    const targetTrip = rawTripId === 'active'
      ? (await loadUserTrips(user))[0]
      : await getTripById(rawTripId);

    if (!targetTrip || !canAccessTrip(targetTrip, user)) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
    }

    const db = requireFirestore();
    const tripRef = db.collection('trips').doc(targetTrip.id);
    const txResult = await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(tripRef);
      if (!snap.exists) return { kind: 'not_found' as const };
      const latest = normalizeTripData(snap.data());

      if (!canAccessTrip(latest, user)) {
        return { kind: 'forbidden' as const };
      }

      if (typeof latest.version === 'number') {
        if (typeof clientVersion !== 'number' || !Number.isInteger(clientVersion) || clientVersion < latest.version) {
          return { kind: 'conflict' as const, currentVersion: latest.version };
        }
      }

      const members = Array.isArray(latest.members) ? latest.members : [];
      const mIdx = members.findIndex((m) => m.id === req.params.memberId);
      if (mIdx < 0) return { kind: 'member_not_found' as const };

      const updatedMembers = members.map((m, idx) => (idx === mIdx ? { ...m, attendanceStatus } : m));
      const authoritative = computeAuthoritativeTripDerivedFields({
        ...latest,
        members: updatedMembers,
      });
      const nextVersion = (latest.version || 0) + 1;

      transaction.update(tripRef, {
        members: authoritative.members,
        membersStatus: authoritative.membersStatus,
        membersTotal: authoritative.membersTotal,
        membersOnline: authoritative.membersOnline,
        version: nextVersion,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return {
        kind: 'ok' as const,
        member: authoritative.members[mIdx],
        membersStatus: authoritative.membersStatus,
        version: nextVersion,
      };
    });

    if (txResult.kind === 'not_found') {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
    }
    if (txResult.kind === 'forbidden') {
      return res.status(403).json({ success: false, error: 'Không có quyền truy cập chuyến đi này' });
    }
    if (txResult.kind === 'member_not_found') {
      return res.status(404).json({ success: false, error: 'Không tìm thấy thành viên' });
    }
    if (txResult.kind === 'conflict') {
      return res.status(409).json({
        success: false,
        error: 'Danh sách thành viên đã thay đổi ở phiên khác. Vui lòng đồng bộ lại.',
        currentVersion: txResult.currentVersion,
      });
    }

    return res.json({
      success: true,
      member: txResult.member,
      membersStatus: txResult.membersStatus,
      version: txResult.version,
    });
  } catch (error) {
    console.error('Error updating member attendance:', error);
    return res.status(503).json({ success: false, error: 'Không thể lưu trạng thái điểm danh' });
  }
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

class ActiveGeminiJobLimitError extends Error {}

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

// ==========================================
// ADMIN API ENDPOINTS: Dynamic Models, Config, Users, Logs
// ==========================================

// Get System & AI Configuration
app.get('/api/admin/config', requireAuth, requireAdmin, async (_req, res) => {
  await syncSystemConfigIfStale(true);
  return res.json({
    success: true,
    config: activeSystemConfig,
    availableModels: ALLOWED_AI_MODELS.map((id) => ({
      id,
      label: id === 'gemini-3.5-flash' ? `${id} (Khuyến nghị)` : id === 'gemini-3.1-flash-lite' ? `${id} (Nhanh & kinh tế)` : id,
    })),
  });
});

// Update System & AI Configuration
app.post('/api/admin/config', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  await syncSystemConfigIfStale(true);
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
    body.vehicles !== undefined ||
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
  let newVehicles = activeVehicles;
  let newReferenceCosts = activeReferenceCosts;

  if (aiModel !== undefined) {
    if (typeof aiModel !== 'string' || !ALLOWED_AI_MODELS.includes(aiModel.trim())) {
      return res.status(400).json({
        success: false,
        error: `Mô hình AI không hợp lệ. Chỉ chấp nhận các mô hình: ${ALLOWED_AI_MODELS.join(', ')}`,
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

  const VALID_VEHICLE_STATUSES = new Set(['Sẵn sàng điều phối', 'Đang chạy tour', 'Bảo dưỡng định kỳ']);
  if (body.vehicles !== undefined) {
    if (!Array.isArray(body.vehicles)) {
      return res.status(400).json({ success: false, error: 'vehicles phải là danh sách mảng.' });
    }
    const validatedVehicles: VehicleRecord[] = [];
    for (let i = 0; i < body.vehicles.length; i++) {
      const v = body.vehicles[i];
      if (!v || typeof v !== 'object') {
        return res.status(400).json({ success: false, error: `Phương tiện thứ ${i + 1} không hợp lệ.` });
      }
      const id = typeof v.id === 'string' && v.id.trim() ? v.id.trim().slice(0, 64) : '';
      const type = typeof v.type === 'string' && v.type.trim() ? v.type.trim().slice(0, 100) : '';
      if (!id || !type) {
        return res.status(400).json({ success: false, error: `Phương tiện thứ ${i + 1} thiếu id hoặc loại xe.` });
      }
      const speedAvg = typeof v.speedAvg === 'string' ? v.speedAvg.slice(0, 30) : '45 km/h';
      const capacity = typeof v.capacity === 'string' ? v.capacity.slice(0, 30) : '16 khách';
      const consumption = typeof v.consumption === 'string' ? v.consumption.slice(0, 30) : '12L / 100km';
      const status: VehicleRecord['status'] = VALID_VEHICLE_STATUSES.has(v.status) ? v.status : 'Sẵn sàng điều phối';
      validatedVehicles.push({ id, type, speedAvg, capacity, consumption, status });
    }
    newVehicles = validatedVehicles;
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
    vehicles: newVehicles,
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

  dynamicGeminiModel = newAiModel;
  dynamicGeminiTemperature = newTemperature;
  dynamicGeminiMaxTokens = newMaxTokens;
  dynamicGeminiSystemPrompt = newSystemPrompt;
  activeVehicles = newVehicles;
  activeReferenceCosts = newReferenceCosts;
  activeSystemConfig = nextSystemConfig;

  const actor = req.authUser?.email || 'Admin';
  recordAuditLog(
    actor,
    `Cập nhật cấu hình quản trị: Model=${dynamicGeminiModel}, MaxTokens=${dynamicGeminiMaxTokens}, Temp=${dynamicGeminiTemperature}, Bảo trì=${activeSystemConfig.maintenanceMode ? 'BẬT' : 'TẮT'}`
  );

  return res.json({
    success: true,
    config: activeSystemConfig,
    message: 'Cập nhật cấu hình thành công',
  });
});

// Get AI Logs & Error Monitor
app.get('/api/admin/ai-logs', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const { requests, errors } = await listAILogs(requireFirestore());
    return res.json({
      success: true,
      requests,
      errors,
      currentModel: dynamicGeminiModel,
      temperature: dynamicGeminiTemperature,
      maxTokens: dynamicGeminiMaxTokens,
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
    const prompt = 'Hãy trả về một phản hồi JSON đơn giản xác nhận hệ thống Voyager hoạt động tốt: {"status": "ok", "message": "Kết nối Gemini API thành công", "model": "' + dynamicGeminiModel + '"}';
    const result = await generateWithGemini(prompt, actor);
    const latency = `${((Date.now() - start) / 1000).toFixed(2)}s`;
    recordAuditLog(actor, `Kiểm tra kết nối AI thành công qua ${dynamicGeminiModel} (Độ trễ: ${latency})`);
    return res.json({
      success: true,
      model: dynamicGeminiModel,
      latency,
      output: result.text || 'OK',
    });
  } catch (error: unknown) {
    const latency = `${((Date.now() - start) / 1000).toFixed(2)}s`;
    const errMsg = error instanceof Error ? error.message : String(error);
    recordAuditLog(actor, `Kiểm tra kết nối AI thất bại qua ${dynamicGeminiModel}: ${errMsg}`);
    return res.status(502).json({
      success: false,
      model: dynamicGeminiModel,
      latency,
      error: errMsg || 'Lỗi khi gọi AI',
    });
  }
});

// ==================== VEHICLES MANAGEMENT ====================
// Danh sách đội xe dùng cho cả điều phối viên & người dùng tạo/gán xe vào chuyến đi
app.get('/api/vehicles', requireAuth, async (_req, res) => {
  await syncSystemConfigIfStale();
  return res.json({
    success: true,
    vehicles: activeVehicles,
  });
});

app.get('/api/admin/vehicles', requireAuth, requireAdmin, async (_req, res) => {
  await syncSystemConfigIfStale();
  return res.json({
    success: true,
    vehicles: activeVehicles,
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

  const nextVehicles = [newVeh, ...activeVehicles];
  const nextConfig: SystemConfig = { ...activeSystemConfig, vehicles: nextVehicles };
  try {
    await saveSystemConfig(nextConfig);
  } catch (err) {
    console.error('[Vehicles] Failed to persist to Firestore:', err);
    return res.status(503).json({ success: false, error: 'Không thể lưu danh sách xe vào Firestore' });
  }

  activeVehicles = nextVehicles;
  activeSystemConfig = nextConfig;
  recordAuditLog(req.authUser?.email || 'Admin', `Thêm phương tiện mới: ${newVeh.type} (${newVeh.capacity})`);

  return res.json({
    success: true,
    vehicle: newVeh,
    vehicles: activeVehicles,
  });
});

app.patch('/api/admin/vehicles/:vehicleId', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  const { vehicleId } = req.params;
  const idx = activeVehicles.findIndex((v) => v.id === vehicleId);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy phương tiện' });
  }

  const { type, speedAvg, capacity, consumption, status } = req.body;
  const updatedVeh: VehicleRecord = {
    ...activeVehicles[idx],
    ...(type ? { type: String(type).trim().slice(0, 100) } : {}),
    ...(speedAvg ? { speedAvg: String(speedAvg).trim().slice(0, 30) } : {}),
    ...(capacity ? { capacity: String(capacity).trim().slice(0, 30) } : {}),
    ...(consumption ? { consumption: String(consumption).trim().slice(0, 30) } : {}),
    ...(status ? { status } : {}),
  };

  const nextVehicles = activeVehicles.map((v, i) => (i === idx ? updatedVeh : v));
  const nextConfig: SystemConfig = { ...activeSystemConfig, vehicles: nextVehicles };
  try {
    await saveSystemConfig(nextConfig);
  } catch (err) {
    console.error('[Vehicles] Failed to update in Firestore:', err);
    return res.status(503).json({ success: false, error: 'Không thể cập nhật phương tiện vào Firestore' });
  }

  activeVehicles = nextVehicles;
  activeSystemConfig = nextConfig;
  recordAuditLog(req.authUser?.email || 'Admin', `Cập nhật thông số phương tiện: ${updatedVeh.type} - Trạng thái: ${updatedVeh.status}`);

  return res.json({
    success: true,
    vehicle: updatedVeh,
    vehicles: activeVehicles,
  });
});

app.delete('/api/admin/vehicles/:vehicleId', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  const { vehicleId } = req.params;
  const target = activeVehicles.find((v) => v.id === vehicleId);
  if (!target) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy phương tiện' });
  }

  const nextVehicles = activeVehicles.filter((v) => v.id !== vehicleId);
  const nextConfig: SystemConfig = { ...activeSystemConfig, vehicles: nextVehicles };
  try {
    await saveSystemConfig(nextConfig);
  } catch (err) {
    console.error('[Vehicles] Failed to delete in Firestore:', err);
    return res.status(503).json({ success: false, error: 'Không thể xóa phương tiện khỏi Firestore' });
  }

  activeVehicles = nextVehicles;
  activeSystemConfig = nextConfig;
  recordAuditLog(req.authUser?.email || 'Admin', `Xóa phương tiện: ${target.type}`);

  return res.json({
    success: true,
    vehicles: activeVehicles,
  });
});

// ==================== REFERENCE COSTS MANAGEMENT ====================
app.get('/api/admin/reference-costs', requireAuth, requireAdmin, async (_req, res) => {
  await syncSystemConfigIfStale();
  return res.json({
    success: true,
    costs: activeReferenceCosts,
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

  const nextCosts = [newCost, ...activeReferenceCosts];
  const nextConfig: SystemConfig = { ...activeSystemConfig, referenceCosts: nextCosts };
  try {
    await saveSystemConfig(nextConfig);
  } catch (err) {
    console.error('[ReferenceCosts] Failed to persist to Firestore:', err);
    return res.status(503).json({ success: false, error: 'Không thể lưu định mức chi phí vào Firestore' });
  }

  activeReferenceCosts = nextCosts;
  activeSystemConfig = nextConfig;
  recordAuditLog(req.authUser?.email || 'Admin', `Thêm định mức chi phí mới: [${newCost.category}] ${newCost.item} - ${newCost.price}`);

  return res.json({
    success: true,
    cost: newCost,
    costs: activeReferenceCosts,
  });
});

app.patch('/api/admin/reference-costs/:costId', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  const { costId } = req.params;
  const idx = activeReferenceCosts.findIndex((c) => c.id === costId);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy định mức chi phí' });
  }

  const { category, item, price, note } = req.body;
  const updatedCost: ReferenceCostRecord = {
    ...activeReferenceCosts[idx],
    ...(category ? { category: String(category).trim().slice(0, 50) } : {}),
    ...(item ? { item: String(item).trim().slice(0, 150) } : {}),
    ...(price ? { price: String(price).trim().slice(0, 50) } : {}),
    ...(note !== undefined ? { note: String(note).trim().slice(0, 200) } : {}),
  };

  const nextCosts = activeReferenceCosts.map((c, i) => (i === idx ? updatedCost : c));
  const nextConfig: SystemConfig = { ...activeSystemConfig, referenceCosts: nextCosts };
  try {
    await saveSystemConfig(nextConfig);
  } catch (err) {
    console.error('[ReferenceCosts] Failed to update in Firestore:', err);
    return res.status(503).json({ success: false, error: 'Không thể cập nhật định mức chi phí vào Firestore' });
  }

  activeReferenceCosts = nextCosts;
  activeSystemConfig = nextConfig;
  recordAuditLog(req.authUser?.email || 'Admin', `Cập nhật định mức chi phí: ${updatedCost.item} -> ${updatedCost.price}`);

  return res.json({
    success: true,
    cost: updatedCost,
    costs: activeReferenceCosts,
  });
});

app.delete('/api/admin/reference-costs/:costId', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  const { costId } = req.params;
  const target = activeReferenceCosts.find((c) => c.id === costId);
  if (!target) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy định mức chi phí' });
  }

  const nextCosts = activeReferenceCosts.filter((c) => c.id !== costId);
  const nextConfig: SystemConfig = { ...activeSystemConfig, referenceCosts: nextCosts };
  try {
    await saveSystemConfig(nextConfig);
  } catch (err) {
    console.error('[ReferenceCosts] Failed to delete in Firestore:', err);
    return res.status(503).json({ success: false, error: 'Không thể xóa định mức chi phí khỏi Firestore' });
  }

  activeReferenceCosts = nextCosts;
  activeSystemConfig = nextConfig;
  recordAuditLog(req.authUser?.email || 'Admin', `Xóa định mức chi phí: ${target.item}`);

  return res.json({
    success: true,
    costs: activeReferenceCosts,
  });
});

// ==================== USERS & RBAC MANAGEMENT ====================
// Get Managed Users (Firebase Auth + Firestore)
app.get('/api/admin/users', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  if (!firebaseAuth || !firestore) {
    return res.status(503).json({ success: false, error: 'Firebase Auth / Firestore chưa sẵn sàng' });
  }
  try {
    const pageToken = typeof req.query.pageToken === 'string' && req.query.pageToken.trim() ? req.query.pageToken.trim() : undefined;
    const pageSize = Math.min(Math.max(Number.parseInt(String(req.query.limit || req.query.pageSize || '100'), 10) || 100, 10), 1000);

    const page = await firebaseAuth.listUsers(pageSize, pageToken);
    const fetchedUsers = page.users;
    const nextPageToken = page.pageToken || undefined;

    const firestoreUsersMap: Record<string, any> = {};
    try {
      const snap = await firestore.collection('users').get();
      snap.docs.forEach((doc) => {
        firestoreUsersMap[doc.id] = doc.data();
      });
    } catch { /* ignored */ }

    const mappedUsers: ManagedUserRecord[] = fetchedUsers.map((u) => {
      const fsUser = firestoreUsersMap[u.uid] || {};
      // Xác thực quyền Admin từ Custom Claims hoặc Firestore, không dựa trên email cố định
      const isAdmin = u.customClaims?.role === 'admin' || fsUser.role === 'Admin';
      const role = isAdmin ? 'Admin' : 'Khách du lịch';
      const createdDate = u.metadata.creationTime ? new Date(u.metadata.creationTime).toLocaleDateString('vi-VN') : 'Mới tạo';
      const lastLogin = u.metadata.lastSignInTime ? new Date(u.metadata.lastSignInTime).toLocaleString('vi-VN') : 'Chưa đăng nhập';
      return {
        id: u.uid,
        name: u.displayName || fsUser.name || u.email?.split('@')[0] || 'Người dùng',
        email: u.email || '',
        phone: u.phoneNumber || fsUser.phone || '',
        role,
        isLocked: !!u.disabled,
        createdAt: createdDate,
        lastLogin,
      };
    });

    return res.json({
      success: true,
      users: mappedUsers,
      ...(nextPageToken ? { nextPageToken } : {}),
    });
  } catch (err: unknown) {
    console.error('[Users] Failed to fetch users from Firebase Auth:', err);
    return res.status(500).json({
      success: false,
      error: 'Lỗi máy chủ khi tải danh sách người dùng từ Firebase Auth',
    });
  }
});

// Add / Upsert Managed User
app.post('/api/admin/users', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  if (!firebaseAuth || !firestore) {
    return res.status(503).json({ success: false, error: 'Firebase Auth / Firestore chưa sẵn sàng' });
  }
  const { name, email, phone, role } = req.body;
  if (!name || !email) {
    return res.status(400).json({ success: false, error: 'Thiếu tên hoặc email' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const targetRole = role === 'Admin' ? 'Admin' : 'Khách du lịch';
  const roleClaim = targetRole === 'Admin' ? 'admin' : 'user';

  try {
    let userRecord: UserRecord | null = null;
    try {
      userRecord = await firebaseAuth.getUserByEmail(cleanEmail);
    } catch (lookupErr: any) {
      if (lookupErr.code !== 'auth/user-not-found') {
        throw lookupErr;
      }
    }

    let passwordResetLink: string | null = null;
    if (userRecord) {
      userRecord = await firebaseAuth.updateUser(userRecord.uid, {
        displayName: String(name).trim(),
      });
    } else {
      // Tạo tài khoản an toàn không mật khẩu, sinh link thiết lập mật khẩu gửi cho người dùng
      userRecord = await firebaseAuth.createUser({
        email: cleanEmail,
        displayName: String(name).trim(),
      });
      try {
        passwordResetLink = await firebaseAuth.generatePasswordResetLink(cleanEmail);
      } catch (linkErr) {
        console.warn('[Users] Không thể tạo password reset link:', linkErr);
      }
    }

    // Hợp nhất (merge) claims thay vì ghi đè mất claims khác
    await firebaseAuth.setCustomUserClaims(userRecord.uid, {
      ...(userRecord.customClaims || {}),
      role: roleClaim,
    });
    await firebaseAuth.revokeRefreshTokens(userRecord.uid);

    await firestore.collection('users').doc(userRecord.uid).set({
      name: String(name).trim(),
      email: cleanEmail,
      phone: String(phone || '').trim(),
      role: targetRole,
      isLocked: !!userRecord.disabled,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    recordAuditLog(req.authUser?.email || 'Admin', `Thêm/Cập nhật tài khoản Auth: ${name} (${cleanEmail}) - Vai trò: ${targetRole}`);

    const createdDate = userRecord.metadata?.creationTime ? new Date(userRecord.metadata.creationTime).toLocaleDateString('vi-VN') : 'Hôm nay';
    const createdUser: ManagedUserRecord = {
      id: userRecord.uid,
      name: String(name).trim(),
      email: cleanEmail,
      phone: String(phone || '').trim(),
      role: targetRole,
      isLocked: !!userRecord.disabled,
      createdAt: createdDate,
      lastLogin: 'Chưa đăng nhập',
    };
    return res.json({
      success: true,
      user: createdUser,
      ...(passwordResetLink ? { resetLink: passwordResetLink } : {}),
    });
  } catch (err: unknown) {
    console.error('[Users] Error creating user in Firebase Auth:', err);
    const msg = err instanceof Error ? err.message : 'Không thể tạo tài khoản trên Firebase Auth';
    return res.status(500).json({ success: false, error: msg });
  }
});

async function countOtherActiveAdmins(authClient: FirebaseAdminAuth, excludeUid: string): Promise<number> {
  let count = 0;
  let pageToken: string | undefined = undefined;
  do {
    const list = await authClient.listUsers(1000, pageToken);
    for (const u of list.users) {
      if (u.uid !== excludeUid && u.customClaims?.role === 'admin' && !u.disabled) {
        count++;
        return count; // Early return as soon as another active admin is found
      }
    }
    pageToken = list.pageToken;
  } while (pageToken);
  return count;
}

// Update User (Lock/Unlock, Role)
app.patch('/api/admin/users/:userId', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  if (!firebaseAuth || !firestore) {
    return res.status(503).json({ success: false, error: 'Firebase Auth / Firestore chưa sẵn sàng' });
  }
  const { userId } = req.params;
  const { isLocked, role } = req.body;

  // 1. Chống tự khóa hoặc tự hạ quyền tài khoản của chính mình
  if (req.authUser?.uid === userId) {
    if (isLocked === true) {
      return res.status(400).json({ success: false, error: 'Không thể tự khóa tài khoản của chính mình.' });
    }
    if (role && role !== 'Admin') {
      return res.status(400).json({ success: false, error: 'Không thể tự hạ quyền Admin của chính mình.' });
    }
  }

  try {
    let targetUser: UserRecord;
    try {
      targetUser = await firebaseAuth.getUser(userId);
    } catch (getErr: any) {
      if (getErr.code === 'auth/user-not-found') {
        return res.status(404).json({ success: false, error: 'Không tìm thấy người dùng trong Firebase Auth' });
      }
      throw getErr;
    }

    // 2. Chống khóa hoặc hạ quyền Admin duy nhất còn hoạt động trong hệ thống
    const isTargetAdmin = targetUser.customClaims?.role === 'admin';
    if (isTargetAdmin && (isLocked === true || (role && role !== 'Admin'))) {
      const otherActiveAdmins = await countOtherActiveAdmins(firebaseAuth, userId);
      if (otherActiveAdmins === 0) {
        return res.status(400).json({
          success: false,
          error: 'Không thể khóa hoặc hạ quyền Admin duy nhất còn hoạt động trong hệ thống.',
        });
      }
    }

    const updates: { disabled?: boolean } = {};
    if (typeof isLocked === 'boolean') {
      updates.disabled = isLocked;
    }
    if (Object.keys(updates).length > 0) {
      await firebaseAuth.updateUser(userId, updates);
      if (isLocked) {
        await firebaseAuth.revokeRefreshTokens(userId);
      }
    }

    if (role && typeof role === 'string') {
      const roleClaim = role === 'Admin' ? 'admin' : 'user';
      // Hợp nhất (merge) claims
      await firebaseAuth.setCustomUserClaims(userId, {
        ...(targetUser.customClaims || {}),
        role: roleClaim,
      });
      await firebaseAuth.revokeRefreshTokens(userId);
    }

    const docUpdates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (typeof isLocked === 'boolean') docUpdates.isLocked = isLocked;
    if (role) docUpdates.role = role;
    await firestore.collection('users').doc(userId).set(docUpdates, { merge: true });

    const updatedRecord = await firebaseAuth.getUser(userId);
    const auditMsg = `${typeof isLocked === 'boolean' ? (isLocked ? 'Khóa' : 'Mở khóa') : ''} ${role ? `Đổi vai trò -> ${role}` : ''} cho tài khoản ${updatedRecord.email}`;
    recordAuditLog(req.authUser?.email || 'Admin', auditMsg.trim());

    const finalRole: 'Admin' | 'Khách du lịch' = updatedRecord.customClaims?.role === 'admin' ? 'Admin' : 'Khách du lịch';
    return res.json({
      success: true,
      user: {
        id: updatedRecord.uid,
        name: updatedRecord.displayName || updatedRecord.email?.split('@')[0] || 'User',
        email: updatedRecord.email || '',
        phone: updatedRecord.phoneNumber || '',
        role: finalRole,
        isLocked: !!updatedRecord.disabled,
        createdAt: updatedRecord.metadata?.creationTime ? new Date(updatedRecord.metadata.creationTime).toLocaleDateString('vi-VN') : '',
        lastLogin: updatedRecord.metadata?.lastSignInTime ? new Date(updatedRecord.metadata.lastSignInTime).toLocaleString('vi-VN') : '',
      },
    });
  } catch (err: unknown) {
    console.error('[Users] Error updating Firebase user:', err);
    const errMsg = err instanceof Error ? err.message : 'Lỗi cập nhật người dùng trên Firebase Auth';
    return res.status(500).json({ success: false, error: errMsg });
  }
});

// Dọn dẹp toàn bộ dữ liệu Firestore gắn với userId TRƯỚC khi xóa Firebase Auth để tránh dữ liệu mồ côi
async function cleanupUserFirestoreData(db: Firestore, userId: string): Promise<void> {
  const deleteByField = async (collectionName: string, fieldName: string) => {
    const snap = await db.collection(collectionName).where(fieldName, '==', userId).get();
    if (!snap.empty) {
      const CHUNK_SIZE = 400;
      for (let i = 0; i < snap.docs.length; i += CHUNK_SIZE) {
        const chunk = snap.docs.slice(i, i + CHUNK_SIZE);
        const batch = db.batch();
        chunk.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }
    }
  };

  await deleteByField('trips', 'ownerId');
  await deleteByField('trip_receipts', 'ownerId');
  await deleteByField('gemini_jobs', 'ownerUid');

  const metaBatch = db.batch();
  metaBatch.delete(db.collection('users').doc(userId));
  metaBatch.delete(db.collection('user_metadata').doc(userId));
  await metaBatch.commit();
}

// Người dùng tự xóa tài khoản và toàn bộ dữ liệu của chính mình (Self-service Account Deletion)
app.delete('/api/account/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!firebaseAuth || !firestore) {
    return res.status(503).json({ success: false, error: 'Firebase Auth / Firestore chưa sẵn sàng' });
  }

  const uid = req.authUser!.uid;
  try {
    const targetUser = await firebaseAuth.getUser(uid);
    if (targetUser.customClaims?.role === 'admin') {
      const otherActiveAdmins = await countOtherActiveAdmins(firebaseAuth, uid);
      if (otherActiveAdmins === 0) {
        return res.status(400).json({
          success: false,
          error: 'Không thể tự xóa tài khoản Admin duy nhất còn hoạt động trong hệ thống.',
        });
      }
    }

    // Dọn dẹp toàn bộ dữ liệu Firestore trước rồi mới xóa Auth để tránh mồ côi dữ liệu
    await cleanupUserFirestoreData(firestore, uid);
    await firebaseAuth.deleteUser(uid);
    recordAuditLog(
      targetUser.email || uid,
      `Người dùng tự xóa tài khoản và toàn bộ dữ liệu cá nhân (${targetUser.email || uid})`
    );
    return res.json({ success: true, message: 'Đã xóa vĩnh viễn tài khoản và toàn bộ dữ liệu của bạn.' });
  } catch (err: unknown) {
    console.error('[Account] Error self-deleting user:', err);
    const errMsg = err instanceof Error ? err.message : 'Không thể xóa tài khoản lúc này';
    return res.status(500).json({ success: false, error: errMsg });
  }
});

// Delete User (Admin)
app.delete('/api/admin/users/:userId', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  if (!firebaseAuth || !firestore) {
    return res.status(503).json({ success: false, error: 'Firebase Auth / Firestore chưa sẵn sàng' });
  }
  const { userId } = req.params;

  // 1. Chống tự xóa tài khoản của chính mình qua route Admin (nên dùng tự xóa riêng)
  if (req.authUser?.uid === userId) {
    return res.status(400).json({ success: false, error: 'Không thể tự xóa tài khoản của chính mình tại màn hình quản trị.' });
  }

  try {
    let targetUser: UserRecord;
    try {
      targetUser = await firebaseAuth.getUser(userId);
    } catch (getErr: any) {
      if (getErr.code === 'auth/user-not-found') {
        return res.status(404).json({ success: false, error: 'Không tìm thấy người dùng trong Firebase Auth' });
      }
      throw getErr;
    }

    // 2. Chống xóa Admin duy nhất còn hoạt động trong hệ thống
    if (targetUser.customClaims?.role === 'admin') {
      const otherActiveAdmins = await countOtherActiveAdmins(firebaseAuth, userId);
      if (otherActiveAdmins === 0) {
        return res.status(400).json({
          success: false,
          error: 'Không thể xóa Admin duy nhất còn hoạt động trong hệ thống.',
        });
      }
    }

    // 3. Dọn dẹp toàn bộ Firestore (trips, gemini_jobs, users, user_metadata) TRƯỚC khi xóa Auth
    await cleanupUserFirestoreData(firestore, userId);
    await firebaseAuth.deleteUser(userId);
    recordAuditLog(req.authUser?.email || 'Admin', `Đã xóa tài khoản Firebase Auth và dọn sạch dữ liệu: ${targetUser.displayName || targetUser.email} (${targetUser.email})`);
    return res.json({ success: true, message: 'Đã dọn sạch dữ liệu và xóa tài khoản thành công' });
  } catch (err: unknown) {
    console.error('[Users] Error deleting user safely:', err);
    const errMsg = err instanceof Error ? err.message : 'Lỗi xóa người dùng và dọn dẹp dữ liệu';
    return res.status(500).json({ success: false, error: errMsg });
  }
});

// CRITICAL: Protect all /api routes from falling through to Vite SPA html fallback!
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