'use client';

/** Browser-side helper that talks to our own server route. Keys never leave the server. */

export interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

export interface CoachReply {
  reply: string;
  model: string;
  usedFallbackKey: boolean;
}

const COACH_REQUEST_TIMEOUT_MS = 35_000;

export async function glassChat(
  idToken: string,
  message: string,
  history: ChatMsg[],
  context: object,
): Promise<CoachReply> {
  let res: Response;
  try {
    res = await fetch('/api/ai/coach', {
      // Firebase Admin reads plus primary→fallback Groq can take time, but the
      // screen must never remain in a permanent "thinking" state.
      signal: AbortSignal.timeout(COACH_REQUEST_TIMEOUT_MS),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ message, history, context }),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new Error('COACH_TIMEOUT');
    }
    throw err;
  }

  const data = (await res.json().catch(() => ({}))) as Partial<CoachReply> & { error?: string };
  if (!res.ok || typeof data.reply !== 'string') {
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return { reply: data.reply, model: data.model ?? 'unknown', usedFallbackKey: !!data.usedFallbackKey };
}
