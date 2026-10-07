import dotenv from 'dotenv';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

dotenv.config();

const [uid, role] = process.argv.slice(2);
if (!uid || !['admin', 'user'].includes(role || '')) {
  console.error('Usage: npm run set:role -- <firebase-user-uid> <admin|user>');
  process.exit(1);
}

const serviceAccountPath = path.resolve(
  process.cwd(),
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 'secrets/firebase-service-account.json',
);
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
const firebaseApp = getApps()[0] || initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth(firebaseApp);

try {
  const user = await auth.getUser(uid);
  await auth.setCustomUserClaims(uid, { ...user.customClaims, role });
  await auth.revokeRefreshTokens(uid);
  console.log(`Set role=${role} for ${user.email || uid}. Existing sessions are revoked; the user must sign in again.`);
} catch (error) {
  console.error('Unable to update Firebase user role:', error);
  process.exitCode = 1;
}