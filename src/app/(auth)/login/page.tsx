'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
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
  const reducedMotion = useReducedMotion();

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
    if (mounted && configured && !loading && user) router.replace('/onboarding');
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
        router.replace('/onboarding');
      } else if (mode === 'signup') {
        await signUp(name.trim(), email.trim(), password);
        router.replace('/onboarding');
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
      router.replace('/onboarding');
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
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#100e19] p-4 sm:p-6">
      <div className="pointer-events-none absolute -left-28 top-1/4 h-96 w-96 rounded-full bg-coral/20 blur-[110px]" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-violet/20 blur-[120px]" aria-hidden="true" />
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 24 }}
        className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/15 bg-[#0d1020]/90 shadow-[0_30px_100px_rgba(0,0,0,0.42)] backdrop-blur-2xl md:grid-cols-[1.12fr_0.88fr]"
      >
        {/* Brand panel */}
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-[linear-gradient(145deg,#ff947b_0%,#f56f70_38%,#8a3f77_100%)] p-8 text-[#27131d] md:flex">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.38), transparent 65%)' }}
          />
          <div className="relative"><LogoWord size={34} /></div>
          <div className="relative space-y-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6b2846]/80">Your daily edge</p>
              <h1 className="mt-2 text-4xl font-black leading-[0.96] tracking-tight">
                Train with<br />clarity. Eat with<br /><span className="text-white">confidence.</span>
              </h1>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#4b2237]/85">
                A focused fitness system built around your training, Indian meals and sustainable momentum.
              </p>
            </div>

            {/* Visual-only product preview; authentication remains real Firebase Auth. */}
            <motion.div
              animate={reducedMotion ? undefined : { y: [0, -6, 0] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
              className="relative max-w-[17rem] rounded-3xl border border-white/35 bg-[#351d37]/90 p-4 text-white shadow-[0_20px_38px_rgba(79,24,55,0.24)] backdrop-blur"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ffd2c1]">Today’s momentum</p>
                  <p className="mt-1 text-2xl font-black">72%</p>
                </div>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[#ffd5ca]"><IconBolt width={15} /></span>
              </div>
              <div className="mt-4 flex items-end gap-1.5" aria-hidden="true">
                {[38, 61, 45, 78, 56, 91, 72].map((height, index) => (
                  <span key={index} className="flex-1 rounded-full bg-gradient-to-t from-[#fb8a72] to-[#ffe1cd]" style={{ height: `${height / 2}px` }} />
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] font-semibold text-[#ffd9cd]">
                <span>Workout + fuel</span><span>On track</span>
              </div>
            </motion.div>

            <ul className="space-y-2.5 text-sm font-medium text-[#3d1d31]">
              {['Structured plans with live session tracking', 'Indian-first nutrition database', 'Private, server-secured AI coaching'].map((t) => (
                <li key={t} className="flex items-center gap-2.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/50 text-[#6a2947]">
                    <IconBolt width={11} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative flex items-center gap-2 text-xs font-medium text-[#4b2237]/75">
            <IconShield width={14} />
            Secured by Firebase Authentication — your session stays on this device.
          </div>
        </aside>

        {/* Form panel */}
        <div className="max-w-full bg-[#0d1020]/92 p-5 sm:p-8">
          <div className="mb-6 flex items-center justify-between md:hidden">
            <Link href="/"><LogoMark size={30} /></Link>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">ApexFit AI</span>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={mode}
              initial={reducedMotion ? false : { opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, x: -10 }}
              transition={{ duration: 0.18 }}
            >
          {mode !== 'reset' ? (
            <>
              <div className="mb-5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-coral">Secure access</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-white">{mode === 'signin' ? 'Welcome back' : 'Build your edge'}</h2>
                <p className="mt-1 text-sm text-slate-400">{mode === 'signin' ? 'Pick up exactly where you left off.' : 'Create your private ApexFit workspace.'}</p>
              </div>
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
            </>
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
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
