import { describe, it, expect } from 'vitest';
import { computeReadiness } from '../readiness';

const quiet7 = [0, 0, 30, 0, 0, 30, 0];
const heavy7 = [70, 70, 70, 70, 70, 70, 70];

describe('computeReadiness — deterministic estimate (§19)', () => {
  it('rest day after very high training load', () => {
    const r = computeReadiness({ minutes7d: heavy7, streakDays: 6, checkin: null });
    expect(r.band).toBe('low');
    expect(r.recommendation).toBe('rest');
    expect(r.estimate).toBe(true);
  });

  it('never inflates to "high" when subjective inputs are missing', () => {
    const r = computeReadiness({ minutes7d: quiet7, streakDays: 0, checkin: null });
    expect(r.band).not.toBe('high'); // capped at moderate
    expect(r.missingSubjectiveInputs).toBe(3);
    expect(r.summary).toMatch(/estimate/i);
  });

  it('with great subjective data and light load it can be high', () => {
    const r = computeReadiness({
      minutes7d: quiet7,
      streakDays: 1,
      checkin: { sleepHrs: 8, energy: 5, soreness: 1 },
    });
    expect(r.band).toBe('high');
    expect(r.recommendation).toBe('normal');
    expect(r.missingSubjectiveInputs).toBe(0);
  });

  it('poor subjective data drags an easy week down to rest/light', () => {
    const r = computeReadiness({
      minutes7d: quiet7,
      streakDays: 0,
      checkin: { sleepHrs: 4, energy: 1, soreness: 5 },
    });
    expect(r.band).not.toBe('high');
    expect(['rest', 'light']).toContain(r.recommendation);
  });

  it('out-of-range check-in values are ignored, not trusted', () => {
    const r = computeReadiness({
      minutes7d: quiet7,
      streakDays: 0,
      checkin: { sleepHrs: 99, energy: 9, soreness: -2 },
    });
    expect(r.missingSubjectiveInputs).toBe(3);
  });

  it('factor details explain what contributed (transparency)', () => {
    const r = computeReadiness({ minutes7d: quiet7, streakDays: 3, checkin: { energy: 4 } });
    const keys = r.factors.map((f) => f.key);
    expect(keys).toContain('load');
    expect(keys).toContain('sleep');
    expect(r.factors.find((f) => f.key === 'energy')!.present).toBe(true);
    expect(r.factors.find((f) => f.key === 'sleep')!.detail).toMatch(/not reported/i);
  });
});
