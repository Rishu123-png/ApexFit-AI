'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, authErrorMessage } from '@/lib/auth/AuthProvider';
import { googleSignInEnabled } from '@/lib/firebase/client';
import { LogoWord, LogoMark } from '@/components/Logo';
import { Alert, Button, Field, Spinner } from '@/components/ui';
import { Splash, ConfigMissing } from '@/components/AuthGate';
import { IconEye, IconEyeOff, IconGoogle, IconBolt, IconShield } from '@/components/icons';
import { clsx } from '@/lib/clsx';

type Mode = 'signin' | 'signup' | 'reset';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const { user, loading, configured, signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState<'form' | 'google' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => setMounted(true), []);

  // Already authenticated → go straight to the dashboard (only after Firebase confirms).
  useEffect(() => {
    if (mounted && configured && !loading && user) router.replace('/dashboard');
  }, [mounted, configured, loading, user, router]);

  if (!mounted || loading) return <Splash message="Preparing secure sign in…" />;
  if (!configured) return <ConfigMissing />;
  if (user) return <Splash message="Welcome back — opening your dashboard…" />;

  function switchMode(next: Mode) {
    setMode(next);
    setError('');
    setNotice('');
  }

  function validate(): string {
    if (mode === 'signup') {
      if (name.trim().length < 2) return 'Please enter your name.';
      if (password.length < 8) return 'Password must be at least 8 characters.';
      if (password !== confirm) return 'Passwords do not match.';
    }
    if (!EMAIL_RE.test(email)) return 'Please enter a valid email address.';
    if (mode !== 'reset' && password.length === 0) return 'Please enter your password.';
    return '';
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setBusy('form');
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
        router.replace('/dashboard');
      } else if (mode === 'signup') {
        await signUp(name.trim(), email.trim(), password);
        router.replace('/dashboard');
      } else {
        await resetPassword(email.trim());
        setNotice(`If an account exists for ${email.trim()}, a password-reset link is on its way. Check your inbox (and spam folder).`);
      }
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleGoogle() {
    setError('');
    setNotice('');
    setBusy('google');
    try {
      await signInWithGoogle();
      router.replace('/dashboard');
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(null);
    }
  }

  const pwToggle = (
    <button
      type="button"
      onClick={() => setShowPw((v) => !v)}
      className="rounded-lg p-2 text-slate-400 transition hover:text-electric-300"
      aria-label={showPw ? 'Hide password' : 'Show password'}
      tabIndex={0}
    >
      {showPw ? <IconEyeOff width={18} /> : <IconEye width={18} />}
    </button>
  );

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-4xl glass-strong rise-in md:grid-cols-[1.1fr_1fr]">
        {/* Brand panel */}
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-navy-800/90 via-abyss to-ink p-8 md:flex">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(34,224,255,0.18), transparent 65%)' }}
          />
          <LogoWord size={34} />
          <div className="space-y-5">
            <h1 className="text-3xl font-extrabold leading-tight">
              Your body.<br />Your data.<br /><span className="neon-text">Your edge.</span>
            </h1>
            <p className="max-w-xs text-sm leading-relaxed text-slate-400">
              An AI-powered training and nutrition system built for India — from rotis and dal to
              dumbbells and HIIT.
            </p>
            <ul className="space-y-2.5 text-sm text-slate-300">
              {['Structured plans with live session tracking', 'Indian-first nutrition database', 'AI coach with secure server-side Groq'].map((t) => (
                <li key={t} className="flex items-center gap-2.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-electric-500/20 text-neon">
                    <IconBolt width={11} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <IconShield width={14} className="text-electric-400" />
            Secured by Firebase Authentication — sessions persist safely on this device.
          </div>
        </aside>

        {/* Form panel */}
        <div className="max-w-full p-5 sm:p-8">
          <div className="mb-6 flex items-center justify-between md:hidden">
            <Link href="/"><LogoMark size={30} /></Link>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">ApexFit AI</span>
          </div>

          {mode !== 'reset' ? (
            <div className="mb-6 grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-white/5 p-1" role="tablist" aria-label="Authentication mode">
              {(['signin', 'signup'] as const).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => switchMode(m)}
                  className={clsx(
                    'rounded-xl py-2.5 text-sm font-semibold transition-all',
                    mode === m
                      ? 'bg-gradient-to-r from-electric-600 to-electric-500 text-white shadow-[0_0_18px_rgba(47,139,255,0.4)]'
                      : 'text-slate-400 hover:text-slate-200',
                  )}
                >
                  {m === 'signin' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>
          ) : (
            <div className="mb-6">
              <h2 className="text-lg font-bold">Reset your password</h2>
              <p className="mt-1 text-sm text-slate-400">
                Enter your account email and we’ll send a secure reset link.
              </p>
            </div>
          )}

          {error && <Alert kind="error" className="mb-4">{error}</Alert>}
          {notice && <Alert kind="success" className="mb-4">{notice}</Alert>}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {mode === 'signup' && (
              <Field
                label="Full name"
                type="text"
                autoComplete="name"
                placeholder="Priya Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            )}
            <Field
              label="Email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {mode !== 'reset' && (
              <>
                <Field
                  label="Password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  trailing={pwToggle}
                  hint={mode === 'signup' ? 'Minimum 8 characters.' : undefined}
                  required
                />
                {mode === 'signup' && (
                  <Field
                    label="Confirm password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    trailing={pwToggle}
                    required
                  />
                )}
              </>
            )}

            <Button
              type="submit"
              glow
              loading={busy === 'form'}
              disabled={busy !== null}
              className="w-full py-3"
            >
              {mode === 'signin' ? 'Sign in securely' : mode === 'signup' ? 'Create my account' : 'Send reset link'}
            </Button>

            {mode === 'signin' && (
              <button
                type="button"
                onClick={() => switchMode('reset')}
                className="w-full text-center text-sm font-medium text-electric-300 transition hover:text-neon"
              >
                Forgot your password?
              </button>
            )}
            {mode === 'reset' && (
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="w-full text-center text-sm font-medium text-slate-400 transition hover:text-slate-200"
              >
                ← Back to sign in
              </button>
            )}
          </form>

          {googleSignInEnabled && mode !== 'reset' && (
            <>
              <div className="my-5 flex items-center gap-3 text-xs text-slate-500" aria-hidden="true">
                <div className="h-px flex-1 bg-white/10" /> OR <div className="h-px flex-1 bg-white/10" />
              </div>
              <Button
                variant="ghost"
                className="w-full py-3"
                onClick={handleGoogle}
                loading={busy === 'google'}
                disabled={busy !== null}
              >
                <IconGoogle width={17} /> Continue with Google
              </Button>
            </>
          )}

          <p className="mt-6 text-center text-[11px] leading-relaxed text-slate-500">
            By continuing you agree to use ApexFit responsibly. Coaching content is guidance, not
            medical advice.
          </p>
        </div>
      </div>
    </div>
  );
}
