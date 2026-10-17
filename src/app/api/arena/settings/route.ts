import { NextRequest, NextResponse } from 'next/server';
import { requireArenaUser, isErrorResponse } from '@/lib/arena/http';
import { getArenaProfile, updateArenaProfile } from '@/lib/arena/server';
import { validateDisplayName, normalizeDisplayName, isValidAvatarId, isValidVisibility, isValidTimeZone } from '@/lib/arena/validate';
import { checkRateLimit } from '@/lib/ai/ratelimit';
import type { ArenaProfile } from '@/lib/arena/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/arena/settings — change display name, avatar, timezone, and
 * join/leave the global/friends competitions independently.
 */
export async function POST(req: NextRequest) {
  const auth = await requireArenaUser(req);
  if (isErrorResponse(auth)) return auth;
  const { uid } = auth;

  const rl = await checkRateLimit(`arena-settings:${uid}`, 30, 60 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: 'RATE_LIMITED', retryAfterSec: rl.retryAfterSec }, { status: 429 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });
  }

  const existing = await getArenaProfile(uid);
  if (!existing) return NextResponse.json({ error: 'NOT_PARTICIPATING' }, { status: 404 });

  const patch: Partial<Pick<ArenaProfile, 'displayName' | 'avatarId' | 'tz' | 'visibility'>> = {};

  if (body.displayName !== undefined) {
    const nameError = validateDisplayName(body.displayName);
    if (nameError) return NextResponse.json({ error: 'INVALID_NAME', message: nameError }, { status: 400 });
    patch.displayName = normalizeDisplayName(body.displayName as string);
  }
  if (body.avatarId !== undefined) {
    if (!isValidAvatarId(body.avatarId)) return NextResponse.json({ error: 'INVALID_AVATAR' }, { status: 400 });
    patch.avatarId = body.avatarId;
  }
  if (body.tz !== undefined) {
    if (typeof body.tz !== 'string' || !isValidTimeZone(body.tz))
      return NextResponse.json({ error: 'INVALID_TZ' }, { status: 400 });
    patch.tz = body.tz;
  }
  if (body.visibility !== undefined) {
    if (!isValidVisibility(body.visibility))
      return NextResponse.json({ error: 'INVALID_VISIBILITY' }, { status: 400 });
    patch.visibility = body.visibility;
  }

  const profile = await updateArenaProfile(uid, patch);
  return NextResponse.json({ profile });
}
