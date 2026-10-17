import { describe, it, expect } from 'vitest';
import { ARENA_XP_CONFIG, applyDailyCap, arenaEventId, checkEligibility, fbSafeKey } from '../xp';

// Sessions only earn XP when server-verified (sealed via /api/workouts/seal).
const goodWorkout = { durationSec: 1500, status: 'completed' as const, planId: 'foundations-full-body', verified: true };
const mobility = { durationSec: 1200, status: 'completed' as const, planId: 'core-mobility', verified: true };

describe('XP config sanity', () => {
  it('proposed reward values are in place', () => {
    expect(ARENA_XP_CONFIG.xp.workout_completed).toBe(50);
    expect(ARENA_XP_CONFIG.xp.mobility_session).toBe(20);
    expect(ARENA_XP_CONFIG.xp.daily_mission).toBe(15);
    expect(ARENA_XP_CONFIG.xp.nutrition_milestone).toBe(10);
    expect(ARENA_XP_CONFIG.xp.weekly_milestone).toBe(100);
    expect(ARENA_XP_CONFIG.dailyCap).toBeGreaterThan(0);
  });
});

describe('workout_completed eligibility', () => {
  it('accepts an eligible completed workout', () => {
    expect(checkEligibility('workout_completed', { session: goodWorkout, workoutAwardsToday: 0 }).ok).toBe(true);
  });
  it('rejects short workouts (anti gaming)', () => {
    const r = checkEligibility('workout_completed', { session: { ...goodWorkout, durationSec: 120 }, workoutAwardsToday: 0 });
    expect(r.ok).toBe(false);
  });
  it('rejects incomplete sessions', () => {
    const r = checkEligibility('workout_completed', { session: { ...goodWorkout, status: 'partial' }, workoutAwardsToday: 0 });
    expect(r.ok).toBe(false);
  });
  it('rejects workouts when daily award quota is exhausted', () => {
    const r = checkEligibility('workout_completed', { session: goodWorkout, workoutAwardsToday: ARENA_XP_CONFIG.maxWorkoutAwardsPerDay });
    expect(r.ok).toBe(false);
  });
  it('routes mobility plans away from the workout reward (no double-dip)', () => {
    const r = checkEligibility('workout_completed', { session: mobility, workoutAwardsToday: 0 });
    expect(r.ok).toBe(false);
  });

  it('rejects unverified (self-reported) sessions — forged completion earns no XP', () => {
    const r = checkEligibility('workout_completed', {
      session: { durationSec: 1500, status: 'completed' as const, planId: 'foundations-full-body' },
      workoutAwardsToday: 0,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/(self-reported|plausibility)/i);
  });

  it('rejects explicitly unverified sessions even with complete data', () => {
    const r = checkEligibility('workout_completed', {
      session: { ...goodWorkout, verified: false },
      workoutAwardsToday: 0,
    });
    expect(r.ok).toBe(false);
  });
});

describe('mobility_session eligibility', () => {
  it('accepts the mobility plan', () => {
    expect(checkEligibility('mobility_session', { session: mobility, workoutAwardsToday: 0 }).ok).toBe(true);
  });
  it('rejects non-mobility plans', () => {
    expect(checkEligibility('mobility_session', { session: goodWorkout, workoutAwardsToday: 0 }).ok).toBe(false);
  });
});

describe('nutrition_milestone eligibility', () => {
  const okDay = { entryCount: 4, distinctMeals: 3, totalCalories: 1800 };
  it('accepts a well-logged, sensibly fuelled day', () => {
    expect(checkEligibility('nutrition_milestone', { nutritionDay: okDay, calorieTarget: 2200 }).ok).toBe(true);
  });
  it('NEVER rewards undereating / restriction', () => {
    const r = checkEligibility('nutrition_milestone', { nutritionDay: { ...okDay, totalCalories: 400 }, calorieTarget: 2200 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/restriction|fuelled/i);
  });
  it('rejects implausibly high totals', () => {
    const r = checkEligibility('nutrition_milestone', { nutritionDay: { ...okDay, totalCalories: 9000 }, calorieTarget: 2200 });
    expect(r.ok).toBe(false);
  });
  it('requires enough entries and meal variety', () => {
    expect(checkEligibility('nutrition_milestone', { nutritionDay: { ...okDay, entryCount: 1 }, calorieTarget: 2200 }).ok).toBe(false);
    expect(checkEligibility('nutrition_milestone', { nutritionDay: { ...okDay, distinctMeals: 1 }, calorieTarget: 2200 }).ok).toBe(false);
  });
});

describe('daily_mission eligibility', () => {
  it('passes with any workout today', () => {
    expect(checkEligibility('daily_mission', { anyWorkoutToday: true, nutritionDay: { entryCount: 0, distinctMeals: 0, totalCalories: 0 } }).ok).toBe(true);
  });
  it('passes with 3+ nutrition logs', () => {
    expect(checkEligibility('daily_mission', { anyWorkoutToday: false, nutritionDay: { entryCount: 3, distinctMeals: 2, totalCalories: 1500 } }).ok).toBe(true);
  });
  it('fails on a completely unlogged day', () => {
    expect(checkEligibility('daily_mission', { anyWorkoutToday: false, nutritionDay: { entryCount: 1, distinctMeals: 1, totalCalories: 300 } }).ok).toBe(false);
  });
});

describe('weekly_milestone eligibility', () => {
  it('requires the configured number of distinct training days', () => {
    expect(checkEligibility('weekly_milestone', { workoutDaysThisWeek: ARENA_XP_CONFIG.weeklyWorkoutDays }).ok).toBe(true);
    expect(checkEligibility('weekly_milestone', { workoutDaysThisWeek: ARENA_XP_CONFIG.weeklyWorkoutDays - 1 }).ok).toBe(false);
  });
});

describe('daily XP cap', () => {
  it('allows awards under the cap', () => {
    expect(applyDailyCap(150, 50).ok).toBe(true);
  });
  it('blocks awards that would exceed the cap', () => {
    expect(applyDailyCap(180, 50).ok).toBe(false);
  });
});

describe('event ID stability (idempotency)', () => {
  it('is deterministic per activity source', () => {
    expect(arenaEventId('workout_completed', { sessionId: 'abc' })).toBe('w:abc');
    expect(arenaEventId('daily_mission', { dayKey: '2026-10-17' })).toBe('d:2026-10-17');
    expect(arenaEventId('weekly_milestone', { weekKey: '2026-W42' })).toBe('y:2026-W42');
    // same inputs → identical key, transaction prevents double award
    expect(arenaEventId('workout_completed', { sessionId: 'abc' })).toBe(arenaEventId('workout_completed', { sessionId: 'abc' }));
  });
  it('produces Firebase-safe keys', () => {
    expect(fbSafeKey('d:2026-10-17')).not.toMatch(/[.#$\[\]\/]/);
    expect(fbSafeKey('m:x.y#z')).toBe('m:x_y_z');
  });
});
