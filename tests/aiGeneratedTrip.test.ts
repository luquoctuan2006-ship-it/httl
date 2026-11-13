import assert from 'node:assert/strict';
import test from 'node:test';
import { createAiRiskAlerts } from '../src/utils/alertDetector';
import { buildAIPlanWaypoints, dedupeWaypointsForMap } from '../src/utils/vietnamGeo';

test('AI waypoints use valid generated coordinates and retain route endpoints', () => {
  const waypoints = buildAIPlanWaypoints('Đà Nẵng', 'Huế', [
    {
      location: 'Bà Nà Hills',
      timeStart: '09:00',
      coordinates: { lat: 15.9977, lng: 107.9964 },
    },
    {
      location: 'Điểm không có tọa độ',
      coordinates: { lat: 91, lng: 181 },
    },
  ]);

  assert.equal(waypoints[0].name, 'Đà Nẵng');
  assert.equal(waypoints.at(-1)?.name, 'Huế');
  assert.deepEqual(
    { lat: waypoints[1].lat, lng: waypoints[1].lng, arrivalTime: waypoints[1].arrivalTime },
    { lat: 15.9977, lng: 107.9964, arrivalTime: '09:00' },
  );
  assert.ok(waypoints.every((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)));
});

test('AI operational risks become visible categorized alerts', () => {
  const alerts = createAiRiskAlerts('trip-ai-1', [
    { title: 'Mưa lớn buổi chiều', level: 'high', advice: 'Chuyển hoạt động ngoài trời vào buổi sáng.' },
    { title: 'Thiếu thời gian di chuyển', level: 'warning', advice: 'Bổ sung thời gian đệm.' },
    { title: '', level: 'error', advice: 'Bỏ qua mục không có tiêu đề.' },
  ]);

  assert.equal(alerts.length, 2);
  assert.equal(alerts[0].severity, 'error');
  assert.equal(alerts[0].category, 'weather');
  assert.equal(alerts[1].severity, 'warning');
  assert.equal(alerts[1].category, 'traffic');
});

test('map markers deduplicate waypoints at the same displayed coordinate', () => {
  const waypoints = buildAIPlanWaypoints('Đà Nẵng', 'Huế', [
    { location: 'Điểm A', coordinates: { lat: 16.05441, lng: 108.20221 } },
    { location: 'Điểm A khác tên', coordinates: { lat: 16.05442, lng: 108.20222 } },
  ]);

  const uniqueMarkers = dedupeWaypointsForMap(waypoints);
  assert.equal(uniqueMarkers.length, 2);
  assert.deepEqual(uniqueMarkers.map((point) => point.name), ['Đà Nẵng', 'Huế']);
});
