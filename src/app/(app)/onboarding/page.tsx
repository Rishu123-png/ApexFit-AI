'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/lib/auth/AuthProvider';
import { saveBodyMetric, savePreferences, subscribeProfile, updateProfileFields } from '@/lib/db';
import { DEFAULT_PREFERENCES, type ExperienceLevel, type FitnessGoal, type TrainingFocus, type UserProfile } from '@/lib/types';
import { BodyBaselineCheck } from '@/components/onboarding/BodyBaselineCheck';
import { Alert, Badge, Button, GlassCard } from '@/components/ui';
import { IconCamera, IconCheck, IconTarget } from '@/components/icons';
import { clsx } from '@/lib/clsx';

const GOALS: { id: FitnessGoal; label: string; detail: string }[] = [
  { id: 'general-fitness', label: 'Feel fitter', detail: 'Build a sustainable weekly rhythm.' },
  { id: 'strength', label: 'Build strength', detail: 'Progress through controlled, repeatable sessions.' },
  { id: 'fat-loss', label: 'Manage body weight', detail: 'Build training and food habits without extreme plans.' },
  { id: 'muscle-gain', label: 'Build muscle', detail: 'Prioritise resistance training and protein consistency.' },
  { id: 'mobility', label: 'Move better', detail: 'Improve mobility, control and recovery.' },
];
const FOCUS: { id: TrainingFocus; label: string }[] = [
  { id: 'full-body', label: 'Full body' }, { id: 'upper-body', label: 'Upper body' }, { id: 'lower-body', label: 'Lower body' },
  { id: 'core', label: 'Core' }, { id: 'mobility', label: 'Mobility' }, { id: 'conditioning', label: 'Conditioning' },
];

const numeric = (value: string) => Number(value.trim());

function startingCalories(weightKg: number, goal: FitnessGoal) {
  const factor = goal === 'fat-loss' ? 28 : goal === 'muscle-gain' ? 34 : goal === 'strength' ? 32 : 30;
  return Math.max(1400, Math.min(6000, Math.round((weightKg * factor) / 50) * 50));
}

function startingProtein(weightKg: number, goal: FitnessGoal) {
  return Math.max(50, Math.min(220, Math.round(weightKg * (goal === 'muscle-gain' ? 1.6 : goal === 'strength' ? 1.5 : 1.3))));
}

export default function OnboardingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [step, setStep] = useState(0);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [goal, setGoal] = useState<FitnessGoal>('general-fitness');
  const [focus, setFocus] = useState<TrainingFocus[]>(['full-body']);
  const [experience, setExperience] = useState<ExperienceLevel>('beginner');
  const [days, setDays] = useState('3');
  const [equipment, setEquipment] = useState<'none' | 'dumbbells' | 'gym'>('none');
  const [baselineChecked, setBaselineChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [profileError, setProfileError] = useState(false);
  const enteredWeight = numeric(weight);
  const suggestedCalories = Number.isFinite(enteredWeight) && enteredWeight > 0 ? startingCalories(enteredWeight, goal) : DEFAULT_PREFERENCES.calorieTarget;
  const suggestedProtein = Number.isFinite(enteredWeight) && enteredWeight > 0 ? startingProtein(enteredWeight, goal) : DEFAULT_PREFERENCES.proteinTarget;

  useEffect(() => {
    if (!user) return;
    const timeout = window.setTimeout(() => setProfileError(true), 15000);
    const unsubscribe = subscribeProfile(user.uid, (next) => {
      window.clearTimeout(timeout);
      if (next?.onboardingCompleted) {
        router.replace('/dashboard');
        return;
      }
      setProfile(next);
      if (next) {
        setHeight(next.heightCm ? String(next.heightCm) : '');
        setWeight(next.weightKg ? String(next.weightKg) : '');
        setTargetWeight(next.targetWeightKg ? String(next.targetWeightKg) : '');
        setGoal(next.goal ?? 'general-fitness');
        setFocus(next.focusAreas?.length ? next.focusAreas : ['full-body']);
        setExperience(next.experience ?? 'beginner');
        setDays(next.trainingDaysPerWeek ? String(next.trainingDaysPerWeek) : '3');
        setEquipment(next.equipmentAccess ?? 'none');
      }
    }, () => setProfileError(true));
    return () => {
      window.clearTimeout(timeout);
      unsubscribe();
    };
  }, [router, user]);

  function toggleFocus(item: TrainingFocus) {
    setFocus((current) => current.includes(item)
      ? (current.length > 1 ? current.filter((value) => value !== item) : current)
      : current.length < 3 ? [...current, item] : current);
  }

  function next() {
    setError('');
    if (step === 0) {
      const h = numeric(height);
      const w = numeric(weight);
      if (!Number.isFinite(h) || h < 100 || h > 250 || !Number.isFinite(w) || w < 25 || w > 350) {
        setError('Enter a height between 100–250 cm and a current weight between 25–350 kg.');
        return;
      }
      const target = targetWeight.trim() ? numeric(targetWeight) : undefined;
      if (target !== undefined && (!Number.isFinite(target) || target < 25 || target > 350)) {
        setError('Enter a target weight between 25–350 kg, or leave it empty.');
        return;
      }
    }
    if (step === 1 && (focus.length === 0 || numeric(days) < 1 || numeric(days) > 7)) {
      setError('Choose at least one focus area and 1–7 training days per week.');
      return;
    }
    setStep((current) => Math.min(2, current + 1));
  }

  async function finish() {
    if (!user) return;
    setSaving(true);
    setError('');
    try {
      const heightCm = numeric(height);
      const weightKg = numeric(weight);
      const target = targetWeight.trim() ? numeric(targetWeight) : undefined;
      const trainingDaysPerWeek = numeric(days);
      const proteinTarget = startingProtein(weightKg, goal);
      const calorieTarget = startingCalories(weightKg, goal);
      await Promise.all([
        updateProfileFields(user.uid, {
          heightCm, weightKg, ...(target !== undefined ? { targetWeightKg: target } : {}), goal, focusAreas: focus, experience, trainingDaysPerWeek,
          equipmentAccess: equipment, onboardingCompleted: true,
          ...(baselineChecked ? { localBodyBaselineCheckedAt: Date.now() } : {}),
        }),
        saveBodyMetric(user.uid, { heightCm, weightKg }),
        savePreferences(user.uid, { ...DEFAULT_PREFERENCES, calorieTarget, proteinTarget }),
      ]);
      router.replace('/dashboard');
    } catch {
      setError('We could not save your setup. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  if (profileError) {
    return (
      <div className="mx-auto max-w-xl">
        <Alert kind="error">Your private profile could not be loaded. Check your phone connection and Firebase access, then retry.</Alert>
        <Button variant="outline" className="mt-4 w-full" onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }
  if (!profile) return <div className="mx-auto max-w-xl"><div className="skeleton h-72" /></div>;

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-8">
      <motion.div initial={reducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-[1.8rem] border border-electric-500/25 bg-[linear-gradient(135deg,rgba(12,37,79,.95),rgba(9,13,31,.94),rgba(46,23,77,.75))] p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-60 w-60 rounded-full bg-neon/15 blur-3xl" />
        <div className="relative">
          <Badge tone="blue">Personal setup · {step + 1} of 3</Badge>
          <h1 className="mt-3 text-3xl font-black tracking-tight">Let’s build your <span className="neon-text">starting point.</span></h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">Your numbers and preferences stay in your private account. We use them to personalise suggestions, not to diagnose, classify your body, or predict how you will look.</p>
        </div>
      </motion.div>

      <div className="flex gap-1.5" aria-label={`Step ${step + 1} of 3`}>
        {[0, 1, 2].map((value) => <span key={value} className={clsx('h-1.5 flex-1 rounded-full', value <= step ? 'bg-gradient-to-r from-electric-500 to-neon' : 'bg-white/10')} />)}
      </div>

      <GlassCard>
        {step === 0 && <div className="space-y-5">
          <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-electric-300">Your baseline</p><h2 className="mt-1 text-xl font-black">Where are you starting today?</h2><p className="mt-1 text-sm text-slate-400">Use current measurements you are comfortable sharing. You can update them later from progress tracking.</p></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField label="Height" suffix="cm" value={height} setValue={setHeight} placeholder="170" />
            <NumberField label="Current weight" suffix="kg" value={weight} setValue={setWeight} placeholder="68" />
            <NumberField label="Optional target weight" suffix="kg" value={targetWeight} setValue={setTargetWeight} placeholder="62" />
          </div>
          <p className="rounded-2xl border border-white/8 bg-white/[.025] px-3.5 py-3 text-xs leading-relaxed text-slate-400">Your goal chart will compare your self-reported current and target weights over time. It is a planning view, not a prediction, body-fat estimate, or medical assessment.</p>
        </div>}

        {step === 1 && <div className="space-y-5">
          <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-electric-300">Your programme</p><h2 className="mt-1 text-xl font-black">What should your first plan prioritise?</h2></div>
          <div className="grid gap-2 sm:grid-cols-2">{GOALS.map((item) => <button key={item.id} onClick={() => setGoal(item.id)} className={clsx('rounded-2xl border p-3 text-left transition', goal === item.id ? 'border-electric-400 bg-electric-500/12 shadow-[0_0_18px_rgba(47,139,255,.12)]' : 'border-white/10 bg-white/[.025] hover:border-white/20')}><p className="text-sm font-bold">{item.label}</p><p className="mt-1 text-xs leading-relaxed text-slate-400">{item.detail}</p></button>)}</div>
          <div><p className="mb-2 text-sm font-bold">Focus areas <span className="font-normal text-slate-500">(choose up to 3)</span></p><div className="flex flex-wrap gap-2">{FOCUS.map((item) => <button key={item.id} onClick={() => toggleFocus(item.id)} className={clsx('rounded-full border px-3 py-2 text-xs font-bold transition', focus.includes(item.id) ? 'border-neon/50 bg-neon/10 text-neon' : 'border-white/10 bg-white/[.025] text-slate-400 hover:text-slate-200')}>{focus.includes(item.id) && <IconCheck width={12} className="mr-1 inline" />}{item.label}</button>)}</div></div>
          <div className="grid gap-3 sm:grid-cols-3"><SelectField label="Experience" value={experience} setValue={(value) => setExperience(value as ExperienceLevel)} options={['beginner', 'intermediate', 'advanced']} /><NumberField label="Training days" suffix="per week" value={days} setValue={setDays} placeholder="3" /><SelectField label="Equipment" value={equipment} setValue={(value) => setEquipment(value as typeof equipment)} options={['none', 'dumbbells', 'gym']} /></div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-electric-500/25 bg-electric-500/8 p-3.5"><p className="text-[10px] font-black uppercase tracking-[.15em] text-electric-300">Starting calorie target</p><p className="mt-1 text-2xl font-black text-slate-100">{suggestedCalories} <span className="text-sm font-semibold text-slate-400">kcal/day</span></p><p className="mt-1 text-xs text-slate-400">A transparent tracking estimate. You can edit it anytime.</p></div>
            <div className="rounded-2xl border border-mint/25 bg-mint/8 p-3.5"><p className="text-[10px] font-black uppercase tracking-[.15em] text-mint">Starting protein target</p><p className="mt-1 text-2xl font-black text-slate-100">{suggestedProtein} <span className="text-sm font-semibold text-slate-400">g/day</span></p><p className="mt-1 text-xs text-slate-400">A planning target, not a diagnosis or prescription.</p></div>
          </div>
        </div>}

        {step === 2 && <div className="space-y-5">
          <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-electric-300">Optional camera setup</p><h2 className="mt-1 text-xl font-black">Check your framing locally.</h2><p className="mt-1 text-sm text-slate-400">This does not scan your body, take a photo, determine body type, or upload anything. It prepares you for optional live form guidance during supported workouts.</p></div>
          <BodyBaselineCheck onCompleted={() => setBaselineChecked(true)} />
          {baselineChecked && <p className="flex items-center gap-2 rounded-2xl border border-mint/25 bg-mint/10 px-3.5 py-3 text-sm text-mint"><IconCheck width={15} /> Local camera framing check completed. No image was saved.</p>}
          <Alert kind="info">You can skip camera setup now. During a workout, you can enable local form guidance with one explicit tap for supported movements.</Alert>
        </div>}

        {error && <Alert kind="error" className="mt-5">{error}</Alert>}
        <div className="mt-6 flex justify-between gap-2"><Button variant="ghost" onClick={() => step === 0 ? router.replace('/dashboard') : setStep((current) => current - 1)}>{step === 0 ? 'Set up later' : 'Back'}</Button>{step < 2 ? <Button glow onClick={next}>Continue</Button> : <Button glow loading={saving} onClick={() => void finish()}><IconTarget width={15} /> Create my starting plan</Button>}</div>
      </GlassCard>
    </div>
  );
}

function NumberField({ label, suffix, value, setValue, placeholder }: { label: string; suffix: string; value: string; setValue: (value: string) => void; placeholder: string }) {
  return <label className="block text-xs font-semibold text-slate-300">{label}<div className="relative mt-1.5"><input className="input pr-14" inputMode="decimal" placeholder={placeholder} value={value} onChange={(event) => setValue(event.target.value)} /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-500">{suffix}</span></div></label>;
}

function SelectField({ label, value, setValue, options }: { label: string; value: string; setValue: (value: string) => void; options: string[] }) {
  return <label className="block text-xs font-semibold capitalize text-slate-300">{label}<select className="input mt-1.5 capitalize" value={value} onChange={(event) => setValue(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option.replace(/-/g, ' ')}</option>)}</select></label>;
}
