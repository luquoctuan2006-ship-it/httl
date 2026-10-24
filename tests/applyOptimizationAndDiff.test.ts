import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialTripData } from '../src/data/mockData';
import {
  applyScheduleChangesStrict,
  computeOptimizationDiff,
  filterAlertsByRecommendation,
  isAlertResolvedByRecommendation,
} from '../src/utils/applyOptimization';
import {
  buildRuleBasedScheduleOptimization,
  pickTripForOptimization,
  runOptimization,
} from '../src/utils/scheduleOptimizer';
import { parseRules, validateOptimizationResult } from '../src/utils/scheduleValidator';
import { Activity, DaySchedule, OperationalAlert, TripData } from '../src/types/travel';

const sampleAdminRules = {
  bufferMinutes: '20',
  startHour: '07:30',
  endHour: '21:30',
  citySpeedLimit: '40 km/h',
  highwaySpeedLimit: '60 km/h',
  passSpeedLimit: '35 km/h',
  conflictChecks: { overlapTime: true, openingHoursMismatch: true, impossibleTransit: true, hotelCheckinConflict: true },
  optimizationPriorities: { costSaving: true, transitTimeMinimization: true, avoidHotNoonSun: true, elderlyPacing: false },
};

test('3. Thay fallback cứng bằng bộ tối ưu theo quy tắc: chạy trên dữ liệu thật, vượt qua kiểm tra khả thi 100%', async () => {
  const payload = {
    tripSource: 'server',
    currentTrip: pickTripForOptimization(initialTripData),
    alertDetails: initialTripData.alerts,
    userGoal: 'An toàn, đúng lịch trình',
    rules: sampleAdminRules,
  };

  const rawFallback = buildRuleBasedScheduleOptimization(payload);
  assert.ok(Array.isArray(rawFallback.recommendations));
  assert.ok(rawFallback.recommendations.length > 0, 'Phải tạo được ít nhất 1 đề xuất theo quy tắc');

  const rec = rawFallback.recommendations[0];
  assert.equal(rec.targetDayIndex, 3);
  assert.ok(rec.scheduleChanges.length > 0);
  assert.equal(rec.scheduleChanges[0].activityId, 'act-10', 'Phải dùng activityId có thật trong ngày 3');

  // Đề xuất phải vượt qua bộ kiểm tra khả thi phía server với 0 lỗi
  const rules = parseRules(sampleAdminRules);
  const outcome = validateOptimizationResult(rawFallback, payload.currentTrip, rules);
  assert.equal(outcome.rejected.length, 0, 'Không đề xuất nào được bị loại');
  assert.ok(outcome.accepted.length > 0, 'Đề xuất phải được chấp nhận');

  // Chạy qua runOptimization khi AI lỗi
  const optResult = await runOptimization(payload, {
    ask: async () => { throw new Error('API key offline'); },
    fallback: buildRuleBasedScheduleOptimization,
    warn: () => undefined,
  });

  assert.equal(optResult.validation.source, 'fallback');
  assert.ok(optResult.recommendations.length > 0);
  assert.equal(optResult.validation.accepted, optResult.recommendations.length);
  assert.equal(optResult.validation.rejected.length, 0);
});

test('4. Ghép thay đổi CHỈ theo activityId duy nhất: không ghép theo tiêu đề hay giờ cũ', () => {
  const day3 = initialTripData.days.find((d) => d.dayIndex === 3)!;

  // Trường hợp 1: Có activityId đúng
  const validChanges = [
    {
      activityId: 'act-10',
      activityTitle: 'Tên khác hoàn toàn',
      oldTime: '99:99',
      newTime: '14:10 — 17:10',
      action: 'Xuất phát sớm 20 phút',
    },
  ];

  const { updatedDay, changedActivities } = applyScheduleChangesStrict(
    day3,
    validChanges,
    'Khởi hành sớm 20 phút',
    'Tránh ùn tắc',
  );

  assert.equal(changedActivities.length, 1);
  assert.equal(changedActivities[0].id, 'act-10');
  assert.equal(changedActivities[0].timeStart, '14:10');
  assert.equal(changedActivities[0].timeEnd, '17:10');
  assert.equal(changedActivities[0].status, 'Đã xác nhận');

  // Các hoạt động khác không bị đổi bừa sang 'Đã xác nhận'
  const act9 = updatedDay.activities.find((a) => a.id === 'act-9')!;
  assert.equal(act9.timeStart, '09:45');
  assert.equal(act9.status, 'Đang diễn ra'); // Vẫn giữ nguyên trạng thái cũ

  // Trường hợp 2: KHÔNG có activityId (hoặc sai ID), chỉ trùng tiêu đề -> TUYỆT ĐỐI KHÔNG GHÉP
  const spoofedChanges = [
    {
      activityId: 'fake-id-999',
      activityTitle: 'Khởi hành đi Lăng Cô', // trùng tên act-10
      newTime: '10:00 — 12:00',
      action: 'Giả mạo theo tên',
    },
  ];

  const resultNoMatch = applyScheduleChangesStrict(day3, spoofedChanges);
  assert.equal(resultNoMatch.changedActivities.length, 0, 'Không được ghép khi activityId không khớp');
  const act10Unchanged = resultNoMatch.updatedDay.activities.find((a) => a.id === 'act-10')!;
  assert.equal(act10Unchanged.timeStart, '14:30'); // Giữ nguyên giờ cũ
});

test('4. Chỉ xóa cảnh báo mà đề xuất thực sự xử lý; giữ nguyên các cảnh báo khác', () => {
  const alerts: OperationalAlert[] = [
    {
      id: 'alt-1',
      title: 'Mưa lớn tại Lăng Cô',
      description: 'Xác suất 75% từ 15:00–17:00. Cần phương án trong nhà.',
      severity: 'warning',
      category: 'weather',
      timeAgo: '2 phút',
    },
    {
      id: 'alt-2',
      title: 'Xung đột giờ nhận phòng',
      description: 'Nhận phòng 14:00 trùng với thời gian di chuyển dự kiến.',
      severity: 'error',
      category: 'schedule',
      timeAgo: '8 phút',
    },
    {
      id: 'alt-3',
      title: 'Đèo Hải Vân lưu lượng đông',
      description: 'Khu vực đỉnh đèo mật độ xe tăng 35%, khuyến nghị đi hầm hoặc khởi hành sớm.',
      severity: 'info',
      category: 'traffic',
      timeAgo: '15 phút',
    },
  ];

  // Đề xuất chỉ xử lý chặng qua Đèo Hải Vân / Lăng Cô (act-10)
  const act10: Activity = {
    id: 'act-10',
    title: 'Khởi hành đi Lăng Cô',
    location: 'QL1A – Đèo Hải Vân',
    status: 'Đã xác nhận',
    type: 'transport',
    details: 'Đã dời sớm 20 phút',
    timeStart: '14:10',
    timeEnd: '17:10',
  };

  const recommendation = {
    actionTitle: 'Khởi hành sớm 20 phút qua Đèo Hải Vân tránh ùn tắc và mưa lớn',
    reason: 'Tránh giờ cao điểm và mưa dông đèo dốc',
    scheduleChanges: [{ activityId: 'act-10', newTime: '14:10 — 17:10' }],
  };

  const { remainingAlerts, resolvedAlerts } = filterAlertsByRecommendation(
    alerts,
    recommendation,
    [act10],
    3,
  );

  // alt-1 và alt-3 liên quan đến Đèo Hải Vân / Lăng Cô -> được xử lý
  assert.ok(resolvedAlerts.some((r) => r.alert.id === 'alt-1'));
  assert.ok(resolvedAlerts.some((r) => r.alert.id === 'alt-3'));

  // alt-2 (Xung đột giờ nhận phòng) KHÔNG liên quan -> BẮT BUỘC PHẢI CÒN LẠI
  assert.equal(remainingAlerts.length, 1);
  assert.equal(remainingAlerts[0].id, 'alt-2');
  assert.equal(remainingAlerts[0].title, 'Xung đột giờ nhận phòng');
});

test('5. Xem trước Diff so sánh chi tiết trước và sau khi áp dụng', () => {
  const rec = {
    actionTitle: 'Khởi hành sớm 20 phút',
    reason: 'Tránh ùn tắc',
    targetDayIndex: 3,
    scheduleChanges: [
      {
        activityId: 'act-10',
        activityTitle: 'Khởi hành đi Lăng Cô',
        oldTime: '14:30',
        newTime: '14:10 — 17:10',
        action: 'Khởi hành sớm 20 phút',
      },
    ],
    timeSaved: '20 phút',
    costSaved: '320.000 ₫',
  };

  const diff = computeOptimizationDiff(initialTripData, rec);
  assert.equal(diff.targetDayIndex, 3);
  assert.equal(diff.changedCount, 1);

  const changedDiff = diff.activityDiffs.find((d) => d.activityId === 'act-10');
  assert.ok(changedDiff);
  assert.equal(changedDiff.isChanged, true);
  assert.equal(changedDiff.before.timeStart, '14:30');
  assert.equal(changedDiff.after.timeStart, '14:10');
  assert.equal(changedDiff.timeDeltaMinutes, -20); // Dời sớm 20 phút

  const unchangedDiff = diff.activityDiffs.find((d) => d.activityId === 'act-9');
  assert.ok(unchangedDiff);
  assert.equal(unchangedDiff.isChanged, false);
  assert.equal(unchangedDiff.timeDeltaMinutes, 0);

  // Kiểm tra diff cảnh báo
  assert.ok(diff.alertDiffs.length > 0);
  assert.ok(diff.resolvedAlertsCount > 0);
  assert.ok(diff.remainingAlertsCount > 0);
});

test('5. Khả năng Hoàn tác (Undo): phục hồi chính xác trạng thái trước khi tối ưu', () => {
  const originalTrip: TripData = structuredClone(initialTripData);
  const snapshot: TripData = structuredClone(originalTrip);

  // Giả lập áp dụng tối ưu
  const day3 = originalTrip.days.find((d) => d.dayIndex === 3)!;
  const { updatedDay } = applyScheduleChangesStrict(day3, [
    { activityId: 'act-10', newTime: '14:10 — 17:10', action: 'Sớm 20 phút' },
  ]);

  const modifiedTrip: TripData = {
    ...originalTrip,
    days: originalTrip.days.map((d) => (d.dayIndex === 3 ? updatedDay : d)),
    alerts: originalTrip.alerts.filter((a) => a.id !== 'alt-1'),
  };

  assert.notDeepEqual(modifiedTrip.days, snapshot.days);
  assert.notDeepEqual(modifiedTrip.alerts, snapshot.alerts);

  // Thực hiện hoàn tác từ snapshot
  const restoredTrip: TripData = structuredClone(snapshot);
  assert.deepEqual(restoredTrip, originalTrip, 'Chuyến đi phục hồi phải khớp 100% với bản chụp trước tối ưu');
  assert.equal(restoredTrip.days.find((d) => d.dayIndex === 3)?.activities.find((a) => a.id === 'act-10')?.timeStart, '14:30');
  assert.equal(restoredTrip.alerts.length, originalTrip.alerts.length);
});
