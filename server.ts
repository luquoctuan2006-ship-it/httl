import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { FirestoreRateLimitStore } from './src/server/middleware/firestoreRateLimitStore';
import { createAuthMiddleware, type AuthenticatedRequest } from './src/server/middleware/auth';
import { registerTripManagementRoutes } from './src/server/routes/tripManagement';
import { registerAdminUserRoutes } from './src/server/routes/adminUsers';
import { registerGeminiRoutes } from './src/server/routes/gemini';
import { registerFleetRoutes } from './src/server/routes/fleet';
import { registerAdminMonitoringRoutes } from './src/server/routes/adminMonitoring';
import { registerAdminConfigRoutes } from './src/server/routes/adminConfig';
import { registerRoutingRoutes } from './src/server/routes/routing';
import { initFirebaseAdmin } from './src/server/services/firebaseAdmin';
import { createSystemConfigStore, ALLOWED_AI_MODELS } from './src/server/services/systemConfigStore';
import { createTripStore } from './src/server/services/tripStore';
import { createGeminiService } from './src/server/services/geminiService';
import { recordAuditLog as persistAuditLog } from './src/server/services/systemLogs';
import type { ReferenceCostRecord, SystemConfig, VehicleRecord } from './src/server/types/systemConfig';

export { ALLOWED_AI_MODELS };
export type { ReferenceCostRecord, SystemConfig, VehicleRecord };

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
  }),
);
app.use(express.json({ limit: '2mb' }));

const { firestore, firebaseAuth, hasServiceAccountCredentials, requireFirestore } = initFirebaseAdmin(__dirname);

const configStore = createSystemConfigStore(() => firestore, requireFirestore);

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

const { requireAuth, requireAdmin } = createAuthMiddleware({
  firebaseAuth,
  firestore,
  hasServiceAccountCredentials,
  syncSystemConfigIfStale: configStore.syncSystemConfigIfStale,
  isMaintenanceMode: () => configStore.getSystemConfig().maintenanceMode,
});

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

const tripStore = createTripStore(requireFirestore);

const geminiService = createGeminiService({
  getFirestoreOrNull: () => firestore,
  requireFirestore,
  getTripById: tripStore.getTripById,
  getSystemConfig: configStore.getSystemConfig,
  getGeminiConfig: () => {
    const state = configStore.getConfigState();
    return {
      dynamicGeminiModel: state.dynamicGeminiModel,
      dynamicGeminiTemperature: state.dynamicGeminiTemperature,
      dynamicGeminiMaxTokens: state.dynamicGeminiMaxTokens,
      dynamicGeminiSystemPrompt: state.dynamicGeminiSystemPrompt,
    };
  },
});

geminiService.startFirestoreCleanupInterval();

registerTripManagementRoutes(app, {
  requireAuth,
  requireFirestore,
  listTripsForUser: tripStore.listTripsForUser,
  loadUserTrips: tripStore.loadUserTrips,
  getTripById: tripStore.getTripById,
  createTripDoc: tripStore.createTripDoc,
  deleteTripDoc: tripStore.deleteTripDoc,
  recordAuditLog,
});

registerGeminiRoutes(app, {
  requireAuth,
  aiRateLimiter,
  ai: geminiService.ai,
  createGeminiCacheKey: geminiService.createGeminiCacheKey,
  getCachedGeminiResult: geminiService.getCachedGeminiResult,
  createGeminiJob: geminiService.createGeminiJob,
  buildOptimizePayload: geminiService.buildOptimizePayload,
  runScheduleOptimization: geminiService.runScheduleOptimization,
  requireFirestore,
});

registerAdminConfigRoutes(app, {
  requireAuth,
  requireAdmin,
  allowedModels: ALLOWED_AI_MODELS,
  getConfigState: configStore.getConfigState,
  setConfigState: configStore.setConfigState,
  syncSystemConfigIfStale: configStore.syncSystemConfigIfStale,
  saveSystemConfig: configStore.saveSystemConfig,
  recordAuditLog,
});

registerAdminMonitoringRoutes(app, {
  requireAuth,
  requireAdmin,
  requireFirestore,
  getGeminiSettings: configStore.getGeminiSettings,
  generateWithGemini: geminiService.generateWithGemini,
  recordAuditLog,
});

registerFleetRoutes(app, {
  requireAuth,
  requireAdmin,
  getSystemConfig: configStore.getSystemConfig,
  getVehicles: configStore.getVehicles,
  getReferenceCosts: configStore.getReferenceCosts,
  setSystemConfig: configStore.setFleetSystemConfig,
  syncSystemConfigIfStale: () => configStore.syncSystemConfigIfStale(),
  saveSystemConfig: configStore.saveSystemConfig,
  recordAuditLog,
});

registerAdminUserRoutes(app, {
  requireAuth,
  requireAdmin,
  firebaseAuth: hasServiceAccountCredentials ? firebaseAuth : null,
  firestore,
  recordAuditLog,
});

registerRoutingRoutes(app, { requireAuth });

app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Đường dẫn API không tồn tại: ${req.method} ${req.originalUrl || req.path}`,
  });
});

app.all('/api', (_req, res) => {
  res.status(404).json({ success: false, error: 'Đường dẫn API không tồn tại' });
});

async function startServer() {
  await configStore.loadSystemConfig();

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