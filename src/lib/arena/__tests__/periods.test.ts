import { describe, it, expect } from 'vitest';
import {
  dayKeyInTz,
  weekKeyInTz,
  seasonKeyInTz,
  startOfDayMsInTz,
  weekStartMsInTz,
  isValidTimeZone,
} from '../periods';

const UTC = 'UTC';
const IST = 'Asia/Kolkata'; // UTC+5:30, no DST

describe('timezone awareness at day boundaries', () => {
  // 2026-10-18 20:30 UTC = 2026-10-19 02:00 IST — different local days.
  const instant = new Date('2026-10-18T20:30:00Z');
  it('day keys differ across timezones near midnight', () => {
    expect(dayKeyInTz(instant, UTC)).toBe('2026-10-18');
    expect(dayKeyInTz(instant, IST)).toBe('2026-10-19');
  });
});

describe('week keys (ISO-8601, Monday start)', () => {
  it('computes known ISO weeks', () => {
    // 2026 ISO calendar: W42 = Mon Oct 12 – Sun Oct 18; W43 = Mon Oct 19 – Sun Oct 25
    expect(weekKeyInTz(new Date('2026-10-17T12:00:00Z'), UTC)).toBe('2026-W42');
    expect(weekKeyInTz(new Date('2026-10-19T00:10:00Z'), UTC)).toBe('2026-W43');
    expect(weekKeyInTz(new Date('2026-10-25T23:50:00Z'), UTC)).toBe('2026-W43');
    expect(weekKeyInTz(new Date('2026-10-26T00:10:00Z'), UTC)).toBe('2026-W44');
  });
  it('year rollover is ISO-correct (2026-01-01 is W01, 2025-12-29 belongs to 2026-W01)', () => {
    expect(weekKeyInTz(new Date('2026-01-01T12:00:00Z'), UTC)).toBe('2026-W01');
    expect(weekKeyInTz(new Date('2025-12-29T12:00:00Z'), UTC)).toBe('2026-W01');
  });
});

describe('season keys (calendar quarters)', () => {
  it('maps months to quarters', () => {
    expect(seasonKeyInTz(new Date('2026-10-17T12:00:00Z'), UTC)).toBe('2026-Q4');
    expect(seasonKeyInTz(new Date('2026-01-05T12:00:00Z'), UTC)).toBe('2026-Q1');
  });
  it('quarter boundary is timezone-aware', () => {
    // 2026-09-30 19:30 UTC = 2026-10-01 01:00 IST → Q4 in IST, Q3 in UTC.
    const boundary = new Date('2026-09-30T19:30:00Z');
    expect(seasonKeyInTz(boundary, UTC)).toBe('2026-Q3');
    expect(seasonKeyInTz(boundary, IST)).toBe('2026-Q4');
  });
});

describe('start-of-day / week timestamps', () => {
  it('IST midnight is 18:30 UTC on the previous day', () => {
    expect(startOfDayMsInTz('2026-10-17', IST)).toBe(Date.parse('2026-10-16T18:30:00Z'));
    expect(startOfDayMsInTz('2026-10-17', UTC)).toBe(Date.parse('2026-10-17T00:00:00Z'));
  });
  it('week start is Monday 00:00 local', () => {
    // Saturday 2026-10-17 UTC → week started Monday 2026-10-12
    expect(weekStartMsInTz(new Date('2026-10-17T12:00:00Z'), UTC)).toBe(Date.parse('2026-10-12T00:00:00Z'));
  });
});

describe('timezone validation', () => {
  it('accepts IANA names, rejects garbage', () => {
    expect(isValidTimeZone('Asia/Kolkata')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Not/AZone')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone('x'.repeat(64))).toBe(false);
  });
});
