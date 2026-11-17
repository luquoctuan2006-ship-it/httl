import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const environmentConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || firebaseConfig.firestoreDatabaseId,
};

const requiredFirebaseValues = [
  environmentConfig.apiKey,
  environmentConfig.authDomain,
  environmentConfig.projectId,
  environmentConfig.appId,
  environmentConfig.firestoreDatabaseId,
];

const firebaseAuthConfigured = requiredFirebaseValues.every(Boolean);

const app = firebaseAuthConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(environmentConfig)
  : null;

export const auth: Auth | null = app ? getAuth(app) : null;
export const firebaseAuth = auth;
