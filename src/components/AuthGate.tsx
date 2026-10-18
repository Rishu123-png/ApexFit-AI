'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { missingFirebaseEnv } from '@/lib/firebase/client';
import { GlassCard, Spinner, Badge, Button, Alert } from '@/components/ui';
import { LogoWord } from '@/components/Logo';
import { IconShield, IconAlert, IconCheck } from '@/components/icons';

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
  if (user.providerData.some((provider) => provider.providerId === 'password') && !user.emailVerified) {
    return <VerificationGate />;
  }

  return <>{children}</>;
}

function VerificationGate() {
  const { user, resendVerification, refreshUser, logout } = useAuth();
  const [busy, setBusy] = useState<'resend' | 'check' | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function resend() {
    setBusy('resend');
    setError('');
    try {
      await resendVerification();
      setNotice('Verification email sent. Check your inbox and spam folder.');
    } catch {
      setError('We could not send the email right now. Wait a moment and try again.');
    } finally {
      setBusy(null);
    }
  }

  async function check() {
    setBusy('check');
    setError('');
    try {
      await refreshUser();
      setNotice('If you clicked the link, your account is now verified.');
    } catch {
      setError('We could not refresh your account yet. Check your connection and try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <GlassCard className="w-full max-w-lg space-y-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-electric-500/30 bg-electric-500/10 text-electric-200"><IconShield width={20} /></span>
          <div><Badge tone="blue">One quick security step</Badge><h1 className="mt-2 text-2xl font-black">Verify your email first</h1><p className="mt-1 text-sm leading-relaxed text-slate-400">We sent a verification link to <b className="text-slate-200">{user?.email}</b>. Verify it before entering onboarding so your private fitness data is connected to the right account.</p></div>
        </div>
        {notice && <Alert kind="success"><IconCheck width={15} className="mr-1 inline" />{notice}</Alert>}
        {error && <Alert kind="error">{error}</Alert>}
        <div className="grid gap-2 sm:grid-cols-2">
          <Button glow onClick={() => void check()} loading={busy === 'check'}><IconCheck width={15} /> I verified my email</Button>
          <Button variant="outline" onClick={() => void resend()} loading={busy === 'resend'}>Resend email</Button>
        </div>
        <Button variant="ghost" className="w-full" onClick={() => void logout()}>Sign out and use another account</Button>
      </GlassCard>
    </div>
  );
}
