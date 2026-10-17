import 'server-only';
import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import type { NextRequest } from 'next/server';

/**
 * Firebase Admin is used ONLY on the server — to verify ID tokens sent by the
 * signed-in browser client and to read that same user's profile for AI
 * context. The service-account credentials come from server-only env vars and
 * must never be exposed to the client.
 */
export class AdminNotConfiguredError extends Error {
  readonly code = 'ADMIN_NOT_CONFIGURED';
  constructor() {
    super(
      'Firebase Admin credentials are not configured. Set FIREBASE_ADMIN_PROJECT_ID, ' +
        'FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY on the server.',
    );
  }
}

function getAdminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0];

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new AdminNotConfiguredError();
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, '\n') }),
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  });
}

/** Extract and verify the Firebase ID token from an Authorization: Bearer header.
 *  Throws AdminNotConfiguredError when server credentials are missing (callers
 *  surface this as 503); returns null for missing/invalid tokens (401). */
export async function verifyRequestUser(req: NextRequest) {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  const auth = getAuth(getAdminApp()); // may throw AdminNotConfiguredError
  try {
    return await auth.verifyIdToken(token);
  } catch {
    return null;
  }
}

/** Read (a whitelisted slice of) the verified user's own record for AI context. */
export async function getUserAiContext(uid: string) {
  try {
    const db = getDatabase(getAdminApp());
    const [snap, arena] = await Promise.all([
      db.ref(`users/${uid}`).get(),
      db.ref(`arenaState/${uid}/lifetime`).get(),
    ]);
    if (!snap.exists()) return null;
    const data = snap.val() as Record<string, unknown>;
    return {
      profile: data.profile ?? null,
      preferences: data.preferences ?? null,
      // Server-trusted Arena balance (client cannot spoof it)
      arena: arena.exists() ? (arena.val() as { xp: number; level: number }) : null,
    };
  } catch (err) {
    console.warn('[admin] profile fetch failed:', err instanceof Error ? err.message : 'unknown');
    return null;
  }
}

/** Lazily get the Admin Realtime Database instance (throws if not configured). */
export function getAdminDb() {
  return getDatabase(getAdminApp());
}
