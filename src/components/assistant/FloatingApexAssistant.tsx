'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { glassChat, type ChatMsg } from '@/lib/ai/client';
import { IconMessage, IconSend, IconSparkles, IconX } from '@/components/icons';

const STARTERS = [
  'Build me a beginner workout for today',
  'Suggest a high-protein Indian dinner',
  'How should I recover after leg day?',
];

function readableCoachError(code: string) {
  if (code === 'AUTH_NOT_CONFIGURED') return 'Coach setup is incomplete: add FIREBASE_ADMIN_* secrets in Vercel, then redeploy.';
  if (code === 'GROQ_NOT_CONFIGURED') return 'Coach setup is incomplete: add GROQ_API_KEY_PRIMARY in Vercel, then redeploy.';
  if (code === 'RATE_LIMITED') return 'You have reached the current coach limit. Please try again later.';
  if (code === 'COACH_TIMEOUT') return 'The coach took too long to respond. Please retry.';
  return 'The coach is temporarily unavailable. Check your connection and retry.';
}

/**
 * Visible on every signed-in screen. It uses server-authenticated context; no
 * API key or private user data is exposed in the browser. The compact button
 * is deliberately separate from any page content, so assistance is discoverable.
 */
export function FloatingApexAssistant() {
  const { getIdToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: 'assistant', content: 'Hi, I’m Apex Coach. Ask about today’s workout, food, recovery, or getting started.' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const openCoach = () => setOpen(true);
    window.addEventListener('apexfit:open-coach', openCoach);
    return () => window.removeEventListener('apexfit:open-coach', openCoach);
  }, []);

  async function send(raw: string) {
    const message = raw.trim();
    if (!message || busy) return;
    const previous = messages;
    const history = previous.slice(-8);
    const next = [...previous, { role: 'user' as const, content: message }];
    setMessages(next);
    setInput('');
    setBusy(true);
    setError('');
    try {
      const token = await getIdToken();
      // The server constructs trusted profile/workout context itself. Supplying
      // no client metrics avoids stale dashboard values on non-dashboard pages.
      const result = await glassChat(token, message, history, {});
      setMessages([...next, { role: 'assistant', content: result.reply }]);
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      setMessages(previous);
      setError(readableCoachError(code));
    } finally {
      setBusy(false);
      requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }));
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void send(input);
  }

  return (
    <div className="fixed bottom-[5.7rem] right-4 z-[60] sm:bottom-5 sm:right-5">
      <AnimatePresence initial={false}>
        {open && (
          <motion.section
            initial={reducedMotion ? false : { opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: 12, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            id="apex-coach-panel"
            className="mb-3 flex w-[min(25rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[1.6rem] border border-violet/30 bg-[#0b0e1d]/95 shadow-[0_24px_80px_rgba(0,0,0,0.52),0_0_40px_rgba(139,92,246,0.12)] backdrop-blur-2xl"
            aria-label="Apex Coach assistant"
          >
            <header className="flex items-center gap-3 border-b border-white/8 bg-[linear-gradient(110deg,rgba(79,47,132,0.38),rgba(16,28,58,0.2))] px-4 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl border border-violet/40 bg-violet/15 text-violet-200 shadow-[0_0_16px_rgba(139,92,246,0.3)]"><IconSparkles width={17} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-white">Apex Coach</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-200">Your fitness copilot</p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-xl p-2 text-slate-400 transition hover:bg-white/8 hover:text-white" aria-label="Close Apex Coach"><IconX width={17} /></button>
            </header>

            <div ref={listRef} className="max-h-[min(23rem,55vh)] min-h-40 space-y-2.5 overflow-y-auto p-3" aria-live="polite">
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={message.role === 'user' ? 'ml-8 flex justify-end' : 'mr-8 flex justify-start'}>
                  <p className={message.role === 'user' ? 'rounded-2xl rounded-br-sm bg-gradient-to-r from-electric-600 to-electric-500 px-3.5 py-2.5 text-sm leading-relaxed text-white' : 'rounded-2xl rounded-bl-sm border border-white/10 bg-white/[0.055] px-3.5 py-2.5 text-sm leading-relaxed text-slate-200'}>
                    {message.content}
                  </p>
                </div>
              ))}
              {busy && <p className="mr-8 inline-block rounded-2xl rounded-bl-sm border border-white/10 bg-white/[0.055] px-3.5 py-2.5 text-sm text-slate-400"><span className="pulse-soft">Apex Coach is thinking…</span></p>}
            </div>

            {error && <p role="alert" className="mx-3 mb-2 rounded-xl border border-coral/30 bg-coral/10 px-3 py-2 text-xs leading-relaxed text-coral">{error}</p>}
            <div className="flex gap-1.5 overflow-x-auto px-3 pb-3">
              {STARTERS.map((starter) => <button key={starter} onClick={() => void send(starter)} disabled={busy} className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 transition hover:border-electric-400/50 hover:text-electric-200 disabled:opacity-50">{starter}</button>)}
            </div>
            <form onSubmit={submit} className="flex gap-2 border-t border-white/8 p-3">
              <label className="sr-only" htmlFor="floating-coach-input">Message Apex Coach</label>
              <input id="floating-coach-input" value={input} onChange={(event) => setInput(event.target.value)} disabled={busy} maxLength={1000} className="input min-w-0 flex-1 px-3 py-2.5 text-sm" placeholder="Ask anything…" />
              <button type="submit" disabled={busy || !input.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-electric-500 text-white shadow-[0_0_18px_rgba(47,139,255,0.35)] transition hover:bg-electric-400 disabled:opacity-40" aria-label="Send message"><IconSend width={17} /></button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
      <motion.button
        onClick={() => setOpen((value) => !value)}
        whileHover={reducedMotion ? undefined : { y: -2, scale: 1.03 }}
        whileTap={reducedMotion ? undefined : { scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 420, damping: 24 }}
        className="group flex h-14 items-center gap-2 rounded-full border border-violet/45 bg-[linear-gradient(135deg,#3e2375,#192f68)] px-4 text-white shadow-[0_12px_32px_rgba(0,0,0,0.36),0_0_30px_rgba(139,92,246,0.22)]"
        aria-expanded={open}
        aria-controls="apex-coach-panel"
      >
        <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-violet-100"><span className="absolute inset-0 rounded-full bg-violet/40 blur-md group-hover:blur-lg" aria-hidden="true" /><IconMessage width={17} className="relative" /></span>
        <span className="text-sm font-black">Ask Apex</span>
      </motion.button>
    </div>
  );
}
