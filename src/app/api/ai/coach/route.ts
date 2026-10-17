import { NextRequest, NextResponse } from 'next/server';
import { verifyRequestUser, getUserAiContext, AdminNotConfiguredError, getAdminDb } from '@/lib/firebase/admin';
import { groqChat, GroqNotConfiguredError, GroqRequestError, type ChatMessage } from '@/lib/ai/groq';
import { checkRateLimit, clientIp } from '@/lib/ai/ratelimit';
import { recommendToday, describeRecommendation } from '@/lib/core/adaptive';
import { computeReadiness } from '@/lib/core/readiness';
import { buildExerciseTrends, suggestNextForExercise } from '@/lib/core/progression';
import { dayKeyInTz } from '@/lib/arena/periods';
import { daysAgoTs, dateKey, last7DayLabels } from '@/lib/dates';
import type { WorkoutSession } from '@/lib/types';
import type { RecoveryCheckinRecord } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_MESSAGE = 1000;
const MAX_HISTORY = 10;
// 20 AI messages per hour per user (per instance — see ratelimit.ts for scale-out notes)
const RL_LIMIT = 20;
const RL_WINDOW_MS = 60 * 60 * 1000;

interface Incoming {
  message: string;
  history: ChatMessage[];
  context: Record<string, number>;
}

/** Whitelist + clamp numeric context values from the client. Never trust anything else. */
const CONTEXT_KEYS = [
  'caloriesToday',
  'proteinToday',
  'waterMlToday',
  'workoutsThisWeek',
  'calorieTarget',
  'proteinTarget',
  'streakDays',
] as const;

function parseBody(raw: unknown): Incoming | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const b = raw as Record<string, unknown>;

  if (typeof b.message !== 'string' || b.message.trim().length === 0 || b.message.length > MAX_MESSAGE) return null;

  let history: ChatMessage[] = [];
  if (Array.isArray(b.history)) {
    history = b.history
      .slice(0, MAX_HISTORY)
      .filter(
        (m): m is ChatMessage =>
          typeof m === 'object' &&
          m !== null &&
          ((m as ChatMessage).role === 'user' || (m as ChatMessage).role === 'assistant') &&
          typeof (m as ChatMessage).content === 'string' &&
          (m as ChatMessage).content.length <= MAX_MESSAGE,
      );
  }

  const context: Record<string, number> = {};
  if (typeof b.context === 'object' && b.context !== null) {
    const c = b.context as Record<string, unknown>;
    for (const k of CONTEXT_KEYS) {
      const v = c[k];
      if (typeof v === 'number' && Number.isFinite(v)) context[k] = Math.max(0, Math.min(v, 100000));
    }
  }

  return { message: b.message.trim(), history, context };
}

const SYSTEM_PROMPT = `You are Apex Coach, the built-in coach of ApexFit AI, a fitness & nutrition app for Indian users.

Rules you must always follow:
- Give practical, safe, encouraging guidance. Use metric units and Indian food context where relevant.
- NEVER provide medical diagnoses, treatment for conditions, or advice for injuries beyond "rest and consult a professional".
- NEVER recommend dangerous training practices, extreme calorie restriction, dehydration, supplements dosing, or performance-enhancing drugs.
- When you give nutrition numbers, frame them as estimates unless the user supplied verified data.
- If the user describes pain, dizziness, or symptoms of illness, advise them to stop and consult a qualified professional.
- You may reference the user's Apex Arena level, verified XP and streaks to motivate them and suggest reasonable missions — but celebrate rest days too, and NEVER pressure the user to exercise on days when recovery is the right call.
- NEVER invent workouts, scores, ranks or achievements the user hasn't earned.
- When "Adaptive engine" or "Apex Readiness" context lines are present, treat them as authoritative constraints computed by deterministic rules: explain and personalize around them, but NEVER override or contradict their rest/light-day call, and never turn an estimate into a medical claim.
- Structure substantial answers as: Recommendation → Why (reasoning) → Confidence/limits → Next action → Safety note when the topic touches pain, food restriction, or fatigue.
- Keep answers concise (under 180 words unless a plan is requested). Use short paragraphs or bullets.`;

export async function POST(req: NextRequest) {
  // 1. Verify the caller's Firebase ID token → their own uid. Clients cannot
  //    impersonate another user: the uid comes solely from the verified token.
  let decoded;
  try {
    decoded = await verifyRequestUser(req);
  } catch (err) {
    if (err instanceof AdminNotConfiguredError) {
      return NextResponse.json(
        { error: 'AUTH_NOT_CONFIGURED', message: 'Server auth is not configured.' },
        { status: 503 },
      );
    }
    throw err;
  }
  if (!decoded) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }
  const uid = decoded.uid;

  // 2. Rate limits: per-IP cost bucket + per verified user bucket (spec §10).
  const rlIp = await checkRateLimit(`coach:ip:${clientIp(req)}`, 200, RL_WINDOW_MS);
  if (!rlIp.ok) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', retryAfterSec: rlIp.retryAfterSec },
      { status: 429, headers: { 'Retry-After': String(rlIp.retryAfterSec) } },
    );
  }
  const rl = await checkRateLimit(`coach:${uid}`, RL_LIMIT, RL_WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    );
  }

  // 3. Validate input.
  let body: Incoming | null = null;
  try {
    body = parseBody(await req.json());
  } catch {
    body = null;
  }
  if (!body) {
    return NextResponse.json({ error: 'BAD_REQUEST', message: 'Invalid message payload.' }, { status: 400 });
  }

  // 4. Build context from server-trusted profile data + whitelisted client summary.
  const profile = await getUserAiContext(uid);
  const contextLines: string[] = [];
  if (body.context.caloriesToday !== undefined)
    contextLines.push(`Calories eaten today: ${body.context.caloriesToday} kcal (target ${body.context.calorieTarget ?? 'unknown'})`);
  if (body.context.proteinToday !== undefined)
    contextLines.push(`Protein today: ${body.context.proteinToday} g (target ${body.context.proteinTarget ?? 'unknown'})`);
  if (body.context.waterMlToday !== undefined)
    contextLines.push(`Water today: ${body.context.waterMlToday} ml`);
  if (body.context.workoutsThisWeek !== undefined)
    contextLines.push(`Workouts in last 7 days: ${body.context.workoutsThisWeek}`);

  const prof = profile?.profile as { displayName?: unknown; goal?: unknown; experience?: unknown; dietaryPreference?: unknown } | null;
  if (prof) {
    if (typeof prof.displayName === 'string') contextLines.push(`User name: ${prof.displayName.split(' ')[0]}`);
    if (typeof prof.goal === 'string') contextLines.push(`Goal: ${prof.goal}`);
    if (typeof prof.experience === 'string') contextLines.push(`Experience level: ${prof.experience}`);
    if (typeof prof.dietaryPreference === 'string') contextLines.push(`Dietary preference: ${prof.dietaryPreference}`);
  }
  // Server-trusted Arena snapshot (verified award history, not client-supplied)
  if (profile?.arena && typeof profile.arena.level === 'number') {
    contextLines.push(`Apex Arena: Level ${profile.arena.level}, ${profile.arena.xp} lifetime XP (verified)`);
  }
  if (body.context.streakDays !== undefined && body.context.streakDays > 0)
    contextLines.push(`Current consistency streak: ${body.context.streakDays} day(s)`);

  // Deterministic adaptive guidance — computed from the user's own sealed
  // workout records on the server (the LLM may explain, never override it).
  try {
    const q = await getAdminDb()
      .ref(`users/${uid}/workouts`)
      .orderByChild('startedAt')
      .startAt(daysAgoTs(6))
      .limitToLast(100)
      .get();
    const tz = 'Asia/Kolkata';
    const recent = q.exists()
      ? Object.values(q.val() as Record<string, WorkoutSession>)
          .filter((s) => s.verified === true) // plausibility-checked, not self-reported
          .map((s) => ({ dayKey: dayKeyInTz(new Date(s.startedAt), tz), durationSec: s.serverDurationSec ?? s.durationSec, planId: s.planId }))
      : [];
    const experience =
      prof && (prof.experience === 'intermediate' || prof.experience === 'advanced') ? prof.experience : 'beginner';
    const rec = recommendToday({ experience, todayKey: dayKeyInTz(new Date(), tz), recent });
    contextLines.push(describeRecommendation(rec));

    // Readiness estimate (deterministic; missing inputs stated, never guessed high)
    const all7 = q.exists() ? Object.values(q.val() as Record<string, WorkoutSession>) : [];
    const days = last7DayLabels();
    const mins = new Map<string, number>(days.map((d) => [d.key, 0]));
    for (const s of all7) {
      const k = dateKey(new Date(s.startedAt));
      mins.set(k, (mins.get(k) ?? 0) + (s.durationSec ?? 0) / 60);
    }
    const checkinSnap = await getAdminDb().ref(`users/${uid}/checkins/${dateKey()}`).get();
    const checkin = (checkinSnap.exists() ? checkinSnap.val() : null) as RecoveryCheckinRecord | null;
    const streakDays = typeof body.context.streakDays === 'number' ? body.context.streakDays : 0;
    const ready = computeReadiness({
      minutes7d: days.map((d) => mins.get(d.key) ?? 0),
      streakDays,
      checkin: checkin
        ? { sleepHrs: checkin.sleepHrs, energy: checkin.energy, soreness: checkin.soreness }
        : null,
    });
    contextLines.push(
      `Apex Readiness (estimate, ${ready.missingSubjectiveInputs} subjective inputs missing): ${ready.score}/100 [${ready.band}] → ${ready.recommendation}. ${ready.summary}`,
    );

    // One bounded progression suggestion (deterministic; only with enough history)
    const trends = buildExerciseTrends(
      all7
        .slice(-20)
        .map((s) => ({ dayKey: dateKey(new Date(s.startedAt)), exercises: s.exercises ?? [] })),
    );
    for (const [exerciseId, pts] of trends) {
      const suggestion = suggestNextForExercise(exerciseId, pts);
      if (suggestion && suggestion.deltaSets !== 0) {
        contextLines.push(
          `Progression suggestion (deterministic, sets-only): ${exerciseId.replace(/-/g, ' ')} → ${suggestion.nextTargetSets} sets next (${suggestion.deltaSets > 0 ? 'step up' : 'easier deload'}). ${suggestion.rationale}`,
        );
        break; // one suggestion max — keep the prompt lean
      }
    }
  } catch {
    contextLines.push('Adaptive engine: unavailable right now — default to conservative advice.');
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'system',
      content: `Current user snapshot (from their own records):\n${contextLines.join('\n') || 'No activity data yet.'}`,
    },
    ...body.history,
    { role: 'user', content: body.message },
  ];

  // 5. Call Groq server-side with primary → fallback key handling.
  try {
    const result = await groqChat(messages);
    return NextResponse.json({
      reply: result.content,
      model: result.model,
      usedFallbackKey: result.usedFallbackKey,
    });
  } catch (err) {
    if (err instanceof GroqNotConfiguredError) {
      return NextResponse.json(
        { error: 'GROQ_NOT_CONFIGURED', message: 'AI service keys are not configured on the server.' },
        { status: 503 },
      );
    }
    // Log only the failure mode — no keys, no user content.
    console.error(
      '[coach] Groq request failed:',
      err instanceof GroqRequestError ? `HTTP ${err.status ?? 'network/timeout'}` : 'unexpected error',
    );
    return NextResponse.json({ error: 'AI_UNAVAILABLE' }, { status: 502 });
  }
}
