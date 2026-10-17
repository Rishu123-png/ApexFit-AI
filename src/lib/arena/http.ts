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
