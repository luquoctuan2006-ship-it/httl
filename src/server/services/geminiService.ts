import { randomUUID } from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import { ActiveGeminiJobLimitError } from '../errors/activeGeminiJobLimitError';
import type { SystemConfig } from '../types/systemConfig';
import { recordAIErrorLog, recordAIRequestLog } from './systemLogs';
import { TRIP_ID_PATTERN } from './tripStore';
import type { OperationalAlert, TripData } from '../../types/travel';
import { parseGeminiJson } from '../../utils/client/geminiJson';
import { buildRuleBasedScheduleOptimization, pickTripForOptimization, runOptimization } from '../../utils/schedule/scheduleOptimizer';
import { isTripOwnerOrAdmin } from '../../utils/trip/tripRepository';

type GeminiCacheEntry = {
  expiresAt: number;
  value: unknown;
};

type GeminiJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export type GeminiJob = {
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

interface GeminiServiceOptions {
  getFirestoreOrNull: () => Firestore | null;
  requireFirestore: () => Firestore;
  getTripById: (tripId: string) => Promise<TripData | null>;
  getSystemConfig: () => SystemConfig;
  getGeminiConfig: () => {
    dynamicGeminiModel: string;
    dynamicGeminiTemperature: number;
    dynamicGeminiMaxTokens: number;
    dynamicGeminiSystemPrompt: string;
  };
}

const GEMINI_JOB_TTL_MS = 15 * 60 * 1000;
const MAX_GEMINI_CACHE_ENTRIES = 200;

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

export function createGeminiService({
  getFirestoreOrNull,
  requireFirestore,
  getTripById,
  getSystemConfig,
  getGeminiConfig,
}: GeminiServiceOptions) {
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
  const geminiFallbackModel = process.env.GEMINI_FALLBACK_MODEL?.trim() || 'gemini-3.1-flash-lite';
  const geminiCacheTtlMs = Math.max(0, Number.parseInt(process.env.GEMINI_CACHE_TTL_MS || '300000', 10));
  const geminiRequestTimeoutMs = Math.max(30_000, Number.parseInt(process.env.GEMINI_TIMEOUT_MS || '30000', 10));

  const ai = geminiApiKey
    ? new GoogleGenAI({
        apiKey: geminiApiKey,
        httpOptions: {
          timeout: geminiRequestTimeoutMs,
          retryOptions: { attempts: 1 },
        },
      })
    : null;

  const geminiCache = new Map<string, GeminiCacheEntry>();
  const inFlightGeminiRequests = new Map<string, Promise<unknown>>();

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

    while (geminiCache.size > MAX_GEMINI_CACHE_ENTRIES) {
      const oldestKey = geminiCache.keys().next().value;
      if (oldestKey === undefined) break;
      geminiCache.delete(oldestKey);
    }
  }

  async function generateWithGemini(prompt: string, userWhoInvoked = 'Hệ thống'): Promise<any> {
    if (!ai) {
      throw new Error('Thiếu GEMINI_API_KEY. Hãy đặt khóa trong tệp .env ở thư mục gốc rồi khởi động lại server.');
    }

    const { dynamicGeminiModel, dynamicGeminiSystemPrompt, dynamicGeminiMaxTokens, dynamicGeminiTemperature } =
      getGeminiConfig();
    const selectedModel = dynamicGeminiModel || 'gemini-3.5-flash';
    const models = [selectedModel, geminiFallbackModel].filter((model, index, values) => model && values.indexOf(model) === index);
    const startTime = Date.now();

    for (let index = 0; index < models.length; index += 1) {
      try {
        const modelId = models[index];
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

  async function buildOptimizePayload(body: unknown, user?: DecodedIdToken) {
    const bodyObj = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const clientTrip = bodyObj.currentTrip && typeof bodyObj.currentTrip === 'object' ? (bodyObj.currentTrip as Partial<TripData>) : null;
    const tripId = typeof clientTrip?.id === 'string' ? clientTrip.id : '';

    let storedTrip: TripData | null = null;
    if (tripId && tripId !== 'active' && TRIP_ID_PATTERN.test(tripId)) {
      let found: TripData | null = null;
      try {
        found = await getTripById(tripId);
      } catch (error) {
        console.warn('[Optimize] Không đọc được chuyến đi từ server, dùng dữ liệu client:', error);
      }
      if (found) {
        if (!isTripOwnerOrAdmin(found, user)) {
          const err = new Error('Chỉ chủ chuyến đi mới có quyền tối ưu lịch trình chuyến đi này.');
          (err as Error & { statusCode?: number }).statusCode = 403;
          throw err;
        }
        storedTrip = found;
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
      rules: getSystemConfig().rules,
    };
  }

  function runScheduleOptimization(payload: Parameters<typeof runOptimization>[0], userActor = 'Hệ thống') {
    const rules = getSystemConfig().rules;
    return runOptimization(payload, {
      ask: async (prompt, dedupeKey) => {
        const response = dedupeKey
          ? await getOrCreateGeminiRequest(dedupeKey, () => generateWithGemini(prompt, userActor))
          : await generateWithGemini(prompt, userActor);
        return parseGeminiJson(extractJsonText(response));
      },
      fallback: (p) => buildRuleBasedScheduleOptimization(p),
      defaultRules: rules,
      warn: (message, error) => console.warn(message, error),
    });
  }

  async function executeGeminiOperation(operation: string, payload: unknown, userActor = 'Hệ thống'): Promise<unknown> {
    if (operation === 'generate-itinerary') {
      const raw = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
      const destination = typeof raw.destination === 'string' ? raw.destination.trim().slice(0, 100) : 'Đà Nẵng - Huế - Hội An';
      const normalizedDays = Math.min(Math.max(Number.parseInt(String(raw.days), 10) || 3, 2), 7);
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
      const parsedPlan = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
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
      id: `gemini-${randomUUID()}`,
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
      const [first, second] = await Promise.all([transaction.get(slotRefs[0]), transaction.get(slotRefs[1])]);
      const slotIndex = [first, second].findIndex(
        (snapshot) => !snapshot.exists || Number(snapshot.data()?.leaseUntil || 0) <= now,
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
        await updateGeminiJob(
          reservedJob,
          {
            status: 'completed',
            progress: 'Đã hoàn tất',
            result,
            error: undefined,
          },
          true,
        );
        if (cacheKey && result) setCachedGeminiResult(cacheKey, result);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Lỗi xử lý Gemini';
        try {
          await updateGeminiJob(
            reservedJob,
            {
              status: 'failed',
              progress: 'Xảy ra lỗi',
              error: message,
            },
            true,
          );
        } catch (storageError) {
          console.error('[Gemini Job] Không thể lưu trạng thái lỗi:', storageError);
        }
      }
    })();
    return reservedJob;
  }

  function startFirestoreCleanupInterval() {
    const interval = setInterval(async () => {
      const now = Date.now();
      const db = getFirestoreOrNull();
      if (!db) return;

      try {
        const snap = await db.collection('gemini_jobs')
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
        const expiredLogsSnap = await db.collection('audit_logs')
          .where('expiresAt', '<', now)
          .limit(50)
          .get();
        if (!expiredLogsSnap.empty) {
          const batch = db.batch();
          expiredLogsSnap.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }
      } catch (error) {
        console.error('[Audit Log] Không thể dọn nhật ký hết hạn:', error);
      }

      for (const collectionName of ['rate_limits', 'ai_request_logs', 'ai_error_logs']) {
        try {
          const expired = await db.collection(collectionName)
            .where('expiresAt', '<=', new Date(now))
            .limit(100)
            .get();
          if (!expired.empty) {
            const batch = db.batch();
            expired.docs.forEach((doc) => batch.delete(doc.ref));
            await batch.commit();
          }
        } catch (error) {
          console.error(`[${collectionName}] Không thể dọn dữ liệu hết hạn:`, error);
        }
      }
    }, 60_000);
    interval.unref();
    return interval;
  }

  return {
    ai,
    createGeminiCacheKey,
    getCachedGeminiResult,
    createGeminiJob,
    buildOptimizePayload,
    runScheduleOptimization,
    generateWithGemini,
    startFirestoreCleanupInterval,
  };
}
