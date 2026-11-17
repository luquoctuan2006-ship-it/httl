import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TripData } from '../src/types/travel';
import { normalizeTripData } from '../src/data/normalizeTripData';
import { ALLOWED_CONFLICT_CHECK_KEYS, ALLOWED_PRIORITY_KEYS } from '../src/utils/scheduleValidator';

import {
  type FirestoreDbLike,
  type FirestoreDocRefLike,
  MAX_TRIP_DOC_BYTES,
  computeAuthoritativeTripDerivedFields,
  getTripComparableJson,
  upsertTripForUser,
} from '../src/utils/tripRepository';

// In-memory Firestore adapter to run the real upsertTripForUser transaction logic
function createInMemoryFirestore(initial?: Record<string, Record<string, unknown>>): {
  db: FirestoreDbLike;
  collections: Map<string, Map<string, Record<string, unknown>>>;
} {
  const collections = new Map<string, Map<string, Record<string, unknown>>>();
  if (initial) {
    const tripsMap = new Map<string, Record<string, unknown>>();
    for (const [id, data] of Object.entries(initial)) {
      tripsMap.set(id, structuredClone(data));
    }
    collections.set('trips', tripsMap);
  }

  const getCol = (name: string) => {
    let map = collections.get(name);
    if (!map) {
      map = new Map();
      collections.set(name, map);
    }
    return map;
  };

  const db: FirestoreDbLike = {
    collection(name: string) {
      return {
        doc(id: string): FirestoreDocRefLike & { _collection?: string } {
          return { id, _collection: name } as FirestoreDocRefLike;
        },
      };
    },
    async runTransaction(updateFunction) {
      const pendingWrites: Array<{ col: string; id: string; data: Record<string, unknown> }> = [];
      const result = await updateFunction({
        async get(docRef) {
          const colName = (docRef as { _collection?: string })._collection || 'trips';
          const data = getCol(colName).get(docRef.id);
          return {
            exists: Boolean(data),
            data: () => (data ? structuredClone(data) : undefined),
          };
        },
        set(docRef, data) {
          const colName = (docRef as { _collection?: string })._collection || 'trips';
          pendingWrites.push({ col: colName, id: docRef.id, data: structuredClone(data) });
        },
      });
      for (const write of pendingWrites) {
        getCol(write.col).set(write.id, write.data);
      }
      return result;
    },
  };

  return { db, collections };
}

test('Optimistic concurrency (real upsertTripForUser): consecutive saves increment version smoothly (v1 -> v2 -> v3)', async () => {
  const { db, collections } = createInMemoryFirestore();
  const user = { uid: 'user-test-123', role: 'user' as const };
  const stamp = () => 'SERVER_TIMESTAMP';

  // Lần lưu 1: Khởi tạo chuyến ban đầu (chưa có version) -> server cấp v1
  const initialTrip = normalizeTripData({
    id: 'trip-concurrency-1',
    title: 'Tour Miền Trung',
    days: [],
  });
  const res1 = await upsertTripForUser(db, initialTrip, user, stamp);
  assert.equal(res1.status, 'ok');
  if (res1.status === 'ok') assert.equal(res1.version, 1);

  const stored1 = collections.get('trips')?.get('trip-concurrency-1') as unknown as TripData;
  assert.equal(stored1.ownerId, 'user-test-123');

  // Client cập nhật version vào state:
  const clientStateTrip1: TripData = { ...initialTrip, version: 1 };

  // Lần lưu 2: Client gửi lên chuyến kèm version: 1 -> server lên v2
  const updatedTripDay1 = {
    ...clientStateTrip1,
    title: 'Tour Miền Trung (Đã đổi tên)',
  };
  const res2 = await upsertTripForUser(db, updatedTripDay1, user, stamp);
  assert.equal(res2.status, 'ok');
  if (res2.status === 'ok') assert.equal(res2.version, 2);

  // Lần lưu 3: Client gửi lên chuyến kèm version: 2 -> server lên v3
  const updatedTripDay2 = {
    ...updatedTripDay1,
    version: 2,
    destination: 'HUE',
  };
  const res3 = await upsertTripForUser(db, updatedTripDay2, user, stamp);
  assert.equal(res3.status, 'ok');
  if (res3.status === 'ok') assert.equal(res3.version, 3);
});

test('Optimistic concurrency (real upsertTripForUser): stale client version is rejected with 409 conflict', async () => {
  const { db } = createInMemoryFirestore();
  const user = { uid: 'user-test-123', role: 'user' as const };
  const stamp = () => 'SERVER_TIMESTAMP';

  // Khởi tạo chuyến lên v1
  const trip = normalizeTripData({ id: 'trip-conflict-test', title: 'Chuyến gốc' });
  const res1 = await upsertTripForUser(db, trip, user, stamp);
  assert.equal(res1.status, 'ok');
  if (res1.status === 'ok') assert.equal(res1.version, 1);

  // Tab B lưu trước -> lên v2
  const tabBTrip = { ...trip, version: 1, title: 'Tab B cập nhật' };
  const res2 = await upsertTripForUser(db, tabBTrip, user, stamp);
  assert.equal(res2.status, 'ok');
  if (res2.status === 'ok') assert.equal(res2.version, 2);

  // Tab A vẫn giữ v1 gửi lên -> bị từ chối conflict kèm currentVersion = 2
  const tabATripStale = { ...trip, version: 1, title: 'Tab A cố ghi đè với v1' };
  const resConflict = await upsertTripForUser(db, tabATripStale, user, stamp);
  assert.equal(resConflict.status, 'conflict');
  if (resConflict.status === 'conflict') {
    assert.equal(resConflict.currentVersion, 2);
  }
});

test('Authorization (real upsertTripForUser): another non-admin user is forbidden and ownerId cannot be spoofed', async () => {
  const { db, collections } = createInMemoryFirestore();
  const owner = { uid: 'owner-1', role: 'user' as const };
  const attacker = { uid: 'attacker-2', role: 'user' as const };
  const stamp = () => 'SERVER_TIMESTAMP';

  const trip = normalizeTripData({ id: 'trip-owned', title: 'Chuyến riêng tư', ownerId: 'spoofed-owner' });
  const createRes = await upsertTripForUser(db, trip, owner, stamp);
  assert.equal(createRes.status, 'ok');
  const saved = collections.get('trips')?.get('trip-owned');
  assert.equal(saved?.ownerId, 'owner-1', 'Server must ignore client-supplied ownerId on creation');

  const attackRes = await upsertTripForUser(db, { ...trip, title: 'Bị sửa trái phép' }, attacker, stamp);
  assert.equal(attackRes.status, 'forbidden');
});

function validateCost(c: unknown): boolean {
  if (!c || typeof c !== 'object') return false;
  const item = c as Record<string, unknown>;
  const id = typeof item.id === 'string' && item.id.trim();
  const name = typeof item.item === 'string' && item.item.trim();
  const price = typeof item.price === 'string' && item.price.trim();
  return Boolean(id && name && price);
}

test('Admin config: validates referenceCosts schema', () => {
  assert.equal(validateCost({ id: 'cost-1', item: 'Vé Bà Nà', price: '1.250.000 đ' }), true);
  assert.equal(validateCost({ id: 'cost-1', item: '', price: '1.250.000 đ' }), false);
  assert.equal(validateCost({ id: 'cost-1', item: 'Vé Bà Nà', price: '' }), false);
  assert.equal(validateCost(null), false);
});

test('Admin config: whitelist filters conflictChecks keys matching UI and scheduleValidator', () => {
  const allowedConflictKeysSet = new Set<string>(ALLOWED_CONFLICT_CHECK_KEYS);

  const candidateKeys = ['overlapTime', 'openingHoursMismatch', 'arbitraryHackerKey', 'prototypePollution'];
  const filtered = candidateKeys.filter((k) => allowedConflictKeysSet.has(k));
  assert.deepEqual(filtered, ['overlapTime', 'openingHoursMismatch']);
});

test('Admin config: dispatch rules payload passes key validation using canonical keys', () => {
  const allowedConflictKeysSet = new Set<string>(ALLOWED_CONFLICT_CHECK_KEYS);
  const allowedPriorityKeysSet = new Set<string>(ALLOWED_PRIORITY_KEYS);

  const uiRulesPayload = {
    bufferMinutes: '15',
    startHour: '07:30',
    endHour: '21:30',
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
  };

  const validConflictKeys = Object.keys(uiRulesPayload.conflictChecks).filter((k) =>
    allowedConflictKeysSet.has(k),
  );
  assert.equal(validConflictKeys.length, 4);

  const validPriorityKeys = Object.keys(uiRulesPayload.optimizationPriorities).filter((k) =>
    allowedPriorityKeysSet.has(k),
  );
  assert.equal(validPriorityKeys.length, 4);
});

test('In-flight edits are preserved when response only updates version', () => {
  // Client state at request dispatch time (t0)
  const tripSnapshotSent = normalizeTripData({
    id: 'trip-concurrent-edit',
    title: 'Tiêu đề lúc gửi request',
    version: 1,
  });

  // User types while request is in-flight (t1)
  const currentClientTrip = {
    ...tripSnapshotSent,
    title: 'Tiêu đề người dùng vừa gõ thêm trong lúc lưu',
  };

  // Response returns with version: 2
  const serverResponse = { success: true, version: 2 };

  // Applying updater function:
  const updatedTrip = currentClientTrip.id === tripSnapshotSent.id
    ? { ...currentClientTrip, version: serverResponse.version }
    : currentClientTrip;

  assert.equal(updatedTrip.title, 'Tiêu đề người dùng vừa gõ thêm trong lúc lưu', 'In-flight text should not be overwritten');
  assert.equal(updatedTrip.version, 2, 'Version should increment to 2');
});

test('Client 409 recovery correctly extracts trip from server GET /api/trips/:tripId response', () => {
  // Server returns { success: true, trip: { id: '...', ... } }
  const serverResponsePayload = {
    success: true,
    trip: {
      id: 'trip-vietnam-express',
      title: 'Hành trình Miền Trung',
      version: 5,
      days: [],
    },
  };

  // Client recovery logic
  const freshTrip = (serverResponsePayload as any)?.trip || ((serverResponsePayload as any)?.id ? serverResponsePayload : null);
  assert.ok(freshTrip, 'freshTrip should be extracted');
  assert.equal(freshTrip.id, 'trip-vietnam-express');
  assert.equal(freshTrip.version, 5);
});

test('getTripComparableJson excludes version from comparison to avoid autosave loops', () => {
  const tripV1 = normalizeTripData({
    id: 'test-trip-loop',
    title: 'Tour Đà Nẵng',
    days: [],
  });
  tripV1.version = 1;

  const tripV2: TripData = {
    ...tripV1,
    version: 2,
  };

  const comp1 = getTripComparableJson(tripV1);
  const comp2 = getTripComparableJson(tripV2);

  assert.equal(comp1, comp2, 'Changing only version should not alter comparable json');
});

test('Trip switching (A -> edit A -> save -> switch to B -> switch back to A) preserves latest edits and prevents stale overwrite', async () => {
  const { db } = createInMemoryFirestore();
  const user = { uid: 'user-switch-1', role: 'user' as const };
  const stamp = () => 'SERVER_TIMESTAMP';

  const tripA = normalizeTripData({ id: 'trip-A', title: 'Chuyến A gốc', version: 1, days: [] });
  const tripB = normalizeTripData({ id: 'trip-B', title: 'Chuyến B gốc', version: 1, days: [] });
  await upsertTripForUser(db, tripA, user, stamp);
  await upsertTripForUser(db, tripB, user, stamp);

  // Trạng thái client sau loadFromApi
  let trips = [tripA, tripB];
  let activeTrip = tripA;
  const lastSavedContentByTripId: Record<string, string> = {
    [tripA.id]: getTripComparableJson(tripA),
    [tripB.id]: getTripComparableJson(tripB),
  };

  // Helper mô phỏng effect đồng bộ trips từ activeTrip trong App.tsx
  const syncTripsFromActive = (nextActive: TripData) => {
    activeTrip = nextActive;
    trips = trips.map((t) => (t.id === activeTrip.id ? activeTrip : t));
  };

  // 1. Người dùng sửa Chuyến A và lưu thành công lên server
  const editedA = { ...activeTrip, title: 'Chuyến A đã sửa' };
  syncTripsFromActive(editedA);
  const saveRes = await upsertTripForUser(db, editedA, user, stamp);
  assert.equal(saveRes.status, 'ok');
  if (saveRes.status === 'ok') {
    lastSavedContentByTripId[editedA.id] = getTripComparableJson(editedA);
    syncTripsFromActive({ ...activeTrip, version: saveRes.version });
  }

  // 2. Chuyển sang Chuyến B
  const selectedB = trips.find((t) => t.id === 'trip-B')!;
  syncTripsFromActive(selectedB);
  assert.equal(
    getTripComparableJson(activeTrip),
    lastSavedContentByTripId[activeTrip.id],
    'Viewing trip B must not falsely trigger autosave',
  );

  // 3. Quay lại Chuyến A: danh sách trips phải giữ nguyên bản đã sửa & version mới nhất
  const selectedABack = trips.find((t) => t.id === 'trip-A')!;
  syncTripsFromActive(selectedABack);
  assert.equal(activeTrip.title, 'Chuyến A đã sửa');
  assert.equal(activeTrip.version, 2);
  assert.equal(
    getTripComparableJson(activeTrip),
    lastSavedContentByTripId['trip-A'],
    'Returning to trip A must not trigger stale overwrite',
  );
});

test('Optimistic concurrency (real upsertTripForUser): omitting version or sending invalid version on existing trip returns 409 conflict', async () => {
  const { db } = createInMemoryFirestore();
  const user = { uid: 'user-strict-version', role: 'user' as const };
  const stamp = () => 'SERVER_TIMESTAMP';

  const initialTrip = normalizeTripData({ id: 'trip-strict-ver', title: 'Chuyến có phiên bản', days: [] });
  const createRes = await upsertTripForUser(db, initialTrip, user, stamp);
  assert.equal(createRes.status, 'ok');
  if (createRes.status === 'ok') assert.equal(createRes.version, 1);

  // Client omits version -> must be rejected as conflict
  const payloadWithoutVersion = normalizeTripData({ id: 'trip-strict-ver', title: 'Ghi đè thiếu version', days: [] });
  delete payloadWithoutVersion.version;
  const conflictMissing = await upsertTripForUser(db, payloadWithoutVersion, user, stamp);
  assert.equal(conflictMissing.status, 'conflict');
  if (conflictMissing.status === 'conflict') {
    assert.equal(conflictMissing.currentVersion, 1);
  }

  // Client sends non-integer/zero version -> must also be rejected as conflict
  const payloadBadVersion = { ...initialTrip, version: 0 } as TripData;
  const conflictInvalid = await upsertTripForUser(db, payloadBadVersion, user, stamp);
  assert.equal(conflictInvalid.status, 'conflict');
  if (conflictInvalid.status === 'conflict') {
    assert.equal(conflictInvalid.currentVersion, 1);
  }
});

test('computeAuthoritativeTripDerivedFields recomputes budget and member totals ignoring forged client totals', async () => {
  const { db } = createInMemoryFirestore();
  const user = { uid: 'user-authoritative-1', role: 'user' as const };
  const stamp = () => 'SERVER_TIMESTAMP';

  const forgedTrip = normalizeTripData({
    id: 'trip-derived-1',
    title: 'Tour Kiểm Tra Tổng Hợp',
    budgetTotal: 10_000_000,
    budgetUsed: 999, // Forged low value from client
    budgetRemaining: 9_999_001, // Forged value
    membersTotal: 99, // Forged value
    membersOnline: 50,
    membersStatus: '99/99 đã điểm danh',
    days: [
      {
        id: 'day-1',
        dayNumber: 1,
        label: 'Ngày 1',
        date: '2026-08-01',
        title: 'Khởi hành',
        confirmedCount: 0,
        pendingCount: 0,
        activities: [
          {
            id: 'act-1',
            timeStart: '08:00',
            timeEnd: '09:00',
            title: 'Ăn sáng',
            details: '',
            type: 'meal',
            location: 'Đà Nẵng',
            cost: 1_500_000,
            status: 'Hoàn tất',
          },
          {
            id: 'act-2',
            timeStart: '14:00',
            timeEnd: '16:00',
            title: 'Tham quan',
            details: '',
            type: 'sightseeing',
            location: 'Hội An',
            cost: 500_000,
            status: 'Cần xử lý',
          },
        ],
      },
    ],
    invoices: [
      {
        id: 'inv-1',
        title: 'Thuê xe',
        amount: 2_000_000,
        category: 'transport',
        date: '2026-08-01',
      },
    ],
    members: [
      { id: 'm1', name: 'An', role: 'Trưởng đoàn', status: 'online', attendanceStatus: 'Có mặt', avatar: '' },
      { id: 'm2', name: 'Bình', role: 'Thành viên', status: 'offline', attendanceStatus: 'Chờ xác nhận', avatar: '' },
    ],
  });

  const direct = computeAuthoritativeTripDerivedFields(forgedTrip);
  assert.equal(direct.budgetUsed, 4_000_000);
  assert.equal(direct.budgetRemaining, 6_000_000);
  assert.equal(direct.budgetUsedPercent, 40);
  assert.equal(direct.membersTotal, 2);
  assert.equal(direct.membersOnline, 1);
  assert.equal(direct.membersStatus, '1/2 đã điểm danh');
  assert.equal(direct.totalActivities, 2);
  assert.equal(direct.confirmedActivities, 1);
  assert.equal(direct.pendingActivities, 1);

  const upsertRes = await upsertTripForUser(db, forgedTrip, user, stamp);
  assert.equal(upsertRes.status, 'ok');
  if (upsertRes.status === 'ok') {
    assert.equal(upsertRes.trip.budgetUsed, 4_000_000);
    assert.equal(upsertRes.trip.membersTotal, 2);
  }
});

test('upsertTripForUser rejects oversized trip document exceeding MAX_TRIP_DOC_BYTES', async () => {
  const { db } = createInMemoryFirestore();
  const user = { uid: 'user-size-guard', role: 'user' as const };
  const stamp = () => 'SERVER_TIMESTAMP';

  const bigReceipt = 'data:image/png;base64,' + 'A'.repeat(240_000);
  const oversizedTrip = normalizeTripData({
    id: 'trip-oversized',
    title: 'Chuyến quá khổ',
    invoices: Array.from({ length: 5 }, (_, idx) => ({
      id: `inv-big-${idx + 1}`,
      title: `Hóa đơn ${idx + 1}`,
      category: 'hotel',
      amount: 500_000,
      date: '2026-08-01',
      receiptImage: bigReceipt,
    })),
    days: [],
  });

  const res = await upsertTripForUser(db, oversizedTrip, user, stamp);
  assert.equal(res.status, 'too_large');
  if (res.status === 'too_large') {
    assert.ok(res.byteSize > MAX_TRIP_DOC_BYTES);
  }
});


