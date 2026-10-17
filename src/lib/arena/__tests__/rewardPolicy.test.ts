import { describe, it, expect } from 'vitest';
import { decideDailyAward, eventDecision, EVENT_STALE_AFTER_MS, type StoredArenaEvent } from '../rewardPolicy';

const CFG = { dailyCap: 200, maxWorkoutAwardsPerDay: 2 };
const baseEvent: StoredArenaEvent = {
  type: 'workout_completed',
  sourceId: 's1',
  xp: 50,
  dayKey: '2026-10-17',
  weekKey: '2026-W42',
  seasonKey: '2026-2H',
  createdAt: 1_000_000,
  status: 'applied',
  attempts: 1,
};

describe('eventDecision — durable idempotency state machine', () => {
  it('absent record → create', () => {
    expect(eventDecision(null, 2_000_000).action).toBe('create');
  });

  it('applied record → idempotent replay (no double award)', () => {
    const d = eventDecision({ ...baseEvent, status: 'applied' }, baseEvent.createdAt + 5000);
    expect(d).toEqual({ action: 'replay', status: 'applied', xp: 50 });
  });

  it('legacy record without status (Task-1/2 era) → replay as applied', () => {
    const { type, sourceId, xp, dayKey, weekKey, seasonKey, createdAt } = baseEvent;
    const d = eventDecision({ type, sourceId, xp, dayKey, weekKey, seasonKey, createdAt } as StoredArenaEvent, createdAt + 5000);
    expect(d).toEqual({ action: 'replay', status: 'applied', xp: 50 });
  });

  it('fresh pending → in-progress (concurrent identical claim is not double-applied)', () => {
    const d = eventDecision({ ...baseEvent, status: 'pending' }, baseEvent.createdAt + EVENT_STALE_AFTER_MS - 1000);
    expect(d.action).toBe('in-progress');
  });

  it('stale pending → retry (stranded event recovers)', () => {
    const d = eventDecision({ ...baseEvent, status: 'pending' }, baseEvent.createdAt + EVENT_STALE_AFTER_MS + 1);
    expect(d.action).toBe('retry');
  });

  it('failed → retry', () => {
    const d = eventDecision({ ...baseEvent, status: 'failed', error: 'boom' }, baseEvent.createdAt + 1000);
    expect(d.action).toBe('retry');
    if (d.action === 'retry') expect(d.event.error).toBe('boom');
  });

  it('cap_limited → closed replay with 0 xp (no later retry inflates)', () => {
    const d = eventDecision({ ...baseEvent, status: 'cap_limited' }, baseEvent.createdAt + 999999);
    expect(d).toEqual({ action: 'replay', status: 'cap_limited', xp: 0 });
  });
});

describe('decideDailyAward — atomic cap/quota transaction policy (§7)', () => {
  it('adds xp and workout award within bounds', () => {
    const d = decideDailyAward({ xp: 100, workoutAwards: 1 }, { xp: 50, isWorkoutType: true }, CFG);
    expect(d.ok).toBe(true);
    if (d.ok) expect(d.next).toEqual({ xp: 150, workoutAwards: 2 });
  });

  it('works from an empty day (null counter)', () => {
    const d = decideDailyAward(null, { xp: 15, isWorkoutType: false }, CFG);
    expect(d.ok).toBe(true);
    if (d.ok) expect(d.next).toEqual({ xp: 15, workoutAwards: 0 });
  });

  it('allows hitting the cap EXACTLY (boundary value)', () => {
    const d = decideDailyAward({ xp: 150, workoutAwards: 2 }, { xp: 50, isWorkoutType: false }, CFG);
    expect(d.ok).toBe(true);
  });

  it('rejects 1 XP over the cap — even if a race tried to sneak it', () => {
    const d = decideDailyAward({ xp: 151, workoutAwards: 0 }, { xp: 50, isWorkoutType: true }, CFG);
    expect(d.ok).toBe(false);
  });

  it('rejects over-quota workout awards independently of the XP cap', () => {
    const d = decideDailyAward({ xp: 100, workoutAwards: 2 }, { xp: 50, isWorkoutType: true }, CFG);
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toMatch(/workout rewards/i);
  });

  it('missions do not consume the workout quota', () => {
    const d = decideDailyAward({ xp: 100, workoutAwards: 2 }, { xp: 15, isWorkoutType: false }, CFG);
    expect(d.ok).toBe(true);
    if (d.ok) expect(d.next.workoutAwards).toBe(2);
  });

  it('is pure: re-evaluating the same aborted award never mutates input state', () => {
    const cur = { xp: 180, workoutAwards: 2 };
    const d1 = decideDailyAward(cur, { xp: 50, isWorkoutType: true }, CFG);
    const d2 = decideDailyAward(cur, { xp: 50, isWorkoutType: true }, CFG);
    expect(d1.ok).toBe(false);
    expect(d2.ok).toBe(false);
    expect(cur).toEqual({ xp: 180, workoutAwards: 2 });
  });
});
