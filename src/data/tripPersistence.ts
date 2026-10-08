import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { TripData } from '../types/travel';

export interface TripPersistenceStore {
  load(): Promise<TripData | null>;
  save(trip: TripData): Promise<void>;
}

export async function createTripPersistenceStore(filePath: string): Promise<TripPersistenceStore> {
  await mkdir(path.dirname(filePath), { recursive: true });

  let currentTrip: TripData | null = null;

  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as TripData;
    currentTrip = parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`[Trip persistence] Unable to read ${filePath}:`, error);
    }
  }

  return {
    async load() {
      if (currentTrip) return currentTrip;

      try {
        const raw = await readFile(filePath, 'utf8');
        currentTrip = JSON.parse(raw) as TripData;
        return currentTrip;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          console.warn(`[Trip persistence] Unable to load ${filePath}:`, error);
        }
        return null;
      }
    },
    async save(trip) {
      const temporaryPath = `${filePath}.${process.pid}.tmp`;
      await writeFile(temporaryPath, JSON.stringify(trip, null, 2), 'utf8');
      await rename(temporaryPath, filePath);
      currentTrip = trip;
    },
  };
}
