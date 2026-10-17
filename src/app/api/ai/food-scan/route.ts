import { NextRequest, NextResponse } from 'next/server';
import { verifyRequestUser, AdminNotConfiguredError } from '@/lib/firebase/admin';
import { rateLimit } from '@/lib/ai/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Food-photo analysis — INTEGRATION PLACEHOLDER.
 *
 * This route intentionally returns 503 until a real, vision-capable model
 * (e.g. a Groq vision model or a dedicated service) is wired in. The UI must
 * never fabricate analysis: when this returns VISION_NOT_CONFIGURED, the
 * client displays the honest "not connected yet" state.
 */
export async function POST(req: NextRequest) {
  let decoded;
  try {
    decoded = await verifyRequestUser(req);
  } catch (err) {
    if (err instanceof AdminNotConfiguredError) {
      return NextResponse.json({ error: 'AUTH_NOT_CONFIGURED' }, { status: 503 });
    }
    throw err;
  }
  if (!decoded) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });

  const rl = rateLimit(`foodscan:${decoded.uid}`, 10, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: 'RATE_LIMITED', retryAfterSec: rl.retryAfterSec }, { status: 429 });
  }

  const visionConfigured = process.env.GROQ_VISION_ENABLED === 'true';
  if (!visionConfigured) {
    return NextResponse.json(
      {
        error: 'VISION_NOT_CONFIGURED',
        message:
          'Food-photo analysis is not connected yet. Wire a vision-capable model provider on the server and set GROQ_VISION_ENABLED=true.',
      },
      { status: 503 },
    );
  }

  // Future: parse multipart image → call vision model → validate + return
  // structured nutrition estimate labelled source: 'estimate'.
  return NextResponse.json({ error: 'VISION_NOT_IMPLEMENTED' }, { status: 501 });
}
