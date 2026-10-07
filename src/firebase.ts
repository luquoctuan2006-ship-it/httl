import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const isConfigured = Object.values(firebaseConfig).every((value) => typeof value === 'string' && value.length > 0);

export const firebaseAuth = isConfigured
  ? getAuth(getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null;

export const firebaseAuthConfigured = isConfigured;