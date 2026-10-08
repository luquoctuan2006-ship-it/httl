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
    return res.status(503).json({
      success: false,
      error: 'Firebase Authentication chưa được cấu hình. Sử dụng token mock-token: để chạy chế độ demo.',
    });
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
const geminiModel = process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash';
const geminiFallbackModel = process.env.GEMINI_FALLBACK_MODEL?.trim() || 'gemini-3.7-flash';
const geminiCacheTtlMs = Math.max(0, Number.parseInt(process.env.GEMINI_CACHE_TTL_MS || '300000', 10));
const geminiRequestTimeoutMs = Math.max(30_000, Number.parseInt(process.env.GEMINI_TIMEOUT_MS || '30000', 10));
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

async function generateWithGemini(prompt: string): Promise<any> {
  if (!ai) {
    throw new Error('Thiếu GEMINI_API_KEY. Hãy đặt khóa trong tệp .env ở thư mục gốc rồi khởi động lại server.');
  }

  const models = [geminiModel, geminiFallbackModel].filter((model, index, values) => model && values.indexOf(model) === index);

  for (let index = 0; index < models.length; index += 1) {
    try {
      return await ai.models.generateContent({
        model: models[index],
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseModalities: ['TEXT'],
          thinkingConfig: { thinkingBudget: 0 },
          maxOutputTokens: 4000,
          temperature: 0.55,
        },
      });
    } catch (error: any) {
      const status = Number(error?.status ?? error?.response?.status ?? 0);
      const message = String(error?.message || error?.status || error || '');
      const retryable = status === 503 || status === 504 || status === 500;
      const isRateLimit = status === 429 || /RATE_LIMIT|RESOURCE_EXHAUSTED/i.test(message);

      if (isRateLimit || !retryable || index === models.length - 1) {
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

function createGeminiJob(operation: string, payload: unknown): GeminiJob {
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
      job.result = await executeGeminiOperation(operation, payload);
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

async function executeGeminiOperation(operation: string, payload: unknown): Promise<any> {
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
Trả về tối đa ${normalizedDays * 3} hoạt động và mỗi ngày tối đa 3 hoạt động. Schema: {tripCode,title,routeSummary:{origin,destination,totalKm,vehicle,destinationsCount},budget:{total,used,unit,breakdown},days:[{dayIndex,dateLabel,fullDate,summary,activities:[{id,timeStart,timeEnd,title,location,status,type,details,cost,coordinates:{lat,lng}}]}],aiOperationalSuggestions:[{id,title,impact,description,savingEstimate,confidence}],potentialRisks:[{title,level,advice}]}.`;
    const response = await getOrCreateGeminiRequest(`generate-itinerary:${JSON.stringify(payload)}`, () => generateWithGemini(prompt));
    const text = response.text || '{}';
    return parseGeminiJson(text);
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
  const response = await getOrCreateGeminiRequest(`optimize-schedule:${JSON.stringify(payload)}`, () => generateWithGemini(prompt));
  const text = response.text || '{}';
  return parseGeminiJson(text);
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

  const job = createGeminiJob('generate-itinerary', req.body);
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

  const job = createGeminiJob('optimize-schedule', req.body);
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
