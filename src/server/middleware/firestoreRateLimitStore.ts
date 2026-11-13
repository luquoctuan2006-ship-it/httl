import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import type { Options, Store } from 'express-rate-limit';

type RateLimitRecord = {
  totalHits: number;
  resetAt: number;
};

export class FirestoreRateLimitStore implements Store {
  localKeys = false;
  prefix = 'ai-rate-limit';
  private windowMs = 5 * 60 * 1000;

  constructor(
    private readonly getFirestore: () => Firestore,
    private readonly collectionName = 'rate_limits',
  ) {}

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  async increment(key: string) {
    const firestore = this.getFirestore();
    const ref = firestore.collection(this.collectionName).doc(this.getDocumentId(key));
    const now = Date.now();

    return firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const record = snapshot.exists ? snapshot.data() as RateLimitRecord : undefined;
      const isActive = record && record.resetAt > now;
      const totalHits = isActive ? record.totalHits + 1 : 1;
      const resetAt = isActive ? record.resetAt : now + this.windowMs;

      transaction.set(ref, { totalHits, resetAt, expiresAt: new Date(resetAt) });
      return { totalHits, resetTime: new Date(resetAt) };
    });
  }

  async get(key: string) {
    const snapshot = await this.getFirestore().collection(this.collectionName).doc(this.getDocumentId(key)).get();
    if (!snapshot.exists) return undefined;

    const record = snapshot.data() as RateLimitRecord;
    if (record.resetAt <= Date.now()) return undefined;
    return { totalHits: record.totalHits, resetTime: new Date(record.resetAt) };
  }

  async decrement(key: string): Promise<void> {
    const firestore = this.getFirestore();
    const ref = firestore.collection(this.collectionName).doc(this.getDocumentId(key));
    await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return;

      const record = snapshot.data() as RateLimitRecord;
      if (record.resetAt <= Date.now()) {
        transaction.delete(ref);
        return;
      }

      transaction.set(ref, {
        ...record,
        totalHits: Math.max(0, record.totalHits - 1),
      });
    });
  }

  async resetKey(key: string): Promise<void> {
    await this.getFirestore().collection(this.collectionName).doc(this.getDocumentId(key)).delete();
  }

  private getDocumentId(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }
}
