import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const present = (name: string) => Boolean(process.env[name]?.trim());

export async function GET() {
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
  };

  const coreReady = checks.firebaseClient && checks.firebaseAdmin;
  const response = NextResponse.json(
    {
      status: coreReady ? 'ok' : 'degraded',
      service: 'apexfit-ai',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: coreReady ? 200 : 503 },
  );
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}
