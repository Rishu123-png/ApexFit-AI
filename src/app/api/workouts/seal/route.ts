import { NextRequest, NextResponse } from 'next/server';
import { requireArenaUser, isErrorResponse } from '@/lib/arena/http';
import { getAdminDb } from '@/lib/firebase/admin';
import { validateSessionSeal, deriveSessionStatus } from '@/lib/workouts/seal';
import { rateLimit } from '@/lib/ai/ratelimit';
import type { WorkoutSession } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/workouts/seal — { sessionId }
 *
 * Turns a client-written, self-reported workout into a server-verified one by
 * stamping `verified: true`, `serverDurationSec` and `sealedAt` after
 * plausibility checks against the server clock. Idempotent: sealing twice
 * returns the existing verification. Clients cannot forge these fields
 * (blocked by database rules); only this route writes them.
 */
export async function POST(req: NextRequest) {
  const auth = await requireArenaUser(req);
  if (isErrorResponse(auth)) return auth;
  const { uid } = auth;

  const rl = rateLimit(`workout-seal:${uid}`, 40, 60 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: 'RATE_LIMITED', retryAfterSec: rl.retryAfterSec }, { status: 429 });

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 2048) return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });
  }

  const sessionId = typeof body.sessionId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(body.sessionId)
    ? body.sessionId
    : null;
  if (!sessionId) return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });

  const db = getAdminDb();
  // Ownership enforced by reading inside the caller's own namespace.
  const ref = db.ref(`users/${uid}/workouts/${sessionId}`);
  const snap = await ref.get();
  if (!snap.exists()) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  const session = snap.val() as WorkoutSession & { verified?: boolean; sealedAt?: number };
  if (session.verified === true) {
    // Idempotent success — a retry is not a second session.
    return NextResponse.json({ sealed: true, alreadySealed: true, status: session.status });
  }

  const exercises = Array.isArray(session.exercises) ? session.exercises : [];
  const totalCompletedSets = exercises.reduce((s, e) => s + (Number(e.completedSets) || 0), 0);
  const status = deriveSessionStatus(exercises);

  const check = validateSessionSeal({
    startedAt: Number(session.startedAt),
    endedAt: Number(session.endedAt),
    durationSec: Number(session.durationSec),
    totalCompletedSets,
    now: Date.now(),
  });
  if (!check.ok) {
    // The record stays in the user's private history as self-reported.
    return NextResponse.json({ sealed: false, reason: check.reason }, { status: 422 });
  }

  const sealedAt = Date.now();
  await ref.update({
    verified: true,
    sealedAt,
    serverDurationSec: Math.round(session.durationSec),
    status,
  });

  return NextResponse.json({ sealed: true, alreadySealed: false, status });
}
