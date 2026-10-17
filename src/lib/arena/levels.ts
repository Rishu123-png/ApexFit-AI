/** Lifetime XP → level curve. Pure + unit-tested. */

/** XP required to *reach* level n (n ≥ 1): quadratic curve. */
export function xpForLevel(level: number): number {
  const n = Math.max(1, Math.floor(level));
  return 100 * (n - 1) * (n - 1);
}

export function levelOf(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
}

export interface LevelProgress {
  level: number;
  /** floor XP of current level */
  base: number;
  /** XP needed for next level (absolute) */
  next: number;
  /** XP earned inside current level */
  into: number;
  /** XP remaining within this level */
  toGo: number;
  pct: number;
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelOf(xp);
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const span = Math.max(1, next - base);
  const into = xp - base;
  return {
    level,
    base,
    next,
    into,
    toGo: Math.max(0, next - xp),
    pct: Math.min(1, Math.max(0, into / span)),
  };
}

export const LEVEL_TITLES = [
  'Rookie', 'Initiate', 'Mover', 'Striver', 'Athlete',
  'Warrior', 'Elite', 'Master', 'Apex', 'Legend',
] as const;

export function levelTitle(level: number): string {
  if (level <= 0) return LEVEL_TITLES[0];
  return level <= LEVEL_TITLES.length
    ? LEVEL_TITLES[level - 1]
    : `Mythic ${level - LEVEL_TITLES.length}`;
}
