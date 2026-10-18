'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthProvider';
import {
  subscribeHydration,
  subscribeNutritionDay,
  subscribePreferences,
  subscribeRecentWorkouts,
  subscribeWeekWorkouts,
  logWater,
} from '@/lib/db';
import { dateKey, friendlyDate, last7DayLabels, formatDuration, formatTime } from '@/lib/dates';
import { DEFAULT_PREFERENCES, type NutritionEntry, type Preferences, type WorkoutSession } from '@/lib/types';
import { GlassCard, SectionTitle, Badge, Button, EmptyState, Spinner } from '@/components/ui';
import { ProgressRing, MiniBars, MacroBar } from '@/components/charts';
import { CoachPanel } from '@/components/dashboard/CoachPanel';
import { WORKOUT_PLANS } from '@/lib/data/plans';
import {
  IconPlay, IconPlus, IconDroplet, IconFlame, IconDumbbell, IconBowl, IconClock, IconSparkles, IconCamera,
} from '@/components/icons';

export default function DashboardPage() {
  const { user } = useAuth();
  const uid = user!.uid;
  const today = dateKey();

  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [meals, setMeals] = useState<NutritionEntry[] | null>(null);
  const [waterMl, setWaterMl] = useState<number | null>(null);
  const [week, setWeek] = useState<WorkoutSession[] | null>(null);
  const [recent, setRecent] = useState<WorkoutSession[] | null>(null);
  const [waterBusy, setWaterBusy] = useState(false);
  const [waterFlash, setWaterFlash] = useState('');
  const coachRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => subscribePreferences(uid, setPrefs), [uid]);
  useEffect(() => subscribeNutritionDay(uid, today, setMeals), [uid, today]);
  useEffect(() => subscribeHydration(uid, today, setWaterMl), [uid, today]);
  useEffect(() => subscribeWeekWorkouts(uid, setWeek), [uid]);
  useEffect(() => subscribeRecentWorkouts(uid, 5, setRecent), [uid]);

  const totals = useMemo(() => {
    const list = meals ?? [];
    return {
      calories: list.reduce((s, e) => s + e.calories * e.servings, 0),
      protein: list.reduce((s, e) => s + e.protein * e.servings, 0),
      carbs: list.reduce((s, e) => s + e.carbs * e.servings, 0),
      fat: list.reduce((s, e) => s + e.fat * e.servings, 0),
    };
  }, [meals]);

  const weekMinutes = useMemo(() => {
    const days = last7DayLabels();
    return days.map(({ label, key }) => ({
      label,
      value: (week ?? [])
        .filter((s) => dateKey(new Date(s.startedAt)) === key)
        .reduce((sum, s) => sum + s.durationSec, 0) / 60,
    }));
  }, [week]);

  const todaysSessions = (week ?? []).filter((s) => dateKey(new Date(s.startedAt)) === today);
  const trainedToday = todaysSessions.length > 0;
  const suggestedPlan = WORKOUT_PLANS[0];
  const firstName = (user!.displayName ?? 'Athlete').split(' ')[0];
  const loadingCore = meals === null || waterMl === null || week === null;

  async function quickWater(ml: number) {
    setWaterBusy(true);
    try {
      await logWater(uid, today, ml);
      setWaterFlash(`+${ml} ml logged`);
      setTimeout(() => setWaterFlash(''), 2200);
    } finally {
      setWaterBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Command-centre hero: emphasis is on one clear next action, not another generic dashboard header. */}
      <motion.section
        initial={reducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 25 }}
        className="relative overflow-hidden rounded-[1.8rem] border border-electric-500/20 bg-[linear-gradient(135deg,rgba(14,31,74,0.9),rgba(8,13,29,0.92)_54%,rgba(12,42,67,0.66))] p-5 shadow-[0_18px_54px_rgba(0,0,0,0.22)] sm:p-7"
      >
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-electric-500/20 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute bottom-0 right-[18%] h-40 w-40 rounded-full bg-neon/10 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-electric-300">{friendlyDate()}</p>
              <span className="h-1 w-1 rounded-full bg-neon" aria-hidden="true" />
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Daily command centre</span>
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Namaste, <span className="neon-text">{firstName}</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">
              Your training, fuel and recovery in one focused view. Build the next strong day with one deliberate action.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="blue"><IconSparkles width={12} /> System online</Badge>
            <Badge tone={trainedToday ? 'green' : 'amber'}>{trainedToday ? 'Training logged' : 'Session waiting'}</Badge>
          </div>
        </div>
      </motion.section>

      {/* High-frequency actions stay above the fold on every viewport. */}
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reducedMotion ? 0 : 0.05, type: 'spring', stiffness: 260, damping: 24 }}
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-4"
      >
        <Link href="/workouts"><Button glow className="h-full w-full"><IconPlay width={15} /> Start workout</Button></Link>
        <Link href="/nutrition?add=1"><Button variant="outline" className="h-full w-full"><IconPlus width={15} /> Add meal</Button></Link>
        <Button variant="outline" className="h-full w-full" onClick={() => quickWater(250)} loading={waterBusy}>
          <IconDroplet width={15} /> +250 ml
        </Button>
        <Button variant="outline" className="h-full w-full" onClick={() => coachRef.current?.scrollIntoView({ behavior: 'smooth' })}>
          <IconSparkles width={15} /> Ask AI
        </Button>
      </motion.div>

      {loadingCore ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-32" />)}
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <GlassCard className="flex items-center gap-3">
              <ProgressRing percent={totals.calories / prefs.calorieTarget} label={`${Math.round(totals.calories)}`} sublabel="kcal" />
              <div>
                <p className="text-sm font-bold">Energy</p>
                <p className="text-xs text-slate-400">of {prefs.calorieTarget} kcal</p>
              </div>
            </GlassCard>
            <GlassCard className="flex items-center gap-3">
              <ProgressRing percent={totals.protein / prefs.proteinTarget} label={`${Math.round(totals.protein)}g`} sublabel="protein" tone="#34d399" />
              <div>
                <p className="text-sm font-bold">Protein</p>
                <p className="text-xs text-slate-400">of {prefs.proteinTarget} g</p>
              </div>
            </GlassCard>
            <GlassCard className="flex items-center gap-3">
              <ProgressRing percent={(waterMl ?? 0) / prefs.waterTargetMl} label={`${((waterMl ?? 0) / 1000).toFixed(1)}L`} sublabel="water" tone="#38bdf8" />
              <div>
                <p className="text-sm font-bold">Hydration</p>
                <p className="text-xs text-slate-400">of {(prefs.waterTargetMl / 1000).toFixed(1)} L</p>
              </div>
            </GlassCard>
            <GlassCard className="flex items-center gap-3">
              <div className="flex h-[88px] w-[88px] items-center justify-center rounded-full border border-white/10 bg-white/5">
                <div className="text-center">
                  <p className="text-2xl font-extrabold text-neon">{week!.length}</p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">workouts</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-bold">This week</p>
                <p className="text-xs text-slate-400">last 7 days</p>
              </div>
            </GlassCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            {/* Today's workout */}
            <GlassCard className="lg:col-span-3" hover>
              <SectionTitle title="Today's training" action={<Badge tone={trainedToday ? 'green' : 'amber'}>{trainedToday ? 'Done' : 'Pending'}</Badge>} />
              {trainedToday ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-300">
                    Solid work — you completed {todaysSessions.length} session{todaysSessions.length > 1 ? 's' : ''} today.
                  </p>
                  {todaysSessions.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                      <div>
                        <p className="font-semibold">{s.planName}</p>
                        <p className="text-xs text-slate-400">
                          <IconClock width={11} className="mr-1 inline" />{formatDuration(s.durationSec)} · {s.totalSets} sets · {formatTime(s.startedAt)}
                        </p>
                      </div>
                      <Badge tone={s.status === 'completed' ? 'green' : 'amber'}>{s.status}</Badge>
                    </div>
                  ))}
                  <Link href="/workouts" className="inline-block"><Button variant="ghost">Train again</Button></Link>
                </div>
              ) : (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-lg font-bold">{suggestedPlan.name}</p>
                    <p className="mt-0.5 text-sm text-slate-400">{suggestedPlan.focus}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge tone="slate">{suggestedPlan.level}</Badge>
                      <Badge tone="slate"><IconClock width={11} /> ~{suggestedPlan.durationMin} min</Badge>
                      <Badge tone="slate">{suggestedPlan.equipment}</Badge>
                    </div>
                  </div>
                  <Link href={`/workouts?plan=${suggestedPlan.id}`}>
                    <Button glow><IconPlay width={15} /> Begin session</Button>
                  </Link>
                </div>
              )}
            </GlassCard>

            {/* Weekly activity */}
            <GlassCard className="lg:col-span-2" hover>
              <SectionTitle title="Weekly activity" action={<span className="text-xs text-slate-500">minutes / day</span>} />
              {week!.length === 0 ? (
                <EmptyState
                  icon={<IconDumbbell width={30} />}
                  title="No sessions yet"
                  body="Finish your first workout and your weekly minutes chart will light up here."
                  action={<Link href="/workouts"><Button variant="outline">Browse plans</Button></Link>}
                />
              ) : (
                <MiniBars data={weekMinutes} unit="min" />
              )}
            </GlassCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Nutrition summary */}
            <GlassCard hover>
              <SectionTitle
                title="Nutrition today"
                action={<Link href="/nutrition" className="text-xs font-semibold text-electric-300 hover:text-neon">Open tracker →</Link>}
              />
              {meals!.length === 0 ? (
                <EmptyState
                  icon={<IconBowl width={30} />}
                  title="Nothing logged yet"
                  body="Log your first meal — the Indian food database has roti, dal, dosa, chai and more."
                  action={<Link href="/nutrition?add=1"><Button variant="outline"><IconPlus width={14} /> Add meal</Button></Link>}
                />
              ) : (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-300"><IconFlame width={16} className="text-coral" /> Calories</span>
                    <span className="tabular-nums text-sm text-slate-400">{Math.round(totals.calories)} / {prefs.calorieTarget} kcal</span>
                  </div>
                  <MacroBar label="Protein" value={totals.protein} target={prefs.proteinTarget} unit="g" tone="#34d399" />
                  <MacroBar label="Carbs" value={totals.carbs} target={Math.round(prefs.calorieTarget * 0.5 / 4)} unit="g" tone="#fbbf24" />
                  <MacroBar label="Fat" value={totals.fat} target={Math.round(prefs.calorieTarget * 0.3 / 9)} unit="g" tone="#fb7185" />
                  <p className="text-[11px] text-slate-500">{meals!.length} item{meals!.length > 1 ? 's' : ''} logged · values mix verified data and labelled estimates</p>
                </div>
              )}
            </GlassCard>

            {/* Hydration */}
            <GlassCard hover>
              <SectionTitle title="Hydration" />
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <ProgressRing size={110} percent={(waterMl ?? 0) / prefs.waterTargetMl} label={`${waterMl ?? 0}`} sublabel="ml" tone="#38bdf8" />
                <div className="flex-1 space-y-2.5 text-center sm:text-left">
                  <p className="text-sm text-slate-400">
                    Target <b className="text-slate-200">{(prefs.waterTargetMl / 1000).toFixed(1)} L</b> ·{' '}
                    {(waterMl ?? 0) >= prefs.waterTargetMl ? (
                      <span className="text-mint">target reached 🎉</span>
                    ) : (
                      <span>{prefs.waterTargetMl - (waterMl ?? 0)} ml to go</span>
                    )}
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                    {[250, 500, 750].map((ml) => (
                      <Button key={ml} variant="outline" onClick={() => quickWater(ml)} loading={waterBusy} className="px-3 py-1.5 text-xs">
                        <IconDroplet width={13} /> {ml} ml
                      </Button>
                    ))}
                  </div>
                  {waterFlash && <p role="status" className="text-xs font-semibold text-mint">{waterFlash}</p>}
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Recent history */}
          <GlassCard hover>
            <SectionTitle title="Recent activity" />
            {recent!.length === 0 ? (
              <p className="text-sm text-slate-500">Your workout history will appear here after your first logged session.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {recent!.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-electric-500/10 text-electric-300"><IconDumbbell width={16} /></div>
                      <div>
                        <p className="text-sm font-semibold">{s.planName}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(s.startedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {formatDuration(s.durationSec)} · {s.totalSets} sets
                        </p>
                      </div>
                    </div>
                    <Badge tone={s.status === 'completed' ? 'green' : 'amber'}>{s.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>

          {/* AI Coach */}
          <div ref={coachRef} className="scroll-mt-20">
            <CoachPanel
              context={{
                caloriesToday: Math.round(totals.calories),
                proteinToday: Math.round(totals.protein),
                waterMlToday: waterMl ?? 0,
                workoutsThisWeek: week!.length,
                calorieTarget: prefs.calorieTarget,
                proteinTarget: prefs.proteinTarget,
              }}
            />
          </div>


          {/* Vision teaser */}
          <GlassCard hover className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet/30 bg-violet/10 text-violet"><IconCamera width={20} /></div>
              <div>
                <p className="font-bold">Camera form tracking <Badge tone="amber">Beta soon</Badge></p>
                <p className="text-sm text-slate-400">Pose-estimation session module is prepared — activate it to test your camera.</p>
              </div>
            </div>
            <Link href="/camera"><Button variant="outline">Open vision studio</Button></Link>
          </GlassCard>
        </>
      )}
    </div>
  );
}
