import { describe, expect, it } from 'vitest';
import { makeLocalWorkoutId } from '@/lib/offline/workoutQueue';

describe('offline workout queue ids', () => {
  it('creates Firebase-safe deterministic session identifiers', () => {
    const id = makeLocalWorkoutId();
    expect(id).toMatch(/^local_[A-Za-z0-9_-]+$/);
    expect(id).not.toMatch(/[.#$\[\]/]/);
  });
});
