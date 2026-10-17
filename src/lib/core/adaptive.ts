/**
 * Apex Core — adaptive training rules engine. Pure, deterministic, unit-tested.
 *
 * This is the SAFETY layer: conservative, rules-based decisions about whether
 * today should be training, light/recovery, or rest. The LLM may personalize
 * and explain around it, but it cannot override these constraints.
 */

export type Experience = 'beginner' | 'intermediate' | 'advanced';

export interface RecentSession {
  dayKey: string; // yyyy-mm-dd (user tz)
  durationSec: number;
  planId: string;
}

export interface AdaptiveInput {
  experience: Experience;
  /** ISO day keys for "today" in the user's timezone */
  todayKey: string;
  recent: RecentSession[]; // sessions in the trailing 7 days
  preferredDurationMin?: number;
}

export interface AdaptiveRecommendation {
  action: 'train' | 'light' | 'rest';
  planId: string | null;
  /** 0..1 suggested relative effort — never 1.0 (no maximal prescriptions) */
  intensity: number;
  suggestedDurationMin: number;
  reasonCodes: string[];
  summary: string;
}

const HARD_PLANS = new Set(['ignite-hiit']);
const RECOVERY_PLAN = 'core-mobility';

function addDays(dayKey: string, delta: number): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

export function recommendToday(input: AdaptiveInput): AdaptiveRecommendation {
  const { experience, todayKey, recent } = input;
  const codes: string[] = [];

  const daysTrained = new Set(recent.map((s) => s.dayKey)).size;
  const yesterday = addDays(todayKey, -1);
  const dayBefore = addDays(todayKey, -2);
  const trainedYesterday = recent.some((s) => s.dayKey === yesterday);
  const trainedDayBefore = recent.some((s) => s.dayKey === dayBefore);
  const yesterdayHard = recent.some((s) => s.dayKey === yesterday && HARD_PLANS.has(s.planId));

  const baseIntensity = experience === 'beginner' ? 0.6 : experience === 'intermediate' ? 0.75 : 0.85;
  const baseDuration =
    input.preferredDurationMin ?? (experience === 'beginner' ? 25 : experience === 'intermediate' ? 35 : 45);

  const defaultPlan = experience === 'beginner' ? 'foundations-full-body' : 'home-dumbbell-strength';
  // Suggest a different plan than yesterday for load distribution.
  const yesterdayPlan = recent.find((s) => s.dayKey === yesterday)?.planId;
  const variedPlan = yesterdayPlan === defaultPlan ? RECOVERY_PLAN : defaultPlan;
  if (yesterdayPlan && yesterdayPlan === defaultPlan) codes.push('VARIETY_ROTATION');

  // ── Safety rules (ordered, conservative; first match wins) ──

  // 1. Very high weekly frequency → rest day.
  if (daysTrained >= 6) {
    codes.push('RECOVERY_OVERREACH');
    return {
      action: 'rest',
      planId: null,
      intensity: 0,
      suggestedDurationMin: 0,
      reasonCodes: codes,
      summary: `You trained on ${daysTrained} of the last 7 days — full rest today is the performance move.`,
    };
  }

  // 2. Hard session yesterday (or two consecutive training days) → light.
  if (yesterdayHard || (trainedYesterday && trainedDayBefore)) {
    codes.push(yesterdayHard ? 'RECOVERY_AFTER_HIIT' : 'CONSECUTIVE_DAYS_LIMIT');
    return {
      action: 'light',
      planId: RECOVERY_PLAN,
      intensity: 0.4,
      suggestedDurationMin: 20,
      reasonCodes: codes,
      summary: yesterdayHard
        ? 'Yesterday was high intensity — keep today light with mobility work.'
        : 'Third consecutive training day — switch to light mobility to protect recovery.',
    };
  }

  // 3. No sessions in a week → gentle re-entry for everyone.
  if (daysTrained === 0) {
    codes.push('RETURN_AFTER_BREAK');
    return {
      action: 'train',
      planId: 'foundations-full-body',
      intensity: Math.min(0.6, baseIntensity),
      suggestedDurationMin: Math.min(25, baseDuration),
      reasonCodes: codes,
      summary: 'Fresh week — restart with a fundamentals session and build from there.',
    };
  }

  // 4. Normal progression.
  codes.push('NORMAL_PROGRESSION');
  return {
    action: 'train',
    planId: variedPlan,
    intensity: baseIntensity,
    suggestedDurationMin: baseDuration,
    reasonCodes: codes,
    summary: 'Good recent balance — proceed with a regular session at moderate effort.',
  };
}

/** Compact, non-medical line injected into the AI coach context. */
export function describeRecommendation(r: AdaptiveRecommendation): string {
  return `Adaptive engine (deterministic rules, not a guess): action=${r.action}; plan=${r.planId ?? 'none'}; intensity=${r.intensity}; duration~${r.suggestedDurationMin}min; reasons=[${r.reasonCodes.join(',')}]. ${r.summary}`;
}
