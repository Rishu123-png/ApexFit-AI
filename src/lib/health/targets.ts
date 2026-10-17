/**
 * Health-safe target policy (spec §14) — pure, unit-tested.
 *
 * We never prescribe weight loss, deficits, or "burn it off" logic. Calorie
 * targets are USER-SET tracking aids only, clamped to a conservative range.
 * Values below the floor are REJECTED, not silently clamped: the app refuses
 * to display a dangerous number rather than normalize severe restriction.
 */

export const CALORIE_TARGET_RANGE = { min: 1400, max: 6000 } as const;
export const PROTEIN_TARGET_RANGE = { min: 20, max: 400 } as const;
export const WATER_TARGET_RANGE = { min: 500, max: 8000 } as const;

export interface TargetVerdict {
  ok: boolean;
  /** value to store; null when rejected (UI must keep showing guidance, not a number) */
  value: number | null;
  reason?: string;
}

export function safeCalorieTarget(input: number): TargetVerdict {
  if (!Number.isFinite(input)) return { ok: false, value: null, reason: 'Enter a number like 2200.' };
  const v = Math.round(input);
  if (v < CALORIE_TARGET_RANGE.min) {
    return {
      ok: false,
      value: null,
      reason:
        `We don't support targets below ${CALORIE_TARGET_RANGE.min} kcal — that's below a safe self-tracking floor. ` +
        'If you need a lower intake for a medical reason, please work with a qualified dietitian or doctor.',
    };
  }
  if (v > CALORIE_TARGET_RANGE.max) {
    return {
      ok: false,
      value: null,
      reason: `${CALORIE_TARGET_RANGE.max} kcal is the highest target we display — trackers work best when aligned with a professional plan.`,
    };
  }
  return { ok: true, value: v };
}

export function safeProteinTarget(input: number): TargetVerdict {
  if (!Number.isFinite(input)) return { ok: false, value: null, reason: 'Enter a number like 90.' };
  const v = Math.round(input);
  if (v < PROTEIN_TARGET_RANGE.min || v > PROTEIN_TARGET_RANGE.max) {
    return { ok: false, value: null, reason: `Protein targets between ${PROTEIN_TARGET_RANGE.min}–${PROTEIN_TARGET_RANGE.max} g are supported.` };
  }
  return { ok: true, value: v };
}

export function safeWaterTarget(input: number): TargetVerdict {
  if (!Number.isFinite(input)) return { ok: false, value: null, reason: 'Enter a number like 2500.' };
  const v = Math.round(input);
  if (v < WATER_TARGET_RANGE.min || v > WATER_TARGET_RANGE.max) {
    return { ok: false, value: null, reason: `Water targets between ${WATER_TARGET_RANGE.min}–${WATER_TARGET_RANGE.max} ml are supported.` };
  }
  return { ok: true, value: v };
}
