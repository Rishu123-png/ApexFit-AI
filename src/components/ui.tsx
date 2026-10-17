import { clsx, type ClassValue } from '@/lib/clsx';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

// ── Buttons ──────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  glow?: boolean;
}

export function Button({
  variant = 'primary',
  loading = false,
  glow = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const styles: Record<ButtonVariant, string> = {
    primary:
      'bg-gradient-to-r from-electric-600 to-electric-500 text-white shadow-[0_0_24px_rgba(47,139,255,0.35)] hover:shadow-[0_0_36px_rgba(47,139,255,0.55)] hover:brightness-110',
    ghost: 'bg-white/5 text-slate-200 hover:bg-white/10 border border-white/10',
    outline:
      'border border-electric-500/40 text-electric-300 hover:bg-electric-500/10 hover:border-electric-400/70',
    danger: 'bg-coral/15 text-coral border border-coral/30 hover:bg-coral/25',
  };
  return (
    <button
      className={clsx(
        'relative inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200',
        'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
        glow && 'btn-glow',
        styles[variant],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading}
      {...rest}
    >
      {loading && <Spinner size={16} className="text-current" />}
      {children}
    </button>
  );
}

// ── Spinner ──────────────────────────────────────────────────────────────────

export function Spinner({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={clsx('animate-spin', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label="Loading"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ── Inputs ───────────────────────────────────────────────────────────────────

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  trailing?: ReactNode;
}

export function Field({ label, error, hint, id, trailing, className, ...rest }: FieldProps) {
  const inputId = id ?? `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={clsx(
            'input',
            error && 'border-coral/60 focus:border-coral',
            !!trailing && 'pr-11',
            className,
          )}
          {...rest}
        />
        {trailing && <div className="absolute inset-y-0 right-2 flex items-center">{trailing}</div>}
      </div>
      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-xs text-coral">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={`${inputId}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}

interface AreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

export function TextArea({ label, error, id, ...rest }: AreaProps) {
  const inputId = id ?? `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </label>
      <textarea id={inputId} aria-invalid={!!error} className={clsx('input min-h-[84px] resize-y', error && 'border-coral/60')} {...rest} />
      {error && <p role="alert" className="text-xs text-coral">{error}</p>}
    </div>
  );
}

// ── Cards & layout ───────────────────────────────────────────────────────────

export function GlassCard({
  children,
  className,
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div className={clsx('glass rounded-3xl p-5', hover && 'card-hover', className)}>{children}</div>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-slate-400">{title}</h2>
      {action}
    </div>
  );
}

export function Alert({
  kind = 'info',
  children,
  className,
}: {
  kind?: 'info' | 'error' | 'success' | 'warning';
  children: ReactNode;
  className?: string;
}) {
  const styles = {
    info: 'border-electric-500/40 bg-electric-500/10 text-electric-200',
    error: 'border-coral/40 bg-coral/10 text-rose-200',
    success: 'border-mint/40 bg-mint/10 text-emerald-200',
    warning: 'border-amber/40 bg-amber/10 text-amber-200',
  } as const;
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={clsx('rounded-xl border px-4 py-3 text-sm', styles[kind], className)}>
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = 'blue',
}: {
  children: ReactNode;
  tone?: 'blue' | 'green' | 'amber' | 'rose' | 'violet' | 'slate';
}) {
  const tones = {
    blue: 'bg-electric-500/15 text-electric-300 border-electric-500/30',
    green: 'bg-mint/15 text-emerald-300 border-mint/30',
    amber: 'bg-amber/15 text-amber border-amber/30',
    rose: 'bg-coral/15 text-coral border-coral/30',
    violet: 'bg-violet/15 text-violet border-violet/30',
    slate: 'bg-white/10 text-slate-300 border-white/15',
  } as const;
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', tones[tone])}>
      {children}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center">
      <div className="text-electric-400/70">{icon}</div>
      <p className="font-semibold text-slate-200">{title}</p>
      <p className="max-w-sm text-sm text-slate-400">{body}</p>
      {action}
    </div>
  );
}
