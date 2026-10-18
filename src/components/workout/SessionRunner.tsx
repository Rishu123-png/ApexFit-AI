'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { saveWorkoutSession } from '@/lib/db';
import { claimArena, arenaFetch } from '@/lib/arena/client';
import type { ArenaEventType } from '@/lib/arena/types';
import { VoiceControl } from '@/components/voice/VoiceControl';
import { formatDuration } from '@/lib/dates';
import type { WorkoutPlan } from '@/lib/types';
import { Button, GlassCard, Badge, Alert } from '@/components/ui';
import { IconPlay, IconPause, IconStop, IconCheck, IconChevronRight, IconInfo } from '@/components/icons';
import { clsx } from '@/lib/clsx';

type Phase = 'running' | 'paused' | 'finished';

// ── Recoverable in-progress session (localStorage, per user+plan, 12h window) ─
const SESSION_STORE_VER = 3;
interface StoredRun {
  v: number;
  /** Server-issued ID when this run is eligible for an Arena verification. */
  verificationSessionId?: string;
  /** Original start time; server time is used whenever an Arena start exists. */
  startedAt: number;
  seconds: number;
  currentIdx: number;
  completedSets: Record<string, number>;
  restLeftSec: number | null;
  paused: boolean;
  savedAt: number;
}
const runKey = (uid: string, planId: string) => `apexfit:run:v${SESSION_STORE_VER}:${uid}:${planId}`;
function loadStoredRun(uid: string, planId: string): StoredRun | null {
  try {
    const raw = localStorage.getItem(runKey(uid, planId));
    if (!raw) return null;
    const s = JSON.parse(raw) as StoredRun;
    if (s.v !== SESSION_STORE_VER || typeof s.completedSets !== 'object' || s.completedSets === null) return null;
    if (!Number.isFinite(s.startedAt) || s.startedAt > Date.now() + 60_000) return null;
    if (Date.now() - s.savedAt > 12 * 60 * 60 * 1000) return null;
    return s;
  } catch {
    return null;
  }
}

export function SessionRunner({ plan, onExit }: { plan: WorkoutPlan; onExit: () => void }) {
  const { user, getIdToken } = useAuth();
  const [phase, setPhase] = useState<Phase>('running');
  const [seconds, setSeconds] = useState(0);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [completedSets, setCompletedSets] = useState<Record<string, number>>({});
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [arenaNote, setArenaNote] = useState('');
  const [restLeftSec, setRestLeftSec] = useState<number | null>(null);
  const [restoredAgoMin, setRestoredAgoMin] = useState<number | null>(null);
  const startedAtRef = useRef(Date.now());
  const restoredRef = useRef(false);
  const finishingRef = useRef(false);
  const verificationSessionRef = useRef<{ id: string; startedAt: number } | null>(null);
  const verificationAttemptRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const beginArenaVerification = useCallback(async () => {
    const attempt = ++verificationAttemptRef.current;
    verificationSessionRef.current = null;
    if (!user?.uid) return;
    try {
      const token = await getIdToken();
      const start = await arenaFetch<{ sessionId: string; startedAt: number }>(token, '/api/workouts/start', {
        method: 'POST',
        body: { planId: plan.id },
      });
      if (
        verificationAttemptRef.current === attempt &&
        typeof start.sessionId === 'string' &&
        Number.isFinite(start.startedAt)
      ) {
        verificationSessionRef.current = { id: start.sessionId, startedAt: start.startedAt };
        startedAtRef.current = start.startedAt;
      }
    } catch {
      // Saving remains available offline or without Admin credentials. Such a
      // session is deliberately private/self-reported and cannot earn XP.
    }
  }, [getIdToken, plan.id, user?.uid]);

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

  // ── Rest timer ──
  useEffect(() => {
    if (restLeftSec === null || phase !== 'running') return;
    if (restLeftSec <= 0) {
      setRestLeftSec(null);
      try { navigator.vibrate?.(150); } catch { /* unsupported */ }
      return;
    }
    const t = setTimeout(() => setRestLeftSec((s) => (s === null ? null : Math.max(0, s - 1))), 1000);
    return () => clearTimeout(t);
  }, [restLeftSec, phase]);

  // ── Recover interrupted session ──
  useEffect(() => {
    if (!user?.uid || restoredRef.current) return;
    restoredRef.current = true;
    const s = loadStoredRun(user.uid, plan.id);
    if (s && Object.values(s.completedSets).some((n) => n > 0)) {
      startedAtRef.current = s.startedAt;
      if (typeof s.verificationSessionId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(s.verificationSessionId)) {
        verificationSessionRef.current = { id: s.verificationSessionId, startedAt: s.startedAt };
      } else {
        void beginArenaVerification();
      }
      setSeconds(s.seconds);
      setCurrentIdx(Math.min(s.currentIdx, plan.exercises.length - 1));
      setCompletedSets(s.completedSets);
      setRestLeftSec(s.restLeftSec ?? null);
      if (s.paused) setPhase('paused');
      setRestoredAgoMin(Math.max(1, Math.round((Date.now() - s.savedAt) / 60000)));
    } else {
      void beginArenaVerification();
    }
  }, [beginArenaVerification, user?.uid, plan.id, plan.exercises.length]);

  // ── Autosave progress (crash/close-safe) ──
  useEffect(() => {
    if (!user?.uid || phase === 'finished') return;
    try {
      localStorage.setItem(
        runKey(user.uid, plan.id),
        JSON.stringify({
          v: SESSION_STORE_VER,
          verificationSessionId: verificationSessionRef.current?.id,
          startedAt: startedAtRef.current,
          seconds,
          currentIdx,
          completedSets,
          restLeftSec,
          paused: phase === 'paused',
          savedAt: Date.now(),
        } satisfies StoredRun),
      );
    } catch { /* storage blocked/full — session continues in memory */ }
  }, [user?.uid, plan.id, seconds, currentIdx, completedSets, restLeftSec, phase]);

  const clearStoredRun = useCallback(() => {
    try {
      if (user?.uid) localStorage.removeItem(runKey(user.uid, plan.id));
    } catch { /* ignore */ }
  }, [user?.uid, plan.id]);

  function discardRecovery() {
    clearStoredRun();
    setSeconds(0);
    setCurrentIdx(0);
    setCompletedSets({});
    setRestLeftSec(null);
    setPhase('running');
    setRestoredAgoMin(null);
    startedAtRef.current = Date.now();
    void beginArenaVerification();
  }

  const doneSets = current ? (completedSets[current.id] ?? 0) : 0;
  const totalSets = useMemo(
    () => Object.values(completedSets).reduce((a, b) => a + b, 0),
    [completedSets],
  );

  const markSet = useCallback(() => {
    if (!current || phase !== 'running') return;
    const cur = completedSets[current.id] ?? 0;
    if (cur >= current.sets) return;
    setCompletedSets((prev) => ({ ...prev, [current.id]: (prev[current.id] ?? 0) + 1 }));
    setRestLeftSec(current.restSec > 0 ? current.restSec : 45);
    try { navigator.vibrate?.(60); } catch { /* unsupported */ }
  }, [current, completedSets, phase]);

  const goNext = useCallback(() => {
    setRestLeftSec(null);
    setCurrentIdx((i) => Math.min(i + 1, plan.exercises.length - 1));
  }, [plan.exercises.length]);

  const pauseSession = useCallback(() => setPhase('paused'), []);
  const resumeSession = useCallback(() => setPhase('running'), []);

  async function finish() {
    // React state updates are asynchronous; this synchronous guard prevents
    // double-taps or a voice confirmation from creating duplicate sessions.
    if (finishingRef.current || phase === 'finished' || !user) return;
    finishingRef.current = true;
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
      }, verificationSessionRef.current?.id);
      setSaveState('saved');
      clearStoredRun();
      void claimArenaRewards(sessionId, status);
    } catch {
      setSaveState('error');
    }
  }

  /** Best-effort Arena XP claims. First ask the server to SEAL the session
   *  (plausibility check against the server clock) — unsealed/self-reported
   *  sessions stay in private history but earn no XP. Server re-validates
   *  eligibility, ownership, caps and idempotency for every claim. */
  async function claimArenaRewards(sessionId: string, status: 'completed' | 'partial') {
    try {
      const token = await getIdToken();
      let sealed = false;
      try {
        const sealRes = await arenaFetch<{ sealed: boolean }>(token, '/api/workouts/seal', {
          method: 'POST',
          body: { sessionId },
        });
        sealed = sealRes.sealed;
      } catch {
        sealed = false; // offline / admin not configured — no rewards, history intact
      }
      const claims: [ArenaEventType, string | undefined][] = [
        ...(status === 'completed' && sealed
          ? [[plan.id === 'core-mobility' ? 'mobility_session' : 'workout_completed', sessionId] as [ArenaEventType, string]]
          : []),
        ['daily_mission', undefined],
        ['weekly_milestone', undefined],
      ];
      if (!sealed) {
        setArenaNote('Session saved as self-reported (no server plausibility check) — records stay private; no XP was awarded.');
        return;
      }
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
            <Button variant="outline" onClick={pauseSession}><IconPause width={15} /> Pause</Button>
          ) : (
            <Button glow onClick={resumeSession}><IconPlay width={15} /> Resume</Button>
          )}
          <Button variant="danger" onClick={finish}><IconStop width={15} /> Finish</Button>
        </div>
        {phase === 'paused' && <p role="status" className="w-full text-center text-xs font-semibold text-amber">Paused — take a breath.</p>}

        {/* Rest timer */}
        {restLeftSec !== null && (
          <div className="flex w-full items-center gap-3 rounded-xl border border-electric-500/30 bg-electric-500/10 px-3.5 py-2" role="timer" aria-label={`Rest ${restLeftSec} seconds left`}>
            <span className="font-mono text-lg font-extrabold tabular-nums text-electric-200">{restLeftSec}s</span>
            <span className="text-xs text-slate-400">rest between sets</span>
            <div className="ml-auto flex gap-1.5">
              <button className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-slate-300 transition hover:bg-white/5" onClick={() => setRestLeftSec((s) => (s ?? 0) + 15)}>+15s</button>
              <button className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-slate-300 transition hover:bg-white/5" onClick={() => setRestLeftSec(null)}>Skip</button>
            </div>
          </div>
        )}

        {/* Voice command centre — typed controls above always work */}
        <VoiceControl
          canLogSet={phase === 'running' && !!current && (completedSets[current.id] ?? 0) < current.sets}
          paused={phase === 'paused'}
          onPause={pauseSession}
          onResume={resumeSession}
          onNextExercise={goNext}
          onSetDone={markSet}
          onFinishConfirmed={finish}
        />
      </GlassCard>

      {/* Recovery notice */}
      {restoredAgoMin !== null && (
        <div className="flex items-center gap-2 rounded-xl border border-electric-500/30 bg-electric-500/10 px-3 py-2 text-xs text-electric-200" role="status">
          <IconInfo width={13} /> Recovered your unfinished session from ~{restoredAgoMin} min ago.
          <button className="ml-auto font-semibold underline underline-offset-2 hover:text-white" onClick={discardRecovery}>Discard &amp; restart</button>
          <button aria-label="Dismiss recovery notice" onClick={() => setRestoredAgoMin(null)}>✕</button>
        </div>
      )}

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
