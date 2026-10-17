'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { arenaFetch, ArenaApiError } from '@/lib/arena/client';
import { AVATAR_PRESETS, AVATAR_EMOJI, validateDisplayName } from '@/lib/arena/validate';
import type { ArenaProfile } from '@/lib/arena/types';
import { GlassCard, Alert, Badge, Button, Field } from '@/components/ui';
import { IconCheck, IconShield, IconEyeOff, IconUsers, IconTrophy } from '@/components/icons';
import { clsx } from '@/lib/clsx';

const NEVER_PUBLIC = [
  'Email address, real name, age or contact details',
  'Body measurements, weight or health information',
  'Nutrition logs, calorie numbers or meal contents',
  'Private workout history and detailed sessions',
  'AI coach conversations',
];

const VISIBLE = [
  'Your chosen Arena display name and avatar',
  'XP scores, level and rank on leaderboards you join',
  'Your Arena ID (for friends to invite you)',
];

export function ConsentScreen({ onJoined }: { onJoined: (profile: ArenaProfile) => void }) {
  const { getIdToken } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [avatarId, setAvatarId] = useState<string>(AVATAR_PRESETS[0]);
  const [global, setGlobal] = useState(true);
  const [friends, setFriends] = useState(true);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function join() {
    setError('');
    const nameError = validateDisplayName(displayName);
    if (nameError) return setError(nameError);
    if (!global && !friends) return setError('Turn on at least one leaderboard, or stay out of the Arena.');
    if (!consent) return setError('Please confirm you understand what becomes visible.');
    setBusy(true);
    try {
      const token = await getIdToken();
      const res = await arenaFetch<{ profile: ArenaProfile }>(token, '/api/arena/optin', {
        method: 'POST',
        body: {
          displayName,
          avatarId,
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
          visibility: { global, friends },
          consent: true,
        },
      });
      onJoined(res.profile);
    } catch (err) {
      setError(
        err instanceof ArenaApiError
          ? (err.message ?? `Couldn’t join (${err.code}).`)
          : 'Couldn’t join the Arena right now. Try again.',
      );
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="text-center">
        <Badge tone="violet"><IconTrophy width={12} /> Apex Arena</Badge>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
          Compete on <span className="neon-text">your terms</span>
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
          The Arena is optional. Nothing about you is public until you explicitly opt in below — and
          you can leave at any time.
        </p>
      </div>

      <GlassCard className="space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.15em] text-slate-400">
          <IconTrophy width={14} className="text-electric-300" /> What becomes visible
        </h2>
        <ul className="space-y-2 text-sm text-slate-200">
          {VISIBLE.map((t) => (
            <li key={t} className="flex gap-2.5"><IconCheck width={15} className="mt-0.5 shrink-0 text-mint" />{t}</li>
          ))}
          <li className="flex gap-2.5 text-slate-400">
            <IconUsers width={15} className="mt-0.5 shrink-0 text-electric-300" />
            Leaderboard display names and scores are visible to other participants on the boards you join.
          </li>
        </ul>
        <h2 className="flex items-center gap-2 pt-1 text-sm font-bold uppercase tracking-[0.15em] text-slate-400">
          <IconEyeOff width={14} className="text-mint" /> Never public — stays private
        </h2>
        <ul className="space-y-2 text-sm text-slate-400">
          {NEVER_PUBLIC.map((t) => (
            <li key={t} className="flex gap-2.5"><IconShield width={15} className="mt-0.5 shrink-0 text-mint" />{t}</li>
          ))}
        </ul>
      </GlassCard>

      <GlassCard className="space-y-5">
        <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-slate-400">Create your Arena identity</h2>

        <Field
          label="Arena display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g. IronPriya"
          hint="3–24 characters. Not your real name — something you’d be proud to see on a leaderboard."
          maxLength={24}
        />

        <div className="space-y-1.5">
          <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Avatar</span>
          <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Choose avatar">
            {AVATAR_PRESETS.map((id) => (
              <button
                key={id}
                role="radio"
                aria-checked={avatarId === id}
                aria-label={`Avatar ${id}`}
                onClick={() => setAvatarId(id)}
                className={clsx(
                  'flex h-11 items-center justify-center rounded-xl border text-xl transition',
                  avatarId === id
                    ? 'border-electric-400 bg-electric-500/20 shadow-[0_0_14px_rgba(47,139,255,0.4)]'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/25',
                )}
              >
                {AVATAR_EMOJI[id]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2.5">
          {([
            { key: 'global', label: 'Global leaderboard', desc: 'Compete with every participating athlete in India and beyond.', value: global, set: setGlobal },
            { key: 'friends', label: 'Friends leaderboard', desc: 'Only you and friends you explicitly accept.', value: friends, set: setFriends },
          ] as const).map((row) => (
            <label key={row.key} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 transition hover:border-white/20">
              <input
                type="checkbox"
                checked={row.value}
                onChange={(e) => row.set(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-electric-500"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-100">{row.label}</span>
                <span className="block text-xs text-slate-400">{row.desc}</span>
              </span>
            </label>
          ))}
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-electric-500/25 bg-electric-500/8 p-3.5">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-electric-500" />
          <span className="text-sm text-slate-200">
            I understand which information becomes public, and I choose to join the Arena.
          </span>
        </label>

        {error && <Alert kind="error">{error}</Alert>}
        <Button glow onClick={join} loading={busy} className="w-full py-3" disabled={!consent}>
          <IconTrophy width={16} /> Enter Apex Arena
        </Button>
        <p className="text-center text-[11px] text-slate-500">
          Leave anytime from Arena settings — your private fitness history and lifetime XP are never deleted.
        </p>
      </GlassCard>
    </div>
  );
}
