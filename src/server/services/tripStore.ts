import type { DecodedIdToken } from 'firebase-admin/auth';
import { FieldValue, type Firestore, type Query } from 'firebase-admin/firestore';
import { normalizeTripData, normalizeTripSummary } from '../../data/normalizeTripData';
import type { TripData } from '../../types/travel';
import { isAdminUser } from '../../utils/tripRepository';

export const TRIP_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

const TRIP_SUMMARY_FIELDS = [
  'id',
  'ownerId',
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
    let query = isAdminUser(user)
      ? col.orderBy('updatedAt', 'desc')
      : col.where('ownerId', '==', user.uid);

    if (isAdminUser(user) && options.startAfterId) {
      const cursorSnap = await col.doc(options.startAfterId).get();
      if (cursorSnap.exists) {
        query = query.startAfter(cursorSnap);
      }
    }

    const applySelect = (q: Query): Query => {
      if (summaryOnly && typeof q.select === 'function') {
        return q.select(...TRIP_SUMMARY_FIELDS);
      }
      return q;
    };

    let docs;
    try {
      const snapshot = await applySelect(query).limit(safeLimit + 1).get();
      docs = snapshot.docs;
    } catch {
      const fallbackBase = isAdminUser(user)
        ? col.limit(safeLimit + 1)
        : col.where('ownerId', '==', user.uid).limit(safeLimit + 1);
      const fallbackSnap = await applySelect(fallbackBase).get();
      docs = [...fallbackSnap.docs].sort((a, b) => b.updateTime.toMillis() - a.updateTime.toMillis());
    }

    const hasMore = docs.length > safeLimit;
    const pageDocs = docs.slice(0, safeLimit);
    if (!isAdminUser(user)) {
      pageDocs.sort((a, b) => b.updateTime.toMillis() - a.updateTime.toMillis());
    }

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
    listTripsForUser,
    createTripDoc,
    deleteTripDoc,
    loadUserTrips,
  };
}
