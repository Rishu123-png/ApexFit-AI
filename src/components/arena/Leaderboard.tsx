'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { getLeaderboardClient, ArenaApiError } from '@/lib/arena/client';
import type { LeaderboardPeriod, LeaderboardRow, LeaderboardScope } from '@/lib/arena/types';
import { glassBoardEmptyCopy } from './copy';
import { Button, EmptyState, Alert } from '@/components/ui';
import { ArenaAvatar, LevelBadge } from './LevelBadge';
import { IconUsers, IconTrophy, IconRefresh } from '@/components/icons';
import { clsx } from '@/lib/clsx';

const PERIODS: { id: LeaderboardPeriod; label: string }[] = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'seasonal', label: 'Season' },
  { id: 'lifetime', label: 'Lifetime' },
];

type BoardState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; rows: LeaderboardRow[]; total: number; nextCursor: number | null; selfRank: number | null; periodKey: string };

export function Leaderboard({ scope, onSwitchFriends }: { scope: LeaderboardScope; onSwitchFriends?: () => void }) {
  const { getIdToken } = useAuth();
  const [period, setPeriod] = useState<LeaderboardPeriod>('weekly');
  const [cursor, setCursor] = useState(0);
  const [state, setState] = useState<BoardState>({ status: 'loading' });
  const [reloadFlag, setReloadFlag] = useState(0);

  const load = useCallback(
    async (c: number) => {
      setState({ status: 'loading' });
      try {
        const token = await getIdToken();
        const data = await getLeaderboardClient(token, scope, period, c);
        setState({
          status: 'ready',
          rows: data.rows,
          total: data.total,
          nextCursor: data.nextCursor,
          selfRank: data.selfRank,
          periodKey: data.periodKey,
        });
      } catch (err) {
        setState({
          status: 'error',
          message:
            err instanceof ArenaApiError && err.code === 'RATE_LIMITED'
              ? 'Slow down a little — leaderboard refresh limit reached. Try again soon.'
              : 'Couldn’t load the leaderboard. Check your connection and retry.',
        });
      }
    },
    [getIdToken, scope, period],
  );

  useEffect(() => {
    void load(cursor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, period, scope, reloadFlag]);

  function changePeriod(p: LeaderboardPeriod) {
    setPeriod(p);
    setCursor(0);
  }

  return (
    <div className="space-y-3.5">
      {/* Period selector */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/5 p-1" role="tablist" aria-label="Leaderboard period">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={period === p.id}
              onClick={() => changePeriod(p.id)}
              className={clsx(
                'rounded-xl px-3.5 py-1.5 text-xs font-semibold transition',
                period === p.id ? 'bg-gradient-to-r from-electric-600 to-electric-500 text-white shadow-[0_0_14px_rgba(47,139,255,0.45)]' : 'text-slate-400 hover:text-slate-200',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setReloadFlag((f) => f + 1)}
          className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:text-electric-300"
          aria-label="Refresh leaderboard"
        >
          <IconRefresh width={15} />
        </button>
      </div>

      {state.status === 'loading' && (
        <div className="space-y-2" aria-label="Loading leaderboard">
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-14" />)}
        </div>
      )}

      {state.status === 'error' && (
        <div className="space-y-3">
          <Alert kind="error">{state.message}</Alert>
          <Button variant="outline" onClick={() => void load(cursor)} className="w-full">
            <IconRefresh width={14} /> Retry
          </Button>
        </div>
      )}

      {state.status === 'ready' && state.rows.length === 0 && (
        <EmptyState
          icon={scope === 'friends' ? <IconUsers width={30} /> : <IconTrophy width={30} />}
          title={scope === 'friends' ? 'No friends on the board yet' : 'No participants yet this period'}
          body={
            scope === 'friends'
              ? 'Invite friends with your Arena ID — once they accept, their scores appear here.'
              : glassBoardEmptyCopy(period)
          }
          action={
            scope === 'friends' && onSwitchFriends ? (
              <Button variant="outline" onClick={onSwitchFriends}><IconUsers width={14} /> Manage friends</Button>
            ) : undefined
          }
        />
      )}

      {state.status === 'ready' && state.rows.length > 0 && (
        <>
          <ol className="space-y-2" aria-label={`${scope} ${period} leaderboard`}>
            {state.rows.map((row) => (
              <li
                key={`${row.rank}-${row.displayName}`}
                className={clsx(
                  'flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 transition',
                  row.isSelf
                    ? 'border-electric-400/60 bg-electric-500/12 shadow-[0_0_20px_rgba(47,139,255,0.2)]'
                    : 'border-white/8 bg-white/[0.03]',
                  row.rank <= 3 && !row.isSelf && 'border-amber/25',
                )}
              >
                <span
                  className={clsx(
                    'w-8 text-center font-extrabold tabular-nums',
                    row.rank === 1 ? 'text-amber' : row.rank <= 3 ? 'text-slate-200' : 'text-slate-500',
                  )}
                  aria-label={`Rank ${row.rank}`}
                >
                  {row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : row.rank}
                </span>
                <ArenaAvatar avatarId={row.avatarId} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-100">
                    {row.displayName}
                    {row.isSelf && <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-neon">you</span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    LV {row.level}
                    {scope === 'friends' && row.friendship === 'friend' && ' · friend'}
                  </p>
                </div>
                <DeltaBadge delta={row.delta} />
                <span className="text-right">
                  <span className="block text-sm font-extrabold tabular-nums text-electric-200">{row.score.toLocaleString('en-IN')}</span>
                  <span className="block text-[10px] uppercase tracking-wider text-slate-500">{period === 'lifetime' ? 'lifetime XP' : 'XP'}</span>
                </span>
              </li>
            ))}
          </ol>

          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              {state.total} participant{state.total === 1 ? '' : 's'} · {state.periodKey}
              {state.selfRank ? ` · you are #${state.selfRank}` : ''}
            </p>
            <div className="flex gap-1.5">
              <Button variant="ghost" className="px-3 py-1.5 text-xs" disabled={cursor === 0} onClick={() => setCursor(Math.max(0, cursor - 25))}>
                ← Prev
              </Button>
              <Button variant="ghost" className="px-3 py-1.5 text-xs" disabled={state.nextCursor === null} onClick={() => state.nextCursor !== null && setCursor(state.nextCursor)}>
                Next →
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null || delta === 0) return <span className="w-8" aria-hidden="true" />;
  const up = delta > 0;
  return (
    <span
      className={clsx('w-8 text-center text-xs font-bold tabular-nums', up ? 'text-mint' : 'text-coral')}
      title={up ? `Up ${delta} since your last award` : `Down ${-delta} since your last award`}
      aria-label={up ? `Rank up ${delta}` : `Rank down ${-delta}`}
    >
      {up ? '▲' : '▼'}{Math.abs(delta)}
    </span>
  );
}

export { LevelBadge };
