import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { verifyRequestUser, AdminNotConfiguredError } from '@/lib/firebase/admin';

/**
 * Shared auth boilerplate for Arena routes:
 * - 503 AUTH_NOT_CONFIGURED when the server lacks Admin credentials
 * - 401 UNAUTHENTICATED when the bearer token is missing/invalid
 * - otherwise the verified uid (the ONLY source of user identity)
 */
export async function requireArenaUser(
  req: NextRequest,
): Promise<{ uid: string } | NextResponse> {
  let decoded;
  try {
    decoded = await verifyRequestUser(req);
  } catch (err) {
    if (err instanceof AdminNotConfiguredError) {
      return NextResponse.json({ error: 'AUTH_NOT_CONFIGURED' }, { status: 503 });
    }
    console.error('[arena] auth error:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'AUTH_ERROR' }, { status: 500 });
  }
  if (!decoded) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  return { uid: decoded.uid };
}

export function isErrorResponse(v: { uid: string } | NextResponse): v is NextResponse {
  return v instanceof NextResponse;
}

export class ArenaServiceTimeoutError extends Error {
  constructor() {
    super('Arena service timed out');
    this.name = 'ArenaServiceTimeoutError';
  }
}

/**
 * Firebase Admin calls do not accept AbortSignals. Race them against a short
 * response deadline so a stalled database connection never leaves a mobile
 * Arena screen on an indefinite skeleton. The underlying call may finish
 * later, but no further response is sent from this request.
 */
export async function withArenaDeadline<T>(work: Promise<T>, timeoutMs = 12_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new ArenaServiceTimeoutError()), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function arenaUnavailableResponse(err: unknown, operation: string): NextResponse {
  const timedOut = err instanceof ArenaServiceTimeoutError;
  if (!timedOut) {
    console.error(`[arena] ${operation} failed:`, err instanceof Error ? err.message : 'unknown');
  }
  return NextResponse.json(
    {
      error: timedOut ? 'ARENA_TIMEOUT' : 'ARENA_UNAVAILABLE',
      message: timedOut ? 'Arena is taking too long to respond. Please retry.' : 'Arena is temporarily unavailable. Please retry.',
    },
    { status: timedOut ? 504 : 503 },
  );
}
