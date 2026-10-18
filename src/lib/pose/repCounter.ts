/**
 * Exercise rep-counting state machine — pure, deterministic, unit-tested.
 *
 * Counts full cycles: EXTENDED → (angle crosses down threshold) LOW →
 * (crosses up threshold) REP. With EMA smoothing, visibility gating, a
 * cooldown between reps and honest confidence reporting. Never judges form
 * without visible joints, never makes clinical claims.
 */

export type RepQuality = 'good' | 'shallow' | 'rushed';

export interface RepCounterOptions {
  /** angle must go BELOW this to register the "low" phase */
  downAngle: number;
  /** angle must rise ABOVE this for the rep to complete */
  upAngle: number;
  /** reps faster than this are flagged 'rushed' but still not counted */
  minRepMs: number;
  /** EMA smoothing factor 0..1 (higher = less smoothing) */
  smoothAlpha?: number;
  /** min landmark confidence to accept a frame */
  minVisibility?: number;
}

export type RepEventType = { type: 'rep'; count: number; quality: RepQuality };

export class AngleRepCounter {
  private phase: 'extended' | 'low' = 'extended';
  private smoothed: number | null = null;
  private minAngleInCycle = Infinity;
  private maxAngleInCycle = -Infinity;
  private lastRepAt = 0;
  public readonly countRef = { count: 0 };

  constructor(private readonly opts: RepCounterOptions) {}

  /**
   * Feed one frame's measured angle. Returns a RepEventType when a rep
   * completes, otherwise null. Frames below visibility are ignored.
   */
  feed(angle: number | null, visibility: number, nowMs: number): RepEventType | null {
    const minVis = this.opts.minVisibility ?? 0.45;
    if (angle === null || !Number.isFinite(angle) || visibility < minVis) return null;

    const alpha = this.opts.smoothAlpha ?? 0.35;
    this.smoothed = this.smoothed === null ? angle : alpha * angle + (1 - alpha) * this.smoothed;
    const a = this.smoothed;

    if (this.phase === 'extended') {
      this.maxAngleInCycle = Math.max(this.maxAngleInCycle, a);
      if (a <= this.opts.downAngle) {
        this.phase = 'low';
        this.minAngleInCycle = a;
      }
      return null;
    }

    // low phase
    this.minAngleInCycle = Math.min(this.minAngleInCycle, a);
    if (a >= this.opts.upAngle) {
      const dt = nowMs - this.lastRepAt;
      this.phase = 'extended';
      this.countRef.count += 1;
      const quality: RepQuality =
        dt < this.opts.minRepMs && this.lastRepAt > 0
          ? 'rushed'
          : this.minAngleInCycle > this.opts.downAngle + 15
            ? 'shallow'
            : 'good';
      this.lastRepAt = nowMs;
      this.minAngleInCycle = Infinity;
      this.maxAngleInCycle = -Infinity;
      return { type: 'rep', count: this.countRef.count, quality };
    }
    return null;
  }

  get currentPhase(): 'extended' | 'low' {
    return this.phase;
  }

  get smoothedAngle(): number | null {
    return this.smoothed;
  }

  reset(): void {
    this.phase = 'extended';
    this.smoothed = null;
    this.minAngleInCycle = Infinity;
    this.maxAngleInCycle = -Infinity;
    this.countRef.count = 0;
    this.lastRepAt = 0;
  }
}

export interface TrackableExercise {
  id: string;
  label: string;
  /** which joint angle drives counting */
  kind: 'knee' | 'elbow';
  counter: RepCounterOptions;
  /** simple non-clinical cue shown while tracking */
  cue: string;
}

/** Conservative, equipment-free starting set. All feedback is form-neutral. */
export const TRACKABLE_EXERCISES: TrackableExercise[] = [
  {
    id: 'squat',
    label: 'Squats',
    kind: 'knee',
    counter: { downAngle: 110, upAngle: 160, minRepMs: 1200 },
    cue: 'Frame your full body side-on; go down until thighs approach parallel, then stand tall.',
  },
  {
    id: 'pushup',
    label: 'Push-ups',
    kind: 'elbow',
    counter: { downAngle: 100, upAngle: 160, minRepMs: 1000 },
    cue: 'Side view, full arm visible. Lower until elbows pass roughly 90°, then press up smooth.',
  },
  {
    id: 'lunge',
    label: 'Lunges (front leg)',
    kind: 'knee',
    counter: { downAngle: 120, upAngle: 165, minRepMs: 1300 },
    cue: 'Side view shows the front knee best. Step, dip under control, return upright.',
  },
];

/** Map the shipped workout exercise IDs to the conservative pose counters.
 * Unmapped exercises intentionally receive no automated judgement. */
const WORKOUT_TO_TRACKABLE: Record<string, TrackableExercise['id']> = {
  squat: 'squat',
  'goblet-squat': 'squat',
  'knee-pushup': 'pushup',
  pushup: 'pushup',
  lunge: 'lunge',
  'reverse-lunge': 'lunge',
};

export function trackableForWorkoutExercise(exerciseId: string): TrackableExercise | null {
  const trackableId = WORKOUT_TO_TRACKABLE[exerciseId];
  return TRACKABLE_EXERCISES.find((exercise) => exercise.id === trackableId) ?? null;
}
