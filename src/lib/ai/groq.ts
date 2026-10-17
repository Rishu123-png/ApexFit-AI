import 'server-only';

/**
 * Groq service — server-side only, unified for chat + vision.
 *
 * Guarantees:
 *  - keys read ONLY from server env (never sent to the browser)
 *  - primary key tried first; secondary used ONLY for retryable failures
 *    (auth 401/403, rate-limit 429, upstream 5xx, network/timeout) — a 400
 *    program error is never retried against the fallback key
 *  - model output is validated and normalized before use
 *  - nothing about keys appears in logs or error responses
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const TEXT_MODEL = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
const VISION_MODEL = process.env.GROQ_VISION_MODEL ?? 'meta-llama/llama-4-scout-17b-16e-instruct';
const TIMEOUT_MS = 15_000;
const MAX_OUTPUT_CHARS = 6000;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface VisionContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

interface VisionMessage {
  role: 'user' | 'system';
  content: VisionContentPart[];
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

/** Retryable: auth failure, rate limit, upstream 5xx, network/timeout (no status). */
export function isRetryable(err: unknown): boolean {
  if (err instanceof GroqRequestError) {
    if (!err.status) return true;
    return err.status === 401 || err.status === 403 || err.status === 429 || err.status >= 500;
  }
  return true; // timeouts / network errors
}

/** Validate + normalize raw model output before it is used anywhere. */
export function normalizeModelOutput(content: unknown): string {
  if (typeof content !== 'string') throw new GroqRequestError('Groq returned a non-text payload');
  // strip control chars (keep \n\t), trim, clamp to a sane length
  const cleaned = content.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (cleaned.length === 0) throw new GroqRequestError('Groq returned an empty payload');
  return cleaned.slice(0, MAX_OUTPUT_CHARS);
}

async function callOnce(
  apiKey: string,
  body: Record<string, unknown>,
): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    // Deliberately discard upstream body — it can echo request metadata.
    throw new GroqRequestError('Groq request failed', res.status);
  }

  const data: unknown = await res.json();
  const content =
    typeof data === 'object' && data !== null
      ? (data as { choices?: { message?: { content?: unknown } }[] }).choices?.[0]?.message?.content
      : undefined;
  return normalizeModelOutput(content);
}

/** Run a request against primary, falling back to secondary on retryable errors only. */
async function withKeyFailover(body: Record<string, unknown>): Promise<{ content: string; usedFallbackKey: boolean }> {
  const primary = process.env.GROQ_API_KEY_PRIMARY;
  const secondary = process.env.GROQ_API_KEY_SECONDARY;
  if (!primary && !secondary) throw new GroqNotConfiguredError();

  if (primary) {
    try {
      return { content: await callOnce(primary, body), usedFallbackKey: false };
    } catch (err) {
      if (!isRetryable(err) || !secondary) throw err;
      // Log failure mode only — never keys, request bodies or user content.
      console.warn(
        '[groq] primary key failed:',
        err instanceof GroqRequestError ? `HTTP ${err.status ?? 'network/timeout'}` : 'unexpected error',
        '— retrying with secondary key',
      );
    }
  }
  return { content: await callOnce(secondary as string, body), usedFallbackKey: true };
}

export interface GroqResult {
  content: string;
  model: string;
  usedFallbackKey: boolean;
}

export async function groqChat(messages: ChatMessage[], opts: { model?: string } = {}): Promise<GroqResult> {
  const model = opts.model ?? TEXT_MODEL;
  const { content, usedFallbackKey } = await withKeyFailover({
    model,
    messages,
    temperature: 0.6,
    max_tokens: 700,
  });
  return { content, model, usedFallbackKey };
}

/** Vision: one image (data URL) + a text prompt. Returns validated raw text. */
export async function groqVision(
  imageDataUrl: string,
  prompt: string,
  opts: { model?: string; maxTokens?: number } = {},
): Promise<GroqResult> {
  const model = opts.model ?? VISION_MODEL;
  const messages: VisionMessage[] = [
    {
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: imageDataUrl } },
      ],
    },
  ];
  const { content, usedFallbackKey } = await withKeyFailover({
    model,
    messages: messages as unknown as Record<string, unknown>[],
    temperature: 0.2,
    max_tokens: opts.maxTokens ?? 900,
  });
  return { content, model, usedFallbackKey };
}
