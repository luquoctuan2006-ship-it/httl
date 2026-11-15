import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialTripData } from '../src/data/mockData';
import { normalizeTripData, normalizeTripSummary } from '../src/data/normalizeTripData';
import type { TripData } from '../src/types/travel';
import { cloneTripForTemplate } from '../src/utils/tripHelpers';
import {
  buildGuestInviteUrl,
  generateTripJoinCode,
  guestTripToReadOnlyTripData,
  isUserTripOwnerOrAdmin,
  isUserTripParticipant,
  isValidJoinCodeFormat,
  normalizeJoinCode,
  sanitizeTripForGuest,
} from '../src/utils/tripJoinHelpers';
import {
  canAccessTrip,
  isTripOwnerOrAdmin,
  upsertTripForUser,
  type FirestoreDbLike,
} from '../src/utils/tripRepository';

function createMockDb(initialDocs: Record<string, TripData>): FirestoreDbLike {
  const store = new Map<string, Record<string, unknown>>(
    Object.entries(initialDocs).map(([id, doc]) => [id, structuredClone(doc) as unknown as Record<string, unknown>]),
  );

  return {
    collection: () => ({
      doc: (id: string) => ({ id }),
    }),
    runTransaction: async (fn) => {
      const tx = {
        get: async (docRef: { id: string }) => {
          const data = store.get(docRef.id);
          return {
            exists: Boolean(data),
            data: () => (data ? structuredClone(data) : undefined),
          };
        },
        set: (docRef: { id: string }, data: Record<string, unknown>) => {
          store.set(docRef.id, structuredClone(data));
        },
      };
      return await fn(tx);
    },
  };
}

test('join code normalization, validation, and generation', () => {
  assert.equal(normalizeJoinCode('  v8k-4m2 '), 'V8K4M2');
  assert.equal(isValidJoinCodeFormat('V8K4M2'), true);
  assert.equal(isValidJoinCodeFormat('abc'), false);
  assert.equal(isValidJoinCodeFormat('V8K4M2!'), false);

  const generated = generateTripJoinCode(6);
  assert.equal(generated.length, 6);
  assert.equal(isValidJoinCodeFormat(generated), true);

  assert.equal(
    buildGuestInviteUrl('v8k4m2', 'https://voyager.example'),
    'https://voyager.example/?guestCode=V8K4M2',
  );
});

test('normalizeTripData and normalizeTripSummary preserve joinCode, participantUids, and member link metadata', () => {
  const input: TripData = {
    ...structuredClone(initialTripData),
    id: 'trip-join-1',
    ownerId: 'user-a',
    joinCode: '  ab12cd ',
    joinCodeEnabled: true,
    participantUids: ['user-b', 'user-a', ''],
    members: [
      {
        id: 'mem-1',
        name: 'Nguyễn Văn A',
        avatar: 'NA',
        role: 'Trưởng đoàn',
        phone: '0901112223',
        status: 'online',
        attendanceStatus: 'Có mặt',
        uid: 'user-a',
        memberType: 'account',
      },
      {
        id: 'mem-2',
        name: 'Trần Thị B',
        avatar: 'TB',
        role: 'Khách du lịch',
        phone: '0904445556',
        status: 'online',
        attendanceStatus: 'Có mặt',
        uid: 'user-b',
        memberType: 'account',
      },
      {
        id: 'guest-1',
        name: 'Bà Ngoại B',
        avatar: 'NB',
        role: 'Khách du lịch',
        phone: '0907778889',
        status: 'online',
        attendanceStatus: 'Chưa điểm danh',
        memberType: 'guest',
        invitedByUid: 'user-b',
        invitedByName: 'Trần Thị B',
      },
    ],
  };

  const full = normalizeTripData(input);
  assert.equal(full.joinCode, 'AB12CD');
  assert.equal(full.joinCodeEnabled, true);
  assert.deepEqual(full.participantUids, ['user-b', 'user-a']);
  assert.equal(full.members[1].uid, 'user-b');
  assert.equal(full.members[1].memberType, 'account');
  assert.equal(full.members[2].memberType, 'guest');
  assert.equal(full.members[2].invitedByUid, 'user-b');
  assert.equal(full.members[2].invitedByName, 'Trần Thị B');

  const summary = normalizeTripSummary(input);
  assert.equal(summary.joinCode, 'AB12CD');
  assert.equal(summary.joinCodeEnabled, true);
  assert.deepEqual(summary.participantUids, ['user-b', 'user-a']);
});

test('cloneTripForTemplate clears joinCode, participantUids, and account links', () => {
  const source: TripData = {
    ...structuredClone(initialTripData),
    id: 'trip-template-src',
    ownerId: 'user-a',
    joinCode: 'JOIN99',
    joinCodeEnabled: false,
    participantUids: ['user-b'],
    members: [
      {
        id: 'mem-b',
        name: 'User B',
        avatar: 'UB',
        role: 'Khách du lịch',
        phone: '0900000000',
        status: 'online',
        attendanceStatus: 'Có mặt',
        uid: 'user-b',
        memberType: 'account',
        invitedByUid: 'user-a',
        invitedByName: 'User A',
      },
    ],
  };

  const cloned = cloneTripForTemplate(source, 'user-c');
  assert.equal(cloned.ownerId, 'user-c');
  assert.equal(cloned.joinCode, undefined);
  assert.equal(cloned.participantUids, undefined);
  assert.equal(cloned.joinCodeEnabled, true);
  assert.equal(cloned.members[0].uid, undefined);
  assert.equal(cloned.members[0].memberType, 'manual');
  assert.equal(cloned.members[0].invitedByUid, undefined);
  assert.equal(cloned.members[0].invitedByName, undefined);
});

test('participant HK user can read trip but cannot overwrite full trip via upsertTripForUser; removing member revokes access', async () => {
  const tripDoc: TripData = {
    ...structuredClone(initialTripData),
    id: 'trip-perm-1',
    ownerId: 'user-a',
    participantUids: ['user-b'],
    version: 1,
    members: [
      {
        id: 'mem-a',
        name: 'User A',
        avatar: 'UA',
        role: 'Trưởng đoàn',
        phone: '0901234567',
        status: 'online',
        attendanceStatus: 'Có mặt',
        uid: 'user-a',
        memberType: 'account',
      },
      {
        id: 'mem-b',
        name: 'User B',
        avatar: 'UB',
        role: 'Khách du lịch',
        phone: '0907654321',
        status: 'online',
        attendanceStatus: 'Có mặt',
        uid: 'user-b',
        memberType: 'account',
      },
    ],
  };

  assert.equal(canAccessTrip(tripDoc, { uid: 'user-b', role: 'user' }), true);
  assert.equal(isTripOwnerOrAdmin(tripDoc, { uid: 'user-b', role: 'user' }), false);
  assert.equal(isUserTripOwnerOrAdmin(tripDoc, 'user-b', 'user'), false);
  assert.equal(isUserTripParticipant(tripDoc, 'user-b'), true);

  const db = createMockDb({ [tripDoc.id]: tripDoc });

  // User B attempts full PUT -> forbidden
  const forbiddenOutcome = await upsertTripForUser(
    db,
    { ...tripDoc, title: 'Hacked title' },
    { uid: 'user-b', role: 'user' },
    () => new Date().toISOString(),
  );
  assert.equal(forbiddenOutcome.status, 'forbidden');

  // Owner A removes User B from members -> participantUids should automatically drop user-b
  const ownerUpdateOutcome = await upsertTripForUser(
    db,
    {
      ...tripDoc,
      members: tripDoc.members.filter((m) => m.uid !== 'user-b'),
    },
    { uid: 'user-a', role: 'user' },
    () => new Date().toISOString(),
  );
  assert.equal(ownerUpdateOutcome.status, 'ok');
  if (ownerUpdateOutcome.status === 'ok') {
    assert.deepEqual(ownerUpdateOutcome.trip.participantUids || [], []);
    assert.equal(canAccessTrip(ownerUpdateOutcome.trip, { uid: 'user-b', role: 'user' }), false);
  }
});

test('sanitizeTripForGuest strips financial data, UIDs, AI notes, and passenger phones while retaining staff contacts', () => {
  const source: TripData = {
    ...structuredClone(initialTripData),
    id: 'trip-guest-1',
    ownerId: 'user-a',
    joinCode: 'GUE789',
    participantUids: ['user-b'],
    budgetTotal: 150000000,
    budgetUsed: 45000000,
    invoices: [
      { id: 'inv-1', title: 'Internal Invoice', category: 'hotel', amount: 25000000, date: '2026-05-01' },
    ],
    members: [
      {
        id: 'staff-1',
        name: 'Nguyễn Văn Lái',
        avatar: 'NL',
        role: 'Tài xế',
        phone: '0909888777',
        status: 'online',
        attendanceStatus: 'Có mặt',
      },
      {
        id: 'staff-2',
        name: 'Lê Hướng Dẫn',
        avatar: 'LD',
        role: 'Hướng dẫn viên',
        phone: '0909555444',
        status: 'online',
        attendanceStatus: 'Có mặt',
      },
      {
        id: 'pax-1',
        name: 'Trần Khách Hàng',
        avatar: 'TK',
        role: 'Khách du lịch',
        phone: '0911222333',
        status: 'online',
        attendanceStatus: 'Có mặt',
        uid: 'user-b',
        memberType: 'account',
      },
    ],
  };

  const sanitized = sanitizeTripForGuest(source);
  const rawJson = JSON.stringify(sanitized);

  assert.equal(rawJson.includes('user-a'), false);
  assert.equal(rawJson.includes('user-b'), false);
  assert.equal(rawJson.includes('Internal Invoice'), false);
  assert.equal(rawJson.includes('0911222333'), false);
  assert.equal((sanitized as unknown as Record<string, unknown>).budgetTotal, undefined);
  assert.equal((sanitized as unknown as Record<string, unknown>).invoices, undefined);

  // Staff contacts remain visible
  assert.equal(sanitized.members[0].phone, '0909888777');
  assert.equal(sanitized.members[1].phone, '0909555444');
  // Passenger phone is masked
  assert.equal(sanitized.members[2].phone, '');

  // Activity costs are removed
  const firstActivity = sanitized.days[0]?.activities[0];
  assert.ok(firstActivity);
  assert.equal((firstActivity as unknown as Record<string, unknown>).cost, undefined);

  // Can convert back to read-only TripData safely for LiveRouteMap
  const readOnlyTrip = guestTripToReadOnlyTripData(sanitized);
  assert.equal(readOnlyTrip.budgetTotal, 0);
  assert.deepEqual(readOnlyTrip.aiSuggestions, []);
  assert.equal(readOnlyTrip.days.length, source.days.length);
});
