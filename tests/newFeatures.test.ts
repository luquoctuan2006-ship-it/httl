import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeTripData } from '../src/data/normalizeTripData';
import {
  buildExpenseReportCsv,
  cloneTripForTemplate,
  findMatchingActivityForWaypoint,
} from '../src/utils/tripHelpers';
import {
  clearTripPendingOfflineSync,
  loadOfflineTripsCache,
  markTripPendingOfflineSyncDetailed,
  saveOfflineTripsCacheDetailed,
  type StorageLike,
} from '../src/utils/offlineStorage';
import type { TripData } from '../src/types/travel';

function createMemoryStorage(): StorageLike {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
}

function createSampleTrip(): TripData {
  return normalizeTripData({
    id: 'trip-base-1',
    ownerId: 'uid-old',
    code: 'DL-2026',
    title: 'Đà Lạt 3N2Đ',
    status: 'Đang vận hành',
    budgetTotal: 15000000,
    budgetUsed: 4200000,
    alerts: [
      {
        id: 'alert-1',
        type: 'weather',
        title: 'Mưa lớn',
        detail: 'Mưa rào',
        severity: 'high',
      },
    ],
    invoices: [
      {
        id: 'inv-1',
        title: 'Tiền xăng xe',
        amount: 1200000,
        category: 'transport',
        date: '2026-06-01',
        vendor: 'Petrolimex',
        invoiceNumber: 'HD-01',
        receiptImage: 'data:image/jpeg;base64,abc123',
        updatedAt: '2026-06-01T10:00:00.000Z',
      },
    ],
    telematics: {
      vehicle: 'Hyundai Solati 16 chỗ',
      vehicleId: 'veh-solati-01',
      licensePlate: '51B-999.99',
      driver: 'Nguyễn Văn A',
      driverPhone: '0901234567',
      driverMemberId: 'mem-driver-1',
      currentLat: 11.9404,
      currentLng: 108.4583,
      gpsUpdatedAt: '2026-06-01T11:30:00.000Z',
      gpsSource: 'gps',
      speedKmh: 48,
    },
    waypoints: [
      {
        id: 'wp-1',
        name: 'Quảng trường Lâm Viên',
        code: 'WP-LV',
        arrivalTime: '09:00',
        status: 'current',
        lat: 11.9395,
        lng: 108.4453,
        xPercent: 50,
        yPercent: 50,
      },
    ],
    members: [
      {
        id: 'mem-driver-1',
        name: 'Nguyễn Văn A',
        role: 'Tài xế',
        phone: '0901234567',
        status: 'online',
        attendanceStatus: 'Có mặt',
      },
    ],
    days: [
      {
        dayIndex: 1,
        dateLabel: 'N1',
        dayName: 'T6',
        dateNum: 1,
        fullDate: '01/06/2026',
        confirmedCount: 1,
        pendingCount: 0,
        activities: [
          {
            id: 'act-1',
            timeStart: '08:30',
            timeEnd: '10:30',
            title: 'Check-in Quảng trường',
            location: 'Quảng trường Lâm Viên',
            type: 'Tham quan',
            status: 'Hoàn tất',
            cost: 500000,
            coordinates: { lat: 11.9396, lng: 108.4454 },
          },
        ],
      },
    ],
    version: 7,
  });
}

test('normalizeTripData preserves valid GPS telematics and drops invalid coords', () => {
  const valid = createSampleTrip();
  assert.equal(valid.telematics.vehicleId, 'veh-solati-01');
  assert.equal(valid.telematics.currentLat, 11.9404);
  assert.equal(valid.telematics.currentLng, 108.4583);
  assert.equal(valid.telematics.gpsSource, 'gps');
  assert.equal(valid.telematics.speedKmh, 48);

  const corrupted = normalizeTripData({
    ...valid,
    telematics: {
      ...valid.telematics,
      currentLat: 999,
      currentLng: -500,
      gpsSource: 'fake_source',
      speedKmh: -20,
    },
  });
  assert.equal(corrupted.telematics.currentLat, undefined);
  assert.equal(corrupted.telematics.currentLng, undefined);
  assert.equal(corrupted.telematics.gpsSource, undefined);
  assert.equal(corrupted.telematics.speedKmh, undefined);
});

test('normalizeTripData preserves safe invoice receiptImage and rejects unsafe/oversized strings', () => {
  const trip = createSampleTrip();
  assert.equal(trip.invoices?.[0]?.receiptImage, 'data:image/jpeg;base64,abc123');
  assert.equal(trip.invoices?.[0]?.updatedAt, '2026-06-01T10:00:00.000Z');

  const unsafe = normalizeTripData({
    ...trip,
    invoices: [
      {
        id: 'inv-bad',
        title: 'Hóa đơn lỗi',
        amount: 100000,
        category: 'meal',
        date: '2026-06-01',
        receiptImage: 'javascript:alert(1)',
      },
    ],
  });
  assert.equal(unsafe.invoices?.[0]?.receiptImage, undefined);
});

test('cloneTripForTemplate resets operational state, alerts, invoices, GPS, and version', () => {
  const source = createSampleTrip();
  const cloned = cloneTripForTemplate(source, 'uid-new');

  assert.notEqual(cloned.id, source.id);
  assert.equal(cloned.ownerId, 'uid-new');
  assert.equal(cloned.title, 'Đà Lạt 3N2Đ (Bản sao)');
  assert.equal(cloned.status, 'Chuẩn bị');
  assert.equal(cloned.alerts.length, 0);
  assert.equal(cloned.invoices?.length, 0);
  assert.equal(cloned.budgetUsed, 0);
  assert.equal(cloned.budgetRemaining, source.budgetTotal);
  assert.equal(cloned.telematics.currentLat, undefined);
  assert.equal(cloned.version, undefined);
  assert.equal(cloned.days[0].activities[0].status, 'Đã xác nhận');
  assert.equal(cloned.members[0].attendanceStatus, 'Chưa điểm danh');
});

test('findMatchingActivityForWaypoint matches location/name and coordinates cleanly', () => {
  const trip = createSampleTrip();
  const matchByName = findMatchingActivityForWaypoint(trip, trip.waypoints[0]);
  assert.ok(matchByName);
  assert.equal(matchByName.dayIndex, 1);
  assert.equal(matchByName.activity.id, 'act-1');

  const matchByCoords = findMatchingActivityForWaypoint(trip, {
    id: 'wp-coord',
    name: 'Tên khác hoàn toàn',
    code: 'WP-99',
    arrivalTime: '09:15',
    status: 'pending',
    lat: 11.94,
    lng: 108.445,
    xPercent: 50,
    yPercent: 50,
  });
  assert.ok(matchByCoords);
  assert.equal(matchByCoords.activity.id, 'act-1');

  const noMatch = findMatchingActivityForWaypoint(trip, {
    id: 'wp-far',
    name: 'Hà Nội',
    code: 'WP-HN',
    arrivalTime: '12:00',
    status: 'pending',
    lat: 21.0285,
    lng: 105.8542,
    xPercent: 10,
    yPercent: 10,
  });
  assert.equal(noMatch, null);
});

test('buildExpenseReportCsv outputs UTF-8 BOM CSV with invoice & activity totals', () => {
  const trip = createSampleTrip();
  const csv = buildExpenseReportCsv(trip);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"Tiền xăng xe"'));
  assert.ok(csv.includes('"Có ảnh đính kèm"'));
  assert.ok(csv.includes('"Check-in Quảng trường"'));
  assert.ok(csv.includes('"1700000"'));
});

test('offlineStorage caches trips per user and tracks pending sync IDs cleanly', () => {
  const storage = createMemoryStorage();
  const trip = createSampleTrip();

  const saved = saveOfflineTripsCacheDetailed('user-123', [trip], trip.id, undefined, storage).cache;
  assert.ok(saved);
  assert.equal(saved.trips.length, 1);
  assert.equal(saved.pendingSyncIds.length, 0);

  const modifiedTrip = { ...trip, title: 'Đà Lạt 3N2Đ (Offline Edit)' };
  const marked = markTripPendingOfflineSyncDetailed('user-123', modifiedTrip, storage).cache;
  assert.ok(marked);
  assert.deepEqual(marked.pendingSyncIds, [trip.id]);

  const reloaded = loadOfflineTripsCache('user-123', storage);
  assert.ok(reloaded);
  assert.equal(reloaded.trips[0].title, 'Đà Lạt 3N2Đ (Offline Edit)');
  assert.deepEqual(reloaded.pendingSyncIds, [trip.id]);

  const cleared = clearTripPendingOfflineSync('user-123', trip.id, storage);
  assert.ok(cleared);
  assert.deepEqual(cleared.pendingSyncIds, []);
});
