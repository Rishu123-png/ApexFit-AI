'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { arenaFetch, ArenaApiError, type ArenaProfileResponse } from '@/lib/arena/client';
import { AVATAR_EMOJI, type AvatarId } from '@/lib/arena/validate';
import { levelTitle } from '@/lib/arena/levels';
import { ConsentScreen } from '@/components/arena/ConsentScreen';
import { Leaderboard } from '@/components/arena/Leaderboard';
import { FriendsManager } from '@/components/arena/FriendsManager';
import { ArenaSettings } from '@/components/arena/ArenaSettings';
import { MissionsBoard } from '@/components/arena/MissionsBoard';
import { ArenaAvatar, LevelBadge, XpBar } from '@/components/arena/LevelBadge';
import { GlassCard, Alert, Badge, Button } from '@/components/ui';
import { IconTrophy, IconUsers, IconFlame, IconSettings, IconBolt } from '@/components/icons';
import { clsx } from '@/lib/clsx';

type ArenaState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: ArenaProfileResponse };

type Tab = 'boards' | 'friends' | 'settings';

export default function ArenaPage() {
  const { getIdToken } = useAuth();
  const [state, setState] = useState<ArenaState>({ status: 'loading' });
  const [boardScope, setBoardScope] = useState<'global' | 'friends'>('global');
  const [tab, setTab] = useState<Tab>('boards');

  const load = useCallback(async () => {
    try {
      const token = await getIdToken();
      const data = await arenaFetch<ArenaProfileResponse>(token, '/api/arena/profile');
      setState({ status: 'ready', data });
    } catch (err) {
      setState({
        status: 'error',
        message:
          err instanceof ArenaApiError && err.code === 'AUTH_NOT_CONFIGURED'
            ? 'Server auth (FIREBASE_ADMIN_*) is not configured, so the Arena cannot verify sessions. See README → Server secrets.'
            : err instanceof ArenaApiError && err.code === 'RATE_LIMITED'
              ? 'Too many requests in a short time. Wait a minute and retry.'
              : 'Couldn’t load the Arena. Check your connection and retry.',
      });
    }
  }, [getIdToken]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.status === 'loading') {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <div className="skeleton h-28" />
        <div className="skeleton h-64" />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="mx-auto max-w-lg space-y-3">
        <Alert kind="error">{state.message}</Alert>
        <Button variant="outline" onClick={() => void load()} className="w-full">Retry</Button>
      </div>
    );
  }

  const { data } = state;
  if (!data.participant) {
    return <ConsentScreen onJoined={() => void load()} />;
  }

  const profile = data.profile!;
  const lifetime = data.lifetime!;
  const avatarEmoji = AVATAR_EMOJI[(profile.avatarId as AvatarId)] ?? '⚡';

  return (
    <div className="space-y-5">
      {/* Arena header / HUD */}
      <GlassCard className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(34,224,255,0.14), transparent 65%)' }}
          aria-hidden="true"
        />
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <ArenaAvatar avatarId={profile.avatarId} size={60} />
            <span className="absolute -bottom-1 -right-1 text-base" aria-hidden="true">{avatarEmoji}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-extrabold tracking-tight">{profile.displayName}</h1>
              <Badge tone="violet"><IconTrophy width={11} /> {levelTitle(lifetime.level)}</Badge>
            </div>
            <p className="mt-0.5 font-mono text-xs tracking-widest text-slate-500">{profile.arenaId}</p>
            <div className="mt-2.5 max-w-md">
              <XpBar xp={lifetime.xp} />
            </div>
          </div>
          <LevelBadge level={lifetime.level} size={58} />
        </div>

        {/* Stat chips */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatChip icon={<IconFlame width={15} className="text-coral" />} label="Streak" value={`${data.streakDays ?? 0}d`} title="Consecutive days with a workout" />
          <StatChip icon={<IconBolt width={15} className="text-neon" />} label="Today" value={`${data.today?.xp ?? 0} XP`} title="XP earned today (capped at 200)" />
          <StatChip icon={<IconTrophy width={15} className="text-amber" />} label="Week" value={`${data.period?.weekXp ?? 0} XP`} title={data.period?.weekKey ?? ''} />
          <StatChip icon={<IconMedalFallback />} label="Season" value={`${data.period?.seasonXp ?? 0} XP`} title={data.period?.seasonKey ?? ''} />
        </div>
      </GlassCard>

      {/* Boards / friends tabs */}
      <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/5 p-1" role="tablist" aria-label="Arena sections">
        {([
          { id: 'boards', label: 'Leaderboards', icon: IconTrophy },
          { id: 'friends', label: 'Friends', icon: IconUsers },
          { id: 'settings', label: 'Settings', icon: IconSettings },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={clsx(
              'flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition',
              tab === id ? 'bg-gradient-to-r from-electric-600 to-electric-500 text-white shadow-[0_0_16px_rgba(47,139,255,0.4)]' : 'text-slate-400 hover:text-slate-200',
            )}
          >
            <Icon width={15} /> {label}
          </button>
        ))}
      </div>

      {tab === 'boards' && (
        <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
          <GlassCard>
            {/* Scope switch inside the card */}
            <div className="mb-4 flex gap-1 rounded-2xl border border-white/10 bg-white/5 p-1" role="tablist" aria-label="Leaderboard scope">
              {(['global', 'friends'] as const).map((s) => (
                <button
                  key={s}
                  role="tab"
                  aria-selected={boardScope === s}
                  onClick={() => setBoardScope(s)}
                  className={clsx(
                    'flex-1 rounded-xl px-4 py-2 text-sm font-semibold capitalize transition',
                    boardScope === s ? 'bg-white/10 text-neon' : 'text-slate-400 hover:text-slate-200',
                  )}
                >
                  {s === 'global' ? '🌐 Global' : '🤝 Friends'}
                </button>
              ))}
            </div>
            <Leaderboard scope={boardScope} onSwitchFriends={() => setTab('friends')} />
          </GlassCard>
          <div className="space-y-4">
            <MissionsBoard onClaimed={() => void load()} />
            <GlassCard>
              <h3 className="mb-2 text-sm font-bold uppercase tracking-[0.15em] text-slate-400">How XP works</h3>
              <ul className="space-y-1.5 text-sm text-slate-300">
                <li className="flex justify-between"><span>Completed workout (≥10 min)</span><b className="text-neon">+50</b></li>
                <li className="flex justify-between"><span>Mobility / recovery session</span><b className="text-neon">+20</b></li>
                <li className="flex justify-between"><span>Daily consistency mission</span><b className="text-neon">+15</b></li>
                <li className="flex justify-between"><span>Nutrition milestone</span><b className="text-neon">+10</b></li>
                <li className="flex justify-between"><span>Weekly consistency (4 days)</span><b className="text-neon">+100</b></li>
              </ul>
              <p className="mt-2.5 text-[11px] text-slate-500">
                Verified server-side against your own activity. Ties on leaderboards break by who
                reached the score first.
              </p>
            </GlassCard>
          </div>
        </div>
      )}

      {tab === 'friends' && <FriendsManager arenaId={profile.arenaId} />}

      {tab === 'settings' && (
        <ArenaSettings
          profile={profile}
          onUpdated={() => void load()}
          onWithdrawn={() => void load()}
        />
      )}
    </div>
  );
}

function StatChip({ icon, label, value, title }: { icon: React.ReactNode; label: string; value: string; title?: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3.5 py-2.5" title={title}>
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
        {icon} {label}
      </p>
      <p className="mt-0.5 text-lg font-extrabold tabular-nums text-slate-100">{value}</p>
    </div>
  );
}

function IconMedalFallback() {
  return <IconBolt width={15} className="text-violet" />;
}
