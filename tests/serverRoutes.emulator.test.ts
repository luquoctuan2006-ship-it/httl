import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express, { type RequestHandler } from 'express';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test } from 'node:test';
import { FirestoreRateLimitStore } from '../src/server/middleware/firestoreRateLimitStore';
import { createGeminiJobsRouter } from '../src/server/routes/geminiJobs';
import { createTripSyncRouter } from '../src/server/routes/trips';
import { listAuditLogs, recordAuditLog } from '../src/server/services/systemLogs';

const emulatorAvailable = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

test('Firestore emulator: route save handles consecutive syncs and stale versions', {
  skip: !emulatorAvailable && 'FIRESTORE_EMULATOR_HOST is not set',
}, async (t) => {
  const firebaseApp = initializeApp({ projectId: 'demo-httl-server-tests' }, `route-tests-${randomUUID()}`);
  const firestore = getFirestore(firebaseApp);
  const tripId = `trip-${randomUUID()}`;
  const jobId = `job-${randomUUID()}`;
  const rateLimitKey = `uid:${randomUUID()}`;

  const authMiddleware: RequestHandler = (req, _res, next) => {
    const request = req as typeof req & { authUser?: { uid: string; role: string } };
    request.authUser = {
      uid: req.header('x-test-uid') || 'sync-test-user',
      role: req.header('x-test-role') || 'user',
    };
    next();
  };

  const app = express();
  app.use(express.json());
  app.use('/api/trips', createTripSyncRouter({
    requireAuth: authMiddleware,
    getFirestore: () => firestore,
    cleanupOrphanReceiptsForTrip: async () => {},
  }));
  app.use('/api/gemini/jobs', createGeminiJobsRouter({
    requireAuth: authMiddleware,
    getFirestore: () => firestore,
  }));

  const httpServer = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
  const address = httpServer.address();
  assert.ok(address && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  t.after(async () => {
    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => error ? reject(error) : resolve());
    });
    await firestore.collection('trips').doc(tripId).delete();
    await firestore.collection('gemini_jobs').doc(jobId).delete();
    const auditLogs = await firestore.collection('audit_logs').where('action', '==', logAction).get();
    await Promise.all(auditLogs.docs.map((doc) => doc.ref.delete()));
    await deleteApp(firebaseApp);
  });

  const saveTrip = (body: Record<string, unknown>) => fetch(`${baseUrl}/api/trips/${tripId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-test-uid': 'sync-test-user' },
    body: JSON.stringify(body),
  });

  const initial = await saveTrip({ id: tripId, title: 'Initial itinerary', days: [] });
  assert.equal(initial.status, 200);
  assert.equal((await initial.json() as { version: number }).version, 1);

  const updated = await saveTrip({ id: tripId, title: 'Updated itinerary', version: 1, days: [] });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json() as { version: number }).version, 2);

  const stale = await saveTrip({ id: tripId, title: 'Stale itinerary', version: 1, days: [] });
  assert.equal(stale.status, 409);
  assert.equal((await stale.json() as { currentVersion: number }).currentVersion, 2);
  assert.equal((await firestore.collection('trips').doc(tripId).get()).data()?.title, 'Updated itinerary');

  const firstRateLimitStore = new FirestoreRateLimitStore(() => firestore);
  const secondRateLimitStore = new FirestoreRateLimitStore(() => firestore);
  assert.equal((await firstRateLimitStore.increment(rateLimitKey)).totalHits, 1);
  assert.equal((await secondRateLimitStore.increment(rateLimitKey)).totalHits, 2);
  await secondRateLimitStore.resetKey(rateLimitKey);

  const logAction = `Emulator integration ${randomUUID()}`;
  await recordAuditLog(firestore, 'sync-test-user', logAction);
  assert.ok((await listAuditLogs(firestore)).some((entry) => entry.action === logAction));

  await firestore.collection('gemini_jobs').doc(jobId).set({
    id: jobId,
    ownerUid: 'sync-test-user',
    slotIndex: 0,
    status: 'running',
    progress: 'Gemini đang xử lý',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    expiresAt: Date.now() + 60_000,
  });

  const ownerJob = await fetch(`${baseUrl}/api/gemini/jobs/${jobId}`, {
    headers: { 'x-test-uid': 'sync-test-user' },
  });
  assert.equal(ownerJob.status, 200);
  assert.equal((await ownerJob.json() as { job: { ownerUid?: string } }).job.ownerUid, undefined);

  const otherUserJob = await fetch(`${baseUrl}/api/gemini/jobs/${jobId}`, {
    headers: { 'x-test-uid': 'other-user' },
  });
  assert.equal(otherUserJob.status, 404);
});
