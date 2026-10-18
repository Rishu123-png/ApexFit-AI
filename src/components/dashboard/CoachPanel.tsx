'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { glassChat, type ChatMsg } from '@/lib/ai/client';
import { GlassCard, SectionTitle, Badge, Button } from '@/components/ui';
import { IconSparkles } from '@/components/icons';

export interface CoachContext {
  caloriesToday: number;
  proteinToday: number;
  waterMlToday: number;
  workoutsThisWeek: number;
  calorieTarget: number;
  proteinTarget: number;
  streakDays?: number;
}

const SUGGESTIONS = [
  'Suggest a high-protein vegetarian dinner',
  'How should I recover after leg day?',
  'Rate my hydration today',
  'Give me a 15-min morning routine',
];

export function CoachPanel({ context }: { context: CoachContext }) {
  const { getIdToken } = useAuth();
  const [messages, setMessages] = useState<(ChatMsg & { fallback?: boolean })[]>([
    {
      role: 'assistant',
      content:
        'I’m Apex Coach. I can see today’s training, nutrition and hydration summary. Ask me anything about workouts, Indian meal ideas, or recovery.',
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setError('');
    const history = messages.slice(-8).map(({ role, content }) => ({ role, content }));
    const next = [...messages, { role: 'user' as const, content: trimmed }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const token = await getIdToken();
      const res = await glassChat(token, trimmed, history, context);
      setMessages([...next, { role: 'assistant', content: res.reply, fallback: res.usedFallbackKey }]);
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (code === 'AUTH_NOT_CONFIGURED') {
        setError('The AI coach needs Firebase Admin credentials on the server (FIREBASE_ADMIN_*). See README → “Server secrets”.');
      } else if (code === 'GROQ_NOT_CONFIGURED') {
        setError('The AI coach needs GROQ_API_KEY_PRIMARY configured on the server (Vercel env or .env.local).');
      } else if (code === 'RATE_LIMITED') {
        setError('You’ve reached the current AI usage limit. Please try again later.');
      } else if (code === 'COACH_TIMEOUT') {
        setError('The coach took too long to respond. Please retry in a moment.');
      } else {
        setError('The coach is unavailable right now. Please try again in a moment.');
      }
      // Roll back the optimistic user message if the request failed hard
      setMessages(messages);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => listRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }));
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  return (
    <GlassCard hover>
      <SectionTitle
        title="AI coach"
        action={<Badge tone="violet"><IconSparkles width={11} /> Groq · server-side</Badge>}
      />
      <div
        ref={listRef}
        className="mb-3 flex max-h-[340px] flex-col gap-2.5 overflow-y-auto rounded-2xl border border-white/5 bg-black/20 p-3"
        aria-live="polite"
        aria-label="Coach conversation"
      >
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'self-end' : 'self-start'} style={{ maxWidth: '88%' }}>
            <div
              className={
                m.role === 'user'
                  ? 'rounded-2xl rounded-br-sm bg-gradient-to-r from-electric-600 to-electric-500 px-4 py-2.5 text-sm text-white'
                  : 'rounded-2xl rounded-bl-sm border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200'
              }
            >
              <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
            </div>
          </div>
        ))}
        {busy && (
          <div className="self-start rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-400">
            <span className="pulse-soft">Apex Coach is thinking…</span>
          </div>
        )}
      </div>

      {error && <p role="alert" className="mb-3 text-sm text-coral">{error}</p>}

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Suggested questions">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => void send(s)}
            disabled={busy}
            className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-electric-400/50 hover:text-electric-200 disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="flex gap-2">
        <label htmlFor="coach-input" className="sr-only">Message Apex Coach</label>
        <input
          id="coach-input"
          className="input flex-1"
          placeholder="Ask about training, food, recovery…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={500}
          disabled={busy}
        />
        <Button type="submit" glow loading={busy} disabled={busy || !input.trim()}>
          Send
        </Button>
      </form>
      <p className="mt-2 text-[11px] text-slate-500">
        Coaching is general guidance, not medical advice. Nutrition numbers may be estimates.
      </p>
    </GlassCard>
  );
}
