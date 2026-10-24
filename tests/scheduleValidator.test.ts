import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialTripData } from '../src/data/mockData';
import {
  buildRulesPromptSection,
  estimateTravelMinutes,
  parseClock,
  parseRules,
  parseTimeRange,
  summarizeRejectionsForRetry,
  validateOptimizationResult,
  validateRecommendation,
} from '../src/utils/scheduleValidator';

// Quy tắc mặc định của Admin (đúng giá trị server đang dùng, kiểu chuỗi).
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
const rules = parseRules(adminRules);

const rec = (changes: any[], extra: Record<string, unknown> = {}) => ({
  id: 'rec-test',
  actionTitle: 'Đề xuất thử',
  reason: 'test',
  targetDayIndex: 3,
  scheduleChanges: changes,
  ...extra,
});

const codes = (verdict: { errors: { code: string }[] }) => verdict.errors.map((e) => e.code);

// ───────────── Phân tích giờ & quy tắc ─────────────

test('parseClock / parseTimeRange chấp nhận định dạng hợp lệ và từ chối rác', () => {
  assert.equal(parseClock('08:30'), 8 * 60 + 30);
  assert.equal(parseClock('8h30'), 8 * 60 + 30);
  assert.equal(parseClock('24:00'), null);
  assert.equal(parseClock('12:75'), null);
  assert.equal(parseClock(830), null);
  assert.deepEqual(parseTimeRange('08:30 — 10:30'), { start: 510, end: 630 });
  assert.deepEqual(parseTimeRange('08:30-10:30'), { start: 510, end: 630 });
  assert.deepEqual(parseTimeRange('14:10'), { start: 850, end: null });
  assert.equal(parseTimeRange('sáng sớm'), null);
  assert.equal(parseTimeRange('08:30 — 10:30 — 12:00'), null);
});

test('parseRules đọc chuỗi của Admin và dùng mặc định khi cấu hình hỏng', () => {
  assert.equal(rules.bufferMinutes, 20);
  assert.equal(rules.dayStartMinutes, 7 * 60 + 30);
  assert.equal(rules.dayEndMinutes, 21 * 60 + 30);
  assert.equal(rules.passSpeedKmh, 35);

  const broken = parseRules({ bufferMinutes: 'abc', startHour: '22:00', endHour: '06:00', passSpeedLimit: '0 km/h' });
  assert.equal(broken.bufferMinutes, 20);
  assert.equal(broken.dayStartMinutes, 7 * 60 + 30); // khung giờ ngược → mặc định
  assert.equal(broken.passSpeedKmh, 35);
  assert.equal(parseRules(null).conflictChecks.overlapTime, true);
});

test('prompt chứa đúng giá trị quy tắc và ưu tiên đang bật', () => {
  const text = buildRulesPromptSection(parseRules({
    ...adminRules,
    bufferMinutes: '25',
    optimizationPriorities: { costSaving: false, transitTimeMinimization: true, avoidHotNoonSun: false, elderlyPacing: true },
  }));
  assert.match(text, /07:30 – 21:30/);
  assert.match(text, /tối thiểu 30 phút/); // elderlyPacing nâng đệm lên ≥ 30
  assert.match(text, /qua đèo 35 km\/h/);
  assert.match(text, /giảm tối đa thời gian di chuyển/);
  assert.match(text, /người lớn tuổi/);
  assert.doesNotMatch(text, /giảm chi phí phát sinh/);
  assert.doesNotMatch(text, /nắng gắt 11:30/);
});

// ───────────── Đề xuất hợp lệ ─────────────

test('đề xuất khởi hành sớm 20 phút (chỉ có giờ bắt đầu) được nhận và giữ nguyên thời lượng', () => {
  const verdict = validateRecommendation(
    rec([{ activityId: 'act-10', newTime: '14:10', action: 'Khởi hành sớm' }]),
    initialTripData,
    rules,
  );
  assert.equal(verdict.accepted, true, JSON.stringify(verdict.errors));
  const change = verdict.recommendation.scheduleChanges[0];
  assert.equal(change.oldTime, '14:30 — 17:30');
  assert.equal(change.newTime, '14:10 — 17:10'); // thời lượng 3 giờ được giữ
  assert.equal(change.activityTitle, 'Khởi hành đi Lăng Cô'); // lấy từ dữ liệu thật, không tin AI
  assert.equal(change.status, 'Đã xác nhận');
});

test('vi phạm có sẵn trong lịch gốc không làm đề xuất bị loại', () => {
  // act-8 → act-9 chỉ cách 15 phút (< 20) từ trước; đề xuất này không đụng tới hai hoạt động đó.
  const verdict = validateRecommendation(
    rec([{ activityId: 'act-11', newTime: '18:45' }]),
    initialTripData,
    rules,
  );
  assert.equal(verdict.accepted, true, JSON.stringify(verdict.errors));
});

// ───────────── Đề xuất bị loại ─────────────

test('đề xuất cứng cũ "Vượt đèo buổi sáng" bị loại vì chồng giờ với Sơn Trà', () => {
  const verdict = validateRecommendation(
    rec([
      { activityId: 'act-10', newTime: '08:30 — 10:30' },
      { activityId: 'act-9', newTime: '13:30 — 16:30' },
    ]),
    initialTripData,
    rules,
  );
  assert.equal(verdict.accepted, false);
  assert.ok(codes(verdict).includes('OVERLAP'));
  assert.equal(verdict.recommendation, null);
});

test('thiếu thời gian đệm giữa hai hoạt động bị loại', () => {
  // act-9 kết thúc 13:00, dời act-10 sang 13:10 → đệm 10 < 20.
  const verdict = validateRecommendation(rec([{ activityId: 'act-10', newTime: '13:10 — 16:10' }]), initialTripData, rules);
  assert.equal(verdict.accepted, false);
  assert.ok(codes(verdict).includes('BUFFER_TOO_SHORT'));
});

test('ngoài khung giờ ngày bị loại', () => {
  const verdict = validateRecommendation(rec([{ activityId: 'act-11', newTime: '21:00 — 22:30' }]), initialTripData, rules);
  assert.equal(verdict.accepted, false);
  assert.ok(codes(verdict).includes('OUT_OF_DAY_WINDOW'));
});

test('dời nhận phòng khách sạn sớm hơn giờ ban đầu bị loại', () => {
  const verdict = validateRecommendation(rec([{ activityId: 'act-11', newTime: '17:50 — 19:20' }]), initialTripData, rules);
  assert.equal(verdict.accepted, false);
  assert.ok(codes(verdict).includes('HOTEL_CHECKIN_EARLY'));
});

test('hoạt động đã hoàn tất không được dời', () => {
  const verdict = validateRecommendation(rec([{ activityId: 'act-8', newTime: '08:00 — 10:00' }]), initialTripData, rules);
  assert.equal(verdict.accepted, false);
  assert.ok(codes(verdict).includes('COMPLETED_ACTIVITY'));
});

test('activityId thiếu / không tồn tại / trùng, giờ sai định dạng đều bị loại — không ghép theo tên', () => {
  const trip = initialTripData;
  assert.ok(codes(validateRecommendation(rec([{ activityTitle: 'Khởi hành đi Lăng Cô', newTime: '14:10' }]), trip, rules)).includes('MISSING_ACTIVITY_ID'));
  assert.ok(codes(validateRecommendation(rec([{ activityId: 'act-999', newTime: '14:10' }]), trip, rules)).includes('UNKNOWN_ACTIVITY'));
  assert.ok(codes(validateRecommendation(rec([
    { activityId: 'act-10', newTime: '14:10' },
    { activityId: 'act-10', newTime: '14:00' },
  ]), trip, rules)).includes('DUPLICATE_CHANGE'));
  assert.ok(codes(validateRecommendation(rec([{ activityId: 'act-10', newTime: 'sáng sớm' }]), trip, rules)).includes('INVALID_TIME'));
  assert.ok(codes(validateRecommendation(rec([{ activityId: 'act-10', newTime: '15:00 — 14:00' }]), trip, rules)).includes('INVALID_RANGE'));
});

test('ngày mục tiêu phải tồn tại và thay đổi không được rỗng', () => {
  assert.ok(codes(validateRecommendation(rec([{ activityId: 'act-10', newTime: '14:10' }], { targetDayIndex: 99 }), initialTripData, rules)).includes('UNKNOWN_DAY'));
  assert.ok(codes(validateRecommendation(rec([{ activityId: 'act-10', newTime: '14:10' }], { targetDayIndex: undefined }), initialTripData, rules)).includes('UNKNOWN_DAY'));
  assert.ok(codes(validateRecommendation(rec([]), initialTripData, rules)).includes('EMPTY_CHANGES'));
  // Đổi sang đúng giờ cũ = không làm gì.
  assert.ok(codes(validateRecommendation(rec([{ activityId: 'act-10', newTime: '14:30 — 17:30' }]), initialTripData, rules)).includes('EMPTY_CHANGES'));
  assert.equal(validateRecommendation(null, initialTripData, rules).accepted, false);
});

// ───────────── Di chuyển ─────────────

const syntheticTrip = {
  waypoints: [],
  days: [{
    dayIndex: 1,
    activities: [
      { id: 'a', timeStart: '08:00', timeEnd: '10:00', title: 'Điểm A', location: 'A', type: 'sightseeing', status: 'Đã xác nhận', coordinates: { lat: 16.0, lng: 108.0 } },
      // Điểm B cách A ~ 50 km đường chim bay.
      { id: 'b', timeStart: '13:00', timeEnd: '15:00', title: 'Điểm B', location: 'B', type: 'sightseeing', status: 'Đã xác nhận', coordinates: { lat: 16.45, lng: 108.0 } },
    ],
  }],
};

test('ước lượng di chuyển dùng hệ số đường thực tế và tốc độ theo ngữ cảnh', () => {
  const a = { lat: 16.0, lng: 108.0 };
  const b = { lat: 16.45, lng: 108.0 };
  const highway = estimateTravelMinutes(a, b, rules, false);
  const pass = estimateTravelMinutes(a, b, rules, true);
  assert.ok(highway > 60 && highway < 80, `highway=${highway}`);
  assert.ok(pass > highway); // đèo chậm hơn
});

test('không đủ thời gian di chuyển giữa hai điểm có tọa độ bị loại, đủ thì nhận', () => {
  // Dời B về 10:30: đệm 30 phút ≥ 20 nhưng cần ~ 65+ phút di chuyển.
  const tooTight = validateRecommendation(rec([{ activityId: 'b', newTime: '10:30 — 12:30' }], { targetDayIndex: 1 }), syntheticTrip, rules);
  assert.equal(tooTight.accepted, false);
  assert.deepEqual(codes(tooTight), ['TRANSIT_TOO_SHORT']);

  const enough = validateRecommendation(rec([{ activityId: 'b', newTime: '12:00 — 14:00' }], { targetDayIndex: 1 }), syntheticTrip, rules);
  assert.equal(enough.accepted, true, JSON.stringify(enough.errors));
});

test('tắt kiểm tra trong Admin thì kiểm tra tương ứng không chạy', () => {
  const off = parseRules({ ...adminRules, conflictChecks: { ...adminRules.conflictChecks, impossibleTransit: false } });
  const verdict = validateRecommendation(rec([{ activityId: 'b', newTime: '10:30 — 12:30' }], { targetDayIndex: 1 }), syntheticTrip, off);
  assert.equal(verdict.accepted, true);

  const noOverlap = parseRules({ ...adminRules, conflictChecks: { ...adminRules.conflictChecks, overlapTime: false } });
  const overlapRec = rec([{ activityId: 'act-10', newTime: '12:00 — 15:00' }]);
  assert.equal(validateRecommendation(overlapRec, initialTripData, rules).accepted, false);
  assert.equal(validateRecommendation(overlapRec, initialTripData, noOverlap).accepted, true);
});

test('thiếu tọa độ → nhận nhưng cảnh báo chưa kiểm tra di chuyển', () => {
  const trip = {
    waypoints: [],
    days: [{
      dayIndex: 1,
      activities: [
        { id: 'a', timeStart: '08:00', timeEnd: '10:00', title: 'A', location: '', type: 'sightseeing', status: 'Đã xác nhận' },
        { id: 'b', timeStart: '13:00', timeEnd: '15:00', title: 'B', location: '', type: 'sightseeing', status: 'Đã xác nhận' },
      ],
    }],
  };
  const verdict = validateRecommendation(rec([{ activityId: 'b', newTime: '14:00 — 16:00' }], { targetDayIndex: 1 }), trip, rules);
  assert.equal(verdict.accepted, true);
  assert.deepEqual(verdict.warnings.map((w) => w.code), ['TRANSIT_UNVERIFIED']);
});

// ───────────── Ưu tiên tối ưu ─────────────

test('elderlyPacing nâng thời gian đệm tối thiểu lên 30 phút', () => {
  const trip = {
    waypoints: [],
    days: [{
      dayIndex: 1,
      activities: [
        { id: 'a', timeStart: '08:00', timeEnd: '09:00', title: 'A', location: '', type: 'meal', status: 'Đã xác nhận' },
        { id: 'b', timeStart: '15:00', timeEnd: '16:00', title: 'B', location: '', type: 'meal', status: 'Đã xác nhận' },
      ],
    }],
  };
  const change = rec([{ activityId: 'b', newTime: '09:25 — 10:25' }], { targetDayIndex: 1 }); // đệm 25 phút
  assert.equal(validateRecommendation(change, trip, rules).accepted, true);
  const elderly = parseRules({ ...adminRules, optimizationPriorities: { ...adminRules.optimizationPriorities, elderlyPacing: true } });
  const verdict = validateRecommendation(change, trip, elderly);
  assert.equal(verdict.accepted, false);
  assert.deepEqual(codes(verdict), ['BUFFER_TOO_SHORT']);
});

test('avoidHotNoonSun: đẩy điểm tham quan vào 11:30–13:30 chỉ là cảnh báo, không bị loại', () => {
  const trip = {
    waypoints: [],
    days: [{
      dayIndex: 1,
      activities: [
        { id: 'a', timeStart: '08:00', timeEnd: '10:00', title: 'Tham quan A', location: '', type: 'sightseeing', status: 'Đã xác nhận' },
      ],
    }],
  };
  const change = rec([{ activityId: 'a', newTime: '11:00 — 13:00' }], { targetDayIndex: 1 });
  const verdict = validateRecommendation(change, trip, rules);
  assert.equal(verdict.accepted, true);
  assert.deepEqual(verdict.warnings.map((w) => w.code), ['HOT_NOON']);
  assert.equal(verdict.recommendation.warnings[0].code, 'HOT_NOON');

  const off = parseRules({ ...adminRules, optimizationPriorities: { ...adminRules.optimizationPriorities, avoidHotNoonSun: false } });
  assert.deepEqual(validateRecommendation(change, trip, off).warnings, []);
});

test('giờ mở cửa của waypoint được kiểm tra khi có dữ liệu', () => {
  const trip = {
    waypoints: [{ name: 'Đại Nội', lat: 16.47, lng: 107.58, openHours: '08:00 - 17:00' }],
    days: [{
      dayIndex: 1,
      activities: [
        { id: 'a', timeStart: '09:00', timeEnd: '11:00', title: 'Tham quan Đại Nội', location: 'Huế', type: 'sightseeing', status: 'Đã xác nhận' },
      ],
    }],
  };
  const late = validateRecommendation(rec([{ activityId: 'a', newTime: '16:00 — 18:00' }], { targetDayIndex: 1 }), trip, rules);
  assert.equal(late.accepted, false);
  assert.ok(codes(late).includes('OUTSIDE_OPENING_HOURS'));
});

// ───────────── Lọc cả kết quả AI ─────────────

test('validateOptimizationResult tách đề xuất đạt / không đạt và xếp ít cảnh báo trước', () => {
  const outcome = validateOptimizationResult(
    {
      recommendations: [
        rec([{ activityId: 'act-10', newTime: '08:30 — 10:30' }], { id: 'bad', actionTitle: 'Chồng giờ' }),
        rec([{ activityId: 'act-10', newTime: '14:10' }], { id: 'good', actionTitle: 'Sớm 20 phút' }),
        'rác',
      ],
    },
    initialTripData,
    rules,
  );
  assert.equal(outcome.checked, 3);
  assert.deepEqual(outcome.accepted.map((r) => r.id), ['good']);
  assert.deepEqual(outcome.rejected.map((r) => r.id), ['bad', undefined]);
  assert.match(summarizeRejectionsForRetry(outcome.rejected), /Chồng giờ/);
});

test('dữ liệu AI/chuyến đi hỏng không làm validator ném lỗi hay cho qua', () => {
  for (const result of [null, undefined, {}, { recommendations: 'x' }, { recommendations: [null, 5, {}] }]) {
    const outcome = validateOptimizationResult(result, { days: [{ dayIndex: 3, activities: 'hỏng' as any }] }, rules);
    assert.deepEqual(outcome.accepted, []);
  }
  assert.deepEqual(validateOptimizationResult({ recommendations: [rec([{ activityId: 'x', newTime: '10:00' }])] }, {}, rules).accepted, []);
});
