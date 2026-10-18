'use client';

import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { arenaFetch, type ArenaProfileResponse } from '@/lib/arena/client';
import { IconTrophy } from '@/components/icons';

/**
 * Arena has one deliberate entry point in the app shell. It is intentionally
 * not duplicated in the sidebar, mobile dock, or dashboard content.
 */
export function ArenaTopPill() {
  const { getIdToken } = useAuth();
  const [arena, setArena] = useState<ArenaProfileResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const token = await getIdToken();
        const result = await arenaFetch<ArenaProfileResponse>(token, '/api/arena/profile');
        if (!cancelled) setArena(result);
      } catch {
        // Arena is optional. The pill remains a quiet entry point when the
        // service is offline, unconfigured, or the user has not opted in.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getIdToken]);

  const joined = arena?.participant === true && !!arena.lifetime;
  const label = joined
    ? `Arena — Level ${arena.lifetime!.level}, ${arena.lifetime!.xp.toLocaleString('en-IN')} XP`
    : 'Open Apex Arena';

  return (
    <Link href="/arena" aria-label={label} className="group relative block shrink-0 rounded-full focus-visible:outline-none">
      <motion.div
        layout
        initial={false}
        whileHover={reducedMotion ? undefined : { y: -1, scale: 1.015 }}
        whileTap={reducedMotion ? undefined : { scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        className="relative flex min-h-10 items-center gap-2 overflow-hidden rounded-full border border-violet/30 bg-[#17102b]/85 px-2.5 py-1.5 text-violet-100 shadow-[0_0_22px_rgba(139,92,246,0.16)] backdrop-blur-xl transition-colors group-hover:border-violet/55 group-hover:bg-violet/15"
      >
        <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-violet/20 text-violet-200">
          <span className="absolute inset-0 rounded-full bg-violet/35 blur-md" aria-hidden="true" />
          <IconTrophy width={14} className="relative" />
        </span>
        <AnimatePresence initial={false} mode="popLayout">
          {joined ? (
            <motion.span
              key="joined"
              initial={reducedMotion ? false : { opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={reducedMotion ? undefined : { opacity: 0, width: 0 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              className="hidden overflow-hidden whitespace-nowrap sm:flex sm:items-center sm:gap-1.5"
            >
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-300">Arena</span>
              <span className="text-xs font-bold text-white">Lv {arena.lifetime!.level}</span>
              <span className="text-[10px] font-semibold text-violet-200/80">{arena.lifetime!.xp.toLocaleString('en-IN')} XP</span>
            </motion.span>
          ) : (
            <motion.span
              key="available"
              initial={reducedMotion ? false : { opacity: 0, width: 0 }}
              animate={{ opacity: loaded ? 1 : 0.55, width: 'auto' }}
              exit={reducedMotion ? undefined : { opacity: 0, width: 0 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              className="hidden whitespace-nowrap text-[10px] font-black uppercase tracking-[0.14em] text-violet-200 sm:block"
            >
              {loaded ? 'Arena' : 'Loading'}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </Link>
  );
}
