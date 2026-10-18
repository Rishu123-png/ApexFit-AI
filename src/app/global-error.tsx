'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="bg-[#04060e] text-slate-100">
        <main className="flex min-h-dvh items-center justify-center px-4 text-center">
          <section className="max-w-lg rounded-3xl border border-white/10 bg-white/[0.04] p-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-coral">ApexFit unavailable</p>
            <h1 className="mt-3 text-2xl font-extrabold">Please reload the app</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">A critical page error occurred. Reloading is safe and does not delete your fitness data.</p>
            <button className="mt-6 rounded-xl bg-electric-600 px-4 py-2.5 text-sm font-semibold text-white" onClick={() => reset()}>Reload</button>
          </section>
        </main>
      </body>
    </html>
  );
}
