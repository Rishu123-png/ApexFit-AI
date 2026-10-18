'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app] unhandled route error', error.digest ?? error.message);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 text-center">
      <section className="glass w-full max-w-lg rounded-3xl p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-coral">Something went wrong</p>
        <h1 className="mt-3 text-2xl font-extrabold text-slate-100">ApexFit needs a retry</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          This screen hit an unexpected error. Your saved data is unchanged. Try the page again, or return to the dashboard.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button className="btn-glow rounded-xl bg-gradient-to-r from-electric-600 to-electric-500 px-4 py-2.5 text-sm font-semibold text-white" onClick={() => reset()}>
            Try again
          </button>
          <a className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200" href="/dashboard">
            Go to dashboard
          </a>
        </div>
        {error.digest && <p className="mt-5 text-[11px] text-slate-600">Error ID: {error.digest}</p>}
      </section>
    </main>
  );
}
