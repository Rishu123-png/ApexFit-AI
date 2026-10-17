/**
 * Timezone-aware period keys for Arena competitions.
 *
 * Rules (documented in README):
 * - Every user has an IANA `tz` stored on their Arena profile (default Asia/Kolkata).
 * - Day keys, week keys and season keys are computed in THAT timezone.
 * - Weeks are ISO-8601: Monday-start, week 1 contains the year's first Thursday.
 * - Seasons are calendar quarters: Q1 = Jan–Mar … Q4 = Oct–Dec.
 * - Scores are grouped per period key; a user's claim lands in the period
 *   containing "now" in their own timezone.
 */

interface ZonedParts {
  y: number;
  m0: number; // 0-based month
  d: number;
  weekday: number; // 0=Sunday
}

function zonedParts(date: Date, tz: string): ZonedParts {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });
  const parts = dtf.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    y: Number(get('year')),
    m0: Number(get('month')) - 1,
    d: Number(get('day')),
    weekday: weekdays[get('weekday')] ?? 0,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

export function dayKeyInTz(date: Date, tz: string): string {
  const p = zonedParts(date, tz);
  return `${p.y}-${pad(p.m0 + 1)}-${pad(p.d)}`;
}

function isoWeekNumber(y: number, m0: number, d: number): { weekYear: number; week: number } {
  const date = new Date(Date.UTC(y, m0, d));
  const dayNum = (date.getUTCDay() + 6) % 7; // Monday = 0
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // nearest Thursday
  const weekYear = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(weekYear, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / 604800000);
  return { weekYear, week };
}

export function weekKeyInTz(date: Date, tz: string): string {
  const p = zonedParts(date, tz);
  const { weekYear, week } = isoWeekNumber(p.y, p.m0, p.d);
  return `${weekYear}-W${pad(week)}`;
}

export function seasonKeyInTz(date: Date, tz: string): string {
  const p = zonedParts(date, tz);
  const q = Math.floor(p.m0 / 3) + 1;
  return `${p.y}-Q${q}`;
}

/** Offset (ms) that the given tz is ahead of UTC at an instant. */
export function tzOffsetMs(instantMs: number, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23', // NOT hour12:false — avoids the "24:00" midnight quirk
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(new Date(instantMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const hour = get('hour') === 24 ? 0 : get('hour'); // defensive: some engines still emit 24
  const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
  return asUTC - instantMs;
}

/** UTC timestamp of local midnight for a day key in a timezone (DST-safe iteration). */
export function startOfDayMsInTz(dayKey: string, tz: string): number {
  const [y, m, d] = dayKey.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let offset = tzOffsetMs(guess, tz);
  let t = guess - offset;
  offset = tzOffsetMs(t, tz);
  t = guess - offset;
  return t;
}

/** UTC timestamp of the start of the ISO week (Monday 00:00 local) containing the date. */
export function weekStartMsInTz(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  const monday0 = (p.weekday + 6) % 7; // days since Monday
  const monday = new Date(Date.UTC(p.y, p.m0, p.d - monday0));
  const mk = `${monday.getUTCFullYear()}-${pad(monday.getUTCMonth() + 1)}-${pad(monday.getUTCDate())}`;
  return startOfDayMsInTz(mk, tz);
}

/** UTC timestamp of the start of the local season (quarter). */
export function seasonStartMsInTz(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  const qStartMonth = Math.floor(p.m0 / 3) * 3;
  return startOfDayMsInTz(`${p.y}-${pad(qStartMonth + 1)}-01`, tz);
}

export function isValidTimeZone(tz: string): boolean {
  if (typeof tz !== 'string' || tz.length < 2 || tz.length > 40) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
