import { describe, it, expect } from 'vitest';
import { projectionPlan } from '../projections';

describe('projectionPlan — consent → public visibility matrix', () => {
  it('no profile ⇒ every public path is deleted, nothing written', () => {
    const p = projectionPlan(false);
    expect(p).toEqual({ writeLifetime: false, deleteLifetime: true, writePeriods: false, deletePeriods: true });
  });

  it('global + friends ⇒ writes lifetime and periods, deletes nothing', () => {
    const p = projectionPlan(true, { global: true, friends: true });
    expect(p).toEqual({ writeLifetime: true, deleteLifetime: false, writePeriods: true, deletePeriods: false });
  });

  it('global off (friends on) ⇒ lifetime ladder entry DELETED, period scores kept for friends boards', () => {
    const p = projectionPlan(true, { global: false, friends: true });
    expect(p.deleteLifetime).toBe(true);
    expect(p.writeLifetime).toBe(false);
    expect(p.writePeriods).toBe(true);
    expect(p.deletePeriods).toBe(false);
  });

  it('both off ⇒ NO public ranking anywhere: all projections deleted', () => {
    const p = projectionPlan(true, { global: true, friends: false });
    // global-only is allowed: keeps the ladder, has no friends board
    expect(p.writeLifetime).toBe(true);
    expect(p.deletePeriods).toBe(false);

    const off = projectionPlan(true, { global: false, friends: false });
    expect(off).toEqual({ writeLifetime: false, deleteLifetime: true, writePeriods: false, deletePeriods: true });
  });

  it('rejoined with fresh consent ⇒ writes resume (no zombie state: deletion is monotonic by consent)', () => {
    const rejoined = projectionPlan(true, { global: true, friends: true });
    expect(rejoined.writeLifetime).toBe(true);
    expect(rejoined.deleteLifetime).toBe(false);
  });
});
