import { NextRequest, NextResponse } from 'next/server';
import { requireArenaUser, isErrorResponse } from '@/lib/arena/http';
import {
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  blockUser,
  unblockUser,
  getFriendsOverview,
} from '@/lib/arena/server';
import { rateLimit } from '@/lib/ai/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const ARENA_ID_RE = /^[A-Z2-9]{4}-[A-Z2-9]{4}$/;

/** GET /api/arena/friends — my friends, incoming/outgoing requests, blocks. */
export async function GET(req: NextRequest) {
  const auth = await requireArenaUser(req);
  if (isErrorResponse(auth)) return auth;

  const rl = rateLimit(`arena-friends-read:${auth.uid}`, 120, 60 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: 'RATE_LIMITED', retryAfterSec: rl.retryAfterSec }, { status: 429 });

  const overview = await getFriendsOverview(auth.uid);
  return NextResponse.json(overview);
}

/**
 * POST /api/arena/friends — every mutation is validated against relationships
 * and blocks, server-side, before any write occurs.
 * Body: { action: request|accept|reject|remove|block|unblock, arenaId?, requestId?, uid? }
 */
export async function POST(req: NextRequest) {
  const auth = await requireArenaUser(req);
  if (isErrorResponse(auth)) return auth;
  const { uid } = auth;

  const rl = rateLimit(`arena-friends:${uid}`, 40, 60 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: 'RATE_LIMITED', retryAfterSec: rl.retryAfterSec }, { status: 429 });

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 4096) return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });
  }

  const action = body.action;
  const requestId = typeof body.requestId === 'string' && UID_RE.test(body.requestId) ? body.requestId : undefined;
  const targetUid = typeof body.uid === 'string' && UID_RE.test(body.uid) ? body.uid : undefined;
  const arenaId =
    typeof body.arenaId === 'string' && ARENA_ID_RE.test(body.arenaId.toUpperCase())
      ? body.arenaId.toUpperCase()
      : undefined;

  try {
    switch (action) {
      case 'request': {
        if (!arenaId) return NextResponse.json({ error: 'INVALID_ARENA_ID', message: 'Enter an Arena ID in the format XXXX-XXXX.' }, { status: 400 });
        const res = await sendFriendRequest(uid, arenaId);
        return NextResponse.json(res, { status: res.ok ? 200 : 400 });
      }
      case 'accept': {
        if (!requestId) return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });
        const res = await acceptFriendRequest(uid, requestId);
        return NextResponse.json(res, { status: res.ok ? 200 : 400 });
      }
      case 'reject': {
        if (!requestId) return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });
        const res = await rejectFriendRequest(uid, requestId);
        return NextResponse.json(res, { status: res.ok ? 200 : 400 });
      }
      case 'remove': {
        if (!targetUid) return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });
        const res = await removeFriend(uid, targetUid);
        return NextResponse.json(res, { status: res.ok ? 200 : 400 });
      }
      case 'block': {
        if (!targetUid && !arenaId) return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });
        const res = await blockUser(uid, { uid: targetUid, arenaId });
        return NextResponse.json(res, { status: res.ok ? 200 : 400 });
      }
      case 'unblock': {
        if (!targetUid) return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });
        const res = await unblockUser(uid, targetUid);
        return NextResponse.json(res, { status: res.ok ? 200 : 400 });
      }
      default:
        return NextResponse.json({ error: 'UNKNOWN_ACTION' }, { status: 400 });
    }
  } catch (err) {
    console.error('[arena] friends op failed:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'FRIENDS_OP_FAILED' }, { status: 500 });
  }
}
