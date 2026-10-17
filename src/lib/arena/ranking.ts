/** Deterministic leaderboard ranking. Pure + unit-tested. */

export interface RankCandidate {
  uid: string;
  score: number;
  updatedAt: number;
}

/**
 * Deterministic order:
 *  1. score descending
 *  2. earlier `updatedAt` first (reached the score sooner)
 *  3. uid ascending (final stable tiebreak — results never depend on input order)
 */
export function sortRanked<T extends RankCandidate>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.updatedAt !== b.updatedAt) return a.updatedAt - b.updatedAt;
    return a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0;
  });
}

/** Ranks are 1-based dense positions after sorting (no gaps, deterministic). */
export function assignRanks<T extends RankCandidate>(rows: T[]): (T & { rank: number })[] {
  return sortRanked(rows).map((row, i) => ({ ...row, rank: i + 1 }));
}

/** Bounded pagination over ranked rows. */
export function paginate<T>(rows: T[], cursor: number, limit: number): { page: T[]; nextCursor: number | null } {
  const safeCursor = Math.max(0, Number.isFinite(cursor) ? Math.floor(cursor) : 0);
  const safeLimit = Math.min(Math.max(1, Math.floor(limit) || 25), 50);
  const page = rows.slice(safeCursor, safeCursor + safeLimit);
  const next = safeCursor + safeLimit;
  return { page, nextCursor: next < rows.length ? next : null };
}
