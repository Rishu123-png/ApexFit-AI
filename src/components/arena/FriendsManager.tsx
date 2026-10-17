'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { arenaFetch, ArenaApiError, type FriendsOverviewResponse } from '@/lib/arena/client';
import { GlassCard, SectionTitle, Alert, Badge, Button, EmptyState } from '@/components/ui';
import { ArenaAvatar } from './LevelBadge';
import { IconUserPlus, IconCheck, IconX, IconTrash, IconBan, IconUsers } from '@/components/icons';

export function FriendsManager({ arenaId }: { arenaId: string }) {
  const { getIdToken } = useAuth();
  const [data, setData] = useState<FriendsOverviewResponse | null>(null);
  const [error, setError] = useState('');
  const [idInput, setIdInput] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const token = await getIdToken();
      setData(await arenaFetch<FriendsOverviewResponse>(token, '/api/arena/friends'));
    } catch {
      setError('Couldn’t load your friends. Check your connection.');
    }
  }, [getIdToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(body: Record<string, unknown>, busyKey: string) {
    setBusy(busyKey);
    setError('');
    setNotice('');
    try {
      const token = await getIdToken();
      const res = await arenaFetch<{ ok: boolean; message?: string }>(token, '/api/arena/friends', {
        method: 'POST',
        body,
      });
      setNotice(res.message ?? 'Done.');
      await load();
    } catch (err) {
      setError(err instanceof ArenaApiError ? (err.message ?? `Action failed (${err.code}).`) : 'Action failed. Try again.');
    } finally {
      setBusy('');
    }
  }

  function sendRequest(e: FormEvent) {
    e.preventDefault();
    const cleaned = idInput.trim().toUpperCase();
    if (!/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(cleaned)) {
      setError('Arena IDs look like XXXX-XXXX. Ask your friend for theirs.');
      return;
    }
    void act({ action: 'request', arenaId: cleaned }, 'send');
  }

  function copyId() {
    void navigator.clipboard?.writeText(arenaId).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => setCopied(false),
    );
  }

  return (
    <div className="space-y-4">
      {/* Invite */}
      <GlassCard>
        <SectionTitle title="Add a friend" />
        <p className="mb-3 text-sm text-slate-400">
          Share your Arena ID, or enter a friend’s. Requests require acceptance — nothing is public
          beyond your Arena display name and avatar.
        </p>
        <div className="mb-3 flex items-center gap-2 rounded-2xl border border-neon/25 bg-neon/5 px-4 py-3">
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Your Arena ID</p>
            <p className="font-mono text-lg font-extrabold tracking-widest text-neon">{arenaId}</p>
          </div>
          <Button variant="outline" onClick={copyId} className="px-3 py-1.5 text-xs">{copied ? 'Copied ✓' : 'Copy'}</Button>
        </div>
        <form onSubmit={sendRequest} className="flex gap-2">
          <label htmlFor="friend-arena-id" className="sr-only">Friend’s Arena ID</label>
          <input
            id="friend-arena-id"
            className="input flex-1 font-mono uppercase tracking-widest"
            placeholder="XXXX-XXXX"
            value={idInput}
            onChange={(e) => setIdInput(e.target.value)}
            maxLength={9}
            autoComplete="off"
          />
          <Button glow type="submit" loading={busy === 'send'}><IconUserPlus width={15} /> Invite</Button>
        </form>
        {notice && <Alert kind="success" className="mt-3">{notice}</Alert>}
        {error && <Alert kind="error" className="mt-3">{error}</Alert>}
      </GlassCard>

      {data === null ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-16" />)}</div>
      ) : (
        <>
          {/* Incoming requests */}
          {data.incoming.length > 0 && (
            <GlassCard>
              <SectionTitle title={`Requests (${data.incoming.length})`} />
              <ul className="space-y-2.5">
                {data.incoming.map((r) => (
                  <li key={r.requestId} className="flex items-center gap-3">
                    <ArenaAvatar avatarId={r.fromAvatarId} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{r.fromDisplayName}</p>
                      <p className="text-xs text-slate-500">wants to be your Arena friend</p>
                    </div>
                    <Button variant="outline" className="px-3 py-1.5 text-xs" loading={busy === `a-${r.requestId}`} onClick={() => void act({ action: 'accept', requestId: r.requestId }, `a-${r.requestId}`)}>
                      <IconCheck width={13} /> Accept
                    </Button>
                    <Button variant="ghost" className="px-3 py-1.5 text-xs" loading={busy === `r-${r.requestId}`} onClick={() => void act({ action: 'reject', requestId: r.requestId }, `r-${r.requestId}`)}>
                      <IconX width={13} /> Decline
                    </Button>
                  </li>
                ))}
              </ul>
            </GlassCard>
          )}

          {/* Friends list */}
          <GlassCard>
            <SectionTitle title={`Friends (${data.friends.length})`} />
            {data.friends.length === 0 ? (
              <EmptyState
                icon={<IconUsers width={30} />}
                title="No Arena friends yet"
                body="Invite training partners with your Arena ID above. Accepted friends appear on your friends leaderboard."
              />
            ) : (
              <ul className="divide-y divide-white/5">
                {data.friends.map((f) => (
                  <li key={f.uid} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <ArenaAvatar avatarId={f.avatarId} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{f.displayName}</p>
                      <p className="text-xs text-slate-500">Level {f.level}</p>
                    </div>
                    <button
                      onClick={() => void act({ action: 'remove', uid: f.uid }, `rm-${f.uid}`)}
                      disabled={busy === `rm-${f.uid}`}
                      className="rounded-lg p-2 text-slate-500 transition hover:bg-white/10 hover:text-coral disabled:opacity-40"
                      aria-label={`Remove ${f.displayName}`}
                      title="Remove friend"
                    >
                      <IconTrash width={15} />
                    </button>
                    <button
                      onClick={() => void act({ action: 'block', uid: f.uid }, `bl-${f.uid}`)}
                      disabled={busy === `bl-${f.uid}`}
                      className="rounded-lg p-2 text-slate-500 transition hover:bg-white/10 hover:text-amber disabled:opacity-40"
                      aria-label={`Block ${f.displayName}`}
                      title="Block"
                    >
                      <IconBan width={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>

          {data.outgoing.length > 0 && (
            <GlassCard>
              <SectionTitle title={`Sent (${data.outgoing.length})`} />
              <p className="text-sm text-slate-400">{data.outgoing.length} request{data.outgoing.length > 1 ? 's' : ''} waiting for a response.</p>
            </GlassCard>
          )}

          {data.blocked.length > 0 && (
            <GlassCard>
              <SectionTitle title={`Blocked (${data.blocked.length})`} />
              <ul className="space-y-2">
                {data.blocked.map((b) => (
                  <li key={b.uid} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-400">{b.displayName ?? 'Former participant'}</span>
                    <Button variant="ghost" className="px-3 py-1.5 text-xs" loading={busy === `ub-${b.uid}`} onClick={() => void act({ action: 'unblock', uid: b.uid }, `ub-${b.uid}`)}>
                      Unblock
                    </Button>
                  </li>
                ))}
              </ul>
            </GlassCard>
          )}
        </>
      )}
    </div>
  );
}

export { Badge };
