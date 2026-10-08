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
