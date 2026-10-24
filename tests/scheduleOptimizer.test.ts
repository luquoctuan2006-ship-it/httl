import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialTripData } from '../src/data/mockData';
import { buildOptimizePrompt, pickTripForOptimization, runOptimization } from '../src/utils/scheduleOptimizer';
import { parseRules } from '../src/utils/scheduleValidator';

const adminRules = {
  bufferMinutes: '20',
  startHour: '07:30',
  endHour: '21:30',
  citySpeedLimit: '40 km/h',
  highwaySpeedLimit: '60 km/h',
  passSpeedLimit: '35 km/h',
  conflictChecks: { overlapTime: true, openingHoursMismatch: true, impossibleTransit: true, hotelCheckinConflict: true },
  optimizationPriorities: { costSaving: true, transitTimeMinimization: true, avoidHotNoonSun: true, elderlyPacing: false },
};

const payload = () => ({
  tripSource: 'server',
  currentTrip: pickTripForOptimization(initialTripData),
  alertDetails: [{ id: 'a1', title: 'Mưa lớn đèo Hải Vân', category: 'weather' }],
  userGoal: 'an toàn',
  rules: adminRules,
});

const goodRec = {
  id: 'good',
  actionTitle: 'Khởi hành sớm 20 phút',
  reason: 'Tránh giờ cao điểm',
  targetDayIndex: 3,
  scheduleChanges: [{ activityId: 'act-10', newTime: '14:10', action: 'Đi sớm' }],
};
const overlapRec = {
  id: 'bad',
  actionTitle: 'Vượt đèo buổi sáng',
  reason: 'Tránh mưa',
  targetDayIndex: 3,
  scheduleChanges: [{ activityId: 'act-10', newTime: '08:30 — 10:30' }],
};

// Bản sao đầu ra cứng của buildFallbackScheduleOptimization (server.ts) khi có cảnh báo thời tiết.
const hardcodedFallback = () => ({
  recommendations: [{
    id: 'rec-weather-pass',
    actionTitle: 'Điều phối tránh dông đèo Hải Vân',
    reason: '...',
    targetDayIndex: 3,
    scheduleChanges: [
      { activityId: 'act-10', newTime: '08:30 — 10:30' },
      { activityId: 'act-9', newTime: '13:30 — 16:30' },
    ],
  }],
  dispatcherNotice: 'Lệnh điều phối an toàn',
});

test('pickTripForOptimization giữ đủ hoạt động (không cắt còn 5) cùng tọa độ và waypoint', () => {
  const longDay = {
    dayIndex: 1,
    activities: Array.from({ length: 9 }, (_, i) => ({
      id: `x${i}`, timeStart: '08:00', timeEnd: '09:00', title: `Hoạt động ${i}`, coordinates: { lat: 16, lng: 108 },
    })),
  };
  const picked = pickTripForOptimization({ id: 't', days: [longDay], waypoints: [{ name: 'Bà Nà', lat: 1, lng: 2, extra: 'bỏ' }] });
  assert.equal(picked.days[0].activities.length, 9);
  assert.deepEqual(picked.days[0].activities[0].coordinates, { lat: 16, lng: 108 });
  assert.deepEqual(picked.waypoints[0], { name: 'Bà Nà', lat: 1, lng: 2, openHours: undefined });
  assert.deepEqual(pickTripForOptimization(null).days, []);
});

test('prompt chứa quy tắc Admin, ưu tiên đang bật và yêu cầu activityId có thật', () => {
  const rules = parseRules({ ...adminRules, bufferMinutes: '25', optimizationPriorities: { ...adminRules.optimizationPriorities, elderlyPacing: true } });
  const prompt = buildOptimizePrompt(payload(), rules);
  assert.match(prompt, /Khởi hành đi Lăng Cô/);
  assert.match(prompt, /act-11/);
  assert.match(prompt, /07:30 – 21:30/);
  assert.match(prompt, /tối thiểu 30 phút/);
  assert.match(prompt, /người lớn tuổi/);
  assert.match(prompt, /activityId.*có thật/);
});

test('đề xuất hợp lệ của AI được trả về, đề xuất vi phạm bị loại và báo lý do', async () => {
  const prompts: string[] = [];
  const result = await runOptimization(payload(), {
    ask: async (prompt) => { prompts.push(prompt); return { recommendations: [overlapRec, goodRec], dispatcherNotice: 'ok' }; },
    fallback: () => { throw new Error('không được gọi'); },
  });
  assert.equal(prompts.length, 1);
  assert.deepEqual(result.recommendations.map((r: any) => r.id), ['good']);
  assert.equal(result.recommendations[0].scheduleChanges[0].newTime, '14:10 — 17:10');
  assert.equal(result.dispatcherNotice, 'ok');
  assert.equal(result.validation.source, 'gemini');
  assert.equal(result.validation.repaired, false);
  assert.equal(result.validation.checked, 2);
  assert.equal(result.validation.accepted, 1);
  assert.equal(result.validation.rejected[0].id, 'bad');
  assert.equal(result.validation.rejected[0].violations[0].code, 'OVERLAP');
});

test('bị loại hết → thử lại 1 lần kèm lý do; lần sau hợp lệ thì dùng kết quả đó', async () => {
  const calls: { prompt: string; key: string | null }[] = [];
  const result = await runOptimization(payload(), {
    ask: async (prompt, key) => {
      calls.push({ prompt, key });
      return calls.length === 1
        ? { recommendations: [overlapRec], dispatcherNotice: 'phương án lỗi' }
        : { recommendations: [goodRec], dispatcherNotice: 'phương án sửa' };
    },
    fallback: () => { throw new Error('không được gọi'); },
  });
  assert.equal(calls.length, 2);
  assert.notEqual(calls[0].key, null);
  assert.equal(calls[1].key, null);
  assert.match(calls[1].prompt, /LẦN TRƯỚC/);
  assert.match(calls[1].prompt, /Chồng giờ/);
  assert.deepEqual(result.recommendations.map((r: any) => r.id), ['good']);
  assert.equal(result.dispatcherNotice, 'phương án sửa');
  assert.equal(result.validation.repaired, true);
  assert.equal(result.validation.rejected.length, 1); // lần đầu vẫn được ghi nhận
});

test('thử lại vẫn sai hoặc lỗi → trả về rỗng + lý do, không nhận bừa, không ném lỗi', async () => {
  const stillBad = await runOptimization(payload(), {
    ask: async () => ({ recommendations: [overlapRec], dispatcherNotice: 'không được dùng' }),
    fallback: () => { throw new Error('không được gọi'); },
  });
  assert.deepEqual(stillBad.recommendations, []);
  assert.equal(stillBad.dispatcherNotice, undefined);
  assert.equal(stillBad.validation.repaired, true);
  assert.equal(stillBad.validation.rejected.length, 2);

  let n = 0;
  const warnings: string[] = [];
  const retryThrows = await runOptimization(payload(), {
    ask: async () => { n += 1; if (n === 1) return { recommendations: [overlapRec] }; throw new Error('503'); },
    fallback: () => { throw new Error('không được gọi'); },
    warn: (m) => warnings.push(m),
  });
  assert.deepEqual(retryThrows.recommendations, []);
  assert.equal(retryThrows.validation.repaired, false);
  assert.equal(warnings.length, 1);
});

test('AI lỗi → dùng bộ dự phòng nhưng vẫn bị kiểm tra: đề xuất cứng cũ bị loại, nguồn ghi rõ fallback', async () => {
  let asked = 0;
  const result = await runOptimization(payload(), {
    ask: async () => { asked += 1; throw new Error('Thiếu GEMINI_API_KEY'); },
    fallback: hardcodedFallback,
    warn: () => undefined,
  });
  assert.equal(asked, 1); // không retry khi nguồn là fallback
  assert.equal(result.validation.source, 'fallback');
  assert.deepEqual(result.recommendations, []);
  assert.equal(result.validation.rejected[0].id, 'rec-weather-pass');
  assert.equal(result.dispatcherNotice, undefined);
});

test('quy tắc trong payload quyết định kết quả (đổi cấu hình Admin → đổi kết luận)', async () => {
  const ask = async () => ({ recommendations: [overlapRec] });
  const strict = await runOptimization(payload(), { ask, fallback: () => ({}), warn: () => undefined });
  assert.equal(strict.recommendations.length, 0);

  const relaxed = await runOptimization(
    { ...payload(), rules: { ...adminRules, conflictChecks: { ...adminRules.conflictChecks, overlapTime: false, impossibleTransit: false } } },
    { ask, fallback: () => ({}) },
  );
  assert.equal(relaxed.recommendations.length, 1);

  // Không có rules trong payload → dùng defaultRules của server.
  const viaDefault = await runOptimization(
    { ...payload(), rules: undefined },
    { ask, fallback: () => ({}), defaultRules: { ...adminRules, conflictChecks: { ...adminRules.conflictChecks, overlapTime: false, impossibleTransit: false } } },
  );
  assert.equal(viaDefault.recommendations.length, 1);
});
