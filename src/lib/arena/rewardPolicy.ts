import type { ArenaDayCounter, ArenaEvent } from './types';

/**
 * Reward pipeline policy — pure, deterministic, unit-tested (spec §6/§7).
 *
 * Two decision points live here so the server code applies them identically:
 *  1) `eventDecision` — the durable idempotency state machine for an event
 *     record: pending → applied / failed (retryable) / cap_limited (closed).
 *  2) `decideDailyAward` — the atomic daily-counter mutation used INSIDE an
 *     RTDB transaction, so concurrent claims cannot race past the daily cap
 *     or the per-day workout-award quota (no read-then-write).
 */

export interface StoredArenaEvent extends ArenaEvent {
  status: 'pending' | 'applied' | 'failed' | 'cap_limited';
  attempts: number;
  error?: string;
  appliedAt?: number;
  /** per-stage durability flags — a retried event re-applies ONLY missing stages */
  dailyApplied?: boolean;
  lifetimeApplied?: boolean;
  periodsApplied?: boolean;
}

/** A 'pending' event older than this is considered stranded and retried. */
export const EVENT_STALE_AFTER_MS = 90_000;

export type EventDecision =
  | { action: 'create' }
  /** already applied (or closed): idempotent answer, no new work */
  | { action: 'replay'; status: 'applied' | 'cap_limited'; xp: number }
  /** another request is actively applying it right now */
  | { action: 'in-progress' }
  /** failed or stale-pending: caller must re-apply the stored event */
  | { action: 'retry'; event: StoredArenaEvent };

export function eventDecision(existing: StoredArenaEvent | null, nowMs: number): EventDecision {
  if (!existing) return { action: 'create' };
  // Legacy events from before status tracking exist in the wild: they were
  // written only on success, so replay them as already-applied.
  if (!existing.status || existing.status === 'applied') {
    return { action: 'replay', status: 'applied', xp: typeof existing.xp === 'number' ? existing.xp : 0 };
  }
  if (existing.status === 'cap_limited') return { action: 'replay', status: 'cap_limited', xp: 0 };
  if (existing.status === 'pending') {
    const age = nowMs - existing.createdAt;
    return age < EVENT_STALE_AFTER_MS ? { action: 'in-progress' } : { action: 'retry', event: existing };
  }
  return { action: 'retry', event: existing }; // failed
}

export interface DailyAwardConfig {
  dailyCap: number;
  maxWorkoutAwardsPerDay: number;
}

export type DailyAwardDecision =
  | { ok: true; next: ArenaDayCounter }
  | { ok: false; reason: string };

/** Mutation for INSIDE `arenaState/{uid}/days/{dayKey}` transaction. */
export function decideDailyAward(
  cur: ArenaDayCounter | null,
  award: { xp: number; isWorkoutType: boolean },
  cfg: DailyAwardConfig,
): DailyAwardDecision {
  const curXp = cur?.xp ?? 0;
  const curWorkout = cur?.workoutAwards ?? 0;

  if (curXp + award.xp > cfg.dailyCap) {
    return { ok: false, reason: `Daily XP cap reached (${cfg.dailyCap} XP resets tomorrow).` };
  }
  if (award.isWorkoutType && curWorkout + 1 > cfg.maxWorkoutAwardsPerDay) {
    return { ok: false, reason: `Workout rewards are limited to ${cfg.maxWorkoutAwardsPerDay} verified session awards per day.` };
  }
  return {
    ok: true,
    next: {
      xp: curXp + award.xp,
      workoutAwards: curWorkout + (award.isWorkoutType ? 1 : 0),
    },
  };
}
