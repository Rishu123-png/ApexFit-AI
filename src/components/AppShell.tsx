'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useState, type ReactNode } from 'react';
import { clsx } from '@/lib/clsx';
import { useAuth } from '@/lib/auth/AuthProvider';
import { LogoMark, LogoWord } from '@/components/Logo';
import { ArenaTopPill } from '@/components/navigation/ArenaTopPill';
import {
  IconHome,
  IconDumbbell,
  IconBowl,
  IconCamera,
  IconCrown,
  IconLogout,
  IconTrendingUp,
} from '@/components/icons';
import { Splash } from '@/components/AuthGate';

// Arena deliberately does not appear here. Its sole global entry point is the
// top-bar ArenaTopPill, preventing the old sidebar/dashboard/mobile duplication.
const PRIMARY_NAV = [
  { href: '/dashboard', label: 'Home', icon: IconHome },
  { href: '/workouts', label: 'Train', icon: IconDumbbell },
  { href: '/nutrition', label: 'Fuel', icon: IconBowl },
  { href: '/camera', label: 'Vision', icon: IconCamera },
  { href: '/insights', label: 'Insights', icon: IconTrendingUp },
];

const SECONDARY_NAV = [{ href: '/plans', label: 'Plans', icon: IconCrown }];

function navActive(pathname: string, href: string) {
  return href === '/dashboard' ? pathname === href : pathname.startsWith(href);
}

interface RailItemProps {
  href: string;
  label: string;
  icon: typeof IconHome;
  active: boolean;
  expanded: boolean;
}

function RailItem({ href, label, icon: Icon, active, expanded }: RailItemProps) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      title={expanded ? undefined : label}
      className={clsx(
        'group/item relative flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon',
        active
          ? 'bg-electric-500/15 text-neon shadow-[inset_0_0_0_1px_rgba(34,224,255,0.12),0_0_20px_rgba(47,139,255,0.12)]'
          : 'text-slate-500 hover:bg-white/[0.055] hover:text-slate-100',
      )}
    >
      {active && <span className="absolute left-0 h-5 w-0.5 rounded-full bg-neon shadow-[0_0_10px_rgba(34,224,255,0.95)]" aria-hidden="true" />}
      <Icon width={20} className="shrink-0" />
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.16 }}
            className="whitespace-nowrap"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [railExpanded, setRailExpanded] = useState(false);
  const reducedMotion = useReducedMotion();

  async function handleLogout() {
    setSigningOut(true);
    try {
      await logout();
      router.replace('/login');
    } finally {
      setSigningOut(false);
    }
  }

  if (signingOut) return <Splash message="Signing out…" />;

  const initials = (user?.displayName ?? user?.email ?? 'A').slice(0, 1).toUpperCase();
  const pageTitle = [...PRIMARY_NAV, ...SECONDARY_NAV].find((item) => navActive(pathname, item.href))?.label ?? 'ApexFit';

  return (
    <div className="min-h-dvh bg-ink text-slate-100">
      {/* Desktop-only expandable command rail. It avoids crowding the top bar. */}
      <motion.aside
        initial={false}
        animate={{ width: railExpanded ? 216 : 68 }}
        transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 360, damping: 32 }}
        onMouseEnter={() => setRailExpanded(true)}
        onMouseLeave={() => setRailExpanded(false)}
        onFocusCapture={() => setRailExpanded(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setRailExpanded(false);
        }}
        className="fixed left-4 top-1/2 z-50 hidden -translate-y-1/2 flex-col rounded-[1.7rem] border border-white/10 bg-[#090d1c]/85 p-2 shadow-[0_20px_70px_rgba(0,0,0,0.34)] backdrop-blur-2xl lg:flex"
        aria-label="Primary navigation"
      >
        <div className="mb-3 flex h-11 items-center px-1.5">
          <Link href="/dashboard" aria-label="ApexFit home" className="flex shrink-0 items-center text-neon focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon">
            <LogoMark size={28} />
          </Link>
          <AnimatePresence initial={false}>
            {railExpanded && (
              <motion.span initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} className="ml-2.5 whitespace-nowrap">
                <LogoWord size={23} />
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-1">
          {PRIMARY_NAV.map((item) => (
            <RailItem key={item.href} {...item} active={navActive(pathname, item.href)} expanded={railExpanded} />
          ))}
        </div>
        <div className="my-3 h-px bg-white/8" />
        <div className="space-y-1">
          {SECONDARY_NAV.map((item) => (
            <RailItem key={item.href} {...item} active={navActive(pathname, item.href)} expanded={railExpanded} />
          ))}
        </div>
        <div className="mt-3">
          <button
            onClick={() => void handleLogout()}
            title={railExpanded ? undefined : 'Sign out'}
            className="flex h-11 w-full items-center gap-3 rounded-2xl px-3 text-sm font-semibold text-slate-500 transition-colors hover:bg-coral/10 hover:text-coral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          >
            <IconLogout width={20} className="shrink-0" />
            <AnimatePresence initial={false}>
              {railExpanded && <motion.span initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }}>Sign out</motion.span>}
            </AnimatePresence>
          </button>
        </div>
      </motion.aside>

      <div className="mx-auto flex min-h-dvh w-full max-w-[1500px] flex-col lg:pl-[100px]">
        {/* The top bar owns the only global Arena entry point. */}
        <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5">
          <div className="flex h-14 items-center justify-between gap-3 rounded-2xl border border-white/10 bg-ink/75 px-3 shadow-[0_8px_30px_rgba(0,0,0,0.16)] backdrop-blur-2xl sm:px-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <Link href="/dashboard" aria-label="ApexFit home" className="shrink-0 lg:hidden">
                <LogoMark size={28} />
              </Link>
              <div className="hidden min-w-0 sm:block lg:block">
                <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">ApexFit workspace</p>
                <p className="truncate text-sm font-bold text-slate-200">{pageTitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-2.5">
              <ArenaTopPill />
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full border border-electric-500/35 bg-gradient-to-br from-electric-500/35 to-neon/15 text-xs font-black text-electric-100 shadow-[0_0_18px_rgba(47,139,255,0.16)]"
                title={user?.email ?? ''}
                aria-label={`Signed in as ${user?.displayName ?? user?.email ?? 'user'}`}
              >
                {initials}
              </div>
              <button
                onClick={() => void handleLogout()}
                className="hidden h-8 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 text-[11px] font-bold text-slate-300 transition hover:border-white/20 hover:bg-white/[0.08] sm:inline-flex"
                aria-label="Sign out"
              >
                <IconLogout width={13} />
                <span className="hidden md:inline">Sign out</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10">{children}</main>
      </div>

      {/* Mobile has only the five high-frequency tasks. Plans live in Train; Arena remains in the top bar. */}
      <nav
        className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-white/10 bg-[#080c1a]/90 p-1.5 shadow-[0_16px_45px_rgba(0,0,0,0.38)] backdrop-blur-2xl lg:hidden"
        aria-label="Primary navigation"
        style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto flex max-w-md items-stretch justify-between">
          {PRIMARY_NAV.map(({ href, label, icon: Icon }) => {
            const active = navActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[9px] font-bold transition-colors',
                  active ? 'text-neon' : 'text-slate-500 hover:text-slate-200',
                )}
              >
                {active && <motion.span layoutId="mobile-nav-active" className="absolute inset-x-1 top-0 h-0.5 rounded-full bg-neon shadow-[0_0_8px_rgba(34,224,255,0.9)]" />}
                <Icon width={20} className={active ? 'drop-shadow-[0_0_8px_rgba(34,224,255,0.7)]' : ''} />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
