import dotenv from 'dotenv';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

dotenv.config();

// Dùng: npm run migrate:owner -- <owner-uid> [--dry-run] [--delete-active]
//  - Gán ownerId cho mọi chuyến cũ chưa có chủ (bỏ qua doc "active").
//  - --delete-active: xóa doc trips/active dùng chung cũ (không còn được dùng nữa).
const args = process.argv.slice(2);
const ownerUid = args.find((a) => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
const deleteActive = args.includes('--delete-active');

if (!ownerUid) {
  console.error('Usage: npm run migrate:owner -- <owner-uid> [--dry-run] [--delete-active]');
  process.exit(1);
}

const serviceAccountPath = path.resolve(
  process.cwd(),
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 'secrets/firebase-service-account.json',
);
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
const firebaseApp = getApps()[0] || initializeApp({ credential: cert(serviceAccount) });
const firestore = getFirestore(firebaseApp);

const snapshot = await firestore.collection('trips').get();
let updated = 0;

for (const document of snapshot.docs) {
  if (document.id === 'active') continue;
  if (document.data().ownerId) continue;

  console.log(`${dryRun ? '[dry-run] ' : ''}Gán ownerId=${ownerUid} cho chuyến ${document.id} (${document.data().title ?? ''})`);
  if (!dryRun) {
    await document.ref.update({ ownerId: ownerUid, updatedAt: FieldValue.serverTimestamp() });
  }
  updated += 1;
}

if (deleteActive && !dryRun) {
  await firestore.collection('trips').doc('active').delete();
  console.log('Đã xóa doc trips/active dùng chung cũ.');
}

console.log(`Xong: ${updated} chuyến ${dryRun ? 'sẽ được' : 'đã được'} gán chủ.`);