import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 text-center">
      <section className="glass w-full max-w-lg rounded-3xl p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-electric-300">404</p>
        <h1 className="mt-3 text-2xl font-extrabold text-slate-100">That page does not exist</h1>
        <p className="mt-3 text-sm text-slate-400">The link may be outdated, or the page may have moved.</p>
        <Link className="mt-6 inline-flex rounded-xl bg-electric-600 px-4 py-2.5 text-sm font-semibold text-white" href="/">Return home</Link>
      </section>
    </main>
  );
}
