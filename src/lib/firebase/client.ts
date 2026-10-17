import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getDatabase, type Database } from 'firebase/database';

/**
 * Firebase *web* config. These values are public by design (they ship in the
 * browser bundle). Security is enforced by Firebase Authentication plus
 * Realtime Database security rules — never by hiding these values.
 */
const ENV_KEYS = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_DATABASE_URL',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
] as const;

const config: Record<string, string | undefined> = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Static env map: Next.js inlines NEXT_PUBLIC_* values into the browser
// bundle ONLY for static member access (process.env.NAME). A dynamic
// process.env[k] lookup is never inlined and is always undefined in the
// browser — so the configured-ness check must read from this static map.
const ENV_VALUES: Record<(typeof ENV_KEYS)[number], string | undefined> = {
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_DATABASE_URL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function missingFirebaseEnv(): string[] {
  return ENV_KEYS.filter((k) => !ENV_VALUES[k]);
}

export function isFirebaseConfigured(): boolean {
  return missingFirebaseEnv().length === 0;
}

export const googleSignInEnabled =
  process.env.NEXT_PUBLIC_GOOGLE_SIGN_IN_ENABLED === 'true';

interface FirebaseClients {
  app: FirebaseApp;
  auth: Auth;
  db: Database;
}

let cached: FirebaseClients | null = null;

/**
 * Lazily initialise the Firebase client SDK. Returns `null` during SSR or when
 * the environment is not configured — callers must render the safe
 * "configuration missing" state instead of crashing.
 */
export function getFirebase(): FirebaseClients | null {
  if (typeof window === 'undefined') return null;
  if (cached) return cached;
  if (!isFirebaseConfigured()) return null;
  const app = getApps().length > 0 ? getApps()[0] : initializeApp(config);
  cached = { app, auth: getAuth(app), db: getDatabase(app) };
  return cached;
}
