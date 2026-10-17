import type { ArenaEventType } from './types';

/**
 * XP reward engine — pure, config-driven and unit-tested.
 * ALL awards are computed server-side from validated activity records;
 * clients supply only a claim *type* and a *source reference*, never XP.
 */
export const ARENA_XP_CONFIG = {
  xp: {
    workout_completed: 50,
    mobility_session: 20,
    daily_mission: 15,
    nutrition_milestone: 10,
    weekly_milestone: 100,
  } as Record<ArenaEventType, number>,
  /** max XP a user can earn per local day */
  dailyCap: 200,
  /** max workout-type awards per local day (anti-farming) */
  maxWorkoutAwardsPerDay: 2,
  /** a workout must be at least this long to earn XP */
  minWorkoutSeconds: 600, // 10 minutes
  /** recognised recovery/mobility plans earn the lower, distinct reward */
  mobilityPlanIds: ['core-mobility'] as string[],
  /** nutrition milestone: enough real meals, without rewarding undereating */
  minNutritionEntries: 3,
  minNutritionMeals: 2,
  nutritionMinCalories: 800,
  /** never reward extreme intake either: cap factor × user's calorie target */
  nutritionCalorieMaxFactor: 1.6,
  /** daily consistency mission: any workout, or this many nutrition logs */
  missionNutritionEntries: 3,
  /** weekly consistency: distinct days with a workout this week */
  weeklyWorkoutDays: 4,
  /** future: minimum pose-confidence required for camera-based rewards */
  cameraMinConfidence: 0.8,
} as const;

export interface SessionLike {
  durationSec: number;
  status: 'completed' | 'partial';
  planId: string;
}

export interface NutritionDayLike {
  entryCount: number;
  distinctMeals: number;
  totalCalories: number;
}

export interface EligibilityFacts {
  session?: SessionLike | null;
  nutritionDay?: NutritionDayLike | null;
  calorieTarget?: number;
  /** workout-type awards already granted today */
  workoutAwardsToday?: number;
  /** distinct days with a workout so far this local week (including today) */
  workoutDaysThisWeek?: number;
  /** any workout session OR enough nutrition logs today */
  anyWorkoutToday?: boolean;
}

export type Eligibility = { ok: true } | { ok: false; reason: string };

export function checkEligibility(
  type: ArenaEventType,
  facts: EligibilityFacts,
  cfg = ARENA_XP_CONFIG,
): Eligibility {
  switch (type) {
    case 'workout_completed': {
      const s = facts.session;
      if (!s) return { ok: false, reason: 'Workout session not found.' };
      if (cfg.mobilityPlanIds.includes(s.planId))
        return { ok: false, reason: 'Mobility sessions earn the mobility reward instead.' };
      if (s.status !== 'completed')
        return { ok: false, reason: 'Only fully completed workouts earn XP.' };
      if (s.durationSec < cfg.minWorkoutSeconds)
        return { ok: false, reason: `Workout must be at least ${cfg.minWorkoutSeconds / 60} minutes.` };
      if ((facts.workoutAwardsToday ?? 0) >= cfg.maxWorkoutAwardsPerDay)
        return { ok: false, reason: 'Daily workout reward limit reached.' };
      return { ok: true };
    }
    case 'mobility_session': {
      const s = facts.session;
      if (!s) return { ok: false, reason: 'Workout session not found.' };
      if (!cfg.mobilityPlanIds.includes(s.planId))
        return { ok: false, reason: 'This plan is not a mobility/recovery session.' };
      if (s.status !== 'completed')
        return { ok: false, reason: 'Only fully completed sessions earn XP.' };
      if (s.durationSec < cfg.minWorkoutSeconds / 2)
        return { ok: false, reason: 'Session too short to be eligible.' };
      if ((facts.workoutAwardsToday ?? 0) >= cfg.maxWorkoutAwardsPerDay)
        return { ok: false, reason: 'Daily workout reward limit reached.' };
      return { ok: true };
    }
    case 'daily_mission': {
      const hasWorkout = facts.anyWorkoutToday === true;
      const hasLogs = (facts.nutritionDay?.entryCount ?? 0) >= cfg.missionNutritionEntries;
      if (!hasWorkout && !hasLogs)
        return { ok: false, reason: 'Mission incomplete: do any workout or log 3 meals today.' };
      return { ok: true };
    }
    case 'nutrition_milestone': {
      const n = facts.nutritionDay;
      if (!n) return { ok: false, reason: 'No nutrition entries found for today.' };
      if (n.entryCount < cfg.minNutritionEntries)
        return { ok: false, reason: `Log at least ${cfg.minNutritionEntries} items to unlock this milestone.` };
      if (n.distinctMeals < cfg.minNutritionMeals)
        return { ok: false, reason: 'Spread logs across at least 2 different meals.' };
      if (n.totalCalories < cfg.nutritionMinCalories)
        // Deliberate: we never reward undereating or restriction.
        return { ok: false, reason: 'Milestone requires a reasonably fuelled day — restriction is never rewarded.' };
      const max = (facts.calorieTarget ?? 2200) * cfg.nutritionCalorieMaxFactor;
      if (n.totalCalories > max)
        return { ok: false, reason: 'Milestone requires a sensible day total near your target.' };
      return { ok: true };
    }
    case 'weekly_milestone': {
      if ((facts.workoutDaysThisWeek ?? 0) < cfg.weeklyWorkoutDays)
        return { ok: false, reason: `Train on ${cfg.weeklyWorkoutDays} different days this week to unlock.` };
      return { ok: true };
    }
  }
}

/** Pure daily-cap check. */
export function applyDailyCap(dayXp: number, award: number, cap = ARENA_XP_CONFIG.dailyCap) {
  return dayXp + award <= cap
    ? ({ ok: true } as const)
    : ({ ok: false, reason: `Daily XP cap (${cap}) reached — see you tomorrow.` } as const);
}

/** Stable, deterministic event IDs — the idempotency keys. */
export function arenaEventId(
  type: ArenaEventType,
  ctx: { sessionId?: string; dayKey?: string; weekKey?: string },
): string {
  switch (type) {
    case 'workout_completed':
      return `w:${ctx.sessionId}`;
    case 'mobility_session':
      return `m:${ctx.sessionId}`;
    case 'daily_mission':
      return `d:${ctx.dayKey}`;
    case 'nutrition_milestone':
      return `n:${ctx.dayKey}`;
    case 'weekly_milestone':
      return `y:${ctx.weekKey}`;
  }
}

/** Sanitised event id for use as a Firebase key (no . $ # [ ] /). */
export function fbSafeKey(id: string): string {
  return id.replace(/[.#$\[\]\/]/g, '_');
}
