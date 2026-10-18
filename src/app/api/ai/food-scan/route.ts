import { NextRequest } from 'next/server';
import { verifyRequestUser, AdminNotConfiguredError } from '@/lib/firebase/admin';
import { groqVision, GroqNotConfiguredError, GroqRequestError } from '@/lib/ai/groq';
import { parseVisionEstimate, VISION_PROMPT } from '@/lib/ai/vision-parse';
import { checkRateLimit, clientIp } from '@/lib/ai/ratelimit';
import { apiJson, logApiEvent, logApiFailure, requestContext } from '@/lib/observability/server';

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
  const trace = requestContext(req, 'POST /api/ai/food-scan');
  let decoded;
  try {
    decoded = await verifyRequestUser(req);
  } catch (err) {
    if (err instanceof AdminNotConfiguredError) {
      logApiFailure(trace, 'AUTH_NOT_CONFIGURED', 503);
      return apiJson({ error: 'AUTH_NOT_CONFIGURED' }, trace, { status: 503 });
    }
    logApiFailure(trace, 'AUTH_ERROR', 500);
    return apiJson({ error: 'AUTH_ERROR' }, trace, { status: 500 });
  }
  if (!decoded) {
    logApiFailure(trace, 'UNAUTHENTICATED', 401);
    return apiJson({ error: 'UNAUTHENTICATED' }, trace, { status: 401 });
  }

  const rl = await checkRateLimit(`foodscan:${decoded.uid}`, 10, 60 * 60 * 1000);
  if (!rl.ok) {
    logApiFailure(trace, 'RATE_LIMITED_USER', 429);
    return apiJson({ error: 'RATE_LIMITED', retryAfterSec: rl.retryAfterSec }, trace, { status: 429 });
  }
  // IP-aware second bucket — cost control against account-hopping abuse.
  const rlIp = await checkRateLimit(`foodscan:ip:${clientIp(req)}`, 60, 60 * 60 * 1000);
  if (!rlIp.ok) {
    logApiFailure(trace, 'RATE_LIMITED_IP', 429);
    return apiJson({ error: 'RATE_LIMITED', retryAfterSec: rlIp.retryAfterSec }, trace, { status: 429 });
  }

  if (process.env.GROQ_VISION_ENABLED !== 'true') {
    logApiFailure(trace, 'VISION_NOT_CONFIGURED', 503);
    return apiJson(
      { error: 'VISION_NOT_CONFIGURED', message: 'Food-photo analysis is disabled. Set GROQ_VISION_ENABLED=true with Groq keys configured.' },
      trace,
      { status: 503 },
    );
  }

  let image: string;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_CHARS) {
      logApiFailure(trace, 'IMAGE_TOO_LARGE', 413);
      return apiJson({ error: 'IMAGE_TOO_LARGE', message: 'Photo is too large — please retake closer or crop it.' }, trace, { status: 413 });
    }
    const body = JSON.parse(raw) as Record<string, unknown>;
    if (typeof body.image !== 'string' || !DATA_URL_RE.test(body.image.replace(/\s+/g, ''))) {
      logApiFailure(trace, 'INVALID_IMAGE', 400);
      return apiJson({ error: 'INVALID_IMAGE' }, trace, { status: 400 });
    }
    image = body.image.replace(/\s+/g, '');
  } catch {
    logApiFailure(trace, 'BAD_REQUEST', 400);
    return apiJson({ error: 'BAD_REQUEST' }, trace, { status: 400 });
  }

  try {
    const result = await groqVision(image, VISION_PROMPT);
    const estimate = parseVisionEstimate(result.content);
    if (!estimate) {
      logApiFailure(trace, 'ANALYSIS_UNREADABLE', 422);
      return apiJson({ error: 'ANALYSIS_UNREADABLE', message: 'Couldn’t read the photo. Try better lighting and a top-down shot.' }, trace, { status: 422 });
    }
    if (estimate.items.length === 0) {
      logApiFailure(trace, 'NO_FOOD_DETECTED', 422);
      return apiJson({ error: 'NO_FOOD_DETECTED', message: estimate.notes || 'No food was detected. Try a clearer, closer photo.' }, trace, { status: 422 });
    }
    logApiEvent('info', trace, 'food_scan_complete', { itemCount: estimate.items.length, usedFallbackKey: result.usedFallbackKey });
    return apiJson({
      estimate: true, // UI must label every value as an estimate
      model: result.model,
      items: estimate.items,
      notes: estimate.notes || 'AI estimate — verify portions before logging.',
    }, trace);
  } catch (err) {
    if (err instanceof GroqNotConfiguredError) {
      logApiFailure(trace, 'GROQ_NOT_CONFIGURED', 503);
      return apiJson({ error: 'GROQ_NOT_CONFIGURED' }, trace, { status: 503 });
    }
    logApiFailure(trace, 'AI_UNAVAILABLE', 502, {
      upstreamStatus: err instanceof GroqRequestError ? String(err.status ?? 'network-timeout') : 'unexpected',
    });
    return apiJson({ error: 'AI_UNAVAILABLE' }, trace, { status: 502 });
  }
}
