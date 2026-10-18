import { NextRequest, NextResponse } from 'next/server';
import { requireArenaUser, isErrorResponse } from '@/lib/arena/http';
import { getAdminDb } from '@/lib/firebase/admin';
import { WORKOUT_PLANS } from '@/lib/data/plans';
import { checkRateLimit } from '@/lib/ai/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Issues an opaque, server-timed workout start. The matching private session
 * may still be written by the client, but only this server record makes it
 * eligible for a later Arena seal/XP claim.
 */
export async function POST(req: NextRequest) {
  const auth = await requireArenaUser(req);
  if (isErrorResponse(auth)) return auth;

  const rate = await checkRateLimit(`workout-start:${auth.uid}`, 12, 60 * 60 * 1000);
  if (!rate.ok) {
    return NextResponse.json({ error: 'RATE_LIMITED', retryAfterSec: rate.retryAfterSec }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 1024) return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });
  }

  const planId = typeof body.planId === 'string' ? body.planId : '';
  if (!WORKOUT_PLANS.some((plan) => plan.id === planId)) {
    return NextResponse.json({ error: 'UNKNOWN_PLAN' }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const sessionId = db.ref().push().key;
    if (!sessionId) throw new Error('Could not allocate session ID');
    const startedAt = Date.now();
    await db.ref(`workoutStarts/${auth.uid}/${sessionId}`).set({
      planId,
      startedAt,
      // The seal route rejects old starts. This value also supports future
      // server-side cleanup without trusting browser timestamps.
      expiresAt: startedAt + 12 * 60 * 60 * 1000,
    });
    return NextResponse.json({ sessionId, startedAt });
  } catch (err) {
    console.error('[workouts] start failed:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'START_FAILED' }, { status: 500 });
  }
}
