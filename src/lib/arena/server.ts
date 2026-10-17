import 'server-only';
/**
 * Arena server engine — every privileged operation lives here behind Admin.
 *
 * IMPORTANT: the Firebase Admin SDK BYPASSES Realtime Database security rules.
 * Every function therefore takes the ALREADY VERIFIED `uid` (from a verified ID
 * token) and enforces authorization rules explicitly: users only ever mutate
 * their own arena state, and relationship checks run before any friend data
 * is read or written.
 */
import { randomBytes } from 'crypto';
import { getAdminDb } from '@/lib/firebase/admin';
import { ARENA_XP_CONFIG, arenaEventId, checkEligibility, fbSafeKey, type NutritionDayLike, type SessionLike } from './xp';
import { levelOf } from './levels';
import { dayKeyInTz, weekKeyInTz, seasonKeyInTz, weekStartMsInTz, startOfDayMsInTz } from './periods';
import { assignRanks, paginate } from './ranking';
import { projectionPlan } from './projections';
import { decideDailyAward, eventDecision, type StoredArenaEvent } from './rewardPolicy';
import type {
  ArenaClaimResult,
  ArenaDayCounter,
  ArenaEventType,
  ArenaLifetimeState,
  ArenaProfile,
  ArenaScoreEntry,
  ArenaVisibility,
  BlockRecord,
  FriendRequestRecord,
  FriendRequestSentRecord,
  FriendshipRecord,
  LeaderboardPeriod,
  LeaderboardRow,
  LeaderboardScope,
} from './types';
import type { WorkoutSession, Preferences } from '@/lib/types';

const DEFAULT_TZ = 'Asia/Kolkata';
const MAX_FRIENDS = 200;
const MAX_PENDING_INCOMING = 100;

// ── Profile ──────────────────────────────────────────────────────────────────

export async function getArenaProfile(uid: string): Promise<ArenaProfile | null> {
  const s = await getAdminDb().ref(`arenaProfiles/${uid}`).get();
  return s.exists() ? (s.val() as ArenaProfile) : null;
}

export async function findUidByArenaId(arenaId: string): Promise<string | null> {
  const q = await getAdminDb()
    .ref('arenaProfiles')
    .orderByChild('arenaId')
    .equalTo(arenaId)
    .limitToFirst(1)
    .get();
  if (!q.exists()) return null;
  return Object.keys(q.val() as Record<string, unknown>)[0];
}

function generateArenaId(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I/L/O/0/1 ambiguity
  const bytes = randomBytes(8);
  let id = '';
  for (let i = 0; i < 8; i++) id += alphabet[bytes[i] % alphabet.length];
  return `${id.slice(0, 4)}-${id.slice(4)}`;
}

export async function createArenaProfile(
  uid: string,
  input: { displayName: string; avatarId: string; tz: string; visibility: ArenaVisibility },
): Promise<ArenaProfile> {
  const db = getAdminDb();
  let arenaId = generateArenaId();
  // Id collisions are astronomically unlikely; verify anyway (bounded retries).
  for (let i = 0; i < 5 && (await findUidByArenaId(arenaId)); i++) arenaId = generateArenaId();

  const now = Date.now();
  const profile: ArenaProfile = { arenaId, ...input, createdAt: now, updatedAt: now };
  await db.ref(`arenaProfiles/${uid}`).set(profile);
  await syncProjections(uid); // publish public score projections per visibility
  return profile;
}

export async function updateArenaProfile(
  uid: string,
  patch: Partial<Pick<ArenaProfile, 'displayName' | 'avatarId' | 'tz' | 'visibility'>>,
): Promise<ArenaProfile | null> {
  const db = getAdminDb();
  await db.ref(`arenaProfiles/${uid}`).update({ ...patch, updatedAt: Date.now() });
  await syncProjections(uid); // joining/leaving boards changes projections
  return getArenaProfile(uid);
}

/**
 * Full withdrawal: removes the public profile, ALL public score projections
 * and relationship records — but preserves the private XP balance, verified
 * event history, private workouts/nutrition and the account itself.
 */
export async function withdrawFromArena(uid: string): Promise<void> {
  const db = getAdminDb();
  const now = new Date();
  const profile = await getArenaProfile(uid);
  const tz = profile?.tz ?? DEFAULT_TZ;
  const weekKey = weekKeyInTz(now, tz);
  const seasonKey = seasonKeyInTz(now, tz);

  // remove friendships both directions
  const friendsSnap = await db.ref(`friendships/${uid}`).get();
  const updates: Record<string, null> = {
    [`arenaProfiles/${uid}`]: null,
    [`arenaScores/lifetime/${uid}`]: null,
    [`arenaScores/weekly/${weekKey}/${uid}`]: null,
    [`arenaScores/season/${seasonKey}/${uid}`]: null,
    [`friendRequests/${uid}`]: null,
    [`friendRequestsSent/${uid}`]: null,
    [`friendships/${uid}`]: null,
  };
  if (friendsSnap.exists()) {
    for (const friendUid of Object.keys(friendsSnap.val() as Record<string, unknown>)) {
      updates[`friendships/${friendUid}/${uid}`] = null;
      // also remove any of my pending requests stored under the friend
      const reqSnap = await db
        .ref(`friendRequests/${friendUid}`)
        .orderByChild('fromUid')
        .equalTo(uid)
        .get();
      if (reqSnap.exists()) {
        for (const reqId of Object.keys(reqSnap.val() as Record<string, unknown>)) {
          updates[`friendRequests/${friendUid}/${reqId}`] = null;
        }
      }
    }
  }
  await db.ref().update(updates);
}

// ── Score projections ────────────────────────────────────────────────────────

/** Private lifetime XP balance (never deleted on opt-out). */
export async function getLifetimeState(uid: string): Promise<ArenaLifetimeState> {
  const s = await getAdminDb().ref(`arenaState/${uid}/lifetime`).get();
  return s.exists()
    ? (s.val() as ArenaLifetimeState)
    : { xp: 0, level: 1, updatedAt: 0 };
}

/**
 * Reconcile public projections with CURRENT consent (A2 fix). Whatever the
 * visibility is now, this converges the public paths to exactly what consent
 * allows: global-off deletes the lifetime ladder entry, both-off deletes every
 * public projection. Multi-path update keeps it atomic.
 */
export async function syncProjections(uid: string): Promise<void> {
  const db = getAdminDb();
  const [profile, lifetime] = await Promise.all([getArenaProfile(uid), getLifetimeState(uid)]);
  const plan = projectionPlan(profile !== null, profile?.visibility);

  const updates: Record<string, unknown> = {};
  const now = Date.now();

  if (plan.writeLifetime && profile) {
    const existing = (await db.ref(`arenaScores/lifetime/${uid}`).get()).val() as ArenaScoreEntry | null;
    updates[`arenaScores/lifetime/${uid}`] = {
      score: lifetime.xp,
      updatedAt: now,
      prevRank: existing?.prevRank,
      lastRank: existing?.lastRank,
    } satisfies ArenaScoreEntry;
  } else if (plan.deleteLifetime) {
    updates[`arenaScores/lifetime/${uid}`] = null;
  }

  if (plan.deletePeriods) {
    // Remove every stored weekly/seasonal projection for this user (bounded scan).
    for (const period of ['weekly', 'season'] as const) {
      const s = await db.ref(`arenaScores/${period}`).orderByKey().limitToFirst(104).get();
      if (s.exists()) {
        for (const periodKey of Object.keys(s.val() as Record<string, unknown>)) {
          updates[`arenaScores/${period}/${periodKey}/${uid}`] = null;
        }
      }
    }
  }

  if (Object.keys(updates).length > 0) await db.ref().update(updates);
}

async function computeRankInPath(path: string, myScore: number, uid: string): Promise<number> {
  // Bounded count of entries with a strictly higher score; ties resolved by
  // updatedAt/uid — approximation for the delta display only, documented.
  const q = await getAdminDb()
    .ref(path)
    .orderByChild('score')
    .startAt(myScore + 1)
    .limitToFirst(500)
    .get();
  return q.numChildren() + 1;
}

// ── XP award engine (server-only) ────────────────────────────────────────────

interface AwardContext {
  uid: string;
  tz: string;
  type: ArenaEventType;
  sourceId?: string;
}

/** Evidence reads accept ONLY server-sealed sessions — a client can forge
 *  `status`/`durationSec`, but never `verified`/`serverDurationSec` (rules
 *  deny those fields to client writes; see realtime-database.rules.json). */
async function readOwnWorkout(uid: string, sessionId: string): Promise<SessionLike | null> {
  const s = await getAdminDb().ref(`users/${uid}/workouts/${sessionId}`).get();
  if (!s.exists()) return null;
  const v = s.val() as WorkoutSession;
  if (v.verified !== true || typeof v.serverDurationSec !== 'number') {
    return { durationSec: v.durationSec, status: v.status, planId: v.planId, verified: false };
  }
  return { durationSec: v.serverDurationSec, status: v.status, planId: v.planId, verified: true };
}

async function readOwnNutritionDay(uid: string, dayKey: string): Promise<NutritionDayLike> {
  const s = await getAdminDb().ref(`users/${uid}/nutrition/${dayKey}`).get();
  if (!s.exists()) return { entryCount: 0, distinctMeals: 0, totalCalories: 0 };
  const entries = Object.values(s.val() as Record<string, { meal: string; calories: number; servings: number }>);
  return {
    entryCount: entries.length,
    distinctMeals: new Set(entries.map((e) => e.meal)).size,
    totalCalories: entries.reduce((sum, e) => sum + e.calories * e.servings, 0),
  };
}

async function readOwnCalendar(uid: string, key: 'preferences' | 'profile') {
  const s = await getAdminDb().ref(`users/${uid}/${key}`).get();
  return s.exists() ? (s.val() as Record<string, unknown>) : null;
}

async function workoutDaysInRange(uid: string, startMs: number): Promise<Set<string>> {
  const q = await getAdminDb()
    .ref(`users/${uid}/workouts`)
    .orderByChild('startedAt')
    .startAt(startMs)
    .limitToLast(500)
    .get();
  const days = new Set<string>();
  if (q.exists()) {
    for (const v of Object.values(q.val() as Record<string, WorkoutSession>)) {
      // only server-sealed sessions count toward missions/milestones
      if (v.verified === true) days.add(new Date(v.startedAt).toISOString().slice(0, 10));
    }
  }
  return days;
}

/**
 * Award XP for one verified claim. Idempotent via stable event IDs and a
 * transaction on the event record; aggregates move in their own transactions.
 * XP is taken ONLY from server-side config — never from the request body.
 */
export async function awardXp({
  uid,
  tz,
  type,
  sourceId,
}: AwardContext): Promise<ArenaClaimResult> {
  const db = getAdminDb();
  const profile = await getArenaProfile(uid);
  if (!profile) return { status: 'not_participating', xpAwarded: 0 };

  const now = new Date();
  const dayKey = dayKeyInTz(now, tz);
  const weekKey = weekKeyInTz(now, tz);
  const seasonKey = seasonKeyInTz(now, tz);
  const xp = ARENA_XP_CONFIG.xp[type];

  // ── 1. Load the evidence and validate ELIGIBILITY (functions read only the
  //        claimer's own records — enforced by using the verified uid).
  const dayCounter = await getDayCounter(uid, dayKey);
  let session: SessionLike | null = null;
  if (type === 'workout_completed' || type === 'mobility_session') {
    if (!sourceId) return { status: 'not_eligible', reason: 'Missing workout reference.', xpAwarded: 0 };
    session = await readOwnWorkout(uid, sourceId);
  }
  const nutritionDay =
    type === 'nutrition_milestone' || type === 'daily_mission'
      ? await readOwnNutritionDay(uid, dayKey)
      : undefined;
  const prefs = type === 'nutrition_milestone' ? ((await readOwnCalendar(uid, 'preferences')) as Preferences | null) : null;
  const anyWorkoutToday =
    type === 'daily_mission'
      ? (await workoutDaysInRange(uid, startOfDayMsInTz(dayKey, tz))).size > 0
      : undefined;
  const workoutDaysThisWeek =
    type === 'weekly_milestone'
      ? (await workoutDaysInRange(uid, weekStartMsInTz(now, tz))).size
      : undefined;

  const eligibility = checkEligibility(type, {
    session,
    nutritionDay,
    calorieTarget: prefs?.calorieTarget,
    workoutAwardsToday: Math.min(dayCounter.workoutAwards, ARENA_XP_CONFIG.maxWorkoutAwardsPerDay),
    anyWorkoutToday,
    workoutDaysThisWeek,
  });
  if (!eligibility.ok) return { status: 'not_eligible', reason: eligibility.reason, xpAwarded: 0 };

  // ── 2. Durable, idempotent event state machine (spec §6).
  //        Event record = pending → applied | failed(retryable) | cap_limited(closed).
  //        Stage flags make every step recoverable after a partial failure. ──
  const eventKey = fbSafeKey(arenaEventId(type, { sessionId: sourceId, dayKey, weekKey }));
  const eventRef = db.ref(`arenaEvents/${uid}/${eventKey}`);
  const existing = (await eventRef.get()).val() as StoredArenaEvent | null;
  const decision = eventDecision(existing, Date.now());

  if (decision.action === 'replay') {
    return decision.status === 'cap_limited'
      ? { status: 'daily_cap', reason: 'Daily cap was already reached when this event was recorded.', xpAwarded: 0 }
      : { status: 'already_awarded', reason: 'This activity was already rewarded.', xpAwarded: 0 };
  }
  if (decision.action === 'in-progress') {
    return { status: 'busy', reason: 'This reward is being processed — retry in a few seconds.', xpAwarded: 0 };
  }

  let event: StoredArenaEvent;
  if (decision.action === 'create') {
    event = { type, sourceId, xp, dayKey, weekKey, seasonKey, createdAt: Date.now(), status: 'pending', attempts: 1 };
    const claimTxn = await eventRef.transaction((cur) => (cur ? undefined : event), undefined, false);
    if (claimTxn.committed !== true) {
      // An identical claim landed concurrently — answer from its state, never double-award.
      const snap2 = (await eventRef.get()).val() as StoredArenaEvent | null;
      const d2 = eventDecision(snap2, Date.now());
      return d2.action === 'replay'
        ? { status: d2.status === 'cap_limited' ? 'daily_cap' : 'already_awarded', xpAwarded: 0 }
        : { status: 'busy', reason: 'A concurrent identical claim is in progress.', xpAwarded: 0 };
    }
  } else {
    // Retry of a failed/stale-pending event: the STORED record is authoritative.
    event = { ...decision.event, status: 'pending', attempts: (decision.event.attempts ?? 0) + 1 };
    await eventRef.update({ status: 'pending', attempts: event.attempts, error: null });
  }

  // ── 3. Apply stages, durably marking each one on the event. On ANY failure
  //        the event is marked 'failed' and the same claim may safely retry —
  //        nothing reports success until every stage is durably applied. ──
  const isWorkoutType = event.type === 'workout_completed' || event.type === 'mobility_session';

  try {
    // Stage A — the daily cap + workout quota, atomically (spec §7).
    if (event.dailyApplied !== true) {
      let capReason = 'Daily cap reached.';
      const dailyTxn = await db
        .ref(`arenaState/${uid}/days/${event.dayKey}`)
        .transaction(
          (cur: ArenaDayCounter | null) => {
            const d = decideDailyAward(cur, { xp: event.xp, isWorkoutType }, ARENA_XP_CONFIG);
            if (!d.ok) {
              capReason = d.reason;
              return undefined; // abort — no partial counter write
            }
            return d.next;
          },
          undefined,
          false,
        );
      if (dailyTxn.committed !== true) {
        await eventRef.update({ status: 'cap_limited', error: null, appliedAt: Date.now() });
        return { status: 'daily_cap', reason: capReason, xpAwarded: 0 };
      }
      await eventRef.update({ dailyApplied: true });
    }

    // Stage B — private lifetime balance (never client-writable).
    let lifetime: ArenaLifetimeState;
    if (event.lifetimeApplied !== true) {
      const lifetimeTxn = await db
        .ref(`arenaState/${uid}/lifetime`)
        .transaction((cur: ArenaLifetimeState | null) => {
          const nextXp = (cur?.xp ?? 0) + event.xp;
          return { xp: nextXp, level: levelOf(nextXp), updatedAt: Date.now() };
        });
      lifetime = lifetimeTxn.snapshot.val() as ArenaLifetimeState;
      await eventRef.update({ lifetimeApplied: true });
    } else {
      lifetime = ((await db.ref(`arenaState/${uid}/lifetime`).get()).val() as ArenaLifetimeState | null) ?? {
        xp: 0,
        level: 0,
        updatedAt: Date.now(),
      };
    }
    const prevLevel = levelOf(lifetime.xp - event.xp);
    const leveledUp = event.lifetimeApplied !== true && lifetime.level > prevLevel;

    // Stage C — public projections per CURRENT consent (additive → stage-flagged).
    const plan = projectionPlan(true, profile.visibility);
    if (event.periodsApplied !== true) {
      if (plan.writePeriods) {
        const scoreUpdate = (cur: ArenaScoreEntry | null) => ({
          score: (cur?.score ?? 0) + event.xp,
          updatedAt: Date.now(),
          prevRank: cur?.prevRank,
          lastRank: cur?.lastRank,
        });
        if (plan.writeLifetime) {
          // absolute write (idempotent by construction)
          await db.ref(`arenaScores/lifetime/${uid}`).transaction((cur: ArenaScoreEntry | null) => ({
            score: lifetime.xp,
            updatedAt: Date.now(),
            prevRank: cur?.lastRank ?? cur?.prevRank,
            lastRank: undefined as unknown as number,
          }));
        }
        const weekKeyOfEvent = event.weekKey;
        const seasonKeyOfEvent = event.seasonKey;
        await db.ref(`arenaScores/weekly/${weekKeyOfEvent}/${uid}`).transaction(scoreUpdate);
        await db.ref(`arenaScores/season/${seasonKeyOfEvent}/${uid}`).transaction(scoreUpdate);

        // Rank snapshots for the delta display (bounded reads; best-effort).
        const [weekRank, lifeRank] = await Promise.all([
          computeRankInPath(`arenaScores/weekly/${weekKeyOfEvent}`, (await db.ref(`arenaScores/weekly/${weekKeyOfEvent}/${uid}/score`).get()).val() ?? 0, uid),
          plan.writeLifetime
            ? computeRankInPath('arenaScores/lifetime', lifetime.xp, uid)
            : Promise.resolve(0),
        ]);
        const metaUpdate: Record<string, unknown> = {
          [`arenaScores/weekly/${weekKeyOfEvent}/${uid}/prevRank`]: (await db.ref(`arenaScores/weekly/${weekKeyOfEvent}/${uid}/lastRank`).get()).val() ?? null,
          [`arenaScores/weekly/${weekKeyOfEvent}/${uid}/lastRank`]: weekRank,
        };
        if (plan.writeLifetime && lifeRank > 0) {
          metaUpdate[`arenaScores/lifetime/${uid}/prevRank`] =
            (await db.ref(`arenaScores/lifetime/${uid}/lastRank`).get()).val() ?? null;
          metaUpdate[`arenaScores/lifetime/${uid}/lastRank`] = lifeRank;
        }
        await db.ref().update(metaUpdate);
      }
      await eventRef.update({ periodsApplied: true });
    }

    // Every stage durably done — only now can success be truthfully reported.
    await eventRef.update({ status: 'applied', appliedAt: Date.now(), error: null });
    return { status: 'awarded', xpAwarded: event.xp, lifetime: { xp: lifetime.xp, level: lifetime.level, leveledUp } };
  } catch (err) {
    await eventRef
      .update({ status: 'failed', error: err instanceof Error ? err.message.slice(0, 200) : 'unknown' })
      .catch(() => undefined);
    return { status: 'failed', reason: 'Reward processing failed — safely retry the same claim.', xpAwarded: 0 };
  }
}

export async function getDayCounter(uid: string, dayKey: string): Promise<ArenaDayCounter> {
  const s = await getAdminDb().ref(`arenaState/${uid}/days/${dayKey}`).get();
  return s.exists() ? (s.val() as ArenaDayCounter) : { xp: 0, workoutAwards: 0 };
}

// ── Consistency streak (own data only, computed on demand) ──────────────────

export async function computeStreak(uid: string, tz: string): Promise<number> {
  const since = Date.now() - 62 * 86_400_000;
  const days = new Set<string>();
  const q = await getAdminDb().ref(`users/${uid}/workouts`).orderByChild('startedAt').startAt(since).limitToLast(400).get();
  if (!q.exists()) return 0;
  for (const v of Object.values(q.val() as Record<string, WorkoutSession>)) {
    days.add(dayKeyInTz(new Date(v.startedAt), tz));
  }
  let streak = 0;
  const cursor = new Date();
  // Today not required to be complete to keep an existing streak alive.
  if (!days.has(dayKeyInTz(cursor, tz))) cursor.setTime(cursor.getTime() - 86_400_000);
  while (days.has(dayKeyInTz(cursor, tz))) {
    streak += 1;
    cursor.setTime(cursor.getTime() - 86_400_000);
    if (streak > 62) break;
  }
  return streak;
}

// ── Friend system (all operations validate relationships first) ─────────────

async function getFriendUids(uid: string): Promise<string[]> {
  const s = await getAdminDb().ref(`friendships/${uid}`).get();
  return s.exists() ? Object.keys(s.val() as Record<string, FriendshipRecord>) : [];
}

async function isBlockedEither(a: string, b: string): Promise<boolean> {
  const db = getAdminDb();
  const [ab, ba] = await Promise.all([db.ref(`blocks/${a}/${b}`).get(), db.ref(`blocks/${b}/${a}`).get()]);
  return ab.exists() || ba.exists();
}

const FRIEND_ERR_GENERIC = 'No Arena participant found with that ID.';

export async function sendFriendRequest(fromUid: string, targetArenaId: string) {
  const db = getAdminDb();
  const me = await getArenaProfile(fromUid);
  if (!me) return { ok: false as const, error: 'not_participating', message: 'Join Apex Arena before adding friends.' };

  const toUid = await findUidByArenaId(targetArenaId);
  // Deliberately identical for unknown IDs, withdrawn users and blocks —
  // we never reveal whether a private account exists.
  if (!toUid || toUid === fromUid) {
    return { ok: false as const, error: 'not_found', message: toUid === fromUid ? "That's your own Arena ID — share it with friends instead." : FRIEND_ERR_GENERIC };
  }
  if (await isBlockedEither(fromUid, toUid)) {
    return { ok: false as const, error: 'not_found', message: FRIEND_ERR_GENERIC };
  }
  const friends = await getFriendUids(fromUid);
  if (friends.includes(toUid)) return { ok: false as const, error: 'already_friends', message: 'You are already friends.' };
  if (friends.length >= MAX_FRIENDS) return { ok: false as const, error: 'limit', message: 'Friend list is full.' };

  // incoming request from them already? then just accept it.
  const incoming = await db.ref(`friendRequests/${fromUid}`).orderByChild('fromUid').equalTo(toUid).get();
  if (incoming.exists()) {
    const reqId = Object.keys(incoming.val() as Record<string, FriendRequestRecord>)[0];
    return acceptFriendRequest(fromUid, reqId);
  }

  // duplicate outgoing?
  const sent = await db.ref(`friendRequestsSent/${fromUid}`).orderByChild('toUid').equalTo(toUid).get();
  if (sent.exists()) return { ok: false as const, error: 'duplicate', message: 'Request already sent — waiting for them to respond.' };

  const pendingCount = (await db.ref(`friendRequests/${toUid}`).get()).numChildren();
  if (pendingCount >= MAX_PENDING_INCOMING) {
    return { ok: false as const, error: 'limit', message: 'That user has too many pending requests right now.' };
  }

  const reqId = db.ref().push().key as string;
  const now = Date.now();
  const request: FriendRequestRecord = {
    fromUid,
    fromDisplayName: me.displayName,
    fromAvatarId: me.avatarId,
    createdAt: now,
  };
  const sentRecord: FriendRequestSentRecord = { toUid, createdAt: now };
  await db.ref().update({
    [`friendRequests/${toUid}/${reqId}`]: request,
    [`friendRequestsSent/${fromUid}/${reqId}`]: sentRecord,
  });
  return { ok: true as const, message: 'Friend request sent.' };
}

export async function acceptFriendRequest(uid: string, requestId: string) {
  const db = getAdminDb();
  const snap = await db.ref(`friendRequests/${uid}/${requestId}`).get();
  if (!snap.exists()) return { ok: false as const, message: 'Request not found — it may have been withdrawn.' };
  const req = snap.val() as FriendRequestRecord;
  if (await isBlockedEither(uid, req.fromUid)) {
    await removeRequestRecords(uid, requestId, req.fromUid);
    return { ok: false as const, message: 'Unable to accept this request.' };
  }
  const now = Date.now();
  await db.ref().update({
    [`friendships/${uid}/${req.fromUid}`]: { createdAt: now } satisfies FriendshipRecord,
    [`friendships/${req.fromUid}/${uid}`]: { createdAt: now } satisfies FriendshipRecord,
    [`friendRequests/${uid}/${requestId}`]: null,
    [`friendRequestsSent/${req.fromUid}/${requestId}`]: null,
  });
  return { ok: true as const, message: `You and ${req.fromDisplayName} are now Arena friends.` };
}

async function removeRequestRecords(toUid: string, requestId: string, fromUid: string) {
  await getAdminDb().ref().update({
    [`friendRequests/${toUid}/${requestId}`]: null,
    [`friendRequestsSent/${fromUid}/${requestId}`]: null,
  });
}

export async function rejectFriendRequest(uid: string, requestId: string) {
  const db = getAdminDb();
  const snap = await db.ref(`friendRequests/${uid}/${requestId}`).get();
  if (!snap.exists()) return { ok: false as const, message: 'Request not found.' };
  const req = snap.val() as FriendRequestRecord;
  await removeRequestRecords(uid, requestId, req.fromUid);
  return { ok: true as const, message: 'Request declined.' };
}

export async function removeFriend(uid: string, friendUid: string) {
  if (uid === friendUid) return { ok: false as const, message: 'Invalid request.' };
  await getAdminDb().ref().update({
    [`friendships/${uid}/${friendUid}`]: null,
    [`friendships/${friendUid}/${uid}`]: null,
  });
  return { ok: true as const, message: 'Friend removed.' };
}

export async function blockUser(uid: string, target: { arenaId?: string; uid?: string }) {
  const db = getAdminDb();
  const targetUid = target.uid ?? (target.arenaId ? await findUidByArenaId(target.arenaId) : null);
  if (!targetUid || targetUid === uid) return { ok: false as const, message: 'Unable to block that user.' };
  const now = Date.now();
  const updates: Record<string, unknown> = {
    [`blocks/${uid}/${targetUid}`]: { createdAt: now } satisfies BlockRecord,
    // sever any friendship and pending requests, quietly
    [`friendships/${uid}/${targetUid}`]: null,
    [`friendships/${targetUid}/${uid}`]: null,
  };
  // remove pending requests either direction
  const inReq = await db.ref(`friendRequests/${uid}`).orderByChild('fromUid').equalTo(targetUid).get();
  if (inReq.exists()) for (const id of Object.keys(inReq.val() as object)) updates[`friendRequests/${uid}/${id}`] = null;
  const outReq = await db.ref(`friendRequests/${targetUid}`).orderByChild('fromUid').equalTo(uid).get();
  if (outReq.exists()) for (const id of Object.keys(outReq.val() as object)) {
    updates[`friendRequests/${targetUid}/${id}`] = null;
    updates[`friendRequestsSent/${uid}/${id}`] = null;
  }
  await db.ref().update(updates);
  return { ok: true as const, message: 'User blocked. They can no longer interact with you in the Arena.' };
}

export async function unblockUser(uid: string, targetUid: string) {
  await getAdminDb().ref(`blocks/${uid}/${targetUid}`).remove();
  return { ok: true as const, message: 'User unblocked.' };
}

export interface FriendsOverview {
  friends: { uid: string; displayName: string; avatarId: string; level: number; createdAt: number }[];
  incoming: { requestId: string; fromDisplayName: string; fromAvatarId: string; createdAt: number }[];
  outgoing: { requestId: string; createdAt: number }[];
  blocked: { uid: string; displayName: string | null; createdAt: number }[];
}

export async function getFriendsOverview(uid: string): Promise<FriendsOverview> {
  const db = getAdminDb();
  const [friendUids, inSnap, outSnap, blockSnap] = await Promise.all([
    getFriendUids(uid),
    db.ref(`friendRequests/${uid}`).get(),
    db.ref(`friendRequestsSent/${uid}`).get(),
    db.ref(`blocks/${uid}`).get(),
  ]);

  const friends = (
    await Promise.all(
      friendUids.map(async (fuid) => {
        const [p, f, lifetime] = await Promise.all([
          getArenaProfile(fuid),
          db.ref(`friendships/${uid}/${fuid}`).get(),
          getLifetimeState(fuid),
        ]);
        if (!p) return null; // withdrawn users vanish from lists
        return { uid: fuid, displayName: p.displayName, avatarId: p.avatarId, level: lifetime.level, createdAt: (f.val() as FriendshipRecord).createdAt };
      }),
    )
  ).filter((f): f is NonNullable<typeof f> => f !== null);

  const incoming = inSnap.exists()
    ? Object.entries(inSnap.val() as Record<string, FriendRequestRecord>)
        .map(([requestId, r]) => ({ requestId, fromDisplayName: r.fromDisplayName, fromAvatarId: r.fromAvatarId, createdAt: r.createdAt }))
        .sort((a, b) => b.createdAt - a.createdAt)
    : [];

  const outgoing = outSnap.exists()
    ? Object.entries(outSnap.val() as Record<string, FriendRequestSentRecord>)
        .map(([requestId, r]) => ({ requestId, createdAt: r.createdAt }))
        .sort((a, b) => b.createdAt - a.createdAt)
    : [];

  const blocked = blockSnap.exists()
    ? await Promise.all(
        Object.entries(blockSnap.val() as Record<string, BlockRecord>).map(async ([buid, b]) => {
          const p = await getArenaProfile(buid);
          return { uid: buid, displayName: p?.displayName ?? null, createdAt: b.createdAt };
        }),
      )
    : [];

  return { friends, incoming, outgoing, blocked };
}

// ── Leaderboards ─────────────────────────────────────────────────────────────

const MAX_BOARD_SCAN = 500;

export async function getLeaderboard(
  requesterUid: string,
  scope: LeaderboardScope,
  period: LeaderboardPeriod,
  cursor: number,
  limit: number,
) {
  const db = getAdminDb();
  const me = await getArenaProfile(requesterUid);
  const tz = me?.tz ?? DEFAULT_TZ;
  const now = new Date();

  let scorePath: string;
  let periodKey: string;
  if (period === 'lifetime') {
    scorePath = 'arenaScores/lifetime';
    periodKey = 'lifetime';
  } else if (period === 'weekly') {
    periodKey = weekKeyInTz(now, tz);
    scorePath = `arenaScores/weekly/${periodKey}`;
  } else {
    periodKey = seasonKeyInTz(now, tz);
    scorePath = `arenaScores/season/${periodKey}`;
  }

  const snap = await db.ref(scorePath).orderByChild('score').limitToLast(MAX_BOARD_SCAN).get();
  const scores = snap.exists()
    ? (Object.entries(snap.val() as Record<string, ArenaScoreEntry>).map(([uid, v]) => ({ uid, ...v })))
    : [];

  // Friend relationship map is needed for the friends board.
  const friendUids = scope === 'friends' ? new Set(await getFriendUids(requesterUid)) : null;

  // Join with public allowlist profiles + apply participation rules.
  const candidates = (
    await Promise.all(
      scores.map(async (s) => {
        if (scope === 'friends' && s.uid !== requesterUid && !friendUids!.has(s.uid)) return null;
        const p = await getArenaProfile(s.uid);
        if (!p) return null;
        if (scope === 'global' && !p.visibility.global) return null;
        if (scope === 'friends' && s.uid !== requesterUid && !p.visibility.friends) return null;
        return {
          uid: s.uid,
          score: s.score,
          updatedAt: s.updatedAt,
          prevRank: s.prevRank,
          lastRank: s.lastRank,
          displayName: p.displayName,
          avatarId: p.avatarId,
        };
      }),
    )
  ).filter((c): c is NonNullable<typeof c> => c !== null);

  const ranked = assignRanks(candidates);
  const { page, nextCursor } = paginate(ranked, cursor, limit);

  const selfRanked = ranked.find((r) => r.uid === requesterUid);
  const rows: LeaderboardRow[] = await Promise.all(
    page.map(async (r) => {
      const self = r.uid === requesterUid;
      const friendship: LeaderboardRow['friendship'] = self ? 'self' : friendUids?.has(r.uid) ? 'friend' : 'none';
      const level = period === 'lifetime' ? levelOf(r.score) : (await getLifetimeState(r.uid)).level;
      const delta =
        typeof r.prevRank === 'number' && typeof r.lastRank === 'number' ? r.prevRank - r.lastRank : null;
      return {
        rank: r.rank,
        displayName: r.displayName,
        avatarId: r.avatarId,
        score: r.score,
        level,
        delta,
        isSelf: self,
        friendship,
      };
    }),
  );

  return {
    rows,
    total: ranked.length,
    nextCursor,
    period,
    periodKey,
    scope,
    selfRank: selfRanked ? ranked.findIndex((r) => r.uid === requesterUid) + 1 : null,
    participating: !!me,
  };
}

// Re-export for routes
export { weekKeyInTz, seasonKeyInTz, dayKeyInTz };
