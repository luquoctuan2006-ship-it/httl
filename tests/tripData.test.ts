import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialTripData } from '../src/data/mockData';
import { normalizeTripData } from '../src/data/normalizeTripData';

test('mock trip has a valid day schedule schema', () => {
  assert.equal(initialTripData.days.length, 7);
  assert.ok(initialTripData.days.every((day) => Array.isArray(day.activities)));
  assert.equal(initialTripData.days.flatMap((day) => day.activities).length, initialTripData.totalActivities);
});

test('normalizeTripData repairs corrupted activity fields', () => {
  const corrupted = {
    ...initialTripData,
    days: initialTripData.days.map((day, index) =>
      index === 0 ? { ...day, activities: 'corrupted activities' as unknown as never } : day,
    ),
  };

  const normalized = normalizeTripData(corrupted);

  assert.deepEqual(normalized.days[0].activities, []);
  assert.equal(normalized.days[1].activities.length, 3);
});

test('normalizeTripData sets status to "Chờ duyệt" for corrupted single activity and preserves stable ID', () => {
  const trip = {
    id: 'test-trip-1',
    days: [
      {
        dayIndex: 1,
        activities: [
          {
            // corrupted activity missing required title and invalid times
            notes: 'Ghi chú',
          },
        ],
      },
    ],
  };

  const normalized = normalizeTripData(trip);
  const act = normalized.days[0].activities[0];
  assert.equal(act.id, 'act-1-1');
  assert.equal(act.status, 'Chờ duyệt');
  assert.equal(act.timeStart, '08:00');
  assert.equal(act.timeEnd, '09:30');
});

test('normalizeTripData rejects impossible clocks and out-of-range map coordinates', () => {
  const normalized = normalizeTripData({
    id: 'test-trip-invalid-fields',
    days: [
      {
        dayIndex: 1,
        activities: [
          {
            id: 'act-invalid-clock',
            timeStart: '25:70',
            timeEnd: '26:90',
            title: 'Hoạt động sai giờ',
            location: 'Đà Nẵng',
            status: 'Đã xác nhận',
            type: 'sightseeing',
            coordinates: { lat: 999, lng: 999 },
          },
          {
            id: 'act-reversed-clock',
            timeStart: '12:00',
            timeEnd: '11:00',
            title: 'Hoạt động đảo giờ',
            location: 'Đà Nẵng',
            status: 'Đã xác nhận',
            type: 'sightseeing',
          },
        ],
      },
    ],
    waypoints: [
      null,
      {
        id: 'wp-invalid',
        code: '01',
        name: 'Điểm tọa độ lỗi',
        status: 'not-a-status',
        lat: 91,
        lng: 181,
        xPercent: 120,
        yPercent: -10,
      },
    ],
    weather: {
      temp: 25,
      description: 'Mưa nhẹ',
      rainProb: '15%',
      rainProbTime: '15:00',
      stopForecasts: [
        {
          stopId: 'stop-invalid',
          stopName: 'Tọa độ ngoài biên',
          lat: 999,
          lng: 999,
          temp: 25,
          description: 'Mưa nhẹ',
          rainProb: '15%',
          rainProbTime: '15:00',
        },
      ],
    },
  });

  assert.equal(normalized.days[0].activities[0].status, 'Chờ duyệt');
  assert.equal(normalized.days[0].activities[0].timeStart, '08:00');
  assert.equal(normalized.days[0].activities[0].timeEnd, '09:30');
  assert.equal(normalized.days[0].activities[0].coordinates, undefined);
  assert.equal(normalized.days[0].activities[1].status, 'Chờ duyệt');
  assert.equal(normalized.waypoints.length, 1);
  assert.equal(normalized.waypoints[0].status, 'pending');
  assert.equal(normalized.waypoints[0].lat, 0);
  assert.equal(normalized.waypoints[0].lng, 0);
  assert.equal(normalized.waypoints[0].xPercent, 100);
  assert.equal(normalized.waypoints[0].yPercent, 0);
  assert.equal(normalized.weather.stopForecasts, undefined);
});

test('normalizeTripData preserves LiveRouteMap telematics and weather fields', () => {
  const trip = {
    id: 'test-trip-live',
    weather: {
      temp: 32,
      description: 'Mưa rào',
      rainProb: '65%',
      rainProbTime: '15:30',
      humidity: 82,
      windSpeed: '18 km/h',
      isLive: true,
      lastFetched: '14:00',
    },
    telematics: {
      from: 'Đà Nẵng',
      to: 'Hội An',
      vehicleType: 'Xe Limousine 16 chỗ',
      licensePlate: '43B-999.88',
      driver: 'Lê Văn C',
      driverPhone: '0912 345 678',
      driverMemberId: 'mem-driver-01',
      passengerCount: 12,
    },
  };

  const normalized = normalizeTripData(trip);
  assert.equal(normalized.weather.humidity, 82);
  assert.equal(normalized.weather.windSpeed, '18 km/h');
  assert.equal(normalized.weather.isLive, true);
  assert.equal(normalized.weather.lastFetched, '14:00');

  assert.equal(normalized.telematics.licensePlate, '43B-999.88');
  assert.equal(normalized.telematics.driverMemberId, 'mem-driver-01');
  assert.equal(normalized.telematics.driver, 'Lê Văn C');
});

test('normalizeTripData does not borrow initialTripData for empty members, waypoints, alerts or budgetUsed', () => {
  const trip = {
    id: 'test-trip-clean',
    title: 'Tour mới tạo',
    members: [],
    waypoints: [],
    alerts: [],
    budgetUsed: 0,
    budgetTotal: 10000000,
  };

  const normalized = normalizeTripData(trip);
  assert.deepEqual(normalized.members, []);
  assert.deepEqual(normalized.waypoints, []);
  assert.deepEqual(normalized.alerts, []);
  assert.equal(normalized.budgetUsed, 0);
  assert.equal(normalized.budgetRemaining, 10000000);
});

test('normalizeTripData does not invent default version, fake weather or fake aiConfidence', () => {
  const trip = {
    id: 'test-trip-no-version',
    title: 'Tour mới',
  };

  const normalized = normalizeTripData(trip);
  assert.equal(normalized.version, undefined);
  assert.equal(normalized.weather.description, '');
  assert.equal(normalized.weather.temp, 0);
  assert.equal(normalized.weather.rainProb, '');
  assert.equal(normalized.aiConfidence, '');
});

test('normalizeTripData scrubs legacy hashed coordinates on unknown places while keeping valid coordinates', async () => {
  const { computeLegacyHashedCoordinate, isLegacyHashedCoordinate } = await import('../src/utils/vietnamGeo');
  const unknownPlace = 'Quán ẩn danh XYZ cũ';
  const legacyHash = computeLegacyHashedCoordinate(unknownPlace)!;
  assert.ok(legacyHash);
  assert.equal(isLegacyHashedCoordinate(unknownPlace, legacyHash.lat, legacyHash.lng), true);
  // Real coordinates for Đà Nẵng must never be flagged as legacy hash
  assert.equal(isLegacyHashedCoordinate('Đà Nẵng', 16.0544, 108.2022), false);

  const normalized = normalizeTripData({
    id: 'test-legacy-hash-scrub',
    waypoints: [
      { id: 'wp-legacy', code: '01', name: unknownPlace, status: 'pending', lat: legacyHash.lat, lng: legacyHash.lng, xPercent: 50, yPercent: 50 },
      { id: 'wp-real', code: '02', name: 'Đà Nẵng', status: 'current', lat: 16.0544, lng: 108.2022, xPercent: 70, yPercent: 70 },
    ],
    days: [
      {
        dayIndex: 1,
        activities: [
          { id: 'act-1', timeStart: '08:00', timeEnd: '09:00', title: 'Ăn sáng', location: unknownPlace, status: 'Đã xác nhận', type: 'meal', coordinates: legacyHash },
          { id: 'act-2', timeStart: '10:00', timeEnd: '12:00', title: 'Cầu Rồng', location: 'Đà Nẵng', status: 'Đã xác nhận', type: 'sightseeing', coordinates: { lat: 16.0544, lng: 108.2022 } },
        ],
      },
    ],
  });

  assert.equal(normalized.days[0].activities[0].coordinates, undefined);
  assert.deepEqual(normalized.days[0].activities[1].coordinates, { lat: 16.0544, lng: 108.2022 });
  assert.equal(normalized.waypoints[0].lat, 0);
  assert.equal(normalized.waypoints[0].lng, 0);
  assert.equal(normalized.waypoints[1].lat, 16.0544);
  assert.equal(normalized.waypoints[1].lng, 108.2022);
});

test('normalizeTripSummary retains summary metrics while omitting heavy nested arrays', async () => {
  const { normalizeTripSummary } = await import('../src/data/normalizeTripData');

  const summary = normalizeTripSummary({
    ...initialTripData,
    id: 'summary-trip-1',
    version: 4,
  });

  assert.equal(summary.id, 'summary-trip-1');
  assert.equal(summary.isSummary, true);
  assert.equal(summary.version, 4);
  assert.equal(summary.title, initialTripData.title);
  assert.equal(summary.totalDays, initialTripData.totalDays);
  assert.equal(summary.totalActivities, initialTripData.totalActivities);
  assert.equal(summary.budgetTotal, initialTripData.budgetTotal);
  assert.deepEqual(summary.days, []);
  assert.deepEqual(summary.waypoints, []);
  assert.deepEqual(summary.members, []);
});

test('offlineStorage preserves full cached trip against matching-version summary and ignores summary pending syncs', async () => {
  const { normalizeTripSummary } = await import('../src/data/normalizeTripData');
  const {
    loadOfflineTripsCache,
    markTripPendingOfflineSyncDetailed,
    saveOfflineTripsCacheDetailed,
  } = await import('../src/utils/offlineStorage');

  const store = new Map<string, string>();
  const memoryStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  };

  const fullTrip = normalizeTripData({ ...initialTripData, id: 'trip-cached-1', version: 2 });
  saveOfflineTripsCacheDetailed('user-1', [fullTrip], fullTrip.id, [], memoryStorage);

  const sameVersionSummary = normalizeTripSummary({ ...fullTrip, version: 2 });
  saveOfflineTripsCacheDetailed('user-1', [sameVersionSummary], null, undefined, memoryStorage);

  const reloaded = loadOfflineTripsCache('user-1', memoryStorage);
  assert.ok(reloaded);
  assert.equal(reloaded.trips.length, 1);
  assert.equal(reloaded.trips[0].isSummary, undefined);
  assert.equal(reloaded.trips[0].days.length, fullTrip.days.length);

  const pendingAttempt = markTripPendingOfflineSyncDetailed('user-1', sameVersionSummary, memoryStorage);
  assert.equal(pendingAttempt.cache, null);
});


