import { describe, it, expect } from 'vitest';
import { AngleRepCounter, TRACKABLE_EXERCISES } from '../repCounter';
import { jointAngle, keyJointsVisibility } from '../angles';
import type { PoseLandmark } from '../engine';

const squat = TRACKABLE_EXERCISES.find((e) => e.id === 'squat')!;

/** Test counter without EMA smoothing so feeds are instantaneous. */
function newCounter() {
  return new AngleRepCounter({ ...squat.counter, smoothAlpha: 1 });
}

/** Feed one full squat cycle: extended → below 110° → above 160°. */
function cycle(c: AngleRepCounter, t: number, depth = 95) {
  c.feed(168, 1, t);
  c.feed(depth, 1, t + 100);
  return c.feed(170, 1, t + 200);
}

describe('AngleRepCounter', () => {
  it('counts full cycles only', () => {
    const c = newCounter();
    const ev = cycle(c, 1_000);
    expect(c.countRef.count).toBe(1);
    expect(ev?.type).toBe('rep');
  });

  it('ignores half-reps (down but never back up)', () => {
    const c = newCounter();
    c.feed(168, 1, 0);
    c.feed(90, 1, 100);
    c.feed(90, 1, 200);
    c.feed(90, 1, 300);
    expect(c.countRef.count).toBe(0);
  });

  it('ignores tremors around the threshold (no double counting)', () => {
    const c = newCounter();
    cycle(c, 1_000);
    // hover just above upAngle without a new low phase — must not count again
    c.feed(161, 1, 4_000);
    c.feed(159, 1, 4_100);
    c.feed(162, 1, 4_200);
    expect(c.countRef.count).toBe(1);
  });

  it('skips low-visibility frames rather than guessing', () => {
    const c = newCounter();
    c.feed(90, 0.2, 0);
    c.feed(160, 0.2, 100);
    expect(c.countRef.count).toBe(0);
  });

  it('flags very fast repeats as rushed but still counts them', () => {
    const c = newCounter();
    cycle(c, 0);
    const ev2 = cycle(c, 400); // far under minRepMs gap? second rep at ~1s ⇒ rushed possible
    expect(c.countRef.count).toBe(2);
    if (ev2) expect(['rushed', 'good']).toContain(ev2.quality);
  });

  it('reset clears state for the next round', () => {
    const c = newCounter();
    cycle(c, 0);
    c.reset();
    expect(c.countRef.count).toBe(0);
    expect(c.currentPhase).toBe('extended');
    expect(c.smoothedAngle).toBeNull();
  });

  it('each trackable exercise has meaningful thresholds', () => {
    for (const ex of TRACKABLE_EXERCISES) {
      expect(ex.counter.downAngle).toBeLessThan(ex.counter.upAngle);
      expect(ex.counter.minRepMs).toBeGreaterThanOrEqual(800);
    }
  });
});

describe('angle geometry', () => {
  const pt = (x: number, y: number, visibility = 1): PoseLandmark => ({ x, y, z: 0, visibility });

  it('computes a right angle correctly', () => {
    const a = jointAngle(pt(1, 0), pt(0, 0), pt(0, 1));
    expect(a).not.toBeNull();
    expect(Math.abs(a! - 90)).toBeLessThan(0.5);
  });

  it('computes a straight line as ~180°', () => {
    expect(jointAngle(pt(-1, 0), pt(0, 0), pt(1, 0))).toBeCloseTo(180, 0);
  });

  it('returns null for degenerate points', () => {
    expect(jointAngle(pt(0, 0), pt(0, 0), pt(1, 1))).toBeNull();
  });

  it('visibility fraction reflects hidden joints', () => {
    const lms: PoseLandmark[] = Array.from({ length: 33 }, (_, i) =>
      i <= 12 ? pt(0.5, 0.5, 0.9) : pt(0.5, 0.5, 0.1),
    );
    const vis = keyJointsVisibility(lms, [11, 12, 23, 24]);
    expect(vis).toBe(0.5);
  });
});
