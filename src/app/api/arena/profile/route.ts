import { NextRequest, NextResponse } from 'next/server';
import { requireArenaUser, isErrorResponse, withArenaDeadline, arenaUnavailableResponse } from '@/lib/arena/http';
import { getArenaProfile, getLifetimeState, getDayCounter, computeStreak } from '@/lib/arena/server';
import { levelProgress } from '@/lib/arena/levels';
import { dayKeyInTz, weekKeyInTz, seasonKeyInTz } from '@/lib/arena/periods';
import { getAdminDb } from '@/lib/firebase/admin';
import type { ArenaScoreEntry } from '@/lib/arena/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/arena/profile — own participation state, balance and period scores. */
export async function GET(req: NextRequest) {
  const auth = await requireArenaUser(req);
  if (isErrorResponse(auth)) return auth;
  const { uid } = auth;

  try {
    return await withArenaDeadline((async () => {
      const profile = await getArenaProfile(uid);
      if (!profile) return NextResponse.json({ participant: false });

      const tz = profile.tz;
      const now = new Date();
      const dayKey = dayKeyInTz(now, tz);
      const weekKey = weekKeyInTz(now, tz);
      const seasonKey = seasonKeyInTz(now, tz);

      const [lifetime, day, streak, weekScore, seasonScore] = await Promise.all([
        getLifetimeState(uid),
        getDayCounter(uid, dayKey),
        computeStreak(uid, tz),
        getAdminDb().ref(`arenaScores/weekly/${weekKey}/${uid}`).get(),
        getAdminDb().ref(`arenaScores/season/${seasonKey}/${uid}`).get(),
      ]);

      return NextResponse.json({
        participant: true,
        profile,
        lifetime: { ...levelProgress(lifetime.xp), xp: lifetime.xp },
        streakDays: streak,
        today: { xp: day.xp, workoutAwards: day.workoutAwards },
        period: {
          dayKey,
          weekKey,
          weekXp: (weekScore.val() as ArenaScoreEntry | null)?.score ?? 0,
          seasonKey,
          seasonXp: (seasonScore.val() as ArenaScoreEntry | null)?.score ?? 0,
        },
      });
    })());
  } catch (err) {
    return arenaUnavailableResponse(err, 'profile');
  }
}
