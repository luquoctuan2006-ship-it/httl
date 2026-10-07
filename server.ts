import express, { NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'node:fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { DecodedIdToken, getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { GoogleGenAI } from '@google/genai';
import { initialTripData } from './src/data/mockData';
import { TripData } from './src/types/travel';

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

const serviceAccountPath = path.resolve(
  __dirname,
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 'secrets/firebase-service-account.json',
);
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
const firebaseApp = getApps()[0] || initializeApp({ credential: cert(serviceAccount) });
const firestore = getFirestore(firebaseApp);
const firebaseAuth = getAuth(firebaseApp);
const activeTripRef = firestore.collection('trips').doc('active');

async function findTripRef(tripId: string) {
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

  try {
    req.authUser = await firebaseAuth.verifyIdToken(token, true);
    return next();
  } catch {
    return res.status(401).json({ success: false, error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn' });
  }
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.authUser?.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Bạn không có quyền thực hiện thao tác này' });
  }
  return next();
}

app.get('/api/trips/active', requireAuth, async (_req, res) => {
  try {
    const snapshot = await activeTripRef.get();
    if (!snapshot.exists) {
      const seededTrip = initialTripData as TripData;
      await activeTripRef.create({
        ...seededTrip,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return res.json({ success: true, trip: seededTrip, seeded: true });
    }

    const rawTrip = snapshot.data() as TripData | undefined;
    const correctedTrip = rawTrip ? (sanitizeTripPayload(rawTrip) as TripData) : null;

    if (correctedTrip && JSON.stringify(rawTrip) !== JSON.stringify(correctedTrip)) {
      await activeTripRef.set({
        ...correctedTrip,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return res.json({ success: true, trip: correctedTrip || initialTripData });
  } catch (error) {
    console.error('Error loading active trip from Firestore:', error);
    return res.status(503).json({ success: false, error: 'Không thể tải dữ liệu từ Firestore' });
  }
});

app.get('/api/trips', requireAuth, async (_req, res) => {
  try {
    let activeSnapshot = await activeTripRef.get();
    if (!activeSnapshot.exists) {
      const seededTrip = initialTripData as TripData;
      await activeTripRef.create({
        ...seededTrip,
        updatedAt: FieldValue.serverTimestamp(),
      });
      activeSnapshot = await activeTripRef.get();
    }

    const activeTrip = sanitizeTripPayload(activeSnapshot.data()) as TripData;
    const snapshot = await firestore.collection('trips').get();
    const tripsById = new Map<string, TripData>([[activeTrip.id, activeTrip]]);
    for (const document of snapshot.docs) {
      if (document.id === 'active') continue;
      const candidate = sanitizeTripPayload(document.data()) as TripData;
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
  const trip = sanitizeTripPayload(req.body) as TripData;
  if (!trip || typeof trip.id !== 'string' || trip.id === 'active' || !Array.isArray(trip.days)) {
    return res.status(400).json({ success: false, error: 'Dữ liệu chuyến đi không hợp lệ' });
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

app.put('/api/trips/active', requireAuth, requireAdmin, async (req, res) => {
  const trip = sanitizeTripPayload(req.body) as TripData;
  if (!trip || typeof trip.id !== 'string' || !Array.isArray(trip.days)) {
    return res.status(400).json({ success: false, error: 'Dữ liệu chuyến đi không hợp lệ' });
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

app.patch('/api/trips/:tripId/members/:memberId/attendance', requireAuth, async (req, res) => {
  const { attendanceStatus } = req.body;
  if (!['Có mặt', 'Vắng mặt'].includes(attendanceStatus)) {
    return res.status(400).json({ success: false, error: 'Trạng thái điểm danh không hợp lệ' });
  }

  try {
    const tripRef = await findTripRef(req.params.tripId);
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
const ai = geminiApiKey
  ? new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        timeout: 90_000,
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

function createGeminiCacheKey(userId: string, operation: string, payload: unknown): string {
  return `${userId}:${operation}:${JSON.stringify(payload)}`;
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
        },
      });
    } catch (error: any) {
      const message = String(error?.message || error?.status || error || '');
      const temporarilyUnavailable = /429|503|UNAVAILABLE|RESOURCE_EXHAUSTED|RATE_LIMIT|high demand|temporar|overloaded/i.test(message);
      if (!temporarilyUnavailable || index === models.length - 1) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw new Error('Gemini không phản hồi sau khi thử model dự phòng.');
}

// API Route: Generate personalized itinerary using Gemini 2.0 Flash
app.post('/api/gemini/generate-itinerary', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!ai) {
    return res.status(503).json({
      success: false,
      error: 'Thiếu GEMINI_API_KEY. Hãy đặt khóa trong tệp .env ở thư mục gốc rồi khởi động lại server.',
    });
  }

  try {
    const { destination, days, budget, travelStyle, groupType, preferences, startLocation } = req.body;
    const cacheKey = createGeminiCacheKey(req.authUser!.uid, 'generate-itinerary', req.body);
    const cachedResult = getCachedGeminiResult(cacheKey);

    if (cachedResult !== undefined) {
      return res.json({ success: true, data: cachedResult, cached: true });
    }

    const prompt = `Bạn là chuyên gia quy hoạch và điều phối tour du lịch chuyên nghiệp tại Việt Nam cho hệ thống "Voyager Travel Ops".
Hãy lập kế hoạch lịch trình du lịch thông minh, tối ưu và chi tiết theo các thông tin sau:
- Điểm đến: ${destination || 'Đà Nẵng - Huế - Hội An'}
- Số ngày: ${days || 7} ngày
- Ngân sách: ${budget || 'Tiêu chuẩn'}
- Phong cách du lịch: ${travelStyle || 'Khám phá văn hóa & di sản kết hợp ẩm thực'}
- Đối tượng đoàn: ${groupType || 'Đoàn gia đình / nhóm bạn'}
- Nơi xuất phát: ${startLocation || 'Đà Nẵng'}
- Yêu cầu đặc biệt/Sở thích cá nhân hóa: ${preferences || 'Tối ưu thời gian di chuyển, tránh giờ nắng gắt trưa, trải nghiệm văn hóa bản địa'}

Hãy trả về định dạng DUY NHẤT là chuỗi JSON hợp lệ (không kèm markdown \`\`\`json hay text thừa bên ngoài), theo schema sau:
{
  "tripCode": "VN-1025",
  "title": "Tên hành trình hấp dẫn",
  "routeSummary": {
    "origin": "ĐN",
    "destination": "HUE",
    "totalKm": 428,
    "vehicle": "Xe 29 chỗ",
    "destinationsCount": 5
  },
  "budget": {
    "total": 48600000,
    "used": 15000000,
    "unit": "VNĐ",
    "breakdown": [
      {"category": "Vận chuyển", "amount": 12000000},
      {"category": "Khách sạn", "amount": 18000000},
      {"category": "Ăn uống & Vé", "amount": 14000000},
      {"category": "Dự phòng", "amount": 4600000}
    ]
  },
  "days": [
    {
      "dayIndex": 1,
      "dateLabel": "T2 12",
      "fullDate": "Thứ Hai, 12 tháng 10",
      "summary": "Tóm tắt ngắn gọn ngày 1",
      "activities": [
        {
          "id": "act-1-1",
          "timeStart": "08:00",
          "timeEnd": "09:30",
          "title": "Tên hoạt động",
          "location": "Địa điểm cụ thể",
          "status": "Hoàn tất", // hoặc "Đang diễn ra", "Đã xác nhận", "Cần xử lý"
          "type": "transport" | "meal" | "sightseeing" | "hotel" | "checkin",
          "details": "Mô tả chi tiết và lưu ý điều phối",
          "cost": 1500000,
          "coordinates": {"lat": 16.0544, "lng": 108.2022}
        }
      ]
    }
  ],
  "aiOperationalSuggestions": [
    {
      "id": "sug-1",
      "title": "Đề xuất tối ưu thứ tự di chuyển",
      "impact": "-36 phút di chuyển",
      "description": "Lý do và lợi ích tối ưu",
      "savingEstimate": "640.000đ",
      "confidence": "94%"
    }
  ],
  "potentialRisks": [
    {
      "title": "Dự báo thời tiết cục bộ",
      "level": "Cảnh báo vừa",
      "advice": "Chuẩn bị phương án dự phòng bảo đảm lịch trình"
    }
  ]
}`;

    const response = await generateWithGemini(prompt);

    const text = response.text || '{}';
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // Clean possible fences if any
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      data = JSON.parse(cleaned);
    }

    setCachedGeminiResult(cacheKey, data);
    res.json({ success: true, data, cached: false });
  } catch (error: any) {
    console.error('Error generating itinerary with Gemini:', error);
    const errorMessage = String(error?.message || error?.status || '');
    const wasAborted = error?.name === 'AbortError' || /operation was aborted|timed out/i.test(errorMessage);
    const temporarilyUnavailable = /429|503|UNAVAILABLE|RESOURCE_EXHAUSTED|RATE_LIMIT|high demand|temporar|overloaded/i.test(errorMessage);
    res.status(wasAborted ? 504 : temporarilyUnavailable ? 503 : 500).json({
      success: false,
      error: wasAborted
        ? 'Gemini mất hơn 90 giây để tạo lịch trình. Vui lòng thử lại hoặc giảm số ngày hành trình.'
        : temporarilyUnavailable
          ? 'Gemini đang quá tải hoặc giới hạn yêu cầu. Đã thử model dự phòng; vui lòng đợi một chút rồi thử lại.'
        : error.message || 'Lỗi khi tạo lịch trình với Gemini AI',
    });
  }
});

// API Route: Optimize active schedule based on real-time factors
app.post('/api/gemini/optimize-schedule', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!ai) {
    return res.status(503).json({
      success: false,
      error: 'Thiếu GEMINI_API_KEY. Hãy đặt khóa trong tệp .env ở thư mục gốc rồi khởi động lại server.',
    });
  }

  try {
    const { currentTrip, alertDetails, userGoal } = req.body;
    const cacheKey = createGeminiCacheKey(req.authUser!.uid, 'optimize-schedule', req.body);
    const cachedResult = getCachedGeminiResult(cacheKey);

    if (cachedResult !== undefined) {
      return res.json({ success: true, data: cachedResult, cached: true });
    }

    const prompt = `Bạn là Trợ lý Điều phối Vận hành Du lịch Thông minh của hệ thống Voyager.
Thông tin chuyến đi hiện tại:
${JSON.stringify(currentTrip, null, 2)}

Sự kiện/Cảnh báo vận hành thực tế:
${JSON.stringify(alertDetails || 'Mưa lớn tại đèo Hải Vân và Lăng Cô từ 15:00-17:00, có nguy cơ trễ giờ nhận phòng 14:00 tại Lăng Cô Bay Retreat')}

Mục tiêu tối ưu: ${userGoal || 'Đảm bảo an toàn, tối thiểu thời gian kẹt xe, giảm chi phí phát sinh và không ảnh hưởng trải nghiệm du khách'}.

Hãy đưa ra giải pháp điều phối thông minh gồm 2-3 đề xuất cụ thể kèm kế hoạch hành động từng bước. Trả về JSON:
{
  "recommendations": [
    {
      "id": "rec-1",
      "actionTitle": "Đảo thứ tự Lăng Cô – Đại Nội",
      "timeSaved": "-36 phút",
      "reason": "Tránh vùng mưa lớn từ 15:00-17:00, di chuyển vào Đại Nội sớm hơn",
      "confidence": "94%",
      "costSaved": "640.000đ",
      "scheduleChanges": [
        {"oldTime": "14:30 - 17:30", "newTime": "13:00 - 15:00", "action": "Tham quan điểm trong nhà trước"}
      ]
    },
    {
      "id": "rec-2",
      "actionTitle": "Khởi hành sớm 20 phút",
      "timeSaved": "Đúng giờ 100%",
      "reason": "Dự phòng ùn tắc QL1A, kịp giờ nhận phòng khách sạn",
      "confidence": "92%",
      "costSaved": "Tránh phụ thu trễ hẹn",
      "scheduleChanges": []
    }
  ],
  "dispatcherNotice": "Ghi chú cho Điều phối viên hiện trường để thông báo cho tài xế và hướng dẫn viên."
}`;

    const response = await generateWithGemini(prompt);

    const text = response.text || '{}';
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      data = JSON.parse(cleaned);
    }

    setCachedGeminiResult(cacheKey, data);
    res.json({ success: true, data, cached: false });
  } catch (error: any) {
    console.error('Error optimizing schedule with Gemini:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi tối ưu lịch trình với Gemini AI',
    });
  }
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

  app.listen(port, () => {
    console.log(`Voyager Travel Ops server running on http://localhost:${port}`);
  });
}

startServer();
