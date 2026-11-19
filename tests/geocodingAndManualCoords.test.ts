import assert from 'node:assert/strict';
import test from 'node:test';
import { buildManualTrip } from '../src/components/modals/trip-planner/buildManualTrip';
import { resolveActivityCoordinatesWithFallback } from '../src/components/modals/trip-planner/helpers';
import { normalizeTripData } from '../src/utils/trip/normalizeTripData';
import { searchPlaces } from '../src/server/routes/routing';
import { buildDynamicWaypoints, searchLocalPlaces } from '../src/utils/route/vietnamGeo';

test('searchLocalPlaces matches accented and unaccented Vietnamese queries', () => {
  const accented = searchLocalPlaces('Đà Nẵng');
  const unaccented = searchLocalPlaces('da nang');
  assert.ok(accented.length > 0);
  assert.equal(accented[0].name, 'Đà Nẵng');
  assert.ok(unaccented.length > 0);
  assert.equal(unaccented[0].name, 'Đà Nẵng');
  assert.equal(searchLocalPlaces('a').length, 0);
});

test('searchPlaces validates query length, queries Nominatim with caching, and handles global fallback', async () => {
  const shortRes = await searchPlaces('a');
  assert.equal(shortRes.status, 400);

  let fetchCount = 0;
  const mockFetch = (async (input: RequestInfo | URL) => {
    fetchCount += 1;
    const url = String(input);
    if (url.includes('countrycodes=vn')) {
      return new Response(
        JSON.stringify([
          {
            place_id: 101,
            name: 'Nhà hàng Bé Đen',
            display_name: 'Nhà hàng Bé Đen, Thị trấn Lăng Cô, Huyện Phú Lộc, Thừa Thiên Huế, Việt Nam',
            lat: '16.2367123',
            lon: '108.0885456',
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;

  const first = await searchPlaces('Nhà hàng Bé Đen Lăng Cô', { fetchImpl: mockFetch });
  assert.equal(first.status, 200);
  if (first.status === 200) {
    assert.equal(first.cached, false);
    assert.equal(first.source, 'osm');
    assert.equal(first.results.length, 1);
    assert.equal(first.results[0].name, 'Nhà hàng Bé Đen');
    assert.equal(first.results[0].lat, 16.23671);
    assert.equal(first.results[0].lng, 108.08855);
  }
  assert.equal(fetchCount, 1);

  const second = await searchPlaces('nhà hàng bé đen lăng cô', { fetchImpl: mockFetch });
  assert.equal(second.status, 200);
  if (second.status === 200) {
    assert.equal(second.cached, true);
    assert.equal(second.results[0].name, 'Nhà hàng Bé Đen');
  }
  assert.equal(fetchCount, 1);
});

test('searchPlaces falls back to local vietnamGeo when Nominatim fails', async () => {
  const failingFetch = (async () => {
    throw new Error('Network unavailable');
  }) as typeof fetch;

  const res = await searchPlaces('ninh binh', { fetchImpl: failingFetch, bypassCache: true });
  assert.equal(res.status, 200);
  if (res.status === 200) {
    assert.equal(res.source, 'local');
    assert.ok(res.results.some((item) => item.name === 'Ninh Bình'));
  }
});

test('buildDynamicWaypoints and buildManualTrip preserve custom OSM/manual coordinates outside vietnamGeo', () => {
  const customCoords = { lat: 16.23671, lng: 108.08855 }; // Lăng Cô - không nằm trong vietnamGeo
  const intlCoords = { lat: 1.2834, lng: 103.8607 }; // Singapore - ngoài bounding box VN cũ

  const resolvedIntl = resolveActivityCoordinatesWithFallback('Marina Bay Sands', 'Check-in', intlCoords);
  assert.deepEqual(resolvedIntl, intlCoords);

  const waypoints = buildDynamicWaypoints('Đà Nẵng', 'Huế', [
    { location: 'Nhà hàng Bé Đen, Phú Lộc', coordinates: customCoords },
  ]);
  assert.equal(waypoints.length, 3);
  assert.equal(waypoints[1].name, 'Nhà hàng Bé Đen, Phú Lộc');
  assert.equal(waypoints[1].lat, Number(customCoords.lat.toFixed(4)));
  assert.equal(waypoints[1].lng, Number(customCoords.lng.toFixed(4)));

  const trip = buildManualTrip({
    tripTitle: 'Tour Huế - Lăng Cô',
    tripCode: 'hue-lc-01',
    origin: 'Đà Nẵng',
    destination: 'Huế',
    startDate: '2026-12-01',
    totalDays: 1,
    vehicle: 'Xe 16 chỗ',
    membersCount: 6,
    budgetEstimated: 8000000,
    totalCalculatedCost: 1200000,
    totalActivitiesCount: 1,
    manualDays: [
      {
        dayIndex: 1,
        dateLabel: 'Ngày 1',
        dayName: 'N1',
        dateNum: 1,
        fullDate: 'Ngày 1: Lăng Cô',
        confirmedCount: 1,
        pendingCount: 0,
        dispatcherNote: '',
        activities: [
          {
            id: 'act-langco-1',
            timeStart: '11:30',
            timeEnd: '13:00',
            title: 'Ăn trưa hải sản',
            location: 'Nhà hàng Bé Đen, Phú Lộc',
            status: 'Đã xác nhận',
            type: 'meal',
            details: 'Bàn đặt trước',
            cost: 1200000,
            coordinates: customCoords,
          },
        ],
      },
    ],
  });

  assert.deepEqual(trip.days[0].activities[0].coordinates, customCoords);
  assert.ok(trip.waypoints.some((wp) => wp.name === 'Nhà hàng Bé Đen, Phú Lộc'));
  assert.ok(trip.totalKm > 50);

  const normalized = normalizeTripData(trip);
  assert.deepEqual(normalized.days[0].activities[0].coordinates, customCoords);
});
