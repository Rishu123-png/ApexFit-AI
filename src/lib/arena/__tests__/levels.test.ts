import { describe, it, expect } from 'vitest';
import { levelOf, xpForLevel, levelProgress, levelTitle } from '../levels';

describe('level curve', () => {
  it('level 1 starts at 0 XP', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(levelOf(0)).toBe(1);
  });
  it('thresholds are strictly increasing', () => {
    for (let n = 1; n < 50; n++) {
      expect(xpForLevel(n + 1)).toBeGreaterThan(xpForLevel(n));
    }
  });
  it('levelOf is consistent with thresholds', () => {
    for (const xp of [0, 99, 100, 101, 400, 5000, 100000]) {
      const level = levelOf(xp);
      expect(xp).toBeGreaterThanOrEqual(xpForLevel(level));
      expect(xp).toBeLessThan(xpForLevel(level + 1));
    }
  });
  it('progress stays within [0,1] and is monotonic in xp', () => {
    let last = -1;
    for (const xp of [0, 50, 99, 100, 250, 399, 400, 700, 1600, 2500]) {
      const p = levelProgress(xp);
      expect(p.pct).toBeGreaterThanOrEqual(0);
      expect(p.pct).toBeLessThanOrEqual(1);
      if (p.level === levelOf(xp - 1)) expect(p.pct).toBeGreaterThanOrEqual(last);
      last = p.pct;
    }
  });
  it('titles exist and never crash on extremes', () => {
    expect(levelTitle(1)).toBe('Rookie');
    expect(levelTitle(100)).toContain('Mythic');
  });
});
