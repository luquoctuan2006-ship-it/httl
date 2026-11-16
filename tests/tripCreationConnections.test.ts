import assert from 'node:assert/strict';
import test from 'node:test';
import { buildManualTrip } from '../src/components/modals/trip-planner/buildManualTrip';
import {
  buildMembers,
  buildTripDatesLabel,
  computeEstimatedRouteKm,
  mapAiBudgetBreakdownToAllocations,
  normalizeAiGeneratedDays,
  normalizeAiMoney,
  normalizeAiSuggestions,
} from '../src/components/modals/trip-planner/helpers';
import { buildDynamicWaypoints } from '../src/utils/vietnamGeo';
import { countUnreadAlerts } from '../src/utils/seenAlerts';

test('buildManualTrip connects owner account, calendar dates, coordinates, route distance, and budget/schedule alerts', () => {
  const trip = buildManualTrip({
    tripTitle: 'Tour Đà Nẵng - Hội An',
    tripCode: 'dn-ha-01',
    origin: 'Đà Nẵng',
    destination: 'Hội An',
    startDate: '2026-11-16',
    totalDays: 2,
    vehicle: 'Xe 16 chỗ Ford Transit',
    membersCount: 4,
    budgetEstimated: 5000000,
    totalCalculatedCost: 6000000,
    totalActivitiesCount: 2,
    owner: { uid: 'user-owner-1', name: 'Nguyễn Văn An' },
    manualDays: [
      {
        dayIndex: 1,
        dateLabel: 'Ngày 1',
        dayName: 'N1',
        dateNum: 1,
        fullDate: 'Ngày 1: Khởi hành & Tham quan',
        confirmedCount: 1,
        pendingCount: 0,
        dispatcherNote: '',
        activities: [
          {
            id: 'act-1',
            timeStart: '11:30',
            timeEnd: '13:00',
            title: 'Tham quan phố cổ Hội An',
            location: 'Hội An',
            status: 'Đã xác nhận',
            type: 'sightseeing',
            details: '',
            cost: 6000000,
          },
        ],
      },
      {
        dayIndex: 2,
        dateLabel: 'Ngày 2',
        dayName: 'N2',
        dateNum: 2,
        fullDate: 'Ngày 2: Nghỉ dưỡng',
        confirmedCount: 0,
        pendingCount: 0,
        dispatcherNote: '',
        activities: [],
      },
    ],
  });

  // Dates & calendar days
  assert.equal(trip.dates, '16/11/2026 - 17/11/2026');
  assert.equal(trip.days[0].dayName, 'T2');
  assert.equal(trip.days[0].dateNum, 16);
  assert.equal(trip.days[0].dateLabel, 'T2 16');
  assert.equal(trip.days[1].dayName, 'T3');
  assert.equal(trip.days[1].dateNum, 17);

  // Owner linked into members[0]
  assert.equal(trip.members.length, 4);
  assert.equal(trip.members[0].uid, 'user-owner-1');
  assert.equal(trip.members[0].name, 'Nguyễn Văn An');
  assert.equal(trip.members[0].role, 'Trưởng đoàn');
  assert.equal(trip.members[0].memberType, 'account');
  assert.equal(trip.members[0].status, 'online');
  assert.equal(trip.membersOnline, 1);

  // Coordinates & route distance connected
  assert.ok(trip.days[0].activities[0].coordinates);
  assert.ok(trip.totalKm > 0 && trip.totalKm !== 2 * 75);

  // Budget & schedule alerts detected automatically
  assert.ok(trip.alerts.some((a) => a.category === 'budget' && a.severity === 'error'));
  assert.ok(trip.alerts.some((a) => a.id.startsWith('alert-noon-')));
});

test('buildMembers stays backward-compatible when owner is omitted', () => {
  const members = buildMembers(2);
  assert.equal(members.length, 2);
  assert.equal(members[0].name, 'Thành viên 1');
  assert.equal(members[0].role, 'Trưởng đoàn');
  assert.equal(members[0].status, 'offline');
  assert.equal(members[0].uid, undefined);
});

test('buildMembers scopes member IDs to the trip so switching trips cannot reuse member codes', () => {
  const firstTripMembers = buildMembers(2, undefined, 'trip-one');
  const secondTripMembers = buildMembers(2, undefined, 'trip-two');

  assert.deepEqual(firstTripMembers.map((member) => member.id), ['trip-one-1', 'trip-one-2']);
  assert.equal(firstTripMembers.some((member) => secondTripMembers.some((other) => other.id === member.id)), false);
});

test('normalizeAiGeneratedDays deduplicates activity IDs across days, sorts times, and resolves coordinates', () => {
  const days = normalizeAiGeneratedDays(
    [
      {
        dayIndex: 1,
        fullDate: 'Ngày 1: Khởi hành',
        summary: 'Đón đoàn tại Đà Nẵng',
        activities: [
          {
            id: 'act-1',
            timeStart: '14:00',
            timeEnd: '16:00',
            title: 'Tắm biển Mỹ Khê',
            location: 'Đà Nẵng',
            type: 'sightseeing',
            cost: 200000,
          },
          {
            id: 'act-2',
            timeStart: '08:00',
            timeEnd: '10:00',
            title: 'Ăn sáng bún chả cá',
            location: 'Đà Nẵng',
            type: 'meal',
            cost: '500.000',
          },
        ],
      },
      {
        dayIndex: 2,
        fullDate: 'Ngày 2: Phố cổ',
        activities: [
          {
            id: 'act-1', // same ID emitted by Gemini on day 2
            timeStart: '09:00',
            timeEnd: '11:30',
            title: 'Check-in khách sạn',
            location: 'Hội An',
            type: 'checkin',
            coordinates: { lat: 999, lng: 999 }, // invalid coords should fall back to Hội An
            cost: 1500000,
          },
        ],
      },
    ],
    '2026-11-20',
    'VND',
    12345,
  );

  assert.equal(days.length, 2);
  assert.equal(days[0].dayName, 'T6');
  assert.equal(days[0].dateNum, 20);
  assert.equal(days[1].dayName, 'T7');
  assert.equal(days[1].dateNum, 21);

  // Sorted chronologically by timeStart
  assert.equal(days[0].activities[0].timeStart, '08:00');
  assert.equal(days[0].activities[1].timeStart, '14:00');
  assert.equal(days[0].activities[0].cost, 500000);

  // Globally unique IDs across all days
  const allIds = days.flatMap((d) => d.activities.map((a) => a.id));
  assert.equal(new Set(allIds).size, allIds.length);

  // Fallback coordinates resolved when Gemini omits or corrupts coordinates
  assert.ok(days[0].activities[0].coordinates);
  assert.ok(days[1].activities[0].coordinates);
  assert.ok(days[1].activities[0].coordinates!.lat >= 15 && days[1].activities[0].coordinates!.lat <= 17);
});

test('AI budget breakdown and operational suggestions map into Budget allocations and OperationsPanel fields', () => {
  assert.equal(normalizeAiMoney(35, 'triệu VND'), 35_000_000);
  assert.equal(normalizeAiMoney('42.500.000', 'VND'), 42_500_000);

  const allocations = mapAiBudgetBreakdownToAllocations(
    {
      transport: 8,
      hotel: 12,
      'ăn uống': 7,
      sightseeing: 5,
      contingency: 3,
    },
    'triệu VNĐ',
  );

  assert.deepEqual(allocations, {
    transport: 8_000_000,
    hotel: 12_000_000,
    meal: 7_000_000,
    sightseeing: 5_000_000,
    contingency: 3_000_000,
  });

  const mapped = normalizeAiSuggestions(
    [
      {
        id: '1',
        title: 'Đổi giờ tham quan ngoài trời sang buổi sáng',
        impact: 'Giảm rủi ro nắng nóng',
        description: 'Tránh khung giờ 12:00-13:30 nhiệt độ cao.',
        savingEstimate: '450.000 ₫',
        confidence: '92%',
      },
    ],
    '',
    '',
  );

  assert.equal(mapped.aiSuggestions[0].badge, 'Giảm rủi ro nắng nóng');
  assert.equal(mapped.aiSuggestions[0].costSaved, '450.000 ₫');
  assert.equal(mapped.aiSuggestions[0].confidence, '92%');
  assert.equal(mapped.aiSavingsEstimate, '450.000 ₫');
  assert.equal(mapped.aiConfidence, '92%');
});

test('buildTripDatesLabel and computeEstimatedRouteKm calculate consistent ranges and distances', () => {
  assert.equal(buildTripDatesLabel('2026-11-16', 1), '16/11/2026');
  assert.equal(buildTripDatesLabel('2026-11-16', 3), '16/11/2026 - 18/11/2026');

  const waypoints = buildDynamicWaypoints('Đà Nẵng', 'Huế', ['Hội An']);
  const km = computeEstimatedRouteKm(waypoints, 225);
  assert.ok(km > 50 && km < 300);

  const fallbackKm = computeEstimatedRouteKm([], 225);
  assert.equal(fallbackKm, 225);
});

test('normalizeAiSuggestions does not fabricate 88% confidence or generic savings when AI omits them', () => {
  const result = normalizeAiSuggestions(
    [
      {
        id: '1',
        title: 'Sắp xếp tham quan hợp lý',
        description: 'Gom nhóm điểm gần nhau.',
      },
    ],
    undefined,
    undefined,
  );
  assert.equal(result.aiConfidence, '');
  assert.equal(result.aiSavingsEstimate, '');
});

test('countUnreadAlerts counts only alerts not yet seen by user', () => {
  const alerts = [
    { id: 'a-1', title: 'Cảnh báo 1', timeAgo: 'Vừa xong', description: '...', severity: 'warning' as const, category: 'weather' as const },
    { id: 'a-2', title: 'Cảnh báo 2', timeAgo: 'Vừa xong', description: '...', severity: 'error' as const, category: 'budget' as const },
  ];
  assert.equal(countUnreadAlerts(alerts, new Set()), 2);
  assert.equal(countUnreadAlerts(alerts, new Set(['a-1'])), 1);
  assert.equal(countUnreadAlerts(alerts, new Set(['a-1', 'a-2'])), 0);
});
