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
