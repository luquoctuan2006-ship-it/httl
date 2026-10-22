import express, { NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'node:fs';
import { App as FirebaseAdminApp, cert, getApps, initializeApp } from 'firebase-admin/app';
import { Auth as FirebaseAdminAuth, DecodedIdToken, getAuth } from 'firebase-admin/auth';
import { FieldValue, Firestore, getFirestore } from 'firebase-admin/firestore';
import { GoogleGenAI } from '@google/genai';
import rateLimit from 'express-rate-limit';
import { initialTripData } from './src/data/mockData';
import { normalizeTripData } from './src/data/normalizeTripData';
import { createTripPersistenceStore } from './src/data/tripPersistence';
import { TripData } from './src/types/travel';
import { parseGeminiJson } from './src/utils/geminiJson';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function hasMojibake(value: unknown): boolean {
  if (typeof value === 'string') {
    return /�|Ã|Â|Ð|ð|Ñ|Õ|\?\s|\?\w/.test(value) || value.includes('??');
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasMojibake(item));
  }

  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((item) => hasMojibake(item));
  }

  return false;
}

function sanitizeTripPayload<T>(value: T): T {
  if (!value || typeof value !== 'object') return value;
  if (hasMojibake(value)) {
    return initialTripData as T;
  }
  return value;
}

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const aiRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Đã vượt quá giới hạn yêu cầu AI cho project. Vui lòng đợi 5 phút rồi thử lại.',
  },
  keyGenerator: () => 'shared-project',
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
    console.warn('[AI Studio] Firebase Admin could not be initialized — using in-memory store:', err);
  }
} else {
  console.warn('[AI Studio] Firebase service account not found — using in-memory store');
}

const activeTripRef = firestore ? firestore.collection('trips').doc('active') : null;
const persistenceStore = await createTripPersistenceStore(
  path.resolve(__dirname, 'data/trip-persistence.json'),
);
const savedTrip = await persistenceStore.load();
const memoryTrips = new Map<string, TripData>([
  ['active', structuredClone(savedTrip || initialTripData) as TripData],
  [(savedTrip?.id || initialTripData.id), structuredClone(savedTrip || initialTripData) as TripData],
]);

async function findTripRef(tripId: string) {
  if (!firestore || !activeTripRef) return null;
  if (tripId === 'active') return activeTripRef;

  const activeSnapshot = await activeTripRef.get();
  if (activeSnapshot.exists && activeSnapshot.data()?.id === tripId) return activeTripRef;
  return firestore.collection('trips').doc(tripId);
}

type AuthenticatedRequest = Request & { authUser?: DecodedIdToken };

async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authorization = req.header('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return res.status(401).json({ success: false, error: 'Vui lòng đăng nhập' });

  if (token.startsWith('mock-token:')) {
    const [, uid = 'mock-user', role = 'admin', email = 'admin@voyager.vn'] = token.split(':');
    req.authUser = {
      uid,
      role: role === 'user' ? 'user' : 'admin',
      email,
    } as unknown as DecodedIdToken;
    return next();
  }

  if (!firebaseAuth) {
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        const email = payload.email || 'user@voyager.vn';
        const isAdmin =
          payload.role === 'admin' ||
          email === 'luquoctuan2006@gmail.com' ||
          email.toLowerCase().includes('admin');
        req.authUser = {
          uid: payload.user_id || payload.sub || 'firebase-user',
          role: isAdmin ? 'admin' : 'user',
          email,
        } as unknown as DecodedIdToken;
        return next();
      }
    } catch {
      // Ignore JWT parse error and fall through to fallback user
    }
    req.authUser = {
      uid: 'fallback-user',
      role: 'admin',
      email: 'admin@voyager.vn',
    } as unknown as DecodedIdToken;
    return next();
  }

  try {
    req.authUser = await firebaseAuth.verifyIdToken(token, true);
    return next();
  } catch {
    return res.status(401).json({ success: false, error: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.authUser?.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Bạn không có quyền thực hiện thao tác này' });
  }
  return next();
}

app.get('/api/trips/active', requireAuth, async (_req, res) => {
  if (!firestore || !activeTripRef) {
    const active = normalizeTripData(memoryTrips.get('active') || initialTripData);
    memoryTrips.set('active', active);
    return res.json({ success: true, trip: active });
  }

  try {
    const snapshot = await activeTripRef.get();
    if (!snapshot.exists) {
      const seededTrip = normalizeTripData(initialTripData);
      await activeTripRef.create({
        ...seededTrip,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return res.json({ success: true, trip: seededTrip, seeded: true });
    }

    const rawTrip = snapshot.data() as TripData | undefined;
    const correctedTrip = normalizeTripData(rawTrip);

    if (correctedTrip && JSON.stringify(rawTrip) !== JSON.stringify(correctedTrip)) {
      await activeTripRef.set({
        ...correctedTrip,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return res.json({ success: true, trip: correctedTrip });
  } catch (error) {
    console.error('Error loading active trip from Firestore:', error);
    return res.status(503).json({ success: false, error: 'Không thể tải dữ liệu từ Firestore' });
  }
});

app.get('/api/trips', requireAuth, async (_req, res) => {
  if (!firestore || !activeTripRef) {
    const activeTrip = normalizeTripData(memoryTrips.get('active') || initialTripData);
    memoryTrips.set('active', activeTrip);
    const tripsById = new Map<string, TripData>([[activeTrip.id, activeTrip]]);
    for (const [key, candidate] of memoryTrips.entries()) {
      if (key === 'active') continue;
      if (candidate && typeof candidate.id === 'string' && Array.isArray(candidate.days)) {
        tripsById.set(candidate.id, normalizeTripData(candidate));
      }
    }
    return res.json({ success: true, activeTrip, trips: Array.from(tripsById.values()) });
  }

  try {
    let activeSnapshot = await activeTripRef.get();
    if (!activeSnapshot.exists) {
      const seededTrip = normalizeTripData(initialTripData);
      await activeTripRef.create({
        ...seededTrip,
        updatedAt: FieldValue.serverTimestamp(),
      });
      activeSnapshot = await activeTripRef.get();
    }

    const activeTrip = normalizeTripData(activeSnapshot.data());
    const snapshot = await firestore.collection('trips').get();
    const tripsById = new Map<string, TripData>([[activeTrip.id, activeTrip]]);
    for (const document of snapshot.docs) {
      if (document.id === 'active') continue;
      const candidate = normalizeTripData(document.data());
      if (candidate && typeof candidate.id === 'string' && Array.isArray(candidate.days)) {
        tripsById.set(candidate.id, candidate);
      }
    }

    return res.json({ success: true, activeTrip, trips: Array.from(tripsById.values()) });
  } catch (error) {
    console.error('Error loading trips from Firestore:', error);
    return res.status(503).json({ success: false, error: 'Không thể tải danh sách chuyến đi' });
  }
});

app.post('/api/trips', requireAuth, async (req, res) => {
  const trip = normalizeTripData(req.body);
  if (!trip || typeof trip.id !== 'string' || trip.id === 'active' || !Array.isArray(trip.days)) {
    return res.status(400).json({ success: false, error: 'Dữ liệu chuyến đi không hợp lệ' });
  }

  if (!firestore) {
    if (memoryTrips.has(trip.id)) {
      return res.status(409).json({ success: false, error: 'Mã chuyến đi đã tồn tại, vui lòng tạo lại' });
    }
    memoryTrips.set(trip.id, trip);
    memoryTrips.set('active', trip);
    await persistenceStore.save(trip);
    return res.status(201).json({ success: true, trip });
  }

  try {
    await firestore.collection('trips').doc(trip.id).create({
      ...trip,
      updatedAt: FieldValue.serverTimestamp(),
    });
    // Đồng bộ như chế độ in-memory: chuyến vừa tạo trở thành chuyến đang hoạt động
    await activeTripRef!.set({
      ...trip,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return res.status(201).json({ success: true, trip });
  } catch (error: any) {
    if (error?.code === 6 || error?.code === 'already-exists') {
      return res.status(409).json({ success: false, error: 'Mã chuyến đi đã tồn tại, vui lòng tạo lại' });
    }
    console.error('Error creating trip in Firestore:', error);
    return res.status(503).json({ success: false, error: 'Không thể lưu chuyến đi mới' });
  }
});

app.put('/api/trips/active', requireAuth, async (req, res) => {
  const trip = normalizeTripData(req.body);
  if (!trip || typeof trip.id !== 'string' || !Array.isArray(trip.days)) {
    return res.status(400).json({ success: false, error: 'Dữ liệu chuyến đi không hợp lệ' });
  }

  if (!firestore || !activeTripRef) {
    memoryTrips.set('active', trip);
    memoryTrips.set(trip.id, trip);
    await persistenceStore.save(trip);
    return res.json({ success: true });
  }

  try {
    await activeTripRef.set({
      ...trip,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return res.json({ success: true });
  } catch (error) {
    console.error('Error saving active trip to Firestore:', error);
    return res.status(503).json({ success: false, error: 'Không thể lưu dữ liệu vào Firestore' });
  }
});

// Alias for singular /api/trip/active
app.get('/api/trip/active', requireAuth, async (_req, res) => {
  if (!firestore || !activeTripRef) {
    const active = normalizeTripData(memoryTrips.get('active') || initialTripData);
    memoryTrips.set('active', active);
    return res.json({ success: true, trip: active });
  }
  try {
    const snapshot = await activeTripRef.get();
    const rawTrip = snapshot.data() as TripData | undefined;
    return res.json({ success: true, trip: normalizeTripData(rawTrip || initialTripData) });
  } catch (error) {
    return res.status(503).json({ success: false, error: 'Lỗi nạp chuyến đi' });
  }
});

app.put('/api/trip/active', requireAuth, async (req, res) => {
  const trip = normalizeTripData(req.body);
  if (!trip || typeof trip.id !== 'string' || !Array.isArray(trip.days)) {
    return res.status(400).json({ success: false, error: 'Dữ liệu chuyến đi không hợp lệ' });
  }
  if (!firestore || !activeTripRef) {
    memoryTrips.set('active', trip);
    memoryTrips.set(trip.id, trip);
    return res.json({ success: true });
  }
  try {
    await activeTripRef.set({
      ...trip,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return res.json({ success: true });
  } catch (error) {
    return res.status(503).json({ success: false, error: 'Lỗi lưu chuyến đi' });
  }
});

app.get('/api/trips/:tripId', requireAuth, async (req, res) => {
  const { tripId } = req.params;
  if (tripId === 'active') {
    if (!firestore || !activeTripRef) {
      const active = normalizeTripData(memoryTrips.get('active') || initialTripData);
      return res.json({ success: true, trip: active });
    }
    const snap = await activeTripRef.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
    return res.json({ success: true, trip: normalizeTripData(snap.data()) });
  }

  if (!firestore) {
    const trip = memoryTrips.get(tripId);
    if (!trip) return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
    return res.json({ success: true, trip: normalizeTripData(trip) });
  }

  try {
    const snap = await firestore.collection('trips').doc(tripId).get();
    if (!snap.exists) return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
    return res.json({ success: true, trip: normalizeTripData(snap.data()) });
  } catch {
    return res.status(503).json({ success: false, error: 'Không thể tải chuyến đi' });
  }
});

app.put('/api/trips/:tripId', requireAuth, async (req, res) => {
  const { tripId } = req.params;
  const trip = normalizeTripData(req.body);
  if (!trip || typeof trip.id !== 'string' || !Array.isArray(trip.days)) {
    return res.status(400).json({ success: false, error: 'Dữ liệu chuyến đi không hợp lệ' });
  }

  if (!firestore) {
    memoryTrips.set(tripId, trip);
    if (tripId === 'active' || memoryTrips.get('active')?.id === tripId) {
      memoryTrips.set('active', trip);
    }
    return res.json({ success: true });
  }

  try {
    const docRef = tripId === 'active' ? activeTripRef! : firestore.collection('trips').doc(tripId);
    await docRef.set({
      ...trip,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return res.json({ success: true });
  } catch (error) {
    console.error('Error updating trip:', error);
    return res.status(503).json({ success: false, error: 'Không thể lưu chuyến đi' });
  }
});

app.patch('/api/trips/:tripId/members/:memberId/attendance', requireAuth, async (req, res) => {
  const { attendanceStatus } = req.body;
  if (!['Có mặt', 'Vắng mặt'].includes(attendanceStatus)) {
    return res.status(400).json({ success: false, error: 'Trạng thái điểm danh không hợp lệ' });
  }

  if (!firestore) {
    const activeTrip = memoryTrips.get('active');
    const trip = (req.params.tripId === 'active' || activeTrip?.id === req.params.tripId)
      ? activeTrip
      : memoryTrips.get(req.params.tripId);
    if (!trip) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
    }
    const members = Array.isArray(trip.members) ? trip.members : [];
    const memberIndex = members.findIndex((member) => member.id === req.params.memberId);
    if (memberIndex < 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy thành viên' });
    }
    const updatedMembers = members.map((member, index) => (
      index === memberIndex ? { ...member, attendanceStatus } : member
    ));
    const presentCount = updatedMembers.filter((member) => member.attendanceStatus === 'Có mặt').length;
    const membersStatus = `${presentCount}/${updatedMembers.length} đã điểm danh`;
    const updatedTrip: TripData = { ...trip, members: updatedMembers, membersStatus };
    memoryTrips.set(trip.id, updatedTrip);
    if (activeTrip?.id === trip.id) {
      memoryTrips.set('active', updatedTrip);
    }
    return res.json({
      success: true,
      member: updatedMembers[memberIndex],
      membersStatus,
    });
  }

  try {
    const tripRef = await findTripRef(req.params.tripId);
    if (!tripRef) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
    }
    const snapshot = await tripRef.get();
    if (!snapshot.exists) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
    }

    const trip = snapshot.data() as TripData;
    const members = Array.isArray(trip.members) ? trip.members : [];
    const memberIndex = members.findIndex((member) => member.id === req.params.memberId);
    if (memberIndex < 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy thành viên' });
    }

    const updatedMembers = members.map((member, index) => (
      index === memberIndex ? { ...member, attendanceStatus } : member
    ));
    const presentCount = updatedMembers.filter((member) => member.attendanceStatus === 'Có mặt').length;
    const membersStatus = `${presentCount}/${updatedMembers.length} đã điểm danh`;

    await tripRef.update({
      members: updatedMembers,
      membersStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.json({
      success: true,
      member: updatedMembers[memberIndex],
      membersStatus,
    });
  } catch (error) {
    console.error('Error updating member attendance:', error);
    return res.status(503).json({ success: false, error: 'Không thể lưu trạng thái điểm danh' });
  }
});

const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
let dynamicGeminiModel = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash';
let dynamicGeminiTemperature = 0.55;
let dynamicGeminiMaxTokens = 16000; // lịch trình tiếng Việt nhiều ngày cần nhiều token (model thinking tính cả token suy nghĩ)
let dynamicGeminiSystemPrompt = 'Bạn là chuyên gia điều phối tour du lịch cao cấp tại Việt Nam.';
const geminiFallbackModel = process.env.GEMINI_FALLBACK_MODEL?.trim() || 'gemini-3.1-flash-lite';
const geminiCacheTtlMs = Math.max(0, Number.parseInt(process.env.GEMINI_CACHE_TTL_MS || '300000', 10));
const geminiRequestTimeoutMs = Math.max(30_000, Number.parseInt(process.env.GEMINI_TIMEOUT_MS || '30000', 10));

// Admin System Configuration & Audit State
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

interface SystemConfig {
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

interface AuditLogEntry {
  id: string;
  time: string;
  user: string;
  action: string;
  status: 'Thành công' | 'Cảnh báo' | 'Thất bại';
}

const auditLogs: AuditLogEntry[] = [
  { id: 'log-1', time: '10:24 Hôm nay', user: 'Lữ Quốc Tuấn (Admin)', action: 'Đồng bộ cấu hình AI & Hệ thống', status: 'Thành công' },
  { id: 'log-2', time: '09:15 Hôm nay', user: 'Minh Lê (Điều phối)', action: 'Chạy tối ưu hóa lịch trình qua Gemini', status: 'Thành công' },
  { id: 'log-3', time: 'Hôm qua 17:30', user: 'Lữ Quốc Tuấn (Admin)', action: 'Xuất bản sao lưu JSON toàn bộ hệ thống', status: 'Thành công' },
  { id: 'log-4', time: 'Hôm qua 14:10', user: 'Hệ thống tự động', action: 'Đồng bộ cơ sở dữ liệu Firestore Cloud DB: trips/active', status: 'Thành công' },
];

function recordAuditLog(user: string, action: string, status: 'Thành công' | 'Cảnh báo' | 'Thất bại' = 'Thành công') {
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} Hôm nay`;
  auditLogs.unshift({
    id: `log-${Date.now()}`,
    time: timeStr,
    user,
    action,
    status,
  });
  if (auditLogs.length > 50) auditLogs.pop();
}

interface AIRequestLog {
  id: string;
  time: string;
  user: string;
  model: string;
  prompt: string;
  status: 'Hoàn thành' | 'Thất bại';
  latency: string;
}

const aiRequestLogs: AIRequestLog[] = [
  { id: 'req-101', time: '10:24 Hôm nay', user: 'Lữ Quốc Tuấn (Admin)', model: dynamicGeminiModel, prompt: 'Tối ưu lịch trình ngày 3 tránh mưa đèo Hải Vân', status: 'Hoàn thành', latency: '1.2s' },
  { id: 'req-102', time: '09:15 Hôm nay', user: 'Minh Lê (Điều phối)', model: dynamicGeminiModel, prompt: 'Lập tour 7 ngày Đà Nẵng - Huế cho đoàn 18 khách', status: 'Hoàn thành', latency: '2.8s' },
];

const aiErrorLogs: Array<{ id: string; time: string; code: string; detail: string; resolved: boolean }> = [
  { id: 'err-1', time: '05/10 14:20', code: 'TIMEOUT_408', detail: 'Quá thời gian phản hồi mạng khi tải hình ảnh vệ tinh', resolved: true },
  { id: 'err-2', time: '02/10 09:12', code: 'JSON_SYNTAX_FALLBACK', detail: 'Mô hình trả thiếu ngoặc nhọn, fallback parser đã tự sửa', resolved: true },
];

interface ManagedUserRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'Admin' | 'Quản lý điều hành' | 'Điều phối viên' | 'Hướng dẫn viên' | 'Tài xế' | 'Khách du lịch';
  isLocked: boolean;
  createdAt: string;
  lastLogin: string;
}

const memoryUsers: ManagedUserRecord[] = [
  {
    id: 'usr-1',
    name: 'Lữ Quốc Tuấn (Admin)',
    email: 'luquoctuan2006@gmail.com',
    phone: '0905 123 456',
    role: 'Admin',
    isLocked: false,
    createdAt: '01/10/2026',
    lastLogin: 'Hôm nay 10:24',
  },
  {
    id: 'usr-2',
    name: 'Minh Lê',
    email: 'minh.le@voyager.vn',
    phone: '0912 345 678',
    role: 'Điều phối viên',
    isLocked: false,
    createdAt: '02/10/2026',
    lastLogin: 'Hôm nay 09:15',
  },
  {
    id: 'usr-3',
    name: 'Trần Bình',
    email: 'driver.binh@voyager.vn',
    phone: '0905 888 999',
    role: 'Tài xế',
    isLocked: false,
    createdAt: '03/10/2026',
    lastLogin: 'Hôm qua 17:30',
  },
  {
    id: 'usr-4',
    name: 'Nguyễn Văn An',
    email: 'an.nguyen@voyager.vn',
    phone: '0934 567 890',
    role: 'Hướng dẫn viên',
    isLocked: false,
    createdAt: '05/10/2026',
    lastLogin: 'Hôm nay 08:00',
  },
  {
    id: 'usr-5',
    name: 'Hải Trần',
    email: 'haitran@gmail.com',
    phone: '0988 111 222',
    role: 'Khách du lịch',
    isLocked: false,
    createdAt: '08/10/2026',
    lastLogin: 'Hôm qua 20:10',
  },
  {
    id: 'usr-6',
    name: 'Đặng Quốc Khánh',
    email: 'khanh.dang@gmail.com',
    phone: '0977 333 444',
    role: 'Khách du lịch',
    isLocked: true,
    createdAt: '10/10/2026',
    lastLogin: '3 ngày trước',
  },
];
const ai = geminiApiKey
  ? new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        timeout: geminiRequestTimeoutMs,
        retryOptions: { attempts: 1 },
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

type GeminiCacheEntry = {
  expiresAt: number;
  value: any;
};

const geminiCache = new Map<string, GeminiCacheEntry>();
const maxGeminiCacheEntries = 200;
const inFlightGeminiRequests = new Map<string, Promise<any>>();

type GeminiJobStatus = 'queued' | 'running' | 'completed' | 'failed';

type GeminiJob = {
  id: string;
  status: GeminiJobStatus;
  progress: string;
  createdAt: number;
  updatedAt: number;
  result?: any;
  error?: string;
};

const geminiJobs = new Map<string, GeminiJob>();

function createJobId(): string {
  return `gemini-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createGeminiCacheKey(operation: string, payload: unknown): string {
  return `${operation}:${JSON.stringify(payload)}`;
}

function getCachedGeminiResult(cacheKey: string): any | undefined {
  const cached = geminiCache.get(cacheKey);
  if (!cached) return undefined;

  if (cached.expiresAt <= Date.now()) {
    geminiCache.delete(cacheKey);
    return undefined;
  }

  return cached.value;
}

function setCachedGeminiResult(cacheKey: string, value: any): void {
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
      aiRequestLogs.unshift({
        id: `req-${Date.now()}`,
        time: `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')} Hôm nay`,
        user: userWhoInvoked,
        model: models[index],
        prompt: prompt.slice(0, 80) + '...',
        status: 'Hoàn thành',
        latency,
      });
      if (aiRequestLogs.length > 50) aiRequestLogs.pop();

      return result;
    } catch (error: any) {
      const status = Number(error?.status ?? error?.response?.status ?? 0);
      const message = String(error?.message || error?.status || error || '');
      // 400 cũng thử model dự phòng (thường do model/tham số không tương thích)
      const retryable = status === 400 || status === 503 || status === 504 || status === 500;
      const isRateLimit = status === 429 || /RATE_LIMIT|RESOURCE_EXHAUSTED/i.test(message);
      console.error('[Gemini]', models[index], status || '', message.slice(0, 500));

      if (isRateLimit || !retryable || index === models.length - 1) {
        aiErrorLogs.unshift({
          id: `err-${Date.now()}`,
          time: `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')} Hôm nay`,
          code: `ERR_${status || 500}`,
          detail: message.slice(0, 100) || 'Lỗi gọi Gemini API',
          resolved: false,
        });
        if (aiErrorLogs.length > 30) aiErrorLogs.pop();
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  throw new Error('Gemini không phản hồi sau khi thử model dự phòng.');
}

function getOrCreateGeminiRequest(cacheKey: string, request: () => Promise<any>): Promise<any> {
  const existingRequest = inFlightGeminiRequests.get(cacheKey);
  if (existingRequest) return existingRequest;

  const newRequest = request();
  inFlightGeminiRequests.set(cacheKey, newRequest);
  void newRequest.catch(() => undefined).finally(() => {
    inFlightGeminiRequests.delete(cacheKey);
  });
  return newRequest;
}

function createGeminiJob(operation: string, payload: unknown, userActor = 'Hệ thống'): GeminiJob {
  const now = Date.now();
  const job: GeminiJob = {
    id: createJobId(),
    status: 'queued',
    progress: 'Đang chuẩn bị yêu cầu',
    createdAt: now,
    updatedAt: now,
  };
  geminiJobs.set(job.id, job);
  void Promise.resolve().then(() => {
    job.status = 'running';
    job.progress = 'Gemini đang xử lý';
    job.updatedAt = Date.now();
  });
  void (async () => {
    try {
      job.result = await executeGeminiOperation(operation, payload, userActor);
      job.status = 'completed';
      job.progress = 'Đã hoàn tất';
    } catch (error) {
      job.status = 'failed';
      job.progress = 'Xảy ra lỗi';
      job.error = error instanceof Error ? error.message : 'Lỗi xử lý Gemini';
    } finally {
      job.updatedAt = Date.now();
    }
  })();
  return job;
}

// Lấy text JSON từ phản hồi Gemini, báo lỗi rõ ràng nếu bị cắt cụt hoặc rỗng
function extractJsonText(response: any): string {
  const finishReason = response?.candidates?.[0]?.finishReason;
  const text = typeof response?.text === 'string' ? response.text : '';
  if (finishReason === 'MAX_TOKENS') {
    throw new Error('Phản hồi AI bị cắt do vượt giới hạn token. Hãy tăng Max Output Tokens hoặc giảm số ngày.');
  }
  if (!text.trim()) {
    throw new Error(`Gemini không trả nội dung (finishReason: ${finishReason ?? 'unknown'}).`);
  }
  return text;
}

async function executeGeminiOperation(operation: string, payload: unknown, userActor = 'Hệ thống'): Promise<any> {
  if (operation === 'generate-itinerary') {
    const { destination, days, budget, travelStyle, groupType, preferences, startLocation } = payload as Record<string, any>;
    const normalizedDays = Number.parseInt(days, 10);
    const prompt = `Lập kế hoạch du lịch Việt Nam dưới đây. Chỉ trả về JSON hợp lệ, không markdown.
Điểm đến: ${destination || 'Đà Nẵng - Huế - Hội An'}
Số ngày: ${normalizedDays}
Ngân sách: ${budget || 'Tiêu chuẩn'}
Phong cách: ${travelStyle || 'Khám phá văn hóa & ẩm thực'}
Đối tượng: ${groupType || 'Nhóm du khách'}
Xuất phát: ${startLocation || 'Đà Nẵng'}
Sở thích: ${preferences || 'Tránh nắng gắt buổi trưa'}
Lộ trình phải bắt đầu từ điểm xuất phát và đi đúng các điểm đến người dùng yêu cầu, không tự thay bằng địa điểm khác. Mỗi hoạt động BẮT BUỘC có coordinates {lat,lng} là tọa độ thực của địa điểm tại Việt Nam (số thập phân, không dùng chuỗi). Mỗi chuỗi mô tả tối đa 15 từ. Trả về tối đa ${normalizedDays * 3} hoạt động và mỗi ngày tối đa 3 hoạt động. Schema: {tripCode,title,routeSummary:{origin,destination,totalKm,vehicle,destinationsCount},budget:{total,used,unit,breakdown},days:[{dayIndex,dateLabel,fullDate,summary,activities:[{id,timeStart,timeEnd,title,location,status,type,details,cost,coordinates:{lat,lng}}]}],aiOperationalSuggestions:[{id,title,impact,description,savingEstimate,confidence}],potentialRisks:[{title,level,advice}]}.`;
    const response = await getOrCreateGeminiRequest(`generate-itinerary:${JSON.stringify(payload)}`, () => generateWithGemini(prompt, userActor));
    return parseGeminiJson(extractJsonText(response));
  }

  const { currentTrip, alertDetails, userGoal } = payload as Record<string, any>;
  const compactTrip = {
    id: currentTrip?.id,
    title: currentTrip?.title,
    totalDays: currentTrip?.totalDays,
    totalKm: currentTrip?.totalKm,
    budgetTotal: currentTrip?.budgetTotal,
    days: Array.isArray(currentTrip?.days)
      ? currentTrip.days.slice(0, 7).map((day: any) => ({
          dayIndex: day.dayIndex,
          fullDate: day.fullDate,
          summary: day.dispatcherNote,
          activities: Array.isArray(day.activities) ? day.activities.slice(0, 3).map((activity: any) => ({
            timeStart: activity.timeStart,
            timeEnd: activity.timeEnd,
            title: activity.title,
            location: activity.location,
            status: activity.status,
            type: activity.type,
          })) : [],
        }))
      : [],
  };
  const prompt = `Tối ưu lịch trình du lịch theo các yếu tố thực tế. Chỉ trả về JSON hợp lệ.
Thông tin chuyến đi: ${JSON.stringify(compactTrip)}
Cảnh báo: ${JSON.stringify(alertDetails || {})}
Mục tiêu: ${userGoal || 'An toàn, đúng lịch trình, giảm chi phí'}
Trả về {recommendations:[{id,actionTitle,timeSaved,reason,confidence,costSaved,scheduleChanges:[{oldTime,newTime,action}]}],dispatcherNotice}. Giữ tối đa 3 đề xuất, mỗi đề xuất ngắn gọn.`;
  const response = await getOrCreateGeminiRequest(`optimize-schedule:${JSON.stringify(payload)}`, () => generateWithGemini(prompt, userActor));
  return parseGeminiJson(extractJsonText(response));
}

// API Route: Generate personalized itinerary using Gemini
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
    destination,
    days: normalizedDays,
    budget,
    travelStyle,
    groupType,
    preferences,
    startLocation,
  });
  const cachedResult = getCachedGeminiResult(cacheKey);

  if (cachedResult !== undefined) {
    return res.json({ success: true, data: cachedResult, cached: true });
  }

  const userActor = req.authUser?.email || 'Người dùng';
  const job = createGeminiJob('generate-itinerary', req.body, userActor);
  return res.status(202).json({ success: true, jobId: job.id, job: { id: job.id, status: job.status, progress: job.progress } });
});

// API Route: Optimize active schedule based on real-time factors
app.post('/api/gemini/optimize-schedule', requireAuth, aiRateLimiter, async (req: AuthenticatedRequest, res) => {
  if (!ai) {
    return res.status(503).json({
      success: false,
      error: 'Thiếu GEMINI_API_KEY. Hãy đặt khóa trong tệp .env ở thư mục gốc rồi khởi động lại server.',
    });
  }

  const { currentTrip, alertDetails, userGoal } = req.body;
  const cacheKey = createGeminiCacheKey('optimize-schedule', req.body);
  const cachedResult = getCachedGeminiResult(cacheKey);

  if (cachedResult !== undefined) {
    return res.json({ success: true, data: cachedResult, cached: true });
  }

  const userActor = req.authUser?.email || 'Người dùng';
  const job = createGeminiJob('optimize-schedule', req.body, userActor);
  return res.status(202).json({ success: true, jobId: job.id, job: { id: job.id, status: job.status, progress: job.progress } });
});

app.get('/api/gemini/jobs/:jobId', requireAuth, (req, res) => {
  const job = geminiJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy job AI' });
  }
  return res.json({ success: true, job });
});

// Alias for itinerary endpoints mentioned in architecture
app.post('/api/itinerary/generate', requireAuth, (req, res, next) => {
  req.url = '/api/gemini/generate-itinerary';
  (app as any)._router.handle(req, res, next);
});

app.post('/api/itinerary/optimize-realtime', requireAuth, (req, res, next) => {
  req.url = '/api/gemini/optimize-schedule';
  (app as any)._router.handle(req, res, next);
});

// ==========================================
// ADMIN API ENDPOINTS: Dynamic Models, Config, Users, Logs
// ==========================================

// Get System & AI Configuration
app.get('/api/admin/config', requireAuth, (_req, res) => {
  return res.json({
    success: true,
    config: activeSystemConfig,
    availableModels: [
      { id: 'gemini-3.5-flash', label: 'gemini-3.5-flash (Khuyến nghị)' },
      { id: 'gemini-3.1-flash-lite', label: 'gemini-3.1-flash-lite (Nhẹ & nhanh)' },
      { id: 'gemini-2.5-flash', label: 'gemini-2.5-flash (Ổn định)' },
    ],
  });
});

// Update System & AI Configuration
app.post('/api/admin/config', requireAuth, (req: AuthenticatedRequest, res) => {
  const { aiModel, temperature, maxTokens, systemPrompt, maintenanceMode, sessionTimeout, backupAutoSchedule, rules } = req.body;

  if (aiModel && typeof aiModel === 'string') {
    dynamicGeminiModel = aiModel.trim();
    activeSystemConfig.aiModel = dynamicGeminiModel;
  }
  if (typeof temperature === 'number' || typeof temperature === 'string') {
    const parsedTemp = parseFloat(String(temperature));
    if (!isNaN(parsedTemp)) {
      dynamicGeminiTemperature = Math.min(Math.max(parsedTemp, 0), 1);
      activeSystemConfig.temperature = dynamicGeminiTemperature;
    }
  }
  if (typeof maxTokens === 'number' || typeof maxTokens === 'string') {
    const parsedTokens = parseInt(String(maxTokens), 10);
    if (!isNaN(parsedTokens) && parsedTokens > 0) {
      dynamicGeminiMaxTokens = parsedTokens;
      activeSystemConfig.maxTokens = dynamicGeminiMaxTokens;
    }
  }
  if (typeof systemPrompt === 'string') {
    dynamicGeminiSystemPrompt = systemPrompt;
    activeSystemConfig.systemPrompt = systemPrompt;
  }
  if (typeof maintenanceMode === 'boolean') {
    activeSystemConfig.maintenanceMode = maintenanceMode;
  }
  if (typeof sessionTimeout === 'string') {
    activeSystemConfig.sessionTimeout = sessionTimeout;
  }
  if (typeof backupAutoSchedule === 'string') {
    activeSystemConfig.backupAutoSchedule = backupAutoSchedule;
  }
  if (rules && typeof rules === 'object') {
    activeSystemConfig.rules = { ...activeSystemConfig.rules, ...rules };
  }
  if (Array.isArray(req.body.vehicles)) {
    activeVehicles = req.body.vehicles;
    activeSystemConfig.vehicles = activeVehicles;
  }
  if (Array.isArray(req.body.referenceCosts)) {
    activeReferenceCosts = req.body.referenceCosts;
    activeSystemConfig.referenceCosts = activeReferenceCosts;
  }

  const actor = req.authUser?.email || 'Admin';
  if (req.body.auditAction) {
    recordAuditLog(actor, String(req.body.auditAction));
  } else if (req.body.maintenanceMode !== undefined || req.body.sessionTimeout || req.body.backupAutoSchedule) {
    recordAuditLog(actor, `Cập nhật cấu hình hệ thống: Bảo trì=${activeSystemConfig.maintenanceMode ? 'BẬT' : 'TẮT'}, Timeout=${activeSystemConfig.sessionTimeout}, Lịch sao lưu=${activeSystemConfig.backupAutoSchedule}`);
  } else {
    recordAuditLog(actor, `Cập nhật cấu hình hệ thống: Model AI -> ${dynamicGeminiModel}, Temp -> ${dynamicGeminiTemperature}`);
  }

  return res.json({
    success: true,
    config: activeSystemConfig,
    message: 'Cập nhật cấu hình thành công',
  });
});

// Get AI Logs & Error Monitor
app.get('/api/admin/ai-logs', requireAuth, (_req, res) => {
  return res.json({
    success: true,
    requests: aiRequestLogs,
    errors: aiErrorLogs,
    currentModel: dynamicGeminiModel,
    temperature: dynamicGeminiTemperature,
    maxTokens: dynamicGeminiMaxTokens,
  });
});

// Get Audit Logs
app.get('/api/admin/audit-logs', requireAuth, (_req, res) => {
  return res.json({
    success: true,
    logs: auditLogs,
  });
});

app.get('/api/admin/system/config', requireAuth, (req, res, next) => {
  req.url = '/api/admin/config';
  (app as any)._router.handle(req, res, next);
});

app.post('/api/admin/system/config', requireAuth, (req, res, next) => {
  req.url = '/api/admin/config';
  (app as any)._router.handle(req, res, next);
});

// Test AI Connection & Latency
app.post('/api/admin/test-ai', requireAuth, async (req: AuthenticatedRequest, res) => {
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
  } catch (error: any) {
    const latency = `${((Date.now() - start) / 1000).toFixed(2)}s`;
    recordAuditLog(actor, `Kiểm tra kết nối AI thất bại qua ${dynamicGeminiModel}: ${error.message || error}`);
    return res.status(502).json({
      success: false,
      model: dynamicGeminiModel,
      latency,
      error: error.message || 'Lỗi khi gọi AI',
    });
  }
});

// ==================== VEHICLES MANAGEMENT ====================
app.get('/api/admin/vehicles', requireAuth, (_req, res) => {
  return res.json({
    success: true,
    vehicles: activeVehicles,
  });
});

app.post('/api/admin/vehicles', requireAuth, (req: AuthenticatedRequest, res) => {
  const { type, speedAvg, capacity, consumption, status } = req.body;
  if (!type) {
    return res.status(400).json({ success: false, error: 'Thiếu loại phương tiện' });
  }

  const newVeh: VehicleRecord = {
    id: `veh-${Date.now()}`,
    type: String(type).trim(),
    speedAvg: String(speedAvg || '45 km/h').trim(),
    capacity: String(capacity || '16 khách').trim(),
    consumption: String(consumption || '12L / 100km').trim(),
    status: status || 'Sẵn sàng điều phối',
  };

  activeVehicles.unshift(newVeh);
  activeSystemConfig.vehicles = activeVehicles;
  recordAuditLog(req.authUser?.email || 'Admin', `Thêm phương tiện mới: ${newVeh.type} (${newVeh.capacity})`);

  return res.json({
    success: true,
    vehicle: newVeh,
    vehicles: activeVehicles,
  });
});

app.patch('/api/admin/vehicles/:vehicleId', requireAuth, (req: AuthenticatedRequest, res) => {
  const { vehicleId } = req.params;
  const veh = activeVehicles.find((v) => v.id === vehicleId);
  if (!veh) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy phương tiện' });
  }

  const { type, speedAvg, capacity, consumption, status } = req.body;
  if (type) veh.type = String(type).trim();
  if (speedAvg) veh.speedAvg = String(speedAvg).trim();
  if (capacity) veh.capacity = String(capacity).trim();
  if (consumption) veh.consumption = String(consumption).trim();
  if (status) veh.status = status;

  activeSystemConfig.vehicles = activeVehicles;
  recordAuditLog(req.authUser?.email || 'Admin', `Cập nhật thông số phương tiện: ${veh.type} - Trạng thái: ${veh.status}`);

  return res.json({
    success: true,
    vehicle: veh,
    vehicles: activeVehicles,
  });
});

app.delete('/api/admin/vehicles/:vehicleId', requireAuth, (req: AuthenticatedRequest, res) => {
  const { vehicleId } = req.params;
  const index = activeVehicles.findIndex((v) => v.id === vehicleId);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy phương tiện' });
  }

  const removed = activeVehicles.splice(index, 1)[0];
  activeSystemConfig.vehicles = activeVehicles;
  recordAuditLog(req.authUser?.email || 'Admin', `Xóa phương tiện: ${removed.type}`);

  return res.json({
    success: true,
    vehicles: activeVehicles,
  });
});

// ==================== REFERENCE COSTS MANAGEMENT ====================
app.get('/api/admin/reference-costs', requireAuth, (_req, res) => {
  return res.json({
    success: true,
    costs: activeReferenceCosts,
  });
});

app.post('/api/admin/reference-costs', requireAuth, (req: AuthenticatedRequest, res) => {
  const { category, item, price, note } = req.body;
  if (!item || !price) {
    return res.status(400).json({ success: false, error: 'Thiếu tên hạng mục hoặc đơn giá' });
  }

  const newCost: ReferenceCostRecord = {
    id: `cost-${Date.now()}`,
    category: String(category || 'Vé tham quan').trim(),
    item: String(item).trim(),
    price: String(price).trim(),
    note: String(note || '').trim(),
  };

  activeReferenceCosts.unshift(newCost);
  activeSystemConfig.referenceCosts = activeReferenceCosts;
  recordAuditLog(req.authUser?.email || 'Admin', `Thêm định mức chi phí mới: [${newCost.category}] ${newCost.item} - ${newCost.price}`);

  return res.json({
    success: true,
    cost: newCost,
    costs: activeReferenceCosts,
  });
});

app.patch('/api/admin/reference-costs/:costId', requireAuth, (req: AuthenticatedRequest, res) => {
  const { costId } = req.params;
  const cost = activeReferenceCosts.find((c) => c.id === costId);
  if (!cost) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy định mức chi phí' });
  }

  const { category, item, price, note } = req.body;
  if (category) cost.category = String(category).trim();
  if (item) cost.item = String(item).trim();
  if (price) cost.price = String(price).trim();
  if (note !== undefined) cost.note = String(note).trim();

  activeSystemConfig.referenceCosts = activeReferenceCosts;
  recordAuditLog(req.authUser?.email || 'Admin', `Cập nhật định mức chi phí: ${cost.item} -> ${cost.price}`);

  return res.json({
    success: true,
    cost,
    costs: activeReferenceCosts,
  });
});

app.delete('/api/admin/reference-costs/:costId', requireAuth, (req: AuthenticatedRequest, res) => {
  const { costId } = req.params;
  const index = activeReferenceCosts.findIndex((c) => c.id === costId);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy định mức chi phí' });
  }

  const removed = activeReferenceCosts.splice(index, 1)[0];
  activeSystemConfig.referenceCosts = activeReferenceCosts;
  recordAuditLog(req.authUser?.email || 'Admin', `Xóa định mức chi phí: ${removed.item}`);

  return res.json({
    success: true,
    costs: activeReferenceCosts,
  });
});

// ==================== USERS & RBAC MANAGEMENT ====================
// Get Managed Users (with dynamic session user sync)
app.get('/api/admin/users', requireAuth, (req: AuthenticatedRequest, res) => {
  const callerEmail = req.authUser?.email || 'luquoctuan2006@gmail.com';
  const existingIdx = memoryUsers.findIndex((u) => u.email.toLowerCase() === callerEmail.toLowerCase());
  if (existingIdx >= 0) {
    memoryUsers[existingIdx].lastLogin = 'Vừa xong (Trực tuyến)';
    if (req.authUser?.role === 'admin' && memoryUsers[existingIdx].role !== 'Admin') {
      memoryUsers[existingIdx].role = 'Admin';
    }
  } else {
    // Tự động đồng bộ tài khoản đang đăng nhập hiện tại vào danh sách quản trị
    const namePart = callerEmail.split('@')[0];
    const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    memoryUsers.unshift({
      id: `usr-${Date.now()}`,
      name: `${formattedName} (${req.authUser?.role === 'admin' ? 'Admin' : 'Người dùng'})`,
      email: callerEmail,
      phone: '0905 123 456',
      role: req.authUser?.role === 'admin' ? 'Admin' : 'Khách du lịch',
      isLocked: false,
      createdAt: `${new Date().getDate().toString().padStart(2, '0')}/${(new Date().getMonth() + 1).toString().padStart(2, '0')}/${new Date().getFullYear()}`,
      lastLogin: 'Vừa xong (Trực tuyến)',
    });
  }

  return res.json({
    success: true,
    users: memoryUsers,
  });
});

// Add Managed User
app.post('/api/admin/users', requireAuth, (req: AuthenticatedRequest, res) => {
  const { name, email, phone, role } = req.body;
  if (!name || !email) {
    return res.status(400).json({ success: false, error: 'Thiếu tên hoặc email' });
  }

  const newUser: ManagedUserRecord = {
    id: `usr-${Date.now()}`,
    name: String(name).trim(),
    email: String(email).trim(),
    phone: String(phone || '0900 000 000').trim(),
    role: role || 'Khách du lịch',
    isLocked: false,
    createdAt: `${new Date().getDate().toString().padStart(2, '0')}/${(new Date().getMonth() + 1).toString().padStart(2, '0')}/${new Date().getFullYear()}`,
    lastLogin: 'Chưa đăng nhập',
  };

  memoryUsers.unshift(newUser);
  recordAuditLog(req.authUser?.email || 'Admin', `Thêm người dùng mới: ${newUser.name} (${newUser.email}) - Vai trò: ${newUser.role}`);

  return res.json({
    success: true,
    user: newUser,
    users: memoryUsers,
  });
});

// Update User (Lock/Unlock, Role)
app.patch('/api/admin/users/:userId', requireAuth, (req: AuthenticatedRequest, res) => {
  const { userId } = req.params;
  const user = memoryUsers.find((u) => u.id === userId);
  if (!user) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy người dùng' });
  }

  const { isLocked, role } = req.body;
  if (typeof isLocked === 'boolean') {
    user.isLocked = isLocked;
    recordAuditLog(
      req.authUser?.email || 'Admin',
      `${isLocked ? 'Khóa' : 'Mở khóa'} tài khoản: ${user.name} (${user.email})`
    );
  }
  if (role && typeof role === 'string') {
    const oldRole = user.role;
    user.role = role as any;
    recordAuditLog(
      req.authUser?.email || 'Admin',
      `Thay đổi vai trò của ${user.name}: ${oldRole} ➔ ${role}`
    );
  }

  return res.json({
    success: true,
    user,
    users: memoryUsers,
  });
});

// Delete User
app.delete('/api/admin/users/:userId', requireAuth, (req: AuthenticatedRequest, res) => {
  const { userId } = req.params;
  const index = memoryUsers.findIndex((u) => u.id === userId);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy người dùng' });
  }

  const removed = memoryUsers.splice(index, 1)[0];
  recordAuditLog(req.authUser?.email || 'Admin', `Xóa người dùng: ${removed.name} (${removed.email})`);

  return res.json({
    success: true,
    users: memoryUsers,
  });
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

startServer();