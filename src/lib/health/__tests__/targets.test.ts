import { describe, it, expect } from 'vitest';
import { safeCalorieTarget, safeProteinTarget, safeWaterTarget, CALORIE_TARGET_RANGE } from '../targets';

describe('safeCalorieTarget — unsafe targets rejected, never silently shown (§14)', () => {
  it('accepts sensible targets', () => {
    expect(safeCalorieTarget(2200)).toEqual({ ok: true, value: 2200 });
    expect(safeCalorieTarget(1400)).toEqual({ ok: true, value: 1400 });
    expect(safeCalorieTarget(6000)).toEqual({ ok: true, value: 6000 });
  });

  it('REJECTS severe-restriction targets like 800 kcal with a professional-guidance reason', () => {
    const v = safeCalorieTarget(800);
    expect(v.ok).toBe(false);
    expect(v.value).toBeNull();
    expect(v.reason).toMatch(/professional|dietitian|doctor/i);
  });

  it('rejects values just under the floor and absurdly high values', () => {
    expect(safeCalorieTarget(CALORIE_TARGET_RANGE.min - 1).ok).toBe(false);
    expect(safeCalorieTarget(CALORIE_TARGET_RANGE.max + 1).ok).toBe(false);
    expect(safeCalorieTarget(0).ok).toBe(false);
  });

  it('rejects non-numbers without crashing', () => {
    expect(safeCalorieTarget(NaN).ok).toBe(false);
    expect(safeCalorieTarget(Infinity).ok).toBe(false);
  });
});

describe('protein & water target policy', () => {
  it('accepts sane ranges, rejects outliers', () => {
    expect(safeProteinTarget(90).ok).toBe(true);
    expect(safeProteinTarget(19).ok).toBe(false);
    expect(safeProteinTarget(401).ok).toBe(false);
    expect(safeWaterTarget(2500).ok).toBe(true);
    expect(safeWaterTarget(499).ok).toBe(false);
    expect(safeWaterTarget(9000).ok).toBe(false);
  });
});
