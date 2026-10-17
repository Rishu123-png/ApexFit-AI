/**
 * Workout session seal — pure validation (unit-tested).
 *
 * The client stores a *self-reported* session. Before that session may earn
 * XP, the server re-checks plausibility against its own clock and stamps
 * `verified: true`, `serverDurationSec` and `sealedAt` — fields the database
 * rules forbid clients from writing. The stamp is the ONLY proof Arena
 * rewards accept; it is not tamper-proof against a user who pretends to
 * train in real time, but it closes trivial forgery (phantom durations,
 * backdated/future sessions, fabricated completion).
 */

export const SEAL_LIMITS = {
  /** max clock skew tolerated between client claim and server clock */
  maxFutureSkewMs: 15 * 60_000,
  /** claimed duration may exceed real elapsed time by at most this much */
  graceMs: 5 * 60_000,
  /** no legit single session exceeds this */
  maxDurationSec: 4 * 3600,
  /** sessions older than this cannot be sealed (prevents inventory fraud) */
  maxAgeMs: 6 * 60 * 60_000,
  /** a sealed session must contain at least one logged set */
  minCompletedSets: 1,
} as const;

export interface SealCheckInput {
  startedAt: number;
  endedAt: number;
  durationSec: number;
  totalCompletedSets: number;
  now: number;
}

export type SealCheck = { ok: true } | { ok: false; reason: string };

export function validateSessionSeal(input: SealCheckInput): SealCheck {
  const { startedAt, endedAt, durationSec, totalCompletedSets, now } = input;
  const L = SEAL_LIMITS;

  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || !Number.isFinite(durationSec))
    return { ok: false, reason: 'Malformed timestamps or duration.' };
  if (startedAt > now + L.maxFutureSkewMs)
    return { ok: false, reason: 'Session claims to start in the future.' };
  if (now - startedAt > L.maxAgeMs)
    return { ok: false, reason: 'Session is too old to verify — finish and verify promptly.' };
  if (endedAt < startedAt)
    return { ok: false, reason: 'Session ends before it starts.' };
  if (durationSec < 0 || durationSec > L.maxDurationSec)
    return { ok: false, reason: 'Session duration is outside plausible bounds.' };
  const elapsedMs = Math.max(0, Math.min(endedAt, now) - startedAt);
  if (durationSec * 1000 > elapsedMs + L.graceMs)
    return { ok: false, reason: 'Claimed duration exceeds real elapsed time.' };
  if (totalCompletedSets < L.minCompletedSets)
    return { ok: false, reason: 'At least one set must be logged to verify a session.' };

  return { ok: true };
}

/** Server-authoritative completion status derived from set data. */
export function deriveSessionStatus(
  exercises: { targetSets: number; completedSets: number }[],
): 'completed' | 'partial' {
  if (exercises.length === 0) return 'partial';
  const done = exercises.filter((e) => e.completedSets >= e.targetSets && e.targetSets > 0).length;
  return done === exercises.length ? 'completed' : 'partial';
}
