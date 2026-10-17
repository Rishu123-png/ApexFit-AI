
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthProvider';
import { subscribeRecentWorkouts, subscribeWeekWorkouts, subscribeCheckins, saveCheckin, type RecoveryCheckinRecord } from '@/lib/db';
import { recommendToday } from '@/lib/core/adaptive';
import { computeReadiness } from '@/lib/core/readiness';
import { suggestNextForExercise, buildExerciseTrends } from '@/lib/core/progression';
import { dateKey, last7DayLabels, daysAgoTs, formatDuration } from '@/lib/dates';
import { MiniBars } from '@/components/charts';
import { GlassCard, Badge, Button, Alert } from '@/components/ui';
import { IconTrendingUp, IconCopy, IconCheck, IconInfo, IconBolt, IconFlame } from '@/components/icons';
import type { WorkoutSession } from '@/lib/types';

function minutesByDay(sessions: WorkoutSession[]): { label: string; value: number }[] {
  const days = last7DayLabels();
  const mins = new Map<string, number>(days.map((d) => [d.key, 0]));
  for (const s of sessions) {
    const k = dateKey(new Date(s.startedAt));
    mins.set(k, (mins.get(k) ?? 0) + (s.durationSec ?? 0) / 60);
  }
  return days.map((d) => ({ label: d.label, value: Math.round(mins.get(d.key) ?? 0) }));
}

function currentStreak(sessions: WorkoutSession[]): number {
  const days = new Set(sessions.map((s) => dateKey(new Date(s.startedAt))));
  let streak = 0;
  const today = dateKey();
  if (days.has(today)) streak++;
  else {
    // streak may still be alive from yesterday
    const y = dateKey(new Date(Date.now() - 86_400_000));
    if (!days.has(y)) return 0;
  }
  for (let back = days.has(today) ? 1 : 1; ; back++) {
    const k = dateKey(new Date(Date.now() - back * 86_400_000));
    if (days.has(k)) streak++;
    else break;
  }
  return streak;
}

export default function InsightsPage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const [week, setWeek] = useState<WorkoutSession[]>([]);
  const [recent, setRecent] = useState<WorkoutSession[]>([]);
  const [checkins, setCheckins] = useState<Record<string, RecoveryCheckinRecord>>({});
  const [checkinDraft, setCheckinDraft] = useState<{ sleep: string; energy: string; soreness: string }>({ sleep: '', energy: '', soreness: '' });
  const [checkinState, setCheckinState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [copied, setCopied] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!uid) return;
    const u1 = subscribeWeekWorkouts(uid, setWeek);
    const u2 = subscribeRecentWorkouts(uid, 100, (s) => {
      setRecent(s);
      setLoaded(true);
    });
    const u3 = subscribeCheckins(uid, 14, setCheckins);
    return () => {
      u1();
      u2();
      u3();
    };
  }, [uid]);

  const month = useMemo(
    () => recent.filter((s) => s.startedAt >= daysAgoTs(29)),
    [recent],
  );

  const stats = useMemo(() => {
    const all = recent;
    const totalSessions = all.length;
    const totalMinutes = Math.round(all.reduce((a, s) => a + (s.durationSec ?? 0), 0) / 60);
    const longest = all.reduce((m, s) => Math.max(m, s.durationSec ?? 0), 0);
    const verified = all.filter((s) => s.verified === true).length;
    const favPlan = (() => {
      const counts = new Map<string, number>();
      all.forEach((s) => counts.set(s.planName, (counts.get(s.planName) ?? 0) + 1));
      return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
    })();
    return { totalSessions, totalMinutes, longest, verified, favPlan, streak: currentStreak(all) };
  }, [recent]);

  const weekMinutes = useMemo(() => minutesByDay(week), [week]);
  const weekCount = week.length;
  const monthCount = month.length;

  const rec = useMemo(() => {
    const todayK = dateKey();
    return recommendToday({
      experience: 'beginner',
      todayKey: todayK,
      recent: recent
        .filter((s) => s.verified === true)
        .filter((s) => s.startedAt >= daysAgoTs(6))
        .map((s) => ({
          dayKey: dateKey(new Date(s.startedAt)),
          durationSec: s.serverDurationSec ?? s.durationSec,
          planId: s.planId,
        })),
    });
  }, [recent]);

  const planSpread = useMemo(() => {
    const counts = new Map<string, number>();
    month.forEach((s) => counts.set(s.planName, (counts.get(s.planName) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [month]);

  // ── Readiness (§19): training load + streak + today's optional check-in ──
  const readiness = useMemo(() => {
    const days = last7DayLabels();
    const mins = new Map<string, number>(days.map((d) => [d.key, 0]));
    for (const s of week) {
      const k = dateKey(new Date(s.startedAt));
      mins.set(k, (mins.get(k) ?? 0) + (s.durationSec ?? 0) / 60);
    }
    const todayC = checkins[dateKey()];
    return computeReadiness({
      minutes7d: days.map((d) => mins.get(d.key) ?? 0),
      streakDays: stats.streak,
      checkin: todayC
        ? { sleepHrs: todayC.sleepHrs, energy: todayC.energy, soreness: todayC.soreness }
        : null,
    });
  }, [week, checkins, stats.streak]);

  // ── Progression (§20): exercise-level trends, only with enough history ──
  const progression = useMemo(() => {
    const points = buildExerciseTrends(
      recent.slice(0, 40).map((s) => ({
        dayKey: dateKey(new Date(s.startedAt)),
        exercises: s.exercises ?? [],
      })),
    );
    const out: { name: string; suggestion: NonNullable<ReturnType<typeof suggestNextForExercise>> }[] = [];
    for (const [exerciseId, pts] of points) {
      const suggestion = suggestNextForExercise(exerciseId, pts);
      if (suggestion) out.push({ name: exerciseId, suggestion });
    }
    return out
      .sort((a, b) => Math.abs(b.suggestion.deltaSets) - Math.abs(a.suggestion.deltaSets))
      .slice(0, 4);
  }, [recent]);

  async function submitCheckin() {
    if (!uid) return;
    const payload: { sleepHrs?: number; energy?: number; soreness?: number } = {};
    const sleep = Number(checkinDraft.sleep);
    const energy = Number(checkinDraft.energy);
    const soreness = Number(checkinDraft.soreness);
    if (checkinDraft.sleep !== '' && Number.isFinite(sleep) && sleep >= 0 && sleep <= 24) payload.sleepHrs = Math.min(24, Math.max(0, sleep));
    if (checkinDraft.energy !== '' && energy >= 1 && energy <= 5) payload.energy = energy;
    if (checkinDraft.soreness !== '' && soreness >= 1 && soreness <= 5) payload.soreness = soreness;
    if (Object.keys(payload).length === 0) {
      setCheckinState('error');
      return;
    }
    setCheckinState('saving');
    try {
      await saveCheckin(uid, dateKey(), payload);
      setCheckinState('saved');
      setTimeout(() => setCheckinState('idle'), 2500);
    } catch {
      setCheckinState('error');
    }
  }

  const shareText = useMemo(() => {
    const w = formatDuration(week.reduce((a, s) => a + (s.durationSec ?? 0), 0));
    return [
      '⚡ ApexFit weekly report',
      `Sessions: ${weekCount} · Time: ${w} · Streak: ${stats.streak} day${stats.streak === 1 ? '' : 's'}`,
      stats.verified > 0 ? `Server-checked sessions: ${stats.verified}/${stats.totalSessions} (plausibility only, not proof)` : '',
      'Track with ApexFit AI 🏆',
    ]
      .filter(Boolean)
      .join('\n');
  }, [week, weekCount, stats]);

  async function copyShare() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            <IconTrendingUp className="text-neon" width={26} /> Apex <span className="neon-text">Insights</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Summaries, personal records and trends — computed on-device from your real history — server-checked sessions are plausibility-screened, not fraud-proof.
          </p>
        </div>
        <Button variant="outline" className="px-3 py-1.5 text-xs" onClick={copyShare} disabled={weekCount === 0}>
          {copied ? <IconCheck width={14} className="text-mint" /> : <IconCopy width={14} />}
          {copied ? 'Copied!' : 'Copy weekly card'}
        </Button>
      </div>

      {/* Today's deterministic guidance */}
      <GlassCard className="flex flex-wrap items-center gap-3 border border-electric-500/20 bg-electric-500/[0.04]">
        <IconBolt className="text-electric-300" width={20} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-electric-400">Today’s engine recommendation</p>
          <p className="text-sm text-slate-200">{rec.summary}</p>
          {rec.planId && (
            <p className="mt-0.5 text-xs text-slate-400">
              Suggested: <Link className="font-semibold text-electric-300 underline" href="/workouts">{rec.planId.replace(/-/g, ' ')}</Link>
              {' '}· effort {(rec.intensity * 100).toFixed(0)}%{rec.suggestedDurationMin > 0 ? ` · ~${rec.suggestedDurationMin} min` : ''}
            </p>
          )}
        </div>
      </GlassCard>

      {/* Apex Readiness — estimate §19 */}
      <GlassCard>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full border-2 border-electric-500/50 bg-electric-500/10" role="img" aria-label={`Readiness ${readiness.score} out of 100 (${readiness.band})`}>
            <span className="text-2xl font-extrabold tabular-nums text-neon">{readiness.score}</span>
            <span className="text-[9px] uppercase tracking-widest text-slate-400">readiness</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={readiness.band === 'high' ? 'green' : readiness.band === 'moderate' ? 'blue' : 'amber'}>
                {readiness.band} readiness
              </Badge>
              <Badge tone="slate">{readiness.recommendation === 'rest' ? 'rest today' : readiness.recommendation === 'light' ? 'go light' : 'normal session ok'}</Badge>
              <span className="text-[11px] text-slate-500">estimate, not a measurement</span>
            </div>
            <p className="mt-1.5 text-sm text-slate-300">{readiness.summary}</p>
            <ul className="mt-2 grid gap-1 text-xs text-slate-400 sm:grid-cols-2">
              {readiness.factors.map((f) => (
                <li key={f.key} className="flex gap-1.5">
                  <span className={f.present ? 'text-mint' : 'text-slate-600'} aria-hidden="true">●</span>
                  <span>
                    <b className="text-slate-300">{f.label}:</b> {f.detail}
                    {!f.present && ' (missing)'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Optional daily check-in feeds the missing factors */}
        {readiness.missingSubjectiveInputs > 0 && (
          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <p className="mb-2 text-xs font-semibold text-slate-300">30-second check-in (private, optional):</p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-slate-400">
                Sleep (h)
                <input className="input ml-1.5 w-16 py-1 text-xs" inputMode="decimal" placeholder="7.5" value={checkinDraft.sleep} onChange={(e) => setCheckinDraft((d) => ({ ...d, sleep: e.target.value }))} />
              </label>
              <label className="text-xs text-slate-400">
                Energy (1–5)
                <input className="input ml-1.5 w-14 py-1 text-xs" inputMode="numeric" placeholder="4" value={checkinDraft.energy} onChange={(e) => setCheckinDraft((d) => ({ ...d, energy: e.target.value }))} />
              </label>
              <label className="text-xs text-slate-400">
                Soreness (1–5)
                <input className="input ml-1.5 w-14 py-1 text-xs" inputMode="numeric" placeholder="2" value={checkinDraft.soreness} onChange={(e) => setCheckinDraft((d) => ({ ...d, soreness: e.target.value }))} />
              </label>
              <Button className="px-3 py-1.5 text-xs" onClick={submitCheckin} loading={checkinState === 'saving'}>
                {checkinState === 'saved' ? 'Saved ✓' : 'Save check-in'}
              </Button>
              {checkinState === 'error' && <span className="text-xs text-coral">Check values (0–24 h; 1–5 scale).</span>}
            </div>
          </div>
        )}
      </GlassCard>

      {/* Progression (§20) */}
      {progression.length > 0 && (
        <GlassCard>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-slate-400">Next-session suggestions</h2>
            <Badge tone="slate">derived from history</Badge>
          </div>
          <ul className="space-y-2">
            {progression.map(({ name, suggestion }) => (
              <li key={name} className="flex flex-wrap items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-2.5 text-sm">
                <span className="min-w-0 flex-1 truncate font-semibold capitalize">{name.replace(/-/g, ' ')}</span>
                <Badge tone={suggestion.deltaSets > 0 ? 'green' : suggestion.deltaSets < 0 ? 'amber' : 'slate'}>
                  {suggestion.deltaSets > 0 ? `+1 set` : suggestion.deltaSets < 0 ? `−1 set (easier)` : 'hold'}
                </Badge>
                <span className="w-full text-xs text-slate-400">
                  {suggestion.nextTargetSets} sets next · {suggestion.rationale}
                </span>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      {!loaded ? (
        <GlassCard><p className="py-8 text-center text-sm text-slate-400">Loading your training history…</p></GlassCard>
      ) : stats.totalSessions === 0 ? (
        <GlassCard>
          <div className="py-8 text-center">
            <p className="text-lg font-bold">No sessions yet</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-400">
              Your insights appear after your first recorded workout. Verified sessions power XP; every session
              builds trends here.
            </p>
            <Link href="/workouts"><Button glow className="mt-4">Start a workout</Button></Link>
          </div>
        </GlassCard>
      ) : (
        <>
          {/* Headline stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: '7-day sessions', value: String(weekCount) },
              { label: '30-day sessions', value: String(monthCount) },
              { label: 'Total minutes', value: String(stats.totalMinutes) },
              { label: 'Current streak', value: `${stats.streak}d`, flame: true },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-center">
                <p className="flex items-center justify-center gap-1 text-2xl font-extrabold text-neon">
                  {s.flame && stats.streak >= 2 && <IconFlame width={18} className="text-amber" />}
                  {s.value}
                </p>
                <p className="mt-0.5 text-[11px] uppercase tracking-wider text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Weekly minutes */}
          <GlassCard>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-slate-400">This week — active minutes</h2>
              <Badge tone="blue">last 7 days</Badge>
            </div>
            <MiniBars data={weekMinutes} unit="min" />
          </GlassCard>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Records */}
            <GlassCard>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.15em] text-slate-400">Personal records</h2>
              <ul className="space-y-2.5 text-sm">
                <li className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-2.5">
                  <span className="text-slate-300">Longest session</span>
                  <span className="font-extrabold text-neon">{formatDuration(stats.longest)}</span>
                </li>
                <li className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-2.5">
                  <span className="text-slate-300">Favourite plan</span>
                  <span className="max-w-[55%] truncate text-right font-semibold">{stats.favPlan}</span>
                </li>
                <li className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-2.5">
                  <span className="text-slate-300">Server-checked sessions</span>
                  <Badge tone={stats.verified === stats.totalSessions ? 'green' : 'amber'}>
                    {stats.verified}/{stats.totalSessions}
                  </Badge>
                </li>
              </ul>
              <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500">
                <IconInfo width={13} className="mt-0.5 shrink-0" />
                Server-checked sessions pass a plausibility screen (not proof of exercise) and are the only ones that earn XP.
              </p>
            </GlassCard>

            {/* Plan distribution (30d) */}
            <GlassCard>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.15em] text-slate-400">Training mix — 30 days</h2>
              {planSpread.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">No sessions in the last 30 days.</p>
              ) : (
                <ul className="space-y-2.5">
                  {planSpread.map(([name, count]) => {
                    const pct = Math.round((count / monthCount) * 100);
                    return (
                      <li key={name}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="max-w-[70%] truncate text-slate-300">{name}</span>
                          <span className="text-slate-500">{count}× · {pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/5">
                          <div className="h-full rounded-full bg-gradient-to-r from-electric-600 to-neon" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </GlassCard>
          </div>

           {/* Weekly share card */}
          <GlassCard className="border border-neon/20 bg-gradient-to-br from-electric-600/10 to-neon/5">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-[0.15em] text-electric-300">Weekly card</h2>
            <pre className="whitespace-pre-wrap font-sans text-sm text-slate-200">{shareText}</pre>
            <div className="mt-3 flex gap-2">
              <Button className="px-3 py-1.5 text-xs" onClick={copyShare}>{copied ? <IconCheck width={14} className="text-mint" /> : <IconCopy width={14} />} {copied ? 'Copied' : 'Copy text'}</Button>
              <p className="self-center text-xs text-slate-500">Share anywhere — no account data leaves your device.</p>
            </div>
          </GlassCard>

          {stats.verified < stats.totalSessions && (
            <Alert kind="info">
              Some sessions are self-reported (no server plausibility check) — they remain in your private history and trends,
              but only verified sessions count towards Arena XP and missions.
            </Alert>
          )}
        </>
      )}
    </div>
  );
}
