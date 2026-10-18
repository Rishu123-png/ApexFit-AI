'use client';

import type {
  ArenaClaimResult,
  ArenaEventType,
  ArenaProfile,
  LeaderboardResponse,
} from './types';

export interface ArenaProfileResponse {
  participant: boolean;
  profile?: ArenaProfile;
  lifetime?: { xp: number; level: number; base: number; next: number; into: number; toGo: number; pct: number };
  streakDays?: number;
  today?: { xp: number; workoutAwards: number };
  period?: { dayKey: string; weekKey: string; weekXp: number; seasonKey: string; seasonXp: number };
}

export interface FriendsOverviewResponse {
  friends: { uid: string; displayName: string; avatarId: string; level: number; createdAt: number }[];
  incoming: { requestId: string; fromDisplayName: string; fromAvatarId: string; createdAt: number }[];
  outgoing: { requestId: string; createdAt: number }[];
  blocked: { uid: string; displayName: string | null; createdAt: number }[];
}

export class ArenaApiError extends Error {
  constructor(
    public code: string,
    message?: string,
    public status?: number,
  ) {
    super(message ?? code);
  }
}

export async function arenaFetch<T>(
  token: string,
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(path, {
    // Fail visibly instead of hanging on skeletons when the server is cold or
    // the network is weak (Android + Vercel cold start can take tens of seconds).
    signal: AbortSignal.timeout(20000),
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ArenaApiError(
      typeof data.error === 'string' ? data.error : `HTTP_${res.status}`,
      typeof data.message === 'string' ? data.message : undefined,
      res.status,
    );
  }
  return data as T;
}

export function claimArena(
  token: string,
  type: ArenaEventType,
  opts: { sourceId?: string } = {},
): Promise<ArenaClaimResult> {
  return arenaFetch<ArenaClaimResult>(token, '/api/arena/claim', {
    method: 'POST',
    // Period boundaries are determined from the server-stored Arena profile;
    // never let an individual reward request choose a timezone.
    body: { type, sourceId: opts.sourceId },
  });
}

export function getLeaderboardClient(
  token: string,
  scope: 'global' | 'friends',
  period: 'weekly' | 'seasonal' | 'lifetime',
  cursor: number,
): Promise<LeaderboardResponse & { selfRank: number | null; participating: boolean }> {
  return arenaFetch(token, `/api/arena/leaderboard?scope=${scope}&period=${period}&cursor=${cursor}&limit=25`);
}
