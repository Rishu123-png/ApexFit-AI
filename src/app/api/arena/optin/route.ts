import { NextRequest, NextResponse } from 'next/server';
import { requireArenaUser, isErrorResponse } from '@/lib/arena/http';
import { createArenaProfile, getArenaProfile } from '@/lib/arena/server';
import { validateDisplayName, normalizeDisplayName, isValidAvatarId, isValidVisibility, isValidTimeZone } from '@/lib/arena/validate';
import { checkRateLimit } from '@/lib/ai/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/arena/optin — publish an Arena profile after explicit consent. */
export async function POST(req: NextRequest) {
  const auth = await requireArenaUser(req);
  if (isErrorResponse(auth)) return auth;
  const { uid } = auth;

  const rl = await checkRateLimit(`arena-optin:${uid}`, 6, 60 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: 'RATE_LIMITED', retryAfterSec: rl.retryAfterSec }, { status: 429 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });
  }

  const nameError = validateDisplayName(body.displayName);
  if (nameError) return NextResponse.json({ error: 'INVALID_NAME', message: nameError }, { status: 400 });
  if (!isValidAvatarId(body.avatarId))
    return NextResponse.json({ error: 'INVALID_AVATAR' }, { status: 400 });
  if (!isValidVisibility(body.visibility))
    return NextResponse.json({ error: 'INVALID_VISIBILITY' }, { status: 400 });
  if (!body.visibility.global && !body.visibility.friends)
    return NextResponse.json({ error: 'NO_COMPETITION', message: 'Choose at least one leaderboard to join.' }, { status: 400 });

  const tz = typeof body.tz === 'string' && isValidTimeZone(body.tz) ? body.tz : 'Asia/Kolkata';
  // Explicit consent flag must be true — this is the opt-in record.
  if (body.consent !== true)
    return NextResponse.json({ error: 'CONSENT_REQUIRED' }, { status: 400 });

  const existing = await getArenaProfile(uid);
  if (existing) return NextResponse.json({ error: 'ALREADY_JOINED', profile: existing }, { status: 409 });

  const profile = await createArenaProfile(uid, {
    displayName: normalizeDisplayName(body.displayName as string),
    avatarId: body.avatarId,
    tz,
    visibility: body.visibility,
  });
  return NextResponse.json({ profile }, { status: 201 });
}
