import { NextRequest, NextResponse } from 'next/server';
import { requireArenaUser, isErrorResponse } from '@/lib/arena/http';
import { getAdminDb } from '@/lib/firebase/admin';
import { validateSessionSeal, deriveSessionStatus } from '@/lib/workouts/seal';
import { checkRateLimit } from '@/lib/ai/ratelimit';
import { WORKOUT_PLANS } from '@/lib/data/plans';
import type { WorkoutSession } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ServerStart = { planId: string; startedAt: number; expiresAt: number };

/** Reject client-created exercise data. Only the shipped plan structure is
 * eligible for XP; completed set counts remain user-reported but bounded. */
function matchPlan(session: WorkoutSession, planId: string) {
  const plan = WORKOUT_PLANS.find((candidate) => candidate.id === planId);
  const exercises = Array.isArray(session.exercises) ? session.exercises : [];
  if (!plan || session.planId !== plan.id || exercises.length !== plan.exercises.length) return null;

  let totalCompletedSets = 0;
  for (let index = 0; index < plan.exercises.length; index += 1) {
    const expected = plan.exercises[index];
    const supplied = exercises[index];
    if (
      !supplied ||
      supplied.exerciseId !== expected.id ||
      supplied.name !== expected.name ||
      supplied.targetSets !== expected.sets ||
      !Number.isInteger(supplied.completedSets) ||
      supplied.completedSets < 0 ||
      supplied.completedSets > expected.sets
    ) return null;
    totalCompletedSets += supplied.completedSets;
  }
  return { plan, exercises, totalCompletedSets };
}

/**
 * POST /api/workouts/seal — { sessionId }
 *
 * A session can be sealed only when its ID was issued by POST /api/workouts/start
 * for the same authenticated user and plan. This makes the start clock
 * server-controlled, prevents backdating, and constrains XP-eligible exercise
 * data to the shipped plan. It remains an honest-activity signal, not a claim
 * that physical exercise can be proven from a browser.
 */
export async function POST(req: NextRequest) {
  const auth = await requireArenaUser(req);
  if (isErrorResponse(auth)) return auth;
  const { uid } = auth;

  const rl = await checkRateLimit(`workout-seal:${uid}`, 40, 60 * 60 * 1000);
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

  try {
    const db = getAdminDb();
    const ref = db.ref(`users/${uid}/workouts/${sessionId}`);
    const [sessionSnap, startSnap] = await Promise.all([
      ref.get(),
      db.ref(`workoutStarts/${uid}/${sessionId}`).get(),
    ]);
    if (!sessionSnap.exists()) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

    const existing = sessionSnap.val() as WorkoutSession & { verified?: boolean; sealedAt?: number };
    if (existing.verified === true) {
      return NextResponse.json({ sealed: true, alreadySealed: true, status: existing.status });
    }
    if (!startSnap.exists()) {
      return NextResponse.json({ sealed: false, reason: 'This session was not started by the verification service.' }, { status: 422 });
    }

    const serverStart = startSnap.val() as ServerStart;
    const sealedAt = Date.now();
    if (
      typeof serverStart.planId !== 'string' ||
      !Number.isFinite(serverStart.startedAt) ||
      !Number.isFinite(serverStart.expiresAt) ||
      serverStart.expiresAt < sealedAt
    ) {
      return NextResponse.json({ sealed: false, reason: 'The verification window has expired.' }, { status: 422 });
    }

    let refusal: string | null = null;
    let sealedStatus: 'completed' | 'partial' = 'partial';
    const transaction = await ref.transaction((value: unknown) => {
      const session = value as WorkoutSession & { verified?: boolean } | null;
      if (!session) {
        refusal = 'Session was removed before it could be verified.';
        return undefined;
      }
      if (session.verified === true) return session;

      const matched = matchPlan(session, serverStart.planId);
      if (!matched) {
        refusal = 'Session data does not match the selected workout plan.';
        return undefined;
      }
      const endedAt = Number(session.endedAt);
      if (!Number.isFinite(endedAt) || endedAt > sealedAt + 60_000) {
        refusal = 'Session end time is invalid.';
        return undefined;
      }
      const check = validateSessionSeal({
        startedAt: serverStart.startedAt,
        endedAt: Math.min(endedAt, sealedAt),
        durationSec: Number(session.durationSec),
        totalCompletedSets: matched.totalCompletedSets,
        now: sealedAt,
      });
      if (!check.ok) {
        refusal = check.reason;
        return undefined;
      }

      sealedStatus = deriveSessionStatus(matched.exercises);
      return {
        ...session,
        // Canonicalize the values that affect eligibility and summary output.
        planId: matched.plan.id,
        planName: matched.plan.name,
        startedAt: serverStart.startedAt,
        endedAt: Math.min(endedAt, sealedAt),
        totalSets: matched.totalCompletedSets,
        status: sealedStatus,
        verified: true,
        sealedAt,
        serverDurationSec: Math.round(Number(session.durationSec)),
      };
    });

    if (!transaction.committed) {
      return NextResponse.json({ sealed: false, reason: refusal ?? 'Session could not be verified.' }, { status: 422 });
    }
    const sealed = transaction.snapshot.val() as WorkoutSession & { verified?: boolean; status?: 'completed' | 'partial' };
    if (sealed.verified !== true) {
      return NextResponse.json({ sealed: false, reason: 'Session could not be verified.' }, { status: 422 });
    }

    // Retain no reusable start token after the first successful seal. A retry
    // remains idempotent because the immutable verified session is checked first.
    await db.ref(`workoutStarts/${uid}/${sessionId}`).remove();
    return NextResponse.json({ sealed: true, alreadySealed: false, status: sealed.status ?? sealedStatus });
  } catch (err) {
    console.error('[workouts] seal failed:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'SEAL_FAILED' }, { status: 500 });
  }
}
