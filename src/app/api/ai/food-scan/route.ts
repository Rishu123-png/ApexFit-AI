import { NextRequest, NextResponse } from 'next/server';
import { verifyRequestUser, AdminNotConfiguredError } from '@/lib/firebase/admin';
import { groqVision, GroqNotConfiguredError, GroqRequestError } from '@/lib/ai/groq';
import { parseVisionEstimate, VISION_PROMPT } from '@/lib/ai/vision-parse';
import { checkRateLimit, clientIp } from '@/lib/ai/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ~2.1 MB base64 payload ceiling (≈1.5 MB image) — keeps the route cheap and
// usable on slow networks. UI downscales before upload.
const MAX_BODY_CHARS = 2_800_000;
const DATA_URL_RE = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=\s]{100,}$/;

/**
 * POST /api/ai/food-scan — REAL vision integration (Groq vision model).
 * Returns portion-level macro ESTIMATES only (never "verified"), with per-item
 * confidence so the UI can let the user correct them before logging.
 * Returns 503 VISION_NOT_CONFIGURED when the feature flag/keys are absent —
 * the UI shows the honest unavailable state rather than inventing numbers.
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

  const rl = await checkRateLimit(`foodscan:${decoded.uid}`, 10, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: 'RATE_LIMITED', retryAfterSec: rl.retryAfterSec }, { status: 429 });
  }
  // IP-aware second bucket — cost control against account-hopping abuse.
  const rlIp = await checkRateLimit(`foodscan:ip:${clientIp(req)}`, 60, 60 * 60 * 1000);
  if (!rlIp.ok) {
    return NextResponse.json({ error: 'RATE_LIMITED', retryAfterSec: rlIp.retryAfterSec }, { status: 429 });
  }

  if (process.env.GROQ_VISION_ENABLED !== 'true') {
    return NextResponse.json(
      {
        error: 'VISION_NOT_CONFIGURED',
        message: 'Food-photo analysis is disabled. Set GROQ_VISION_ENABLED=true with Groq keys configured.',
      },
      { status: 503 },
    );
  }

  let image: string;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_CHARS)
      return NextResponse.json({ error: 'IMAGE_TOO_LARGE', message: 'Photo is too large — please retake closer or crop it.' }, { status: 413 });
    const body = JSON.parse(raw) as Record<string, unknown>;
    if (typeof body.image !== 'string' || !DATA_URL_RE.test(body.image.replace(/\s+/g, ''))) {
      return NextResponse.json({ error: 'INVALID_IMAGE' }, { status: 400 });
    }
    image = body.image.replace(/\s+/g, '');
  } catch {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });
  }

  try {
    const result = await groqVision(image, VISION_PROMPT);
    const estimate = parseVisionEstimate(result.content);
    if (!estimate) {
      // Model spoke but not in schema — honest failure, never invent numbers.
      console.warn('[food-scan] model returned unparseable output');
      return NextResponse.json({ error: 'ANALYSIS_UNREADABLE', message: 'Couldn’t read the photo. Try better lighting and a top-down shot.' }, { status: 422 });
    }
    if (estimate.items.length === 0) {
      return NextResponse.json(
        { error: 'NO_FOOD_DETECTED', message: estimate.notes || 'No food was detected. Try a clearer, closer photo.' },
        { status: 422 },
      );
    }
    return NextResponse.json({
      estimate: true, // UI must label every value as an estimate
      model: result.model,
      items: estimate.items,
      notes: estimate.notes || 'AI estimate — verify portions before logging.',
    });
  } catch (err) {
    if (err instanceof GroqNotConfiguredError) {
      return NextResponse.json({ error: 'GROQ_NOT_CONFIGURED' }, { status: 503 });
    }
    console.error('[food-scan] failed:', err instanceof GroqRequestError ? `HTTP ${err.status ?? 'network/timeout'}` : 'unexpected error');
    return NextResponse.json({ error: 'AI_UNAVAILABLE' }, { status: 502 });
  }
}
