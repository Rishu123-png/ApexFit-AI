'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { WORKOUT_PLANS } from '@/lib/data/plans';
import { subscribeRecentWorkouts } from '@/lib/db';
import { formatDuration } from '@/lib/dates';
import type { WorkoutPlan, WorkoutSession } from '@/lib/types';
import { GlassCard, SectionTitle, Badge, Button, EmptyState } from '@/components/ui';
import { SessionRunner } from '@/components/workout/SessionRunner';
import { IconPlay, IconClock, IconDumbbell } from '@/components/icons';
import { clsx } from '@/lib/clsx';

function WorkoutsInner() {
  const { user } = useAuth();
  const params = useSearchParams();
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [recent, setRecent] = useState<WorkoutSession[] | null>(null);

  useEffect(() => subscribeRecentWorkouts(user!.uid, 6, setRecent), [user]);

  // Deep link: /workouts?plan=<id> starts that plan's overview first click.
  useEffect(() => {
    const pid = params.get('plan');
    if (pid) {
      const plan = WORKOUT_PLANS.find((p) => p.id === pid);
      if (plan) setActivePlan(plan);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (activePlan) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <button onClick={() => setActivePlan(null)} className="text-sm font-semibold text-slate-400 transition hover:text-slate-200">
          ← All plans
        </button>
        <SessionRunner plan={activePlan} onExit={() => setActivePlan(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Training <span className="neon-text">plans</span></h1>
        <p className="mt-1 text-sm text-slate-400">Pick a plan and run a guided session with live set tracking.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {WORKOUT_PLANS.map((plan) => (
          <GlassCard key={plan.id} hover className="flex flex-col gap-3">
            <div className={clsx('h-1.5 w-16 rounded-full bg-gradient-to-r', plan.accent)} />
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold">{plan.name}</h2>
                <p className="mt-0.5 text-sm text-slate-400">{plan.focus}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={plan.level === 'Beginner' ? 'green' : plan.level === 'Intermediate' ? 'amber' : 'rose'}>{plan.level}</Badge>
              <Badge tone="slate"><IconClock width={11} /> ~{plan.durationMin} min</Badge>
              <Badge tone="slate">{plan.equipment}</Badge>
              <Badge tone="slate">{plan.exercises.length} exercises</Badge>
            </div>
            <ul className="space-y-1 text-xs text-slate-400">
              {plan.exercises.slice(0, 3).map((e) => (
                <li key={e.id} className="flex justify-between">
                  <span>{e.name}</span>
                  <span className="text-slate-500">{e.sets} × {e.reps}</span>
                </li>
              ))}
              {plan.exercises.length > 3 && <li className="text-slate-500">+ {plan.exercises.length - 3} more…</li>}
            </ul>
            <Button glow className="mt-auto w-full" onClick={() => setActivePlan(plan)}>
              <IconPlay width={15} /> Start session
            </Button>
          </GlassCard>
        ))}
      </div>

      <div>
        <SectionTitle title="Recent sessions" />
        {recent === null ? (
          <div className="skeleton h-24" />
        ) : recent.length === 0 ? (
          <EmptyState
            icon={<IconDumbbell width={30} />}
            title="No sessions logged"
            body="Your finished workouts are saved to your private history — complete one to see it here."
          />
        ) : (
          <GlassCard>
            <ul className="divide-y divide-white/5">
              {recent.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-semibold">{s.planName}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(s.startedAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} ·{' '}
                      {formatDuration(s.durationSec)} · {s.totalSets} sets
                    </p>
                  </div>
                  <Badge tone={s.status === 'completed' ? 'green' : 'amber'}>{s.status}</Badge>
                </li>
              ))}
            </ul>
          </GlassCard>
        )}
      </div>
    </div>
  );
}

export default function WorkoutsPage() {
  return (
    <Suspense fallback={<div className="skeleton h-40" />}>
      <WorkoutsInner />
    </Suspense>
  );
}
