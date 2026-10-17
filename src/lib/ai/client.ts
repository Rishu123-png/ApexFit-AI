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

export async function glassChat(
  idToken: string,
  message: string,
  history: ChatMsg[],
  context: object,
): Promise<CoachReply> {
  const res = await fetch('/api/ai/coach', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ message, history, context }),
  });

  const data = (await res.json().catch(() => ({}))) as Partial<CoachReply> & { error?: string };

  if (!res.ok || typeof data.reply !== 'string') {
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return { reply: data.reply, model: data.model ?? 'unknown', usedFallbackKey: !!data.usedFallbackKey };
}
