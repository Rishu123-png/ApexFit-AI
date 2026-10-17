import { describe, it, expect } from 'vitest';
import { assignRanks, sortRanked, paginate } from '../ranking';

const row = (uid: string, score: number, updatedAt: number) => ({ uid, score, updatedAt });

describe('deterministic ranking & tie-breaking', () => {
  it('orders by score descending', () => {
    const out = sortRanked([row('a', 10, 1), row('b', 30, 1), row('c', 20, 1)]);
    expect(out.map((r) => r.uid)).toEqual(['b', 'c', 'a']);
  });
  it('tie → earlier completion wins', () => {
    const out = sortRanked([row('late', 50, 2000), row('early', 50, 1000)]);
    expect(out.map((r) => r.uid)).toEqual(['early', 'late']);
  });
  it('full tie → uid ascending (input order independent)', () => {
    const a = sortRanked([row('z', 1, 1), row('a', 1, 1)]);
    const b = sortRanked([row('a', 1, 1), row('z', 1, 1)]);
    expect(a.map((r) => r.uid)).toEqual(['a', 'z']);
    expect(b.map((r) => r.uid)).toEqual(['a', 'z']);
    expect(a).toEqual(b);
  });
  it('ranks are dense 1-based positions', () => {
    const out = assignRanks([row('b', 5, 1), row('a', 9, 1)]);
    expect(out[0]).toMatchObject({ uid: 'a', rank: 1 });
    expect(out[1]).toMatchObject({ uid: 'b', rank: 2 });
  });
});

describe('pagination', () => {
  const rows = Array.from({ length: 60 }, (_, i) => ({ uid: `u${i}`, score: 1000 - i, updatedAt: i }));
  it('slices bounded pages with a next cursor', () => {
    const p1 = paginate(rows, 0, 25);
    expect(p1.page).toHaveLength(25);
    expect(p1.nextCursor).toBe(25);
    const p2 = paginate(rows, p1.nextCursor!, 25);
    expect(p2.page[0].uid).toBe('u25');
    const p3 = paginate(rows, p2.nextCursor!, 25);
    expect(p3.page).toHaveLength(10);
    expect(p3.nextCursor).toBeNull();
  });
  it('clamps unsafe cursors/limits', () => {
    expect(paginate(rows, -5, 25).page[0].uid).toBe('u0');
    expect(paginate(rows, NaN, 25).page).toHaveLength(25);
    expect(paginate(rows, 0, 1000).page.length).toBeLessThanOrEqual(50);
  });
});
