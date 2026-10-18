import { describe, it, expect } from 'vitest';
import { validateSessionSeal, deriveSessionStatus, SEAL_LIMITS } from '../seal';

const NOW = 1_800_000_000_000; // fixed now
const hour = 3_600_000;

function base(over: Partial<Parameters<typeof validateSessionSeal>[0]> = {}) {
  return {
    startedAt: NOW - 40 * 60_000,
    endedAt: NOW - 5 * 60_000,
    durationSec: 1500,
    totalCompletedSets: 6,
    now: NOW,
    ...over,
  };
}

describe('validateSessionSeal — fraud rejection', () => {
  it('accepts a plausible fresh session', () => {
    expect(validateSessionSeal(base()).ok).toBe(true);
  });

  it('rejects a session starting in the future (forged timestamp)', () => {
    const r = validateSessionSeal(base({ startedAt: NOW + hour, endedAt: NOW + 2 * hour }));
    expect(r.ok).toBe(false);
  });

  it('rejects stale sessions older than the sealing window', () => {
    const r = validateSessionSeal(base({
      startedAt: NOW - SEAL_LIMITS.maxAgeMs - hour,
      endedAt: NOW - SEAL_LIMITS.maxAgeMs,
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/too old/i);
  });

  it('rejects claimed duration exceeding real elapsed time (inflated session)', () => {
    const r = validateSessionSeal(base({ durationSec: 3_000 })); // usable window was only 35 min
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/elapsed/i);
  });

  it('rejects non-monotonic timestamps', () => {
    const r = validateSessionSeal(base({ endedAt: NOW - hour, startedAt: NOW - 5 * 60_000 }));
    expect(r.ok).toBe(false);
  });

  it('rejects absurd durations', () => {
    expect(validateSessionSeal(base({ durationSec: SEAL_LIMITS.maxDurationSec + 1 })).ok).toBe(false);
    expect(validateSessionSeal(base({ durationSec: -5 })).ok).toBe(false);
  });

  it('rejects sessions with no logged sets (phantom finish)', () => {
    const r = validateSessionSeal(base({ totalCompletedSets: 0 }));
    expect(r.ok).toBe(false);
  });

  it('rejects malformed numbers', () => {
    expect(validateSessionSeal(base({ durationSec: NaN })).ok).toBe(false);
    expect(validateSessionSeal(base({ startedAt: Infinity })).ok).toBe(false);
  });

  it('tolerates only the short server-timed UI/network grace window', () => {
    // 35 min elapsed + 60 sec is inside the 90-sec allowance.
    const r = validateSessionSeal(base({
      startedAt: NOW - 35 * 60_000,
      endedAt: NOW,
      durationSec: 36 * 60,
    }));
    expect(r.ok).toBe(true);
    // The old five-minute window made it too easy to complete instantly.
    expect(validateSessionSeal(base({
      startedAt: NOW - 35 * 60_000,
      endedAt: NOW,
      durationSec: 37 * 60,
    })).ok).toBe(false);
  });
});

describe('deriveSessionStatus', () => {
  it('completed when all target sets are done', () => {
    expect(deriveSessionStatus([
      { targetSets: 3, completedSets: 3 },
      { targetSets: 2, completedSets: 2 },
    ])).toBe('completed');
  });

  it('partial when any exercise is short', () => {
    expect(deriveSessionStatus([
      { targetSets: 3, completedSets: 3 },
      { targetSets: 2, completedSets: 1 },
    ])).toBe('partial');
  });

  it('partial for empty sessions', () => {
    expect(deriveSessionStatus([])).toBe('partial');
  });
});
