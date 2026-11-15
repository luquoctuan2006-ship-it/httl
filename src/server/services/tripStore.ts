import type { DecodedIdToken } from 'firebase-admin/auth';
import { FieldValue, type Firestore, type Query, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { normalizeTripData, normalizeTripSummary } from '../../data/normalizeTripData';
import type { TripData } from '../../types/travel';
import { generateTripJoinCode, isValidJoinCodeFormat, normalizeJoinCode } from '../../utils/tripJoinHelpers';
import { isAdminUser } from '../../utils/tripRepository';

export const TRIP_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

const TRIP_SUMMARY_FIELDS = [
  'id',
  'ownerId',
  'joinCode',
  'joinCodeEnabled',
  'participantUids',
  'code',
  'title',
  'status',
  'dates',
  'origin',
  'originFull',
  'destination',
  'destinationFull',
  'destinationsCount',
  'totalKm',
  'vehicle',
  'currentDay',
  'totalDays',
  'totalActivities',
  'confirmedActivities',
  'pendingActivities',
  'budgetTotal',
  'budgetUsed',
  'budgetRemaining',
  'budgetUsedPercent',
  'membersOnline',
  'membersTotal',
  'membersStatus',
  'version',
  'updatedAt',
  'telematics.driver',
  'telematics.vehicleType',
  'telematics.from',
  'telematics.to',
];

export function createTripStore(requireFirestore: () => Firestore) {
  async function getTripById(tripId: string): Promise<TripData | null> {
    const db = requireFirestore();
    const snap = await db.collection('trips').doc(tripId).get();
    return snap.exists ? normalizeTripData(snap.data()) : null;
  }

  async function findTripByJoinCode(rawCode: string): Promise<TripData | null> {
    const code = normalizeJoinCode(rawCode);
    if (!isValidJoinCodeFormat(code)) return null;
    const db = requireFirestore();
    const snap = await db.collection('trips').where('joinCode', '==', code).limit(5).get();
    if (snap.empty) return null;
    const candidates = snap.docs
      .filter((d) => d.id !== 'active')
      .map((d) => normalizeTripData(d.data()));
    return candidates.find((t) => t.joinCodeEnabled !== false) || candidates[0] || null;
  }

  async function generateUniqueJoinCode(): Promise<string> {
    const db = requireFirestore();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = generateTripJoinCode(6);
      const existing = await db.collection('trips').where('joinCode', '==', code).limit(1).get();
      if (existing.empty) return code;
    }
    return generateTripJoinCode(8);
  }

  async function listTripsForUser(
    user: DecodedIdToken,
    options: { limit?: number; startAfterId?: string; summaryOnly?: boolean } = {},
  ): Promise<{ trips: TripData[]; hasMore: boolean; nextCursor: string | null }> {
    const summaryOnly = Boolean(options.summaryOnly);
    const isValidFull = (t: TripData) => typeof t.id === 'string' && Array.isArray(t.days);
    const isValidSummary = (t: TripData) => typeof t.id === 'string' && t.id.length > 0;
    const db = requireFirestore();
    const safeLimit = Math.min(Math.max(1, options.limit || 50), 200);

    const col = db.collection('trips');
    const applySelect = (q: Query): Query => {
      if (summaryOnly && typeof q.select === 'function') {
        return q.select(...TRIP_SUMMARY_FIELDS);
      }
      return q;
    };

    let docs: QueryDocumentSnapshot[];
    if (isAdminUser(user)) {
      let query: Query = col.orderBy('updatedAt', 'desc');
      if (options.startAfterId) {
        const cursorSnap = await col.doc(options.startAfterId).get();
        if (cursorSnap.exists) {
          query = query.startAfter(cursorSnap);
        }
      }
      try {
        const snapshot = await applySelect(query).limit(safeLimit + 1).get();
        docs = snapshot.docs;
      } catch {
        const fallbackSnap = await applySelect(col.limit(safeLimit + 1)).get();
        docs = [...fallbackSnap.docs].sort((a, b) => b.updateTime.toMillis() - a.updateTime.toMillis());
      }
    } else {
      const [ownedSnap, joinedSnap] = await Promise.all([
        applySelect(col.where('ownerId', '==', user.uid)).limit(safeLimit + 1).get(),
        applySelect(col.where('participantUids', 'array-contains', user.uid))
          .limit(safeLimit + 1)
          .get()
          .catch(() => ({ docs: [] as QueryDocumentSnapshot[] })),
      ]);

      const mergedById = new Map<string, QueryDocumentSnapshot>();
      for (const docSnap of ownedSnap.docs) {
        mergedById.set(docSnap.id, docSnap);
      }
      for (const docSnap of joinedSnap.docs) {
        if (!mergedById.has(docSnap.id)) {
          mergedById.set(docSnap.id, docSnap);
        }
      }
      docs = Array.from(mergedById.values()).sort(
        (a, b) => b.updateTime.toMillis() - a.updateTime.toMillis(),
      );
    }

    const hasMore = docs.length > safeLimit;
    const pageDocs = docs.slice(0, safeLimit);

    const trips = pageDocs
      .filter((d) => d.id !== 'active')
      .map((d) => (summaryOnly ? normalizeTripSummary(d.data(), d.id) : normalizeTripData(d.data())))
      .filter(summaryOnly ? isValidSummary : isValidFull);

    const lastDoc = pageDocs[pageDocs.length - 1];
    return {
      trips,
      hasMore,
      nextCursor: hasMore && lastDoc ? lastDoc.id : null,
    };
  }

  async function createTripDoc(trip: TripData): Promise<void> {
    const db = requireFirestore();
    await db.collection('trips').doc(trip.id).create({
      ...trip,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  async function deleteTripDoc(tripId: string): Promise<void> {
    const db = requireFirestore();
    const receiptSnap = await db.collection('trip_receipts').where('tripId', '==', tripId).get();
    if (!receiptSnap.empty) {
      const CHUNK = 400;
      for (let i = 0; i < receiptSnap.docs.length; i += CHUNK) {
        const batch = db.batch();
        receiptSnap.docs.slice(i, i + CHUNK).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }
    await db.collection('trips').doc(tripId).delete();
  }

  async function loadUserTrips(user: DecodedIdToken): Promise<TripData[]> {
    const { trips } = await listTripsForUser(user);
    return trips;
  }

  return {
    getTripById,
    findTripByJoinCode,
    generateUniqueJoinCode,
    listTripsForUser,
    createTripDoc,
    deleteTripDoc,
    loadUserTrips,
  };
}

