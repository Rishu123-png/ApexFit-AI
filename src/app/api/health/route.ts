import { NextRequest } from 'next/server';
import { apiJson, logApiFailure, requestContext } from '@/lib/observability/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const present = (name: string) => Boolean(process.env[name]?.trim());

/**
 * Safe deployment health endpoint. It reports configuration presence only —
 * never values, keys, URLs, user counts, or private data.
 */
export async function GET(req: NextRequest) {
  const trace = requestContext(req, 'GET /api/health');
  const checks = {
    firebaseClient: [
      'NEXT_PUBLIC_FIREBASE_API_KEY',
      'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
      'NEXT_PUBLIC_FIREBASE_DATABASE_URL',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      'NEXT_PUBLIC_FIREBASE_APP_ID',
    ].every(present),
    firebaseAdmin: [
      'FIREBASE_ADMIN_PROJECT_ID',
      'FIREBASE_ADMIN_CLIENT_EMAIL',
      'FIREBASE_ADMIN_PRIVATE_KEY',
    ].every(present),
    groq: present('GROQ_API_KEY_PRIMARY') || present('GROQ_API_KEY_SECONDARY'),
    vision: process.env.GROQ_VISION_ENABLED === 'true',
    distributedRateLimit: present('UPSTASH_REDIS_REST_URL') && present('UPSTASH_REDIS_REST_TOKEN'),
    alertWebhook: present('APEXFIT_ALERT_WEBHOOK_URL'),
  };

  const coreReady = checks.firebaseClient && checks.firebaseAdmin;
  if (!coreReady) logApiFailure(trace, 'CORE_CONFIGURATION_MISSING', 503);
  return apiJson(
    {
      status: coreReady ? 'ok' : 'degraded',
      service: 'apexfit-ai',
      timestamp: new Date().toISOString(),
      checks,
    },
    trace,
    { status: coreReady ? 200 : 503 },
  );
}
