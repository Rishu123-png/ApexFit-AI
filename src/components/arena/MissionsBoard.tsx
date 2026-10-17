'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { claimArena } from '@/lib/arena/client';
import { subscribeNutritionDay, subscribeWeekWorkouts } from '@/lib/db';
import { dateKey } from '@/lib/dates';
import { ARENA_XP_CONFIG } from '@/lib/arena/xp';
import type { NutritionEntry, WorkoutSession } from '@/lib/types';
import type { ArenaEventType, ArenaClaimResult } from '@/lib/arena/types';
import { GlassCard, SectionTitle, Badge, Button } from '@/components/ui';
import { IconCheck, IconRefresh, IconTarget } from '@/components/icons';

interface Mission {
  type: ArenaEventType | 'workout' | 'mobility';
  title: string;
  xp: number;
  progress: string;
  done: boolean;
  weekly?: boolean;
}

export function MissionsBoard({ onClaimed }: { onClaimed: () => void }) {
  const { user, getIdToken } = useAuth();
  const uid = user!.uid;
  const today = dateKey();

  const [meals, setMeals] = useState<NutritionEntry[] | null>(null);
  const [week, setWeek] = useState<WorkoutSession[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState('');

  useEffect(() => subscribeNutritionDay(uid, today, setMeals), [uid, today]);
  useEffect(() => subscribeWeekWorkouts(uid, setWeek), [uid]);

  const todaySessions = (week ?? []).filter((s) => dateKey(new Date(s.startedAt)) === today);
  const completedToday = todaySessions.filter((s) => s.status === 'completed');
  const workoutDays = new Set((week ?? []).map((s) => dateKey(new Date(s.startedAt)))).size;
  const entryCount = meals?.length ?? 0;
  const distinctMeals = new Set((meals ?? []).map((m) => m.meal)).size;

  const missions: Mission[] = useMemo(() => {
    const cfg = ARENA_XP_CONFIG;
    return [
      {
        type: 'workout',
        title: `Complete a workout (≥${cfg.minWorkoutSeconds / 60} min)`,
        xp: cfg.xp.workout_completed,
        progress: `${completedToday.length} done today`,
        done: completedToday.length > 0,
      },
      {
        type: 'mobility',
        title: 'Mobility / recovery session',
        xp: cfg.xp.mobility_session,
        progress: 'Core & Mobility plan',
        done: completedToday.some((s) => cfg.mobilityPlanIds.includes(s.planId)),
      },
      {
        type: 'daily_mission',
        title: 'Daily consistency mission',
        xp: cfg.xp.daily_mission,
        progress: 'any workout, or 3 logged meals',
        done: todaySessions.length > 0 || entryCount >= cfg.missionNutritionEntries,
      },
      {
        type: 'nutrition_milestone',
        title: 'Nutrition logging milestone',
        xp: cfg.xp.nutrition_milestone,
        progress: `${entryCount}/${cfg.minNutritionEntries} items · ${distinctMeals}/${cfg.minNutritionMeals} meals`,
        done: entryCount >= cfg.minNutritionEntries && distinctMeals >= cfg.minNutritionMeals,
      },
      {
        type: 'weekly_milestone',
        title: 'Weekly consistency milestone',
        xp: cfg.xp.weekly_milestone,
        progress: `${workoutDays}/${cfg.weeklyWorkoutDays} training days`,
        done: workoutDays >= cfg.weeklyWorkoutDays,
        weekly: true,
      },
    ];
  }, [completedToday, entryCount, distinctMeals, todaySessions.length, workoutDays]);

  async function sync() {
    setSyncing(true);
    setSyncNote('');
    try {
      const token = await getIdToken();
      let gained = 0;
      // Server re-validates everything; these are idempotent.
      const claims: ArenaClaimResult[] = [];
      for (const type of ['daily_mission', 'nutrition_milestone', 'weekly_milestone'] as ArenaEventType[]) {
        try {
          const r = await claimArena(token, type);
          claims.push(r);
          gained += r.xpAwarded;
        } catch {
          /* unavailable / not configured — stay silent, UI shows progress only */
        }
      }
      setSyncNote(gained > 0 ? `+${gained} XP claimed. Nice work.` : 'All caught up — nothing new to claim right now.');
      onClaimed();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <GlassCard>
      <SectionTitle
        title="Missions"
        action={
          <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={sync} loading={syncing}>
            <IconRefresh width={13} /> Sync & claim
          </Button>
        }
      />
      <ul className="space-y-2">
        {missions.map((m) => (
          <li key={m.type} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-3.5 py-2.5">
            <span
              className={
                m.done
                  ? 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mint/15 text-mint'
                  : 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-white/20 text-slate-500'
              }
              aria-hidden="true"
            >
              {m.done ? <IconCheck width={14} /> : <IconTarget width={13} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-100">{m.title}</span>
              <span className="block text-xs text-slate-500">{m.progress}</span>
            </span>
            <Badge tone={m.weekly ? 'violet' : 'blue'}>+{m.xp}</Badge>
          </li>
        ))}
      </ul>
      {syncNote && <p role="status" className="mt-3 text-sm font-semibold text-mint">{syncNote}</p>}
      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        XP is verified and awarded on the server — never for restriction, extreme volume, or
        low-confidence activity. Daily cap: {ARENA_XP_CONFIG.dailyCap} XP.
      </p>
    </GlassCard>
  );
}
