import { describe, it, expect } from 'vitest';
import { recommendToday, type AdaptiveInput } from '../adaptive';

const TODAY = '2026-10-17';
function sessions(daysAgo: number[], planId = 'home-dumbbell-strength'): AdaptiveInput['recent'] {
  return daysAgo.map((d) => {
    const date = new Date(Date.UTC(2026, 9, 17 - d)).toISOString().slice(0, 10);
    return { dayKey: date, durationSec: 1800, planId };
  });
}

describe('recommendToday — deterministic safety rules', () => {
  it('orders full rest after 6+ training days in the last 7 (no overtraining prescriptions)', () => {
    const rec = recommendToday({ experience: 'advanced', todayKey: TODAY, recent: sessions([1, 2, 3, 4, 5, 6]) });
    expect(rec.action).toBe('rest');
    expect(rec.intensity).toBe(0);
    expect(rec.reasonCodes).toContain('RECOVERY_OVERREACH');
  });

  it('routes HIIT-yesterday to light mobility on the third consecutive day', () => {
    const rec = recommendToday({
      experience: 'intermediate',
      todayKey: TODAY,
      recent: sessions([1], 'ignite-hiit'),
    });
    expect(rec.action).toBe('light');
    expect(rec.planId).toBe('core-mobility');
    expect(rec.reasonCodes).toContain('RECOVERY_AFTER_HIIT');
  });

  it('caps consecutive-day training with a light day', () => {
    const rec = recommendToday({ experience: 'beginner', todayKey: TODAY, recent: sessions([1, 2]) });
    expect(rec.action).toBe('light');
    expect(rec.reasonCodes).toContain('CONSECUTIVE_DAYS_LIMIT');
  });

  it('restarts gently after a full week off', () => {
    const rec = recommendToday({ experience: 'advanced', todayKey: TODAY, recent: [] });
    expect(rec.action).toBe('train');
    expect(rec.planId).toBe('foundations-full-body');
    expect(rec.reasonCodes).toContain('RETURN_AFTER_BREAK');
    expect(rec.intensity).toBeLessThanOrEqual(0.6);
  });

  it('normal progression stays conservative for beginners (never full intensity)', () => {
    const rec = recommendToday({ experience: 'beginner', todayKey: TODAY, recent: sessions([3]) });
    expect(rec.action).toBe('train');
    expect(rec.intensity).toBeLessThan(0.9);
    expect(rec.reasonCodes).toContain('NORMAL_PROGRESSION');
  });

  it('varies the plan when the same one ran yesterday', () => {
    // yesterday = 2026-10-16 for TODAY = 2026-10-17, same default plan
    const rec = recommendToday({
      experience: 'intermediate',
      todayKey: TODAY,
      recent: [{ dayKey: '2026-10-16', durationSec: 1600, planId: 'home-dumbbell-strength' }],
    });
    expect(rec.reasonCodes).toContain('VARIETY_ROTATION');
    expect(rec.planId).not.toBe('home-dumbbell-strength');
  });
});
