import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_INVOICES_PER_TRIP, normalizeTripData } from '../src/utils/trip/normalizeTripData';
import type { TripData } from '../src/types/travel';
import {
  computeBudgetMetrics,
  computeTripBudgetSummaryFields,
  detectBudgetAlerts,
  getIsoDateForTripDay,
  getTripDayIndexForIsoDate,
  resolveCategoryAllocations,
  resolveInitialTripCategoryAllocations,
  resolveScaledAllocationsForBudget,
} from '../src/utils/trip/budgetAlerts';
import { buildExpenseReportCsv } from '../src/utils/trip/tripHelpers';
import {
  countPassengerMembers,
  isStaffRole,
  MAX_GUEST_COMPANIONS_PER_PASSENGER,
  MEMBER_ROLES,
  STAFF_ROLES,
} from '../src/utils/trip/tripJoinHelpers';
import {
  computeAuthoritativeTripDerivedFields,
  type FirestoreDbLike,
  upsertTripForUser,
} from '../src/utils/trip/tripRepository';

function createMockDb(initialDocs: Record<string, TripData>): FirestoreDbLike {
  const store = new Map<string, Record<string, unknown>>(
    Object.entries(initialDocs).map(([id, doc]) => [
      id,
      structuredClone(doc) as unknown as Record<string, unknown>,
    ]),
  );

  return {
    collection: () => ({
      doc: (id: string) => ({ id }),
    }),
    runTransaction: async (fn) => {
      const tx = {
        get: async (docRef: { id: string }) => {
          const data = store.get(docRef.id);
          return {
            exists: Boolean(data),
            data: () => (data ? structuredClone(data) : undefined),
          };
        },
        set: (docRef: { id: string }, data: Record<string, unknown>) => {
          store.set(docRef.id, structuredClone(data));
        },
      };
      return await fn(tx);
    },
  };
}

function buildSampleBudgetTrip(): TripData {
  return normalizeTripData({
    id: 'trip-budget-integrity',
    code: 'BI-101',
    title: 'Tour Kiểm Tra Ngân Sách',
    dates: '2026-09-10 - 2026-09-12',
    totalDays: 3,
    budgetTotal: 10_000_000,
    days: [
      {
        dayIndex: 1,
        dateLabel: 'N1',
        dayName: 'T5',
        dateNum: 10,
        fullDate: '2026-09-10',
        confirmedCount: 3,
        pendingCount: 1,
        dispatcherNote: '',
        activities: [
          {
            id: 'act-lunch-1',
            timeStart: '12:00',
            timeEnd: '13:00',
            title: 'Ăn trưa Hải sản',
            location: 'Đà Nẵng',
            type: 'meal',
            status: 'Đã xác nhận',
            cost: 500_000,
          },
          {
            id: 'act-hotel-1',
            timeStart: '14:00',
            timeEnd: '15:00',
            title: 'Nhận phòng khách sạn',
            location: 'Đà Nẵng',
            type: 'hotel',
            status: 'Hoàn tất',
            cost: 2_000_000,
          },
          {
            id: 'act-pending-1',
            timeStart: '16:00',
            timeEnd: '17:00',
            title: 'Vé du thuyền (Chờ duyệt)',
            location: 'Sông Hàn',
            type: 'sightseeing',
            status: 'Chờ duyệt',
            cost: 1_200_000,
          },
          {
            id: 'act-briefing-1',
            timeStart: '19:00',
            timeEnd: '20:00',
            title: 'Họp đoàn điều hành',
            location: 'Phòng họp KS',
            type: 'briefing',
            status: 'Hoàn tất',
            cost: 300_000,
          },
        ],
      },
      {
        dayIndex: 2,
        dateLabel: 'N2',
        dayName: 'T6',
        dateNum: 11,
        fullDate: '2026-09-11',
        confirmedCount: 0,
        pendingCount: 0,
        dispatcherNote: '',
        activities: [],
      },
      {
        dayIndex: 3,
        dateLabel: 'N3',
        dayName: 'T7',
        dateNum: 12,
        fullDate: '2026-09-12',
        confirmedCount: 0,
        pendingCount: 0,
        dispatcherNote: '',
        activities: [],
      },
    ],
    invoices: [
      {
        id: 'inv-lunch-real',
        title: 'Hóa đơn Ăn trưa Hải sản',
        category: 'meal',
        amount: 480_000,
        date: '2026-09-10',
        dayIndex: 1,
        linkedActivityId: 'act-lunch-1',
      },
    ],
  });
}

test('Budget #1-#3: linkedActivityId deduplicates estimated activity cost, excludes pending approval & briefing from contingency', () => {
  const trip = buildSampleBudgetTrip();
  const metrics = computeBudgetMetrics(trip);

  // Invoice 480k replaces act-lunch-1 (500k)
  // act-hotel-1 (2,000k, Hoàn tất) counts as actual
  // act-pending-1 (1,200k, Chờ duyệt) excluded from spentBudget
  // act-briefing-1 (300k, briefing) excluded from 5 categories (not charged to contingency 5%)
  assert.equal(metrics.linkedActivityIds.has('act-lunch-1'), true);
  assert.equal(metrics.totalInvoicesCosts, 480_000);
  assert.equal(metrics.actualSpentBudget, 2_480_000);
  assert.equal(metrics.plannedCommittedBudget, 0);
  assert.equal(metrics.pendingApprovalBudget, 1_200_000);
  assert.equal(metrics.pendingApprovalCount, 1);
  assert.equal(metrics.spentBudget, 2_480_000);

  const mealCat = metrics.categories.find((c) => c.id === 'meal');
  const hotelCat = metrics.categories.find((c) => c.id === 'hotel');
  const contingencyCat = metrics.categories.find((c) => c.id === 'contingency');
  const sightseeingCat = metrics.categories.find((c) => c.id === 'sightseeing');

  assert.equal(mealCat?.spent, 480_000);
  assert.equal(hotelCat?.spent, 2_000_000);
  assert.equal(contingencyCat?.spent, 0, 'Briefing activities must not eat into contingency 5%');
  assert.equal(sightseeingCat?.spent, 0, 'Chờ duyệt activities must not count into category spent');

  // Verify summary fields match server authoritative calculation & CSV export
  const summary = computeTripBudgetSummaryFields(trip);
  const authoritative = computeAuthoritativeTripDerivedFields(trip);
  assert.equal(summary.budgetUsed, 2_480_000);
  assert.equal(authoritative.budgetUsed, summary.budgetUsed);
  assert.equal(authoritative.budgetRemaining, summary.budgetRemaining);
  assert.equal(authoritative.budgetUsedPercent, summary.budgetUsedPercent);

  const csv = buildExpenseReportCsv(trip);
  assert.ok(csv.includes('2480000'), 'CSV should reflect deduplicated total spent');
  assert.ok(csv.includes('đã thay bằng hóa đơn'));
  assert.ok(csv.includes('Chờ duyệt'));
});

test('Budget #4-#6: MAX_INVOICES_PER_TRIP = 100, proportional allocation scaling caps <= total, date<->day 2-way sync', () => {
  assert.equal(MAX_INVOICES_PER_TRIP, 100);

  const trip = normalizeTripData({
    id: 'trip-scale-1',
    dates: '2026-10-20 - 2026-10-22',
    totalDays: 3,
    budgetTotal: 10_000_000,
    customCategoryAllocations: {
      transport: 3_000_000,
      hotel: 3_500_000,
      meal: 2_000_000,
      sightseeing: 1_000_000,
      contingency: 500_000,
    },
    days: [
      { dayIndex: 1, dateLabel: '', dayName: 'T3', dateNum: 20, fullDate: '2026-10-20', confirmedCount: 0, pendingCount: 0, dispatcherNote: '', activities: [] },
      { dayIndex: 2, dateLabel: '', dayName: 'T4', dateNum: 21, fullDate: '2026-10-21', confirmedCount: 0, pendingCount: 0, dispatcherNote: '', activities: [] },
      { dayIndex: 3, dateLabel: '', dayName: 'T5', dateNum: 22, fullDate: '2026-10-22', confirmedCount: 0, pendingCount: 0, dispatcherNote: '', activities: [] },
    ],
  });

  // Scale down to 7,777,777 -> sum of scaled categories must not exceed 7,777,777
  const scaled = resolveScaledAllocationsForBudget(trip, 7_777_777)!;
  const scaledSum = scaled.transport! + scaled.hotel! + scaled.meal! + scaled.sightseeing! + scaled.contingency!;
  assert.ok(scaledSum <= 7_777_777);
  assert.ok(scaledSum >= 7_777_770);

  // Two-way date <-> dayIndex sync
  assert.equal(getIsoDateForTripDay(trip, 1), '2026-10-20');
  assert.equal(getIsoDateForTripDay(trip, 2), '2026-10-21');
  assert.equal(getIsoDateForTripDay(trip, 3), '2026-10-22');
  assert.equal(getTripDayIndexForIsoDate(trip, '2026-10-21'), 2);
  assert.equal(getTripDayIndexForIsoDate(trip, '2026-10-25'), null);
});

test('Budget allocations created above the trip total are capped proportionally', () => {
  const trip = normalizeTripData({
    id: 'trip-overallocated',
    budgetTotal: 10_000_000,
    customCategoryAllocations: {
      transport: 6_000_000,
      hotel: 5_000_000,
      meal: 4_000_000,
    },
    days: [],
  });

  const allocations = resolveCategoryAllocations(trip);
  const total = Object.values(allocations).reduce((sum, amount) => sum + amount, 0);
  assert.equal(total, 10_000_000);

  const scaled = resolveScaledAllocationsForBudget(trip, trip.budgetTotal);
  assert.ok(scaled);
  assert.ok(Object.values(scaled!).reduce((sum, amount) => sum + amount, 0) <= trip.budgetTotal);
});

test('New trip category allocations cover planned costs without false over-limit alerts', () => {
  const trip = normalizeTripData({
    id: 'trip-initial-category-limits',
    budgetTotal: 10_000_000,
    days: [
      {
        dayIndex: 1,
        dateLabel: '',
        dayName: 'T2',
        dateNum: 1,
        fullDate: 'Ngày 1',
        confirmedCount: 1,
        pendingCount: 0,
        dispatcherNote: '',
        activities: [
          {
            id: 'act-tour-ticket',
            timeStart: '09:00',
            timeEnd: '10:00',
            title: 'Vé tham quan',
            location: 'Đà Nẵng',
            type: 'sightseeing',
            status: 'Đã xác nhận',
            cost: 2_000_000,
          },
        ],
      },
    ],
  });

  const allocations = resolveInitialTripCategoryAllocations(trip);
  assert.ok(allocations);
  assert.equal(Object.values(allocations).reduce((sum, amount) => sum + amount, 0), trip.budgetTotal);
  const initializedTrip = { ...trip, customCategoryAllocations: allocations };
  const sightseeing = computeBudgetMetrics(initializedTrip).categories.find((category) => category.id === 'sightseeing');
  assert.equal(sightseeing?.level, 'normal');
  assert.ok(sightseeing && sightseeing.allocated >= sightseeing.spent);
});

test('Budget alerts include clear planned vs actual breakdown', () => {
  const trip = normalizeTripData({
    id: 'trip-alert-copy',
    budgetTotal: 1_000_000,
    days: [
      {
        dayIndex: 1,
        dateLabel: '',
        dayName: 'T2',
        dateNum: 1,
        fullDate: 'Ngày 1',
        confirmedCount: 1,
        pendingCount: 0,
        dispatcherNote: '',
        activities: [
          {
            id: 'a1',
            timeStart: '08:00',
            timeEnd: '09:00',
            title: 'Thuê xe',
            location: 'HN',
            type: 'transport',
            status: 'Đã xác nhận',
            cost: 1_100_000,
          },
        ],
      },
    ],
  });

  const alerts = detectBudgetAlerts(trip);
  assert.ok(alerts.some((a) => a.description.includes('thực chi') && a.description.includes('dự kiến')));
});

test('Members #1-#7: orphan guest cascade cleanup, passengerCount excludes staff, realistic offline defaults, shared constants', async () => {
  assert.equal(MAX_GUEST_COMPANIONS_PER_PASSENGER, 10);
  assert.equal(isStaffRole('Tài xế'), true);
  assert.equal(isStaffRole('Hướng dẫn viên'), true);
  assert.equal(isStaffRole('Trưởng đoàn'), true);
  assert.equal(isStaffRole('Khách du lịch'), false);
  assert.ok(MEMBER_ROLES.length >= STAFF_ROLES.size + 2);

  const initialTrip = normalizeTripData({
    id: 'trip-members-integrity',
    ownerId: 'owner-a',
    participantUids: ['user-b'],
    version: 1,
    members: [
      {
        id: 'm-owner',
        uid: 'owner-a',
        name: 'Chủ chuyến',
        avatar: 'CC',
        role: 'Trưởng đoàn',
        phone: '0901',
        status: 'online',
        attendanceStatus: 'Có mặt',
        memberType: 'account',
      },
      {
        id: 'm-driver',
        name: 'Bác Tài',
        avatar: 'BT',
        role: 'Tài xế',
        phone: '0902',
        status: 'offline',
        attendanceStatus: 'Chưa điểm danh',
        memberType: 'manual',
      },
      {
        id: 'm-user-b',
        uid: 'user-b',
        name: 'Hành khách B',
        avatar: 'HB',
        role: 'Khách du lịch',
        phone: '0903',
        status: 'online',
        attendanceStatus: 'Chưa điểm danh',
        memberType: 'account',
      },
      {
        id: 'm-guest-b1',
        name: 'Người thân của B',
        avatar: 'NB',
        role: 'Khách du lịch',
        phone: '',
        // Force attempt online on guest companion — normalizeMember must clamp back to offline
        status: 'online',
        attendanceStatus: 'Chưa điểm danh',
        memberType: 'guest',
        invitedByUid: 'user-b',
        invitedByName: 'Hành khách B',
      },
    ],
    days: [],
  });

  // Guest without account is always normalized to offline
  const guestMember = initialTrip.members.find((m) => m.id === 'm-guest-b1');
  assert.equal(guestMember?.status, 'offline');

  // passengerCount excludes Trưởng đoàn & Tài xế -> only Hành khách B + Người thân của B = 2
  assert.equal(countPassengerMembers(initialTrip.members), 2);
  assert.equal(initialTrip.telematics.passengerCount, 2);

  // When owner removes user-b via upsertTripForUser, server must cascade-delete orphaned m-guest-b1 and resync passengerCount to 0
  const db = createMockDb({ [initialTrip.id]: initialTrip });
  const res = await upsertTripForUser(
    db,
    {
      ...initialTrip,
      members: initialTrip.members.filter((m) => m.uid !== 'user-b'),
    },
    { uid: 'owner-a', role: 'user' },
    () => '2026-09-01T00:00:00Z',
  );

  assert.equal(res.status, 'ok');
  if (res.status === 'ok') {
    assert.equal(res.trip.members.some((m) => m.id === 'm-guest-b1'), false, 'Orphaned guest companion must be pruned');
    assert.equal(res.trip.telematics.passengerCount, 0);
    assert.deepEqual(res.trip.participantUids ?? [], []);
  }
});
