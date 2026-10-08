import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { initialTripData } from '../src/data/mockData';
import { createTripPersistenceStore } from '../src/data/tripPersistence';

test('trip persistence saves and restores a trip across store instances', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'voyager-trip-'));
  const filePath = path.join(directory, 'trip-persistence.json');

  try {
    const updatedTrip = {
      ...initialTripData,
      title: 'Chuyến đi lưu trữ mới',
      currentDay: 2,
    };
    const firstStore = await createTripPersistenceStore(filePath);
    await firstStore.save(updatedTrip);

    const secondStore = await createTripPersistenceStore(filePath);
    const restoredTrip = await secondStore.load();

    assert.deepEqual(restoredTrip, updatedTrip);
    assert.deepEqual(JSON.parse(await readFile(filePath, 'utf8')), updatedTrip);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
