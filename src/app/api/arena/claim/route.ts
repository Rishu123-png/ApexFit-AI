import { NextRequest, NextResponse } from 'next/server';
import { requireArenaUser, isErrorResponse } from '@/lib/arena/http';
import { awardXp } from '@/lib/arena/server';
import { isValidEventType, isValidTimeZone } from '@/lib/arena/validate';
import { checkRateLimit } from '@/lib/ai/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/arena/claim — claim XP for a verified activity.
 * Body: { type, sourceId?, tz? } — the server loads the referenced record
 * from the caller's OWN private data and validates eligibility. XP amounts
 * come from server config only; client-supplied amounts are rejected/ignored.
 */
export async function POST(req: NextRequest) {
  const auth = await requireArenaUser(req);
  if (isErrorResponse(auth)) return auth;
  const { uid } = auth;

  const rl = await checkRateLimit(`arena-claim:${uid}`, 30, 60 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: 'RATE_LIMITED', retryAfterSec: rl.retryAfterSec }, { status: 429 });

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 4096) return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });
  }

  if (!isValidEventType(body.type))
    return NextResponse.json({ error: 'INVALID_TYPE' }, { status: 400 });

  // Never accept client-supplied XP.
  if ('xp' in body || 'amount' in body || 'points' in body)
    return NextResponse.json({ error: 'XP_NOT_CLIENT_SPECIFIED', message: 'XP is calculated on the server.' }, { status: 400 });

  const sourceId =
    typeof body.sourceId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(body.sourceId) ? body.sourceId : undefined;
  const tz = typeof body.tz === 'string' && isValidTimeZone(body.tz) ? body.tz : 'Asia/Kolkata';

  try {
    const result = await awardXp({ uid, tz, type: body.type, sourceId });
    const status =
      result.status === 'awarded' ? 200
      : result.status === 'already_awarded' ? 200 // benign idempotent response
      : result.status === 'not_participating' ? 409
      : result.status === 'daily_cap' ? 200
      : 422;
    return NextResponse.json(result, { status });
  } catch (err) {
    console.error('[arena] claim failed:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'CLAIM_FAILED' }, { status: 500 });
  }
}
