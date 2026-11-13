import { randomUUID } from 'node:crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';

export type AuditLogEntry = {
  id: string;
  time: string;
  timestamp: string;
  user: string;
  action: string;
  status: 'Thành công' | 'Cảnh báo' | 'Thất bại';
  expiresAt: number;
};

export type AIRequestLog = {
  id: string;
  time: string;
  user: string;
  model: string;
  prompt: string;
  status: 'Hoàn thành' | 'Thất bại';
  latency: string;
  createdAt: unknown;
  expiresAt: Date;
};

export type AIErrorLog = {
  id: string;
  time: string;
  code: string;
  detail: string;
  resolved: boolean;
  createdAt: unknown;
  expiresAt: Date;
};

const AUDIT_LOG_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const AI_LOG_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function formatVietnameseTime(date: Date): string {
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export async function recordAuditLog(
  firestore: Firestore,
  user: string,
  action: string,
  status: AuditLogEntry['status'] = 'Thành công',
): Promise<void> {
  const now = new Date();
  const entry: AuditLogEntry = {
    id: `log-${randomUUID()}`,
    time: formatVietnameseTime(now),
    timestamp: now.toISOString(),
    user,
    action,
    status,
    expiresAt: now.getTime() + AUDIT_LOG_TTL_MS,
  };
  await firestore.collection('audit_logs').doc(entry.id).set({
    ...entry,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function listAuditLogs(firestore: Firestore, limit = 50): Promise<AuditLogEntry[]> {
  const snapshot = await firestore.collection('audit_logs').orderBy('createdAt', 'desc').limit(limit).get();
  return snapshot.docs.map((doc) => doc.data() as AuditLogEntry);
}

export async function recordAIRequestLog(
  firestore: Firestore,
  entry: Omit<AIRequestLog, 'createdAt' | 'expiresAt'>,
): Promise<void> {
  await firestore.collection('ai_request_logs').doc(entry.id).set({
    ...entry,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: new Date(Date.now() + AI_LOG_TTL_MS),
  });
}

export async function recordAIErrorLog(
  firestore: Firestore,
  entry: Omit<AIErrorLog, 'createdAt' | 'expiresAt'>,
): Promise<void> {
  await firestore.collection('ai_error_logs').doc(entry.id).set({
    ...entry,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: new Date(Date.now() + AI_LOG_TTL_MS),
  });
}

export async function listAILogs(firestore: Firestore, limit = 50) {
  const [requests, errors] = await Promise.all([
    firestore.collection('ai_request_logs').orderBy('createdAt', 'desc').limit(limit).get(),
    firestore.collection('ai_error_logs').orderBy('createdAt', 'desc').limit(limit).get(),
  ]);
  return {
    requests: requests.docs.map((doc) => doc.data() as AIRequestLog),
    errors: errors.docs.map((doc) => doc.data() as AIErrorLog),
  };
}
