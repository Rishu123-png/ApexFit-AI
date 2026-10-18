/** Apex Arena — shared types (client + server). */

export interface ArenaVisibility {
  /** appear on Global leaderboards (incl. lifetime ladder) */
  global: boolean;
  /** appear on your accepted friends' leaderboards */
  friends: boolean;
}

/** Public, allowlisted Arena profile — never a copy of the private user profile. */
export interface ArenaProfile {
  /** short shareable ID used for friend invites (e.g. APEX-7K2Q) */
  arenaId: string;
  displayName: string;
  avatarId: string;
  visibility: ArenaVisibility;
  /** IANA timezone, drives this user's period boundaries */
  tz: string;
  createdAt: number;
  updatedAt: number;
}

export type ArenaEventType =
  | 'workout_completed'
  | 'mobility_session'
  | 'daily_mission'
  | 'nutrition_milestone'
  | 'weekly_milestone';

/** Verified point award — written server-side only. Also the idempotency record. */
export interface ArenaEvent {
  type: ArenaEventType;
  sourceId?: string;
  xp: number;
  dayKey: string;
  weekKey: string;
  seasonKey: string;
  createdAt: number;
  /** Durable state machine (§6): pending → applied | failed(retryable) | cap_limited(closed).
   *  Events written before this field existed have `status === undefined`
   *  and are treated as already applied (replay-safe). */
  status?: 'pending' | 'applied' | 'failed' | 'cap_limited';
  attempts?: number;
  error?: string;
  appliedAt?: number;
}

/** Private XP balance (server-only path). Never deleted on opt-out. */
export interface ArenaLifetimeState {
  xp: number;
  level: number;
  updatedAt: number;
}

/** Public projection used for ranking (exists only while the user participates). */
export interface ArenaScoreEntry {
  score: number;
  updatedAt: number;
  prevRank?: number;
  lastRank?: number;
  /** Denormalized public display data avoids an N+1 profile lookup per row. */
  displayName?: string;
  avatarId?: string;
  level?: number;
  globalVisible?: boolean;
  friendsVisible?: boolean;
}

export interface ArenaDayCounter {
  xp: number;
  workoutAwards: number;
}

export interface FriendRequestRecord {
  fromUid: string;
  fromDisplayName: string;
  fromAvatarId: string;
  createdAt: number;
}

export interface FriendRequestSentRecord {
  toUid: string;
  createdAt: number;
}

export interface FriendshipRecord {
  createdAt: number;
}

export interface BlockRecord {
  createdAt: number;
}

export type LeaderboardScope = 'global' | 'friends';
export type LeaderboardPeriod = 'weekly' | 'seasonal' | 'lifetime';

export interface LeaderboardRow {
  rank: number;
  displayName: string;
  avatarId: string;
  /** period score, or lifetime XP on the lifetime board */
  score: number;
  level: number;
  /** rank change since the user's last stored award; null when no reliable data */
  delta: number | null;
  isSelf: boolean;
  friendship?: 'friend' | 'self' | 'none';
}

export interface LeaderboardResponse {
  rows: LeaderboardRow[];
  total: number;
  nextCursor: number | null;
  period: LeaderboardPeriod;
  periodKey: string;
  scope: LeaderboardScope;
}

export interface ArenaClaimResult {
  status:
    | 'awarded'
    | 'already_awarded'
    | 'not_eligible'
    | 'daily_cap'
    | 'not_participating'
    /** a concurrent identical claim is being applied — safe to poll again */
    | 'busy'
    /** event recorded but aggregate update failed — retry the same claim */
    | 'failed';
  reason?: string;
  xpAwarded: number;
  lifetime?: { xp: number; level: number; leveledUp: boolean };
}
