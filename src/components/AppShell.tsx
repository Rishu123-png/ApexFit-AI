'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clsx } from '@/lib/clsx';
import { useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { LogoMark, LogoWord } from '@/components/Logo';
import {
  IconHome,
  IconDumbbell,
  IconBowl,
  IconCamera,
  IconCrown,
  IconLogout,
  IconTrophy,
} from '@/components/icons';
import { Splash } from '@/components/AuthGate';

const NAV = [
  { href: '/dashboard', label: 'Home', icon: IconHome },
  { href: '/workouts', label: 'Train', icon: IconDumbbell },
  { href: '/arena', label: 'Arena', icon: IconTrophy },
  { href: '/nutrition', label: 'Fuel', icon: IconBowl },
  { href: '/camera', label: 'Vision', icon: IconCamera },
  { href: '/plans', label: 'Plans', icon: IconCrown },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

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

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-ink/70 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <Link href="/dashboard" aria-label="ApexFit home">
            <span className="sm:hidden"><LogoMark size={30} /></span>
            <span className="hidden sm:inline"><LogoWord size={30} /></span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors',
                  pathname.startsWith(href)
                    ? 'bg-electric-500/15 text-electric-300'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
                )}
                aria-current={pathname.startsWith(href) ? 'page' : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full border border-electric-500/40 bg-gradient-to-br from-electric-600/40 to-neon/20 text-sm font-bold text-electric-200"
              title={user?.email ?? ''}
              aria-label={`Signed in as ${user?.displayName ?? user?.email ?? 'user'}`}
            >
              {initials}
            </div>
            <button
              onClick={handleLogout}
              className="hidden items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/10 sm:inline-flex"
              aria-label="Sign out"
            >
              <IconLogout width={14} /> Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 px-4 pb-28 pt-6 sm:px-6 md:pb-12">{children}</main>

      {/* Mobile bottom navigation */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink/85 backdrop-blur-2xl md:hidden"
        aria-label="Primary"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex max-w-md items-stretch justify-between px-2">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors',
                  active ? 'text-neon' : 'text-slate-500 hover:text-slate-300',
                )}
              >
                <Icon
                  width={22}
                  className={active ? 'drop-shadow-[0_0_8px_rgba(34,224,255,0.8)]' : ''}
                />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
