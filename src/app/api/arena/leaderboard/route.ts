import { NextRequest, NextResponse } from 'next/server';
import { requireArenaUser, isErrorResponse } from '@/lib/arena/http';
import { getLeaderboard } from '@/lib/arena/server';
import { rateLimit } from '@/lib/ai/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SCOPES = new Set(['global', 'friends']);
const PERIODS = new Set(['weekly', 'seasonal', 'lifetime']);

/**
 * GET /api/arena/leaderboard?scope=global|friends&period=weekly|seasonal|lifetime&cursor=0&limit=25
 * Bounded, paginated; relationship and participation filters run server-side.
 */
export async function GET(req: NextRequest) {
  const auth = await requireArenaUser(req);
  if (isErrorResponse(auth)) return auth;
  const { uid } = auth;

  const rl = rateLimit(`arena-board:${uid}`, 120, 60 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: 'RATE_LIMITED', retryAfterSec: rl.retryAfterSec }, { status: 429 });

  const url = new URL(req.url);
  const scope = url.searchParams.get('scope') ?? 'global';
  const period = url.searchParams.get('period') ?? 'weekly';
  if (!SCOPES.has(scope) || !PERIODS.has(period))
    return NextResponse.json({ error: 'BAD_PARAMS', message: 'scope must be global|friends, period weekly|seasonal|lifetime' }, { status: 400 });

  const cursor = Math.max(0, Math.floor(Number(url.searchParams.get('cursor')) || 0));
  const limit = Math.min(50, Math.max(1, Math.floor(Number(url.searchParams.get('limit')) || 25)));

  try {
    const board = await getLeaderboard(
      uid,
      scope as 'global' | 'friends',
      period as 'weekly' | 'seasonal' | 'lifetime',
      cursor,
      limit,
    );
    return NextResponse.json(board);
  } catch (err) {
    console.error('[arena] leaderboard failed:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'BOARD_UNAVAILABLE' }, { status: 500 });
  }
}
