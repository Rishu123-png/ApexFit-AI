import { NextRequest } from 'next/server';
import { requireArenaUser, isErrorResponse } from '@/lib/arena/http';
import { getAdminDb } from '@/lib/firebase/admin';
import { WORKOUT_PLANS } from '@/lib/data/plans';
import { checkRateLimit } from '@/lib/ai/ratelimit';
import { apiJson, logApiEvent, logApiFailure, requestContext } from '@/lib/observability/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Issues an opaque, server-timed workout start. The matching private session
 * may still be written by the client, but only this server record makes it
 * eligible for a later Arena seal/XP claim.
 */
export async function POST(req: NextRequest) {
  const trace = requestContext(req, 'POST /api/workouts/start');
  const auth = await requireArenaUser(req);
  if (isErrorResponse(auth)) return auth;

  const rate = await checkRateLimit(`workout-start:${auth.uid}`, 12, 60 * 60 * 1000);
  if (!rate.ok) {
    logApiFailure(trace, 'RATE_LIMITED', 429);
    return apiJson({ error: 'RATE_LIMITED', retryAfterSec: rate.retryAfterSec }, trace, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 1024) {
      logApiFailure(trace, 'PAYLOAD_TOO_LARGE', 413);
      return apiJson({ error: 'PAYLOAD_TOO_LARGE' }, trace, { status: 413 });
    }
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    logApiFailure(trace, 'BAD_REQUEST', 400);
    return apiJson({ error: 'BAD_REQUEST' }, trace, { status: 400 });
  }

  const planId = typeof body.planId === 'string' ? body.planId : '';
  if (!WORKOUT_PLANS.some((plan) => plan.id === planId)) {
    logApiFailure(trace, 'UNKNOWN_PLAN', 400);
    return apiJson({ error: 'UNKNOWN_PLAN' }, trace, { status: 400 });
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
    logApiEvent('info', trace, 'workout_start_created');
    return apiJson({ sessionId, startedAt }, trace);
  } catch {
    logApiFailure(trace, 'START_FAILED', 500);
    return apiJson({ error: 'START_FAILED' }, trace, { status: 500 });
  }
}
