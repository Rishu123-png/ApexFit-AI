'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { missingFirebaseEnv } from '@/lib/firebase/client';
import { GlassCard, Spinner, Badge } from '@/components/ui';
import { LogoWord } from '@/components/Logo';
import { IconShield, IconAlert } from '@/components/icons';

export function Splash({ message = 'Initialising…' }: { message?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
      <LogoWord size={40} />
      <Spinner size={26} className="text-electric-400" />
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}

/** Shown when required Firebase env vars are absent — fails safe, not silent. */
export function ConfigMissing() {
  const missing = missingFirebaseEnv();
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <GlassCard className="max-w-lg">
        <div className="mb-4 flex items-center gap-2 text-coral">
          <IconAlert width={22} />
          <h1 className="text-lg font-bold text-slate-100">Configuration required</h1>
        </div>
        <p className="mb-4 text-sm text-slate-300">
          ApexFit can’t reach Firebase because required environment variables are not set. The app
          fails safe — no fake demo data is shown. To enable it:
        </p>
        <ol className="mb-4 list-decimal space-y-1.5 pl-5 text-sm text-slate-300">
          <li>
            Create a Firebase project and enable <b>Email/Password Authentication</b> and{' '}
            <b>Realtime Database</b>.
          </li>
          <li>
            Copy <code className="code">.env.example</code> to{' '}
            <code className="code">.env.local</code> and fill in your Firebase web config.
          </li>
          <li>Restart the dev server.</li>
        </ol>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <IconShield width={14} /> Missing variables
        </div>
        <div className="flex flex-wrap gap-2">
          {missing.map((k) => (
            <Badge key={k} tone="rose">
              {k}
            </Badge>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-500">
          See the project README for the full Firebase + Vercel setup guide.
        </p>
      </GlassCard>
    </div>
  );
}

/**
 * Client-side route protection. This is a UX gate only — real access control
 * is enforced by Realtime Database security rules and server-side token
 * verification in API routes.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, configured } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (mounted && configured && !loading && !user) {
      router.replace('/login');
    }
  }, [mounted, configured, loading, user, router]);

  if (!mounted) return <Splash />;
  if (!configured) return <ConfigMissing />;
  if (loading) return <Splash message="Restoring your session…" />;
  if (!user) return <Splash message="Redirecting to sign in…" />;

  return <>{children}</>;
}
