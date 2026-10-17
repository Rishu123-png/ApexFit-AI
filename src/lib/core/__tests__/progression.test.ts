import { describe, it, expect } from 'vitest';
import { suggestNextForExercise, buildExerciseTrends } from '../progression';

const pts = (ratios: { d: string; t: number; c: number }[]) =>
  ratios.map((r) => ({ dayKey: r.d, targetSets: r.t, completedSets: r.c }));

describe('suggestNextForExercise — bounded, history-gated (§20)', () => {
  it('returns null with fewer than 3 history points (no guessing)', () => {
    expect(
      suggestNextForExercise('pushup', pts([
        { d: '2026-10-10', t: 3, c: 3 },
        { d: '2026-10-12', t: 3, c: 3 },
      ])),
    ).toBeNull();
  });

  it('steps up by ONE set only when near-full completion is consistent', () => {
    const s = suggestNextForExercise(
      'pushup',
      pts([
        { d: '2026-10-08', t: 3, c: 3 },
        { d: '2026-10-10', t: 3, c: 3 },
        { d: '2026-10-12', t: 3, c: 3 },
        { d: '2026-10-14', t: 3, c: 3 },
      ]),
    );
    expect(s).not.toBeNull();
    expect(s!.deltaSets).toBe(1);
    expect(s!.nextTargetSets).toBe(4);
  });

  it('never exceeds the max-sets ceiling (no runaway volume)', () => {
    const s = suggestNextForExercise(
      'squat',
      pts([
        { d: '2026-10-08', t: 5, c: 5 },
        { d: '2026-10-10', t: 5, c: 5 },
        { d: '2026-10-12', t: 5, c: 5 },
      ]),
    );
    expect(s!.deltaSets).toBe(0);
    expect(s!.nextTargetSets).toBe(5);
  });

  it('suggests an easier session after repeated shortfalls (no shame, just safer load)', () => {
    const s = suggestNextForExercise(
      'rows',
      pts([
        { d: '2026-10-08', t: 3, c: 3 },
        { d: '2026-10-10', t: 3, c: 1 },
        { d: '2026-10-12', t: 3, c: 1 },
      ]),
    );
    expect(s!.deltaSets).toBe(-1);
    expect(s!.nextTargetSets).toBe(2);
    expect(s!.rationale).toMatch(/below target/i);
  });

  it('holds steady when completion is uneven', () => {
    const s = suggestNextForExercise(
      'plank',
      pts([
        { d: '2026-10-08', t: 3, c: 3 },
        { d: '2026-10-10', t: 3, c: 2 },
        { d: '2026-10-12', t: 3, c: 3 },
      ]),
    );
    expect(s!.deltaSets).toBe(0);
  });

  it('never suggests fewer than 1 set', () => {
    const s = suggestNextForExercise(
      'stretch',
      pts([
        { d: '2026-10-08', t: 1, c: 0 },
        { d: '2026-10-10', t: 1, c: 0 },
        { d: '2026-10-12', t: 1, c: 0 },
      ]),
    );
    expect(s).not.toBeNull();
    expect(s!.nextTargetSets).toBeGreaterThanOrEqual(1);
  });
});

describe('buildExerciseTrends', () => {
  it('groups points by exerciseId, falling back to name', () => {
    const trends = buildExerciseTrends([
      {
        dayKey: '2026-10-10',
        exercises: [
          { exerciseId: 'pushup', name: 'Push-up', targetSets: 3, completedSets: 3 },
          { name: 'Wall Sit', targetSets: 2, completedSets: 2 },
        ],
      },
      {
        dayKey: '2026-10-12',
        exercises: [{ exerciseId: 'pushup', name: 'Push-up', targetSets: 3, completedSets: 2 }],
      },
    ]);
    expect(trends.get('pushup')).toHaveLength(2);
    expect(trends.get('Wall Sit')).toHaveLength(1);
  });
});
