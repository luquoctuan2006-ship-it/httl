import { FieldValue, type Firestore } from 'firebase-admin/firestore';

type StoredRecord = {
  data: Record<string, unknown>;
  updateTimeMs: number;
};

type WhereFilter = {
  field: string;
  op: '==' | '<' | '<=' | '>' | '>=';
  value: unknown;
};

type OrderSpec = {
  field: string;
  direction: 'asc' | 'desc';
};

function isServerTimestampSentinel(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if (value === FieldValue.serverTimestamp()) return true;
  const ctorName = (value as { constructor?: { name?: string } }).constructor?.name;
  return ctorName === 'ServerTimestampTransform' || ctorName === 'FieldValue';
}

function toComparableValue(value: unknown): number | string | boolean | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  return String(value);
}

function resolveFieldValues(input: Record<string, unknown>, nowMs: number): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const timestampObj = {
    toMillis: () => nowMs,
    toDate: () => new Date(nowMs),
    seconds: Math.floor(nowMs / 1000),
    nanoseconds: (nowMs % 1000) * 1_000_000,
  };

  for (const [key, val] of Object.entries(input)) {
    if (val === undefined) continue;
    if (isServerTimestampSentinel(val)) {
      result[key] = timestampObj;
    } else if (Array.isArray(val)) {
      result[key] = structuredCloneSafe(val);
    } else if (val && typeof val === 'object' && !(val instanceof Date) && typeof (val as { toMillis?: unknown }).toMillis !== 'function') {
      result[key] = resolveFieldValues(val as Record<string, unknown>, nowMs);
    } else {
      result[key] = val;
    }
  }
  return result;
}

function structuredCloneSafe<T>(val: T): T {
  try {
    return structuredClone(val);
  } catch {
    return JSON.parse(JSON.stringify(val)) as T;
  }
}

export function createInMemoryFirestore(): Firestore {
  const collections = new Map<string, Map<string, StoredRecord>>();
  let txQueue = Promise.resolve();

  const getColMap = (name: string): Map<string, StoredRecord> => {
    let col = collections.get(name);
    if (!col) {
      col = new Map<string, StoredRecord>();
      collections.set(name, col);
    }
    return col;
  };

  const makeSnapshot = (colName: string, docId: string, record?: StoredRecord) => {
    const ref = makeDocRef(colName, docId);
    if (!record) {
      return {
        id: docId,
        ref,
        exists: false,
        updateTime: { toMillis: () => 0 },
        data: () => undefined,
      };
    }
    return {
      id: docId,
      ref,
      exists: true,
      updateTime: { toMillis: () => record.updateTimeMs },
      data: () => structuredCloneSafe(record.data),
    };
  };

  const writeDoc = (
    colName: string,
    docId: string,
    data: Record<string, unknown>,
    options: { merge?: boolean; createOnly?: boolean; updateOnly?: boolean } = {},
  ) => {
    const col = getColMap(colName);
    const existing = col.get(docId);
    if (options.createOnly && existing) {
      const err = new Error(`Document ${colName}/${docId} already exists`) as Error & { code?: number };
      err.code = 6;
      throw err;
    }
    if (options.updateOnly && !existing) {
      const err = new Error(`Document ${colName}/${docId} not found`) as Error & { code?: number };
      err.code = 5;
      throw err;
    }
    const nowMs = Date.now();
    const resolved = resolveFieldValues(data, nowMs);
    const nextData =
      options.merge || options.updateOnly
        ? { ...(existing ? structuredCloneSafe(existing.data) : {}), ...resolved }
        : resolved;
    col.set(docId, { data: nextData, updateTimeMs: nowMs });
  };

  const makeDocRef = (colName: string, docId: string): any => ({
    id: docId,
    path: `${colName}/${docId}`,
    async get() {
      const record = getColMap(colName).get(docId);
      return makeSnapshot(colName, docId, record);
    },
    async set(data: Record<string, unknown>, options?: { merge?: boolean }) {
      writeDoc(colName, docId, data, { merge: Boolean(options?.merge) });
    },
    async create(data: Record<string, unknown>) {
      writeDoc(colName, docId, data, { createOnly: true });
    },
    async update(data: Record<string, unknown>) {
      writeDoc(colName, docId, data, { updateOnly: true });
    },
    async delete() {
      getColMap(colName).delete(docId);
    },
  });

  const makeQuery = (
    colName: string,
    filters: WhereFilter[] = [],
    orders: OrderSpec[] = [],
    limitCount?: number,
    startAfterId?: string,
  ): any => ({
    where(field: string, op: WhereFilter['op'], value: unknown) {
      return makeQuery(colName, [...filters, { field, op, value }], orders, limitCount, startAfterId);
    },
    orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
      return makeQuery(colName, filters, [...orders, { field, direction }], limitCount, startAfterId);
    },
    limit(count: number) {
      return makeQuery(colName, filters, orders, count, startAfterId);
    },
    startAfter(cursorSnap: { id?: string }) {
      return makeQuery(colName, filters, orders, limitCount, cursorSnap?.id);
    },
    async get() {
      const col = getColMap(colName);
      let entries = Array.from(col.entries()).filter(([, record]) => {
        for (const filter of filters) {
          const actual = toComparableValue(record.data[filter.field]);
          const expected = toComparableValue(filter.value);
          if (actual === null || expected === null) {
            if (filter.op === '==' && actual === expected) continue;
            return false;
          }
          if (filter.op === '==' && actual !== expected) return false;
          if (filter.op === '<' && !(actual < expected)) return false;
          if (filter.op === '<=' && !(actual <= expected)) return false;
          if (filter.op === '>' && !(actual > expected)) return false;
          if (filter.op === '>=' && !(actual >= expected)) return false;
        }
        return true;
      });

      if (orders.length > 0) {
        entries = entries.sort(([, a], [, b]) => {
          for (const order of orders) {
            const av = toComparableValue(a.data[order.field]) ?? 0;
            const bv = toComparableValue(b.data[order.field]) ?? 0;
            if (av === bv) continue;
            const cmp = av < bv ? -1 : 1;
            return order.direction === 'desc' ? -cmp : cmp;
          }
          return 0;
        });
      }

      if (startAfterId) {
        const cursorIndex = entries.findIndex(([id]) => id === startAfterId);
        if (cursorIndex >= 0) {
          entries = entries.slice(cursorIndex + 1);
        }
      }

      if (typeof limitCount === 'number' && limitCount >= 0) {
        entries = entries.slice(0, limitCount);
      }

      const docs = entries.map(([id, record]) => makeSnapshot(colName, id, record));
      return {
        empty: docs.length === 0,
        size: docs.length,
        docs,
      };
    },
  });

  const dbLike = {
    collection(name: string) {
      return {
        ...makeQuery(name),
        doc(id: string) {
          return makeDocRef(name, id);
        },
      };
    },
    batch() {
      const ops: Array<() => void> = [];
      return {
        set(ref: { path: string; id: string }, data: Record<string, unknown>, options?: { merge?: boolean }) {
          const colName = ref.path.split('/')[0];
          ops.push(() => writeDoc(colName, ref.id, data, { merge: Boolean(options?.merge) }));
        },
        update(ref: { path: string; id: string }, data: Record<string, unknown>) {
          const colName = ref.path.split('/')[0];
          ops.push(() => writeDoc(colName, ref.id, data, { updateOnly: true }));
        },
        delete(ref: { path: string; id: string }) {
          const colName = ref.path.split('/')[0];
          ops.push(() => {
            getColMap(colName).delete(ref.id);
          });
        },
        async commit() {
          for (const op of ops) op();
        },
      };
    },
    async runTransaction<T>(fn: (transaction: any) => Promise<T>): Promise<T> {
      let resolveResult!: (value: T) => void;
      let rejectResult!: (err: unknown) => void;
      const outerPromise = new Promise<T>((resolve, reject) => {
        resolveResult = resolve;
        rejectResult = reject;
      });

      txQueue = txQueue.then(async () => {
        const stagedOps: Array<() => void> = [];
        const tx = {
          async get(ref: { path: string; id: string }) {
            const colName = ref.path.split('/')[0];
            return makeSnapshot(colName, ref.id, getColMap(colName).get(ref.id));
          },
          set(ref: { path: string; id: string }, data: Record<string, unknown>, options?: { merge?: boolean }) {
            const colName = ref.path.split('/')[0];
            stagedOps.push(() => writeDoc(colName, ref.id, data, { merge: Boolean(options?.merge) }));
          },
          update(ref: { path: string; id: string }, data: Record<string, unknown>) {
            const colName = ref.path.split('/')[0];
            stagedOps.push(() => writeDoc(colName, ref.id, data, { updateOnly: true }));
          },
          delete(ref: { path: string; id: string }) {
            const colName = ref.path.split('/')[0];
            stagedOps.push(() => {
              getColMap(colName).delete(ref.id);
            });
          },
        };

        try {
          const result = await fn(tx);
          for (const op of stagedOps) op();
          resolveResult(result);
        } catch (err) {
          rejectResult(err);
        }
      });

      return outerPromise;
    },
  };

  return dbLike as unknown as Firestore;
}
