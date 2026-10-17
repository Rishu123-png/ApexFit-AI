'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { GlassCard, Badge, Button, Alert } from '@/components/ui';
import { IconCheck, IconCrown, IconInfo } from '@/components/icons';
import { clsx } from '@/lib/clsx';

interface Tier {
  id: string;
  name: string;
  monthly: number;
  yearly: number;
  blurb: string;
  highlight?: boolean;
  features: { text: string; included: boolean; tag?: 'live' | 'soon' }[];
  cta: string;
}

const TIERS: Tier[] = [
  {
    id: 'free',
    name: 'Free',
    monthly: 0,
    yearly: 0,
    blurb: 'Everything you need to start training and tracking.',
    features: [
      { text: 'Standard workout plans with session tracking', included: true, tag: 'live' },
      { text: 'Nutrition logging + Indian food database', included: true, tag: 'live' },
      { text: 'Hydration tracking', included: true, tag: 'live' },
      { text: 'Progress dashboard & history', included: true, tag: 'live' },
      { text: 'AI coach (limited usage)', included: true, tag: 'live' },
      { text: 'Camera rep counting', included: false },
      { text: 'Voice commands', included: false },
      { text: 'Food photo analysis', included: false },
    ],
    cta: 'Current plan',
  },
  {
    id: 'ai-fitness',
    name: 'AI Fitness',
    monthly: 149,
    yearly: 999,
    blurb: 'Camera-powered training with real-time form tracking.',
    features: [
      { text: 'Everything in Free', included: true },
      { text: 'Camera-based exercise tracking & rep counting', included: true, tag: 'soon' },
      { text: 'Form feedback from on-device pose estimation', included: true, tag: 'soon' },
      { text: 'Priority AI coach usage', included: true },
      { text: 'Food photo analysis', included: false },
      { text: 'Voice commands', included: false },
    ],
    cta: 'Coming soon',
  },
  {
    id: 'ai-fitness-nutrition',
    name: 'AI Fitness & Nutrition',
    monthly: 299,
    yearly: 1999,
    blurb: 'The full system — training, camera coaching and nutrition AI.',
    highlight: true,
    features: [
      { text: 'Everything in AI Fitness', included: true },
      { text: 'Food photo analysis with portion estimates', included: true, tag: 'soon' },
      { text: 'Voice commands during workouts', included: true, tag: 'soon' },
      { text: 'AI meal suggestions tuned to Indian dietary preferences', included: true, tag: 'soon' },
      { text: 'Unlimited AI coach', included: true },
      { text: 'Early access to new AI features', included: true, tag: 'soon' },
    ],
    cta: 'Coming soon',
  },
];

export default function PlansPage() {
  useAuth(); // available gate — page works under (app) AuthGate
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Badge tone="violet"><IconCrown width={12} /> Membership</Badge>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-4xl">
          Choose your <span className="neon-text">power level</span>
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-400">
          Pricing hypotheses under validation — not yet charged. Paid features unlock only after a
          real payment provider and server-verified entitlements ship.
        </p>
      </div>

      <Alert kind="info" className="mx-auto flex max-w-2xl items-start gap-2">
        <IconInfo width={16} className="mt-0.5 shrink-0" />
        <span>
          <b>Prices are provisional</b> until market validation is complete, and{' '}
          <b>payments are not enabled</b> in this build. Nothing here charges you, and premium
          features are never granted by frontend state alone.
        </span>
      </Alert>

      {/* Billing cycle toggle */}
      <div className="flex justify-center">
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-white/5 p-1" role="tablist" aria-label="Billing cycle">
          {(['monthly', 'yearly'] as const).map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={cycle === c}
              onClick={() => setCycle(c)}
              className={clsx(
                'rounded-xl px-5 py-2 text-sm font-semibold capitalize transition',
                cycle === c ? 'bg-gradient-to-r from-electric-600 to-electric-500 text-white shadow-[0_0_18px_rgba(47,139,255,0.4)]' : 'text-slate-400 hover:text-slate-200',
              )}
            >
              {c}
              {c === 'yearly' && <span className="ml-1.5 text-[10px] text-neon">save ~44%</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {TIERS.map((tier) => {
          const price = cycle === 'monthly' ? tier.monthly : tier.yearly;
          return (
            <GlassCard
              key={tier.id}
              hover
              className={clsx('relative flex flex-col gap-4', tier.highlight && 'border-electric-400/50 shadow-[0_0_45px_rgba(47,139,255,0.18)]')}
            >
              {tier.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-electric-600 to-neon px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-ink">
                  Most complete
                </span>
              )}
              <div>
                <h2 className="text-lg font-bold">{tier.name}</h2>
                <p className="mt-1 text-sm text-slate-400">{tier.blurb}</p>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-extrabold tracking-tight">
                  ₹{price.toLocaleString('en-IN')}
                </span>
                <span className="text-sm text-slate-500">/{cycle === 'monthly' ? 'month' : 'year'}</span>
              </div>
              <ul className="space-y-2 text-sm">
                {tier.features.map((f) => (
                  <li key={f.text} className={clsx('flex items-start gap-2', f.included ? 'text-slate-200' : 'text-slate-500 line-through decoration-slate-600')}>
                    <IconCheck width={15} className={clsx('mt-0.5 shrink-0', f.included ? 'text-mint' : 'text-slate-600')} />
                    <span className="flex-1">{f.text}</span>
                    {f.tag === 'soon' && <Badge tone="amber">soon</Badge>}
                  </li>
                ))}
              </ul>
              {tier.id === 'free' ? (
                <Button variant="ghost" className="mt-auto w-full" disabled>{tier.cta}</Button>
              ) : (
                <Button variant={tier.highlight ? 'primary' : 'outline'} glow={tier.highlight} className="mt-auto w-full" disabled title="Payments not enabled yet">
                  {tier.cta}
                </Button>
              )}
            </GlassCard>
          );
        })}
      </div>

      <p className="text-center text-xs text-slate-500">
        When payments launch, entitlements will be verified server-side against a real payment
        provider — a premium flag in the browser will never be sufficient.
      </p>
    </div>
  );
}
