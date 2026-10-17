'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthProvider';
import { LogoWord } from '@/components/Logo';
import { Badge, Button, GlassCard } from '@/components/ui';
import { IconBolt, IconCamera, IconBowl, IconSparkles, IconDroplet, IconDumbbell, IconChevronRight } from '@/components/icons';

const FEATURES = [
  {
    icon: IconDumbbell,
    title: 'Structured training',
    body: 'Guided workout plans with sets, reps, rest and smart substitutions — and a live session mode that saves your history.',
    tag: 'Live',
  },
  {
    icon: IconBowl,
    title: 'Indian nutrition tracking',
    body: 'Log rotis, dal, dosa and more with verified reference values, clearly separated from estimates.',
    tag: 'Live',
  },
  {
    icon: IconSparkles,
    title: 'AI coach',
    body: 'A Groq-powered coach that reads your real activity and answers with India-aware fitness and nutrition guidance.',
    tag: 'Live',
  },
  {
    icon: IconCamera,
    title: 'Camera form tracking',
    body: 'Browser-based pose analysis for rep counting and form feedback. Engine integration in progress.',
    tag: 'Coming soon',
  },
  {
    icon: IconDroplet,
    title: 'Hydration & habits',
    body: 'One-tap water logging against a daily target, right on your dashboard.',
    tag: 'Live',
  },
  {
    icon: IconBolt,
    title: 'Progress intelligence',
    body: 'Weekly activity visualisations and history, all from your own records.',
    tag: 'Live',
  },
];

export default function LandingPage() {
  const { user, loading } = useAuth();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 sm:px-6">
      <header className="flex h-16 items-center justify-between">
        <LogoWord size={30} />
        <nav className="flex items-center gap-2" aria-label="Top">
          <Link href="/plans" className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white">
            Pricing
          </Link>
          {!loading && user ? (
            <Link href="/dashboard">
              <Button>Open dashboard <IconChevronRight width={14} /></Button>
            </Link>
          ) : (
            <Link href="/login">
              <Button glow>Sign in</Button>
            </Link>
          )}
        </nav>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center gap-6 py-14 text-center sm:py-24">
        <Badge tone="blue"><IconBolt width={12} /> Your AI fitness operating system</Badge>
        <h1 className="max-w-3xl text-balance text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl md:text-6xl">
          Train smarter. Eat better.<br />
          <span className="neon-text">Let AI do the math.</span>
        </h1>
        <p className="max-w-xl text-pretty text-base text-slate-400 sm:text-lg">
          ApexFit pairs structured workouts and Indian-first nutrition tracking with an AI coach
          that actually knows your week. Built mobile-first, secured with Firebase.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/login">
            <Button glow className="px-6 py-3 text-base">
              <IconBolt width={16} /> Start free
            </Button>
          </Link>
          <Link href="/plans">
            <Button variant="ghost" className="px-6 py-3 text-base">See plans — from ₹0</Button>
          </Link>
        </div>
        <p className="text-xs text-slate-500">Free forever base plan · No card required</p>
      </section>

      {/* Feature grid */}
      <section className="grid grid-cols-1 gap-4 pb-20 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body, tag }) => (
          <GlassCard key={title} hover className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-electric-500/30 bg-electric-500/10 text-electric-300">
                <Icon width={20} />
              </div>
              <Badge tone={tag === 'Live' ? 'green' : 'amber'}>{tag}</Badge>
            </div>
            <h3 className="font-bold text-slate-100">{title}</h3>
            <p className="text-sm leading-relaxed text-slate-400">{body}</p>
          </GlassCard>
        ))}
      </section>

      <footer className="border-t border-white/5 py-6 text-center text-xs text-slate-500">
        ApexFit AI — fitness guidance, not medical advice. Consult a professional for health concerns.
      </footer>
    </div>
  );
}
