'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { arenaFetch, ArenaApiError } from '@/lib/arena/client';
import { AVATAR_PRESETS, AVATAR_EMOJI, validateDisplayName } from '@/lib/arena/validate';
import type { ArenaProfile } from '@/lib/arena/types';
import { GlassCard, SectionTitle, Alert, Button, Field } from '@/components/ui';
import { IconCheck, IconAlert } from '@/components/icons';
import { clsx } from '@/lib/clsx';

export function ArenaSettings({
  profile,
  onUpdated,
  onWithdrawn,
}: {
  profile: ArenaProfile;
  onUpdated: (p: ArenaProfile) => void;
  onWithdrawn: () => void;
}) {
  const { getIdToken } = useAuth();
  const [name, setName] = useState(profile.displayName);
  const [avatar, setAvatar] = useState(profile.avatarId);
  const [global, setGlobal] = useState(profile.visibility.global);
  const [friends, setFriends] = useState(profile.visibility.friends);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);

  async function save() {
    setError('');
    setSaved(false);
    const nameError = validateDisplayName(name);
    if (nameError) return setError(nameError);
    setBusy(true);
    try {
      const token = await getIdToken();
      const res = await arenaFetch<{ profile: ArenaProfile }>(token, '/api/arena/settings', {
        method: 'POST',
        body: { displayName: name, avatarId: avatar, visibility: { global, friends } },
      });
      onUpdated(res.profile);
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch (err) {
      setError(err instanceof ArenaApiError ? (err.message ?? 'Save failed.') : 'Save failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    setBusy(true);
    setError('');
    try {
      const token = await getIdToken();
      await arenaFetch(token, '/api/arena/withdraw', { method: 'POST', body: {} });
      onWithdrawn();
    } catch (err) {
      setError(err instanceof ArenaApiError ? `Withdraw failed (${err.code}).` : 'Withdraw failed. Try again.');
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <GlassCard className="space-y-4">
        <SectionTitle title="Arena identity" action={saved ? <span className="text-xs font-semibold text-mint">Saved ✓</span> : undefined} />
        <Field label="Display name" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} />
        <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Avatar">
          {AVATAR_PRESETS.map((id) => (
            <button
              key={id}
              role="radio"
              aria-checked={avatar === id}
              aria-label={`Avatar ${id}`}
              onClick={() => setAvatar(id)}
              className={clsx(
                'flex h-10 items-center justify-center rounded-xl border text-lg transition',
                avatar === id ? 'border-electric-400 bg-electric-500/20' : 'border-white/10 bg-white/[0.03] hover:border-white/25',
              )}
            >
              {AVATAR_EMOJI[id]}
            </button>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="space-y-3">
        <SectionTitle title="Competition participation" />
        <p className="text-xs text-slate-500">
          Turn a board off to leave it instantly — you vanish from its public rankings. Your private
          history and lifetime XP always stay intact.
        </p>
        {([
          { label: 'Global leaderboard', desc: 'Visible to all participating athletes', value: global, set: setGlobal },
          { label: 'Friends leaderboard', desc: 'Visible only to accepted friends', value: friends, set: setFriends },
        ] as const).map((row) => (
          <label key={row.label} className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
            <span>
              <span className="block text-sm font-semibold">{row.label}</span>
              <span className="block text-xs text-slate-400">{row.desc}</span>
            </span>
            <span className="relative inline-flex">
              <input type="checkbox" checked={row.value} onChange={(e) => row.set(e.target.checked)} className="peer sr-only" />
              <span className="h-6 w-11 rounded-full bg-white/15 transition peer-checked:bg-electric-500 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
            </span>
          </label>
        ))}
        {!global && !friends && (
          <Alert kind="warning">You’re currently not on any leaderboard. Your XP keeps accruing privately; turn a board on any time to reappear.</Alert>
        )}
        {error && <Alert kind="error">{error}</Alert>}
        <Button glow onClick={save} loading={busy} className="w-full"><IconCheck width={15} /> Save changes</Button>
      </GlassCard>

      {/* Danger zone */}
      <GlassCard className="border-coral/25">
        <SectionTitle title="Leave the Arena" />
        <p className="mb-3 text-sm text-slate-400">
          Deletes your Arena profile, removes you from every public ranking and severs Arena
          friendships. <b className="text-slate-200">Kept private:</b> your workouts, nutrition,
          lifetime XP and account — rejoin anytime.
        </p>
        {!confirmWithdraw ? (
          <Button variant="danger" onClick={() => setConfirmWithdraw(true)} className="w-full">
            Withdraw from Apex Arena…
          </Button>
        ) : (
          <div className="space-y-2.5">
            <Alert kind="error" className="flex items-start gap-2">
              <IconAlert width={16} className="mt-0.5 shrink-0" />
              Confirm withdrawal — this takes effect immediately.
            </Alert>
            <div className="flex gap-2">
              <Button variant="danger" onClick={withdraw} loading={busy} className="flex-1">Yes, withdraw me</Button>
              <Button variant="ghost" onClick={() => setConfirmWithdraw(false)} className="flex-1">Cancel</Button>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
