import { NextRequest, NextResponse } from 'next/server';
import { requireArenaUser, isErrorResponse } from '@/lib/arena/http';
import { withdrawFromArena } from '@/lib/arena/server';
import { checkRateLimit } from '@/lib/ai/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/arena/withdraw — leave the Arena completely.
 * Deletes the public profile + public score projections + relationships.
 * Preserves: private workouts/nutrition history, lifetime XP, verified event
 * log, and the account itself.
 */
export async function POST(req: NextRequest) {
  const auth = await requireArenaUser(req);
  if (isErrorResponse(auth)) return auth;
  const { uid } = auth;

  const rl = await checkRateLimit(`arena-withdraw:${uid}`, 6, 60 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: 'RATE_LIMITED', retryAfterSec: rl.retryAfterSec }, { status: 429 });

  await withdrawFromArena(uid);
  return NextResponse.json({ ok: true });
}
