import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AuthSessionError,
  PayloadTooLargeError,
  SingleFlightQueue,
  buildTripScheduleSignature,
  clearPendingRegisteredDisplayName,
  formatTripDatesRange,
  getPendingRegisteredDisplayName,
  mapFirebaseAuthError,
  mergeAlertScanIntoTrip,
  offloadTripReceipts,
  parseTripDatesRange,
  setPendingRegisteredDisplayName,
  validateActivityTimeRange,
  validateTripDateRange,
} from '../src/utils/trip/tripSyncHelpers';
import {
  isStorageQuotaError,
  markTripPendingOfflineSyncDetailed,
  saveOfflineTripsCacheDetailed,
} from '../src/utils/client/offlineStorage';
import { normalizeTripData } from '../src/utils/trip/normalizeTripData';

test('SingleFlightQueue serializes concurrent tasks so they never overlap', async () => {
  const queue = new SingleFlightQueue();
  let inFlight = 0;
  let maxConcurrent = 0;
  const order: string[] = [];

  const runTask = (label: string, delayMs: number) =>
    queue.enqueue(async () => {
      inFlight += 1;
      maxConcurrent = Math.max(maxConcurrent, inFlight);
      assert.equal(queue.isBusy, true);
      await new Promise((r) => setTimeout(r, delayMs));
      order.push(label);
      inFlight -= 1;
      return label;
    });

  const results = await Promise.all([runTask('first', 25), runTask('second', 10), runTask('third', 5)]);
  assert.deepEqual(results, ['first', 'second', 'third']);
  assert.deepEqual(order, ['first', 'second', 'third']);
  assert.equal(maxConcurrent, 1);
  assert.equal(queue.isBusy, false);
});

test('mergeAlertScanIntoTrip merges only alerts, weather, and version while preserving local edits', () => {
  const localTrip = normalizeTripData({
    id: 'trip-1',
    title: 'Tên tour vừa sửa cục bộ',
    dates: '10/10/2026 - 12/10/2026',
    version: 3,
    days: [{ dayIndex: 1, activities: [] }],
    alerts: [{ id: 'old-a', severity: 'low', title: 'Cũ', description: 'Cũ', category: 'schedule' }],
    weather: { temp: 25, description: 'Ít mây' },
  });

  const scannedTrip = normalizeTripData({
    id: 'trip-1',
    title: 'Tên tour cũ trên máy chủ',
    dates: '10/10/2026 - 12/10/2026',
    version: 4,
    days: [{ dayIndex: 1, activities: [] }],
    alerts: [{ id: 'new-a', severity: 'high', title: 'Mưa lớn', description: 'Đèo dốc trơn', category: 'weather' }],
    weather: { temp: 21, description: 'Mưa rào' },
  });

  const merged = mergeAlertScanIntoTrip(localTrip, scannedTrip);
  assert.equal(merged.title, 'Tên tour vừa sửa cục bộ');
  assert.equal(merged.alerts.length, 1);
  assert.equal(merged.alerts[0].id, 'new-a');
  assert.equal(merged.weather.temp, 21);
  assert.equal(merged.weather.description, 'Mưa rào');
  assert.equal(merged.version, 4);
});

test('offloadTripReceipts replaces inline data URLs with receiptId when upload succeeds', async () => {
  const trip = normalizeTripData({
    id: 'trip-rcpt',
    title: 'Tour Demo',
    days: [{ dayIndex: 1, activities: [] }],
    invoices: [
      {
        id: 'inv-1',
        title: 'Xăng xe',
        category: 'transport',
        amount: 500000,
        date: '2026-10-12',
        receiptImage: 'data:image/jpeg;base64,/9j/4AAQ',
      },
      {
        id: 'inv-2',
        title: 'Ăn trưa',
        category: 'meal',
        amount: 300000,
        date: '2026-10-12',
      },
    ],
  });

  const offloaded = await offloadTripReceipts(trip, async (_tripId, dataUrl) => {
    assert.equal(dataUrl.startsWith('data:image/'), true);
    return 'rcpt-uploaded-001';
  });

  assert.equal(offloaded.invoices?.[0].receiptId, 'rcpt-uploaded-001');
  assert.equal(offloaded.invoices?.[0].receiptImage, undefined);
  assert.equal(offloaded.invoices?.[1].receiptId, undefined);
});

test('parses, validates, and formats trip date ranges properly', () => {
  assert.deepEqual(parseTripDatesRange('12/10/2026 - 15/10/2026', 4), {
    startDate: '2026-10-12',
    endDate: '2026-10-15',
  });
  assert.deepEqual(parseTripDatesRange('12–18 THG 10, 2026', 7), {
    startDate: '2026-10-12',
    endDate: '2026-10-18',
  });
  assert.match(validateTripDateRange('2026-10-15', '2026-10-12') || '', /Ngày kết thúc/);
  assert.equal(validateTripDateRange('2026-10-12', '2026-10-15'), null);
  assert.equal(formatTripDatesRange('2026-10-12', '2026-10-15'), '12/10/2026 - 15/10/2026');
});

test('validates activity timeStart < timeEnd', () => {
  assert.equal(validateActivityTimeRange('14:00', '10:00'), 'Giờ kết thúc phải sau giờ bắt đầu.');
  assert.equal(validateActivityTimeRange('09:00', '09:00'), 'Giờ kết thúc phải sau giờ bắt đầu.');
  assert.equal(validateActivityTimeRange('09:00', '11:30'), null);
});

test('maps Firebase auth error codes to specific Vietnamese messages and creates PayloadTooLargeError (413)', () => {
  assert.match(mapFirebaseAuthError('auth/email-already-in-use', 'register'), /đã được đăng ký/);
  assert.match(mapFirebaseAuthError('auth/wrong-password', 'login'), /không chính xác/);
  assert.match(mapFirebaseAuthError('auth/too-many-requests', 'login'), /quá nhiều lần/);
  assert.match(mapFirebaseAuthError('auth/user-disabled', 'login'), /tạm khóa/);

  const err = new PayloadTooLargeError();
  assert.equal(err.status, 413);
  assert.match(err.message, /900KB/);
});

test('AuthSessionError carries HTTP status and pending display name cache works for registration flow', () => {
  const err401 = new AuthSessionError(401);
  assert.equal(err401.status, 401);
  assert.equal(err401.name, 'AuthSessionError');

  setPendingRegisteredDisplayName('uid-reg-1', '  Nguyễn Văn An  ');
  assert.equal(getPendingRegisteredDisplayName('uid-reg-1'), 'Nguyễn Văn An');
  clearPendingRegisteredDisplayName('uid-reg-1');
  assert.equal(getPendingRegisteredDisplayName('uid-reg-1'), undefined);
});

test('buildTripScheduleSignature changes when trip id, activity time/cost, or alerts change', () => {
  const tripA = normalizeTripData({
    id: 'trip-a',
    title: 'Đà Lạt',
    days: [
      {
        dayIndex: 1,
        activities: [{ id: 'act-1', timeStart: '08:00', timeEnd: '09:30', title: 'Đón đoàn', cost: 100000 }],
      },
    ],
    alerts: [],
  });
  const tripAEditedTime = normalizeTripData({
    ...tripA,
    days: [
      {
        dayIndex: 1,
        activities: [{ id: 'act-1', timeStart: '08:30', timeEnd: '10:00', title: 'Đón đoàn', cost: 100000 }],
      },
    ],
  });
  const tripB = normalizeTripData({ ...tripA, id: 'trip-b' });

  assert.notEqual(buildTripScheduleSignature(tripA), buildTripScheduleSignature(tripAEditedTime));
  assert.notEqual(buildTripScheduleSignature(tripA), buildTripScheduleSignature(tripB));
  assert.equal(buildTripScheduleSignature(null), '');
});

test('offlineStorage detailed helpers flag quotaExceeded cleanly when localStorage is full', () => {
  const quotaErr = Object.assign(new Error('Quota exceeded'), { name: 'QuotaExceededError', code: 22 });
  assert.equal(isStorageQuotaError(quotaErr), true);
  assert.equal(isStorageQuotaError(new Error('Other error')), false);

  const mockFullStorage = {
    getItem: () => null,
    setItem: () => {
      throw quotaErr;
    },
    removeItem: () => {},
  };

  const sampleTrip = normalizeTripData({ id: 'trip-q', title: 'Test Quota', days: [{ dayIndex: 1, activities: [] }] });
  const saveRes = saveOfflineTripsCacheDetailed('user-1', [sampleTrip], 'trip-q', [], mockFullStorage);
  assert.equal(saveRes.cache, null);
  assert.equal(saveRes.quotaExceeded, true);

  const markRes = markTripPendingOfflineSyncDetailed('user-1', sampleTrip, mockFullStorage);
  assert.equal(markRes.cache, null);
  assert.equal(markRes.quotaExceeded, true);
});

test('offlineStorage preserves full pending trip when server returns newer summary version', () => {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  };

  const editedOffline = normalizeTripData({
    id: 'trip-pending',
    title: 'Bản sửa ngoại tuyến mới nhất',
    version: 2,
    days: [{ dayIndex: 1, activities: [{ id: 'a1', title: 'Hoạt động offline', timeStart: '09:00', timeEnd: '10:00', location: 'Huế' }] }],
  });
  markTripPendingOfflineSyncDetailed('user-1', editedOffline, mockStorage);

  const serverNewerSummary = {
    id: 'trip-pending',
    title: 'Bản trên server',
    version: 5,
    isSummary: true,
    days: [],
  } as unknown as ReturnType<typeof normalizeTripData>;

  const merged = saveOfflineTripsCacheDetailed('user-1', [serverNewerSummary], 'trip-pending', ['trip-pending'], mockStorage);
  assert.ok(merged.cache);
  assert.equal(merged.cache.trips[0].isSummary, undefined);
  assert.equal(merged.cache.trips[0].title, 'Bản sửa ngoại tuyến mới nhất');
  assert.equal(merged.cache.trips[0].days[0].activities.length, 1);
  assert.deepEqual(merged.cache.pendingSyncIds, ['trip-pending']);
});

