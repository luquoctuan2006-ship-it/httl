import assert from 'node:assert/strict';
import test from 'node:test';
import { initialTripData } from '../src/data/mockData';
import type { TripData } from '../src/types/travel';
import {
  applyStopStatusUpdate,
  buildRouteProgress,
  estimateRoadDistanceKm,
  estimateSegmentTravelMinutes,
  formatTravelDuration,
} from '../src/utils/routeProgress';

function makeSampleTrip(): TripData {
  const base = structuredClone(initialTripData);
  return {
    ...base,
    id: 'trip-route-test',
    waypoints: [
      {
        id: 'wp-1',
        code: '01',
        name: 'Đà Nẵng',
        status: 'completed',
        lat: 16.0544,
        lng: 108.2022,
        xPercent: 20,
        yPercent: 20,
        arrivalTime: '08:00',
        departureTime: '09:00',
      },
      {
        id: 'wp-2',
        code: '02',
        name: 'Hội An',
        status: 'current',
        lat: 15.8801,
        lng: 108.338,
        xPercent: 50,
        yPercent: 60,
        arrivalTime: '09:45',
        departureTime: '12:00',
      },
      {
        id: 'wp-3',
        code: '03',
        name: 'Huế',
        status: 'pending',
        lat: 16.4637,
        lng: 107.5909,
        xPercent: 80,
        yPercent: 30,
        arrivalTime: '15:00',
        departureTime: '18:00',
      },
    ],
    days: [
      {
        dayIndex: 1,
        dateLabel: 'N1',
        dayName: 'T2',
        dateNum: 1,
        fullDate: 'Ngày 1',
        confirmedCount: 2,
        pendingCount: 0,
        activities: [
          {
            id: 'act-1',
            timeStart: '08:00',
            timeEnd: '09:00',
            title: 'Khởi hành Đà Nẵng',
            location: 'Đà Nẵng',
            status: 'Hoàn tất',
            type: 'transport',
            details: 'Tập trung khởi hành',
            coordinates: { lat: 16.0544, lng: 108.2022 },
          },
          {
            id: 'act-2',
            timeStart: '09:45',
            timeEnd: '12:00',
            title: 'Tham quan Phố cổ Hội An',
            location: 'Hội An',
            status: 'Đang diễn ra',
            type: 'sightseeing',
            details: 'Dạo bộ phố cổ',
            coordinates: { lat: 15.8801, lng: 108.338 },
          },
        ],
      },
      {
        dayIndex: 2,
        dateLabel: 'N2',
        dayName: 'T3',
        dateNum: 2,
        fullDate: 'Ngày 2',
        confirmedCount: 1,
        pendingCount: 0,
        activities: [
          {
            id: 'act-3',
            timeStart: '15:00',
            timeEnd: '18:00',
            title: 'Đại Nội Huế',
            location: 'Huế',
            status: 'Đã xác nhận',
            type: 'sightseeing',
            details: 'Khám phá Hoàng Thành',
            coordinates: { lat: 16.4637, lng: 107.5909 },
          },
        ],
      },
    ],
  };
}

test('estimateRoadDistanceKm and estimateSegmentTravelMinutes compute plausible route metrics', () => {
  const dn = { lat: 16.0544, lng: 108.2022 };
  const ha = { lat: 15.8801, lng: 108.338 };
  const km = estimateRoadDistanceKm(dn, ha);
  assert.ok(km > 20 && km < 40, `Expected Da Nang -> Hoi An road km ~30, got ${km}`);
  const mins = estimateSegmentTravelMinutes(km);
  assert.ok(mins >= 30 && mins <= 75, `Expected travel minutes ~45, got ${mins}`);
  assert.equal(formatTravelDuration(45), '45 phút');
  assert.equal(formatTravelDuration(95), '1g 35p');
});

test('buildRouteProgress separates completed (Hoàn tất) from confirmed (sẵn sàng) activities', () => {
  const trip = makeSampleTrip();
  const progress = buildRouteProgress(trip, 'all');

  assert.equal(progress.totalStops, 3);
  assert.equal(progress.completedStops, 1);
  assert.equal(progress.stopProgressPercent, 33);
  assert.equal(progress.completedActivitiesCount, 1);
  assert.equal(progress.activityProgressPercent, 33);
  assert.equal(progress.confirmedActivitiesCount, 2);
  assert.equal(progress.confirmedActivitiesPercent, 67);
  assert.equal(progress.stops[0].order, 1);
  assert.equal(progress.stops[0].distanceFromPrevKm, 0);
  assert.ok(progress.stops[1].distanceFromPrevKm > 0);
  assert.ok(progress.stops[2].distanceFromPrevKm > 0);
  assert.equal(progress.currentStop?.name, 'Hội An');
  assert.equal(progress.nextStop?.name, 'Huế');
  assert.ok(progress.nextLegDistanceKm > 0);
  assert.ok(progress.nextLegMinutes > 0);
  assert.ok(progress.totalRouteKm > progress.nextLegDistanceKm);
  assert.equal(progress.remainingKm, progress.nextLegDistanceKm);
});

test('buildRouteProgress supports filtering by single dayIndex and handles unlocated stops without fake coordinates', () => {
  const trip = makeSampleTrip();
  trip.days[0].activities.splice(1, 0, {
    id: 'act-unknown',
    timeStart: '09:15',
    timeEnd: '09:40',
    title: 'Ăn sáng quán địa phương không rõ vị trí',
    location: 'Quán ẩn danh XYZ',
    status: 'Chờ duyệt',
    type: 'meal',
    details: 'Chưa có tọa độ',
  });

  const day1 = buildRouteProgress(trip, 1);
  assert.equal(day1.totalStops, 3);
  assert.equal(day1.locatedStopsCount, 2);
  assert.equal(day1.unlocatedStopsCount, 1);
  assert.equal(day1.stops[0].name, 'Đà Nẵng');
  assert.equal(day1.stops[1].name, 'Quán ẩn danh XYZ');
  assert.equal(day1.stops[1].hasCoordinates, false);
  assert.equal(day1.stops[1].lat, null);
  assert.equal(day1.stops[1].lng, null);
  assert.equal(day1.stops[1].distanceFromPrevKm, 0);
  assert.equal(day1.stops[1].travelMinutesFromPrev, 0);
  assert.equal(day1.stops[2].name, 'Hội An');
  assert.equal(
    day1.stops[2].distanceFromPrevKm,
    estimateRoadDistanceKm({ lat: 16.0544, lng: 108.2022 }, { lat: 15.8801, lng: 108.338 }),
  );

  const day2 = buildRouteProgress(trip, 2);
  assert.equal(day2.totalStops, 1);
  assert.equal(day2.stops[0].name, 'Huế');
  assert.equal(day2.stops[0].distanceFromPrevKm, 0);
});

test('applyStopStatusUpdate syncs waypoint status and preserves prior Cần xử lý / Chờ duyệt status on revert', () => {
  const trip = makeSampleTrip();
  trip.days[1].activities[0].status = 'Cần xử lý';

  const initialProgress = buildRouteProgress(trip, 'all');
  const hueStop = initialProgress.stops[2];

  // Setting pending while already Cần xử lý must not overwrite Cần xử lý -> Đã xác nhận
  const stayPending = applyStopStatusUpdate(trip, hueStop, 'pending');
  assert.equal(stayPending.days[1].activities[0].status, 'Cần xử lý');

  // Move Cần xử lý -> current -> completed -> pending should restore Cần xử lý
  const movedCurrent = applyStopStatusUpdate(trip, hueStop, 'current');
  assert.equal(movedCurrent.days[1].activities[0].status, 'Đang diễn ra');
  assert.equal(movedCurrent.days[1].activities[0].previousStatus, 'Cần xử lý');

  const movedCompleted = applyStopStatusUpdate(movedCurrent, buildRouteProgress(movedCurrent, 'all').stops[2], 'completed');
  assert.equal(movedCompleted.days[1].activities[0].status, 'Hoàn tất');
  assert.equal(movedCompleted.days[1].activities[0].previousStatus, 'Cần xử lý');

  const revertedPending = applyStopStatusUpdate(movedCompleted, buildRouteProgress(movedCompleted, 'all').stops[2], 'pending');
  assert.equal(revertedPending.days[1].activities[0].status, 'Cần xử lý');
  assert.equal(revertedPending.days[1].activities[0].previousStatus, undefined);
});

test('buildRouteProgress in all-mode marks legacy hashed/zeroed waypoints as unlocated without breaking route distance', async () => {
  const { computeLegacyHashedCoordinate } = await import('../src/utils/vietnamGeo');
  const unknownStop = 'Điểm dừng chưa định danh ABC';
  const legacyHash = computeLegacyHashedCoordinate(unknownStop)!;
  const trip = makeSampleTrip();
  trip.waypoints.splice(1, 0, {
    id: 'wp-legacy',
    code: '02B',
    name: unknownStop,
    status: 'pending',
    lat: legacyHash.lat,
    lng: legacyHash.lng,
    xPercent: 40,
    yPercent: 40,
    arrivalTime: '09:15',
  });

  const progress = buildRouteProgress(trip, 'all');
  assert.equal(progress.totalStops, 4);
  assert.equal(progress.locatedStopsCount, 3);
  assert.equal(progress.unlocatedStopsCount, 1);
  assert.equal(progress.stops[1].name, unknownStop);
  assert.equal(progress.stops[1].hasCoordinates, false);
  assert.equal(progress.stops[1].lat, null);
  assert.equal(progress.stops[1].lng, null);
  assert.equal(progress.stops[1].distanceFromPrevKm, 0);
  // Distance from Đà Nẵng to Hội An stays accurate across the unlocated stop
  assert.equal(
    progress.stops[2].distanceFromPrevKm,
    estimateRoadDistanceKm({ lat: 16.0544, lng: 108.2022 }, { lat: 15.8801, lng: 108.338 }),
  );
});

test('findMatchingActivityForWaypoint and findMatchingWaypointForActivity share consistent matching semantics', async () => {
  const { findMatchingActivityForWaypoint, findMatchingWaypointForActivity } = await import('../src/utils/tripHelpers');
  const trip = makeSampleTrip();

  for (const wp of trip.waypoints) {
    const matchedAct = findMatchingActivityForWaypoint(trip, wp);
    assert.ok(matchedAct, `Expected matching activity for waypoint ${wp.name}`);
    const reverseWp = findMatchingWaypointForActivity(trip.waypoints, matchedAct.activity);
    assert.equal(reverseWp?.id, wp.id);
  }
});

test('buildRouteProgress uses OSRM road leg distance, duration, and polyline when provided', async () => {
  const { makeRoadLegKey } = await import('../src/utils/routeProgress');
  const trip = makeSampleTrip();

  const dn = { lat: 16.0544, lng: 108.2022 };
  const ha = { lat: 15.8801, lng: 108.338 };
  const hue = { lat: 16.4637, lng: 107.5909 };

  const leg1Key = makeRoadLegKey(dn, ha);
  const leg2Key = makeRoadLegKey(ha, hue);

  const roadLegs = new Map([
    [
      leg1Key,
      {
        fromKey: '16.05440,108.20220',
        toKey: '15.88010,108.33800',
        distanceKm: 29.4,
        durationMinutes: 42,
        coordinates: [
          [16.0544, 108.2022] as [number, number],
          [15.96, 108.27] as [number, number],
          [15.8801, 108.338] as [number, number],
        ],
      },
    ],
  ]);

  const mixedProgress = buildRouteProgress(trip, 'all', roadLegs);
  assert.equal(mixedProgress.routingSource, 'mixed');
  assert.equal(mixedProgress.stops[1].legSource, 'osrm');
  assert.equal(mixedProgress.stops[1].distanceFromPrevKm, 29.4);
  assert.equal(mixedProgress.stops[1].travelMinutesFromPrev, 42);
  assert.equal(mixedProgress.stops[1].legCoordinates?.length, 3);
  assert.equal(mixedProgress.stops[2].legSource, 'estimate');

  const fullRoadLegs = new Map([
    ...roadLegs.entries(),
    [
      leg2Key,
      {
        fromKey: '15.88010,108.33800',
        toKey: '16.46370,107.59090',
        distanceKm: 124.8,
        durationMinutes: 145,
        coordinates: [
          [15.8801, 108.338] as [number, number],
          [16.4637, 107.5909] as [number, number],
        ],
      },
    ],
  ]);

  const osrmProgress = buildRouteProgress(trip, 'all', fullRoadLegs);
  assert.equal(osrmProgress.routingSource, 'osrm');
  assert.equal(osrmProgress.totalRouteKm, 154.2);
  assert.equal(osrmProgress.totalTravelMinutes, 187);
});



