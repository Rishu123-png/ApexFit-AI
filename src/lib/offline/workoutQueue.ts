import { saveWorkoutSession } from '@/lib/db';
import type { WorkoutSession } from '@/lib/types';

/**
 * Durable, user-scoped fallback for a completed workout when Realtime Database
 * cannot be reached. It is intentionally limited to private workout history:
 * queued sessions never claim Arena XP in the background.
 */
const QUEUE_VERSION = 1;
const MAX_QUEUED_SESSIONS = 12;

type PendingWorkout = {
  version: number;
  uid: string;
  sessionId: string;
  session: Omit<WorkoutSession, 'id'>;
  queuedAt: number;
};

const keyFor = (uid: string) => `apexfit:pending-workouts:v${QUEUE_VERSION}:${uid}`;

function readQueue(uid: string): PendingWorkout[] {
  try {
    const raw = localStorage.getItem(keyFor(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is PendingWorkout => {
      if (typeof item !== 'object' || item === null) return false;
      const row = item as Record<string, unknown>;
      return row.version === QUEUE_VERSION && row.uid === uid && typeof row.sessionId === 'string' && typeof row.session === 'object' && row.session !== null && typeof row.queuedAt === 'number';
    });
  } catch {
    return [];
  }
}

function writeQueue(uid: string, rows: PendingWorkout[]) {
  try {
    localStorage.setItem(keyFor(uid), JSON.stringify(rows.slice(-MAX_QUEUED_SESSIONS)));
  } catch {
    // Storage can be full or disabled. The caller still receives an honest
    // save failure message rather than incorrectly claiming it is queued.
    throw new Error('Offline storage is unavailable.');
  }
}

export function pendingWorkoutCount(uid: string) {
  return readQueue(uid).length;
}

export function queueWorkoutForSync(
  uid: string,
  sessionId: string,
  session: Omit<WorkoutSession, 'id'>,
) {
  const existing = readQueue(uid).filter((row) => row.sessionId !== sessionId);
  writeQueue(uid, [...existing, { version: QUEUE_VERSION, uid, sessionId, session, queuedAt: Date.now() }]);
}

/**
 * Retry all queued writes in order. A write uses the same deterministic record
 * id that the session runner created, so a network failure after Firebase has
 * accepted a write cannot create a duplicate workout on the next retry.
 */
export async function flushQueuedWorkouts(uid: string): Promise<{ synced: number; remaining: number }> {
  const queued = readQueue(uid);
  if (queued.length === 0) return { synced: 0, remaining: 0 };

  const remaining: PendingWorkout[] = [];
  let synced = 0;
  for (const row of queued) {
    try {
      await saveWorkoutSession(uid, row.session, row.sessionId);
      synced += 1;
    } catch {
      remaining.push(row);
    }
  }
  writeQueue(uid, remaining);
  return { synced, remaining: remaining.length };
}

export function makeLocalWorkoutId() {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replace(/-/g, '')
    : Math.random().toString(36).slice(2);
  return `local_${Date.now()}_${random}`;
}
