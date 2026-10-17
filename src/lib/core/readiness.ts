/**
 * Apex Readiness (spec §19) — pure, deterministic, unit-tested.
 *
 * An ESTIMATE, not a medical measurement. Factors are explicit; missing data
 * compresses the score toward the middle and caps the band — absence must
 * never look like high readiness.
 */

export interface RecoveryCheckin {
  /** hours slept last night, optional */
  sleepHrs?: number;
  /** 1 (drained) – 5 (fully charged) */
  energy?: number;
  /** 1 (none) – 5 (very sore) */
  soreness?: number;
}

export interface ReadinessInput {
  /** minutes trained per day for the trailing 7 days, oldest → today */
  minutes7d: number[];
  streakDays: number;
  checkin?: RecoveryCheckin | null;
}

export interface ReadinessFactor {
  key: string;
  label: string;
  present: boolean;
  /** factor's contribution on 0..100 */
  score: number;
  weight: number;
  detail: string;
}

export interface ReadinessResult {
  score: number; // 0..100
  band: 'low' | 'moderate' | 'high';
  recommendation: 'rest' | 'light' | 'normal';
  factors: ReadinessFactor[];
  missingSubjectiveInputs: number;
  estimate: true;
  summary: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function computeReadiness(input: ReadinessInput): ReadinessResult {
  const minutes = input.minutes7d.slice(-7);
  while (minutes.length < 7) minutes.unshift(0);
  const total = minutes.reduce((a, b) => a + b, 0);
  const yesterday = minutes[5] ?? 0;

  // Training load → recovery deficit model
  let loadScore: number;
  let loadDetail: string;
  if (total === 0) {
    loadScore = 88;
    loadDetail = 'No training in the last 7 days — fully recovered, but a gentle restart is wise.';
  } else if (total <= 180) {
    loadScore = 86;
    loadDetail = `${Math.round(total)} min across 7 days — light, sustainable load.`;
  } else if (total <= 320) {
    loadScore = 70;
    loadDetail = `${Math.round(total)} min across 7 days — a solid, busy week.`;
  } else if (total <= 450) {
    loadScore = 48;
    loadDetail = `${Math.round(total)} min across 7 days — high load, watch fatigue.`;
  } else {
    loadScore = 28;
    loadDetail = `${Math.round(total)} min across 7 days — very high load; recovery work needed.`;
  }
  if (yesterday >= 60 && loadScore > 20) {
    loadScore -= 10;
    loadDetail += ` (${yesterday} min yesterday — heavy.)`;
  }

  const streakScore = clamp(100 - Math.max(0, input.streakDays - 4) * 12, 20, 95);
  const factors: ReadinessFactor[] = [
    { key: 'load', label: 'Training load', present: true, score: loadScore, weight: 40, detail: loadDetail },
    {
      key: 'streak',
      label: 'Consecutive days',
      present: true,
      score: streakScore,
      weight: input.streakDays >= 2 ? 12 : 4,
      detail: input.streakDays >= 2 ? `${input.streakDays} training days in a row.` : 'No long streak pressure.',
    },
  ];

  let missing = 0;
  const c = input.checkin ?? null;

  const push = (key: string, label: string, weight: number, present: boolean, score: number, detail: string) =>
    factors.push({ key, label, present, score, weight, detail });

  if (c?.sleepHrs !== undefined && Number.isFinite(c.sleepHrs) && c.sleepHrs >= 0 && c.sleepHrs <= 24) {
    const s = clamp(30 + (c.sleepHrs - 5) * 20, 10, 100); // 5h→30, 8h→90
    push('sleep', 'Sleep', 20, true, s, `${c.sleepHrs} h reported.`);
  } else {
    missing++;
    push('sleep', 'Sleep', 20, false, 50, 'Not reported — counted as neutral.');
  }
  if (c?.energy !== undefined && c.energy >= 1 && c.energy <= 5) {
    push('energy', 'Energy', 18, true, c.energy * 20, `${c.energy}/5 reported.`);
  } else {
    missing++;
    push('energy', 'Energy', 18, false, 50, 'Not reported — counted as neutral.');
  }
  if (c?.soreness !== undefined && c.soreness >= 1 && c.soreness <= 5) {
    push('soreness', 'Muscle soreness', 10, true, (6 - c.soreness) * 20, `${c.soreness}/5 reported (lower is better).`);
  } else {
    missing++;
    push('soreness', 'Muscle soreness', 10, false, 50, 'Not reported — counted as neutral.');
  }

  const weightSum = factors.reduce((a, f) => a + f.weight, 0);
  const score = Math.round(factors.reduce((a, f) => a + f.score * f.weight, 0) / weightSum);

  // Missing subjective data caps the band at 'moderate'.
  let band: ReadinessResult['band'] = score >= 70 ? 'high' : score >= 45 ? 'moderate' : 'low';
  if (missing >= 2 && band === 'high') band = 'moderate';

  const recommendation: ReadinessResult['recommendation'] =
    band === 'low' ? 'rest' : band === 'moderate' ? 'light' : 'normal';

  const parts = [
    band === 'low'
      ? 'Today looks like a rest or easy-mobility day.'
      : band === 'moderate'
        ? 'Today suits a light-to-moderate session.'
        : 'You look good to train normally today.',
    missing > 0 ? `(${missing} check-in input${missing > 1 ? 's' : ''} missing — this is an estimate, not a measurement.)` : '',
  ];

  return {
    score,
    band,
    recommendation,
    factors,
    missingSubjectiveInputs: missing,
    estimate: true,
    summary: parts.filter(Boolean).join(' '),
  };
}
