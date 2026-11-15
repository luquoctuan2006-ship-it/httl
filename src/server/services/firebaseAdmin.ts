import path from 'path';
import { existsSync, readFileSync } from 'node:fs';
import { App as FirebaseAdminApp, cert, getApps, initializeApp } from 'firebase-admin/app';
import { Auth as FirebaseAdminAuth, getAuth } from 'firebase-admin/auth';
import { Firestore, getFirestore } from 'firebase-admin/firestore';
import { createInMemoryFirestore } from './inMemoryFirestore';

export interface FirebaseAdminContext {
  firebaseApp: FirebaseAdminApp | null;
  firestore: Firestore | null;
  firebaseAuth: FirebaseAdminAuth | null;
  hasServiceAccountCredentials: boolean;
  requireFirestore: () => Firestore;
}

export function initFirebaseAdmin(rootDir: string): FirebaseAdminContext {
  const serviceAccountPath = path.resolve(
    rootDir,
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 'secrets/firebase-service-account.json',
  );

  let firebaseApp: FirebaseAdminApp | null = null;
  let firestore: Firestore | null = null;
  let firebaseAuth: FirebaseAdminAuth | null = null;
  let hasServiceAccountCredentials = false;

  if (existsSync(serviceAccountPath)) {
    try {
      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
      firebaseApp = getApps()[0] || initializeApp({ credential: cert(serviceAccount) });
      firestore = getFirestore(firebaseApp);
      try {
        firestore.settings({ ignoreUndefinedProperties: true });
      } catch {
        /* đã được khởi tạo */
      }
      firebaseAuth = getAuth(firebaseApp);
      hasServiceAccountCredentials = true;
    } catch (err) {
      console.warn('[Firebase Admin] Could not be initialized:', err);
    }
  }

  if (!hasServiceAccountCredentials) {
    let fallbackProjectId = process.env.VITE_FIREBASE_PROJECT_ID?.trim() || '';
    const appletConfigPath = path.resolve(rootDir, 'firebase-applet-config.json');
    if (!fallbackProjectId && existsSync(appletConfigPath)) {
      try {
        const appletConfig = JSON.parse(readFileSync(appletConfigPath, 'utf8')) as { projectId?: string };
        if (typeof appletConfig.projectId === 'string') {
          fallbackProjectId = appletConfig.projectId.trim();
        }
      } catch {
        /* ignore */
      }
    }

    try {
      firebaseApp = getApps()[0] || initializeApp(fallbackProjectId ? { projectId: fallbackProjectId } : undefined);
      firebaseAuth = getAuth(firebaseApp);
    } catch (err) {
      console.warn('[Firebase Auth] Could not initialize token verifier:', err);
    }

    firestore = createInMemoryFirestore();
    console.warn(
      `[Firebase Admin] Service account not found — using in-memory Firestore fallback${fallbackProjectId ? ` and JWT verification for project ${fallbackProjectId}` : ''}`,
    );
  }

  function requireFirestore(): Firestore {
    if (!firestore) {
      throw new Error('Firestore chưa được khởi tạo');
    }
    return firestore;
  }

  return {
    firebaseApp,
    firestore,
    firebaseAuth,
    hasServiceAccountCredentials,
    requireFirestore,
  };
}
