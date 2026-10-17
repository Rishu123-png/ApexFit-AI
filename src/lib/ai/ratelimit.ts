import 'server-only';

/**
 * Shared rate limiting (spec §10).
 *
 * Backend selection order:
 *  1. Upstash Redis REST (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN)
 *     when configured → atomic INCR with one-shot PEXPIRE …NX, survives
 *     across serverless instances.
 *  2. Bounded in-memory fixed-window Map otherwise → explicitly NOT
 *     distributed protection; it is a per-instance safety valve. Callers
 *     must not claim stronger guarantees.
 *
 * Upstash network failures degrade to the in-memory fallback rather than
 * opening or closing all traffic.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_MEMORY_BUCKETS = 5000;

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec: number;
  /** transparency about which protection was actually applied */
  backend: 'upstash' | 'memory';
}

function memoryLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_MEMORY_BUCKETS) {
      // Evict the oldest expired entries; deterministic pressure release.
      for (const [k, v] of buckets) {
        buckets.delete(k);
        if (buckets.size < MAX_MEMORY_BUCKETS * 0.75 || v.resetAt <= now) continue;
        break;
      }
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0, backend: 'memory' };
  }

  if (bucket.count >= limit) {
    return { ok: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000), backend: 'memory' };
  }
  bucket.count += 1;
  return { ok: true, retryAfterSec: 0, backend: 'memory' };
}

// Best-effort cleanup to avoid unbounded growth on long-lived servers.
if (typeof setInterval !== 'undefined') {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  }, 60_000);
  if (typeof timer.unref === 'function') timer.unref();
}

async function upstashLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    // INCR + unconditional-then-conditional expire: PEXPIRE … NX is not
    // supported by all versions; use EXPIRE with "NX" where possible and
    // accept GET-wins semantics otherwise (count stay bounded by TTL set
    // once at first command).
    const res = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCR', key],
        ['PEXPIRE', key, windowMs, 'NX'],
      ]),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result: number }[];
    const count = Number(data?.[0]?.result ?? 0);
    if (!Number.isFinite(count)) return null;
    if (count > limit) {
      // estimate of the window: Upstash PTTL lookup would add a round-trip;
      // return the policy window as a safe upper bound.
      return { ok: false, retryAfterSec: Math.ceil(windowMs / 1000), backend: 'upstash' };
    }
    return { ok: true, retryAfterSec: 0, backend: 'upstash' };
  } catch {
    return null; // degrade honestly to memory fallback
  }
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const up = await upstashLimit(key, limit, windowMs);
  if (up) return up;
  return memoryLimit(key, limit, windowMs);
}

/** First public IP from the proxy header — used only inside limit keys, never logged/stored. */
export function clientIp(req: { headers: Headers }): string {
  const fwd = req.headers.get('x-forwarded-for') ?? '';
  const first = fwd.split(',')[0]?.trim();
  return first && first.length <= 45 ? first.replace(/[^0-9a-fA-F.:]/g, '') : 'unknown';
}

/** Back-compat alias retained for existing tests/policies. */
export const rateLimitPolicyNote =
  'Authenticated per-user limits via checkRateLimit(); distributed atomics when UPSTASH_REDIS_REST_URL/TOKEN are configured; bounded in-memory fallback otherwise.';
