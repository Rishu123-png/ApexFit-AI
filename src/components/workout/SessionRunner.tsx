'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { saveWorkoutSession } from '@/lib/db';
import { claimArena } from '@/lib/arena/client';
import type { ArenaEventType } from '@/lib/arena/types';
import { formatDuration } from '@/lib/dates';
import type { WorkoutPlan } from '@/lib/types';
import { Button, GlassCard, Badge, Alert } from '@/components/ui';
import { IconPlay, IconPause, IconStop, IconCheck, IconChevronRight, IconInfo } from '@/components/icons';
import { clsx } from '@/lib/clsx';

type Phase = 'running' | 'paused' | 'finished';

export function SessionRunner({ plan, onExit }: { plan: WorkoutPlan; onExit: () => void }) {
  const { user, getIdToken } = useAuth();
  const [phase, setPhase] = useState<Phase>('running');
  const [seconds, setSeconds] = useState(0);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [completedSets, setCompletedSets] = useState<Record<string, number>>({});
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [arenaNote, setArenaNote] = useState('');
  const startedAtRef = useRef(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const current = plan.exercises[currentIdx];
  const next = plan.exercises[currentIdx + 1] ?? null;

  // Session timer
  useEffect(() => {
    if (phase === 'running') {
      intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [phase]);

  const doneSets = current ? (completedSets[current.id] ?? 0) : 0;
  const totalSets = useMemo(
    () => Object.values(completedSets).reduce((a, b) => a + b, 0),
    [completedSets],
  );

  const markSet = useCallback(() => {
    if (!current) return;
    setCompletedSets((prev) => {
      const cur = Math.min(prev[current.id] ?? 0, current.sets);
      if (cur >= current.sets) return prev;
      return { ...prev, [current.id]: cur + 1 };
    });
  }, [current]);

  const goNext = useCallback(() => {
    setCurrentIdx((i) => Math.min(i + 1, plan.exercises.length - 1));
  }, [plan.exercises.length]);

  async function finish() {
    setPhase('finished');
    const endedAt = Date.now();
    setSaveState('saving');
    try {
      const exercises = plan.exercises.map((e) => ({
        exerciseId: e.id,
        name: e.name,
        targetSets: e.sets,
        completedSets: completedSets[e.id] ?? 0,
      }));
      const fullyDone = exercises.filter((e) => e.completedSets >= e.targetSets).length;
      const status = fullyDone === exercises.length ? 'completed' : 'partial';
      const sessionId = await saveWorkoutSession(user!.uid, {
        planId: plan.id,
        planName: plan.name,
        startedAt: startedAtRef.current,
        endedAt,
        durationSec: seconds,
        totalSets,
        status,
        exercises,
      });
      setSaveState('saved');
      void claimArenaRewards(sessionId, status);
    } catch {
      setSaveState('error');
    }
  }

  /** Best-effort Arena XP claims — server validates eligibility + idempotency.
   *  Silent for non-participants and when the server isn't configured. */
  async function claimArenaRewards(sessionId: string, status: 'completed' | 'partial') {
    try {
      const token = await getIdToken();
      const claims: [ArenaEventType, string | undefined][] =
        status === 'completed'
          ? [
              [plan.id === 'core-mobility' ? 'mobility_session' : 'workout_completed', sessionId],
              ['daily_mission', undefined],
              ['weekly_milestone', undefined],
            ]
          : [['daily_mission', undefined]];
      let gained = 0;
      const leveled: number[] = [];
      for (const [type, sourceId] of claims) {
        try {
          const res = await claimArena(token, type, { sourceId });
          gained += res.xpAwarded;
          if (res.lifetime?.leveledUp) leveled.push(res.lifetime.level);
        } catch {
          /* Arena unavailable — never block a workout save */
        }
      }
      if (gained > 0) {
        setArenaNote(
          `+${gained} XP earned in Apex Arena` +
            (leveled.length > 0 ? ` — LEVEL UP! Welcome to Level ${leveled[leveled.length - 1]} 🏆` : ''),
        );
      }
    } catch {
      /* no session token path — ignore */
    }
  }

  // ── Finished summary ───────────────────────────────────────────────────────
  if (phase === 'finished') {
    return (
      <GlassCard className="rise-in">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-mint/15 text-mint"><IconCheck width={18} /></span>
          <h2 className="text-xl font-extrabold">Session complete</h2>
        </div>
        <div className="mb-5 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] py-4">
            <p className="text-2xl font-extrabold text-neon">{formatDuration(seconds)}</p>
            <p className="text-xs text-slate-400">duration</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] py-4">
            <p className="text-2xl font-extrabold text-neon">{totalSets}</p>
            <p className="text-xs text-slate-400">sets done</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] py-4">
            <p className="text-2xl font-extrabold text-neon">
              {plan.exercises.filter((e) => (completedSets[e.id] ?? 0) >= e.sets).length}/{plan.exercises.length}
            </p>
            <p className="text-xs text-slate-400">exercises</p>
          </div>
        </div>
        <ul className="mb-5 space-y-2">
          {plan.exercises.map((e) => {
            const done = completedSets[e.id] ?? 0;
            return (
              <li key={e.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-2 text-sm">
                <span>{e.name}</span>
                <Badge tone={done >= e.sets ? 'green' : done > 0 ? 'amber' : 'slate'}>{done}/{e.sets} sets</Badge>
              </li>
            );
          })}
        </ul>
        {saveState === 'saving' && <Alert kind="info">Saving session to your history…</Alert>}
        {saveState === 'saved' && <Alert kind="success">Saved to your workout history. Dashboard stats are updated.</Alert>}
        {arenaNote && (
          <Alert kind="success" className="mt-3 border-neon/40 bg-neon/10 text-cyan-100">🏆 {arenaNote}</Alert>
        )}
        {saveState === 'error' && <Alert kind="error">Couldn’t save this session. Check your connection — your rules allow writes only to your own account.</Alert>}
        <div className="mt-5 flex gap-2">
          <Button variant="ghost" onClick={onExit} className="flex-1">Back to plans</Button>
        </div>
      </GlassCard>
    );
  }

  // ── Active session ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Timer bar */}
      <GlassCard className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{plan.name}</p>
          <p className="font-mono text-3xl font-extrabold tabular-nums text-neon" aria-label="Session timer">
            {formatDuration(seconds)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {phase === 'running' ? (
            <Button variant="outline" onClick={() => setPhase('paused')}><IconPause width={15} /> Pause</Button>
          ) : (
            <Button glow onClick={() => setPhase('running')}><IconPlay width={15} /> Resume</Button>
          )}
          <Button variant="danger" onClick={finish}><IconStop width={15} /> Finish</Button>
        </div>
        {phase === 'paused' && <p role="status" className="w-full text-center text-xs font-semibold text-amber">Paused — take a breath.</p>}
      </GlassCard>

      {/* Progress dots */}
      <div className="flex gap-1.5" aria-label={`Exercise ${currentIdx + 1} of ${plan.exercises.length}`}>
        {plan.exercises.map((e, i) => (
          <div
            key={e.id}
            className={clsx(
              'h-1.5 flex-1 rounded-full transition-colors',
              i < currentIdx ? 'bg-mint' : i === currentIdx ? 'bg-electric-500 shadow-[0_0_10px_rgba(47,139,255,0.7)]' : 'bg-white/10',
            )}
          />
        ))}
      </div>

      {/* Current exercise */}
      <GlassCard>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <Badge tone="blue">Exercise {currentIdx + 1} / {plan.exercises.length}</Badge>
            <h2 className="mt-2 text-2xl font-extrabold">{current.name}</h2>
            <p className="text-sm text-slate-400">{current.sets} sets × {current.reps} · rest {current.restSec}s between sets</p>
          </div>
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-electric-500/30 bg-electric-500/10" role="img" aria-label={`${doneSets} of ${current.sets} sets complete`}>
            <div className="text-center">
              <p className="text-2xl font-extrabold text-electric-300 tabular-nums">{doneSets}</p>
              <p className="text-[10px] uppercase text-slate-500">of {current.sets}</p>
            </div>
          </div>
        </div>

        <ol className="mb-4 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-slate-300">
          {current.instructions.map((step, i) => <li key={i}>{step}</li>)}
        </ol>

        {current.substitution && (
          <p className="mb-4 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs text-slate-400">
            <IconInfo width={14} className="mt-0.5 shrink-0 text-electric-300" />
            Too hard right now? Substitute: <b className="text-slate-200">{current.substitution}</b>
          </p>
        )}

        <div className="flex gap-2">
          <Button glow onClick={markSet} disabled={doneSets >= current.sets} className="flex-1 py-3">
            <IconCheck width={15} /> Set done ({doneSets}/{current.sets})
          </Button>
          {next && (
            <Button variant="ghost" onClick={goNext} className="px-4">
              Next <IconChevronRight width={15} />
            </Button>
          )}
        </div>
      </GlassCard>

      {/* Up next */}
      {next ? (
        <GlassCard className="opacity-80">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Up next</p>
          <p className="mt-1 font-bold">{next.name} <span className="text-sm font-normal text-slate-400">— {next.sets} × {next.reps}</span></p>
        </GlassCard>
      ) : (
        <Alert kind="info">Last exercise — hit <b>Finish</b> to save your session summary.</Alert>
      )}
    </div>
  );
}
