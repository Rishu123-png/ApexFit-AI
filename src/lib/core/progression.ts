/**
 * Progression engine (spec §20) — pure, deterministic, unit-tested.
 *
 * Tracks per-exercise completion trends and suggests the NEXT session's sets
 * only when enough history exists. Steps are bounded; deloads are suggested
 * honestly; nothing here estimates 1RM or prescribes max effort.
 */

export interface ExerciseHistoryPoint {
  dayKey: string;
  targetSets: number;
  completedSets: number;
}

export interface ProgressionSuggestion {
  exerciseId: string;
  currentTargetSets: number;
  nextTargetSets: number;
  deltaSets: number;
  confidence: 'low' | 'medium' | 'high';
  rationale: string;
}

export interface ProgressionOptions {
  minHistoryPoints?: number;
  maxSets?: number;
  /** step up when the average of the last N completion ratios ≥ this */
  stepUpAt?: number;
  consecutiveLowToDeload?: number;
}

const DEFAULTS: Required<ProgressionOptions> = {
  minHistoryPoints: 3,
  maxSets: 5,
  stepUpAt: 0.95,
  consecutiveLowToDeload: 2,
};

const ratio = (p: ExerciseHistoryPoint) => (p.targetSets > 0 ? p.completedSets / p.targetSets : 0);

export function suggestNextForExercise(
  exerciseId: string,
  points: ExerciseHistoryPoint[],
  opts: ProgressionOptions = {},
): ProgressionSuggestion | null {
  const o = { ...DEFAULTS, ...opts };
  const sorted = points
    .filter((p) => Number.isFinite(p.completedSets) && Number.isFinite(p.targetSets) && p.targetSets > 0)
    .sort((a, b) => (a.dayKey < b.dayKey ? -1 : 1));

  if (sorted.length < o.minHistoryPoints) return null; // not enough data — say so, don't guess

  const last = sorted[sorted.length - 1];
  const recent = sorted.slice(-3);
  const avgRecent = recent.reduce((a, p) => a + ratio(p), 0) / recent.length;

  // Deload: repeated shortfalls
  const lows = sorted
    .slice(-o.consecutiveLowToDeload)
    .filter((p) => ratio(p) < 0.6).length;
  if (lows >= o.consecutiveLowToDeload && last.targetSets > 1) {
    return {
      exerciseId,
      currentTargetSets: last.targetSets,
      nextTargetSets: last.targetSets - 1,
      deltaSets: -1,
      confidence: sorted.length >= 5 ? 'high' : 'medium',
      rationale: `Last ${o.consecutiveLowToDeload} sessions finished well below target — a slightly easier session builds consistency and form.`,
    };
  }

  // Step up: consistently completed
  if (avgRecent >= o.stepUpAt && last.targetSets < o.maxSets) {
    return {
      exerciseId,
      currentTargetSets: last.targetSets,
      nextTargetSets: last.targetSets + 1,
      deltaSets: +1,
      confidence: sorted.length >= 5 ? 'high' : 'medium',
      rationale: `You've completed ${Math.round(avgRecent * 100)}% of sets lately — nudging up by one set keeps progress moving.`,
    };
  }

  return {
    exerciseId,
    currentTargetSets: last.targetSets,
    nextTargetSets: last.targetSets,
    deltaSets: 0,
    confidence: sorted.length >= 5 ? 'medium' : 'low',
    rationale: 'Completion is uneven — hold this target until it feels solid on most days.',
  };
}

/** Aggregate session history (from users/{uid}/workouts) into per-exercise trend points. */
export function buildExerciseTrends(
  sessions: { dayKey: string; exercises: { exerciseId?: string; name: string; targetSets: number; completedSets: number }[] }[],
): Map<string, ExerciseHistoryPoint[]> {
  const map = new Map<string, ExerciseHistoryPoint[]>();
  for (const s of sessions) {
    for (const e of s.exercises ?? []) {
      const key = e.exerciseId ?? e.name;
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ dayKey: s.dayKey, targetSets: e.targetSets, completedSets: e.completedSets });
    }
  }
  return map;
}
