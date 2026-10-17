import 'server-only';

/**
 * Groq chat completions — server-side only.
 *
 * Keys are read exclusively from server env vars (GROQ_API_KEY_PRIMARY /
 * GROQ_API_KEY_SECONDARY) and are never sent to the browser. If the primary
 * key fails with a retryable error (auth, rate-limit, server or network), the
 * request is retried once with the secondary key.
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
const TIMEOUT_MS = 15_000;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class GroqNotConfiguredError extends Error {
  readonly code = 'GROQ_NOT_CONFIGURED';
  constructor() {
    super('Groq API keys are not configured on the server.');
  }
}

export class GroqRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

async function callOnce(apiKey: string, messages: ChatMessage[]): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.6,
      max_tokens: 700,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    // Deliberately discard the body — upstream error text can contain request
    // metadata; we log only the status code.
    throw new GroqRequestError('Groq request failed', res.status);
  }

  const data: unknown = await res.json();
  const content =
    typeof data === 'object' && data !== null
      ? (data as { choices?: { message?: { content?: unknown } }[] }).choices?.[0]?.message
          ?.content
      : undefined;

  if (typeof content !== 'string' || content.length === 0) {
    throw new GroqRequestError('Groq returned an unexpected payload');
  }
  return content.trim();
}

/** Retryable: auth failure, rate limit, upstream 5xx, or network/timeout (no status). */
function isRetryable(err: unknown): boolean {
  if (err instanceof GroqRequestError) {
    if (!err.status) return true;
    return err.status === 401 || err.status === 403 || err.status === 429 || err.status >= 500;
  }
  return true; // timeouts / network errors
}

export interface GroqResult {
  content: string;
  model: string;
  usedFallbackKey: boolean;
}

export async function groqChat(messages: ChatMessage[]): Promise<GroqResult> {
  const primary = process.env.GROQ_API_KEY_PRIMARY;
  const secondary = process.env.GROQ_API_KEY_SECONDARY;

  if (!primary && !secondary) throw new GroqNotConfiguredError();

  if (primary) {
    try {
      const content = await callOnce(primary, messages);
      return { content, model: MODEL, usedFallbackKey: false };
    } catch (err) {
      if (!isRetryable(err) || !secondary) throw err;
      // Log failure mode only — never the key, request body or user content.
      console.warn(
        '[groq] primary key failed:',
        err instanceof GroqRequestError ? `HTTP ${err.status ?? 'network/timeout'}` : 'unexpected error',
        '— retrying with secondary key',
      );
    }
  }

  const content = await callOnce(secondary as string, messages);
  return { content, model: MODEL, usedFallbackKey: true };
}
