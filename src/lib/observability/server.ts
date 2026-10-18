import 'server-only';

import { NextRequest, NextResponse } from 'next/server';

export type RequestContext = {
  requestId: string;
  route: string;
  startedAt: number;
};

type ResponseBody = Record<string, unknown>;

const REQUEST_ID_RE = /^[A-Za-z0-9_-]{8,120}$/;
const ALERT_COOLDOWN_MS = 5 * 60 * 1000;
const alertTimes = new Map<string, number>();

/** Preserve a valid gateway request id, otherwise issue one for support tracing. */
export function requestContext(req: NextRequest, route: string): RequestContext {
  const incoming = req.headers.get('x-request-id')?.trim();
  return {
    requestId: incoming && REQUEST_ID_RE.test(incoming) ? incoming : crypto.randomUUID(),
    route,
    startedAt: Date.now(),
  };
}

/** Every API route can return an opaque support id without exposing internals. */
export function apiJson(body: ResponseBody, context: RequestContext, init: ResponseInit = {}) {
  const response = NextResponse.json({ ...body, requestId: context.requestId }, init);
  response.headers.set('X-Request-ID', context.requestId);
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

/**
 * Structured server logs intentionally omit request bodies, auth tokens, API
 * keys, image content and raw user messages. They are safe to ship to Vercel,
 * Cloud Logging, Datadog, etc. through the platform's normal log drain.
 */
export function logApiEvent(
  level: 'info' | 'warn' | 'error',
  context: RequestContext,
  event: string,
  details: Record<string, string | number | boolean | undefined> = {},
) {
  const safeDetails = Object.fromEntries(Object.entries(details).filter(([, value]) => value !== undefined));
  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service: 'apexfit-ai',
    route: context.route,
    requestId: context.requestId,
    event,
    durationMs: Date.now() - context.startedAt,
    ...safeDetails,
  });
  if (level === 'error') console.error(payload);
  else if (level === 'warn') console.warn(payload);
  else console.info(payload);
}

/**
 * Optional generic incident webhook. Set APEXFIT_ALERT_WEBHOOK_URL in the
 * deployment environment to receive a compact alert after a new failure mode.
 * It is best-effort, rate-limited in each server instance, and never delays the
 * API response or includes health/identity/user-content data.
 */
export function notifyOperationalAlert(
  context: RequestContext,
  code: string,
  status: number,
) {
  const url = process.env.APEXFIT_ALERT_WEBHOOK_URL;
  if (!url) return;
  const key = `${context.route}:${code}`;
  const previous = alertTimes.get(key) ?? 0;
  if (Date.now() - previous < ALERT_COOLDOWN_MS) return;
  alertTimes.set(key, Date.now());

  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service: 'apexfit-ai',
      severity: status >= 500 ? 'error' : 'warning',
      route: context.route,
      code,
      requestId: context.requestId,
      occurredAt: new Date().toISOString(),
    }),
    signal: AbortSignal.timeout(3000),
  }).catch(() => undefined);
}

export function logApiFailure(
  context: RequestContext,
  code: string,
  status: number,
  details: Record<string, string | number | boolean | undefined> = {},
) {
  logApiEvent(status >= 500 ? 'error' : 'warn', context, 'request_failed', { code, status, ...details });
  if (status >= 500) notifyOperationalAlert(context, code, status);
}
