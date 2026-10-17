/** Local-date helpers (device timezone, which for our audience is typically IST). */

export function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function friendlyDate(d: Date = new Date()): string {
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Millisecond timestamp for the start of "n days ago" local time. */
export function daysAgoTs(days: number): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime() - days * 86_400_000;
}

/** Last 7 local day labels (oldest → today), e.g. ['Sat', 'Sun', ...]. */
export function last7DayLabels(): { label: string; key: string }[] {
  const out: { label: string; key: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(daysAgoTs(i));
    out.push({ label: d.toLocaleDateString('en-IN', { weekday: 'short' }), key: dateKey(d) });
  }
  return out;
}

export function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
