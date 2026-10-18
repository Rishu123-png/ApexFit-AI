'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { Exercise } from '@/lib/types';
import { IconInfo } from '@/components/icons';

type GuideKind = 'squat' | 'push' | 'bridge' | 'plank' | 'lunge' | 'mobility';

function kindFor(exerciseId: string): GuideKind {
  if (exerciseId.includes('squat')) return 'squat';
  if (exerciseId.includes('push') || exerciseId.includes('press') || exerciseId.includes('burpee')) return 'push';
  if (exerciseId.includes('bridge') || exerciseId.includes('dead-bug')) return 'bridge';
  if (exerciseId.includes('plank') || exerciseId.includes('climber')) return 'plank';
  if (exerciseId.includes('lunge') || exerciseId.includes('skater')) return 'lunge';
  return 'mobility';
}

const loop = { duration: 2.6, repeat: Infinity, repeatType: 'mirror' as const, ease: 'easeInOut' as const };

type TeachingCue = { start: string; move: string; finish: string; avoid: string };

function teachingFor(exercise: Exercise, kind: GuideKind): TeachingCue {
  const byExercise: Record<string, TeachingCue> = {
    'knee-pushup': { start: 'Hands below shoulders; head, hips and knees in one line.', move: 'Lower chest with elbows about 45° from your body.', finish: 'Press the floor away without dropping your hips.', avoid: 'Do not flare elbows wide or let the lower back sag.' },
    'db-floor-press': { start: 'Lie steady with both feet planted and dumbbells above chest.', move: 'Lower under control until triceps gently meet the floor.', finish: 'Press up smoothly; keep wrists stacked over elbows.', avoid: 'Do not bounce off the floor or force a painful range.' },
    'db-rdl': { start: 'Soft knees; dumbbells close to thighs; ribs gently down.', move: 'Send hips back while the weights slide close to your legs.', finish: 'Drive hips forward and stand tall without leaning back.', avoid: 'Do not round your back or turn it into a deep squat.' },
    'one-arm-row': { start: 'Brace one hand; make a long, neutral spine.', move: 'Pull elbow toward your hip, keeping shoulders level.', finish: 'Lower slowly until the arm is long again.', avoid: 'Do not twist the torso to lift the weight.' },
    'db-shoulder-press': { start: 'Sit tall with dumbbells at shoulder height.', move: 'Press up in a comfortable path while keeping ribs down.', finish: 'Return slowly to shoulder height.', avoid: 'Do not lean back or force a painful overhead range.' },
    'bird-dog': { start: 'Set hands below shoulders and knees below hips.', move: 'Reach opposite arm and leg long, keeping hips level.', finish: 'Return with control, then switch sides.', avoid: 'Do not rotate or let the lower back dip.' },
    'dead-bug': { start: 'Lie on your back with arms up and knees bent at 90°.', move: 'Reach opposite arm and leg away slowly.', finish: 'Return before your lower back lifts from the floor.', avoid: 'Do not rush or arch your lower back.' },
    'cat-cow': { start: 'Begin on all fours with a relaxed neck.', move: 'Move slowly from a gentle arch to a gentle round.', finish: 'Breathe once, then repeat at an easy pace.', avoid: 'Do not force your neck or push into pain.' },
  };
  if (byExercise[exercise.id]) return byExercise[exercise.id];
  if (kind === 'squat') return { start: 'Stand tall with feet about shoulder-width and chest comfortable.', move: 'Send hips back and bend knees over the line of your toes.', finish: 'Press through mid-foot to stand tall.', avoid: 'Do not let knees collapse inward or lift the heels.' };
  if (kind === 'lunge') return { start: 'Set a long, stable stance and keep your torso tall.', move: 'Lower straight down with control and a soft front knee.', finish: 'Press through the front foot to return.', avoid: 'Do not rush the landing or let the front knee collapse inward.' };
  if (kind === 'bridge') return { start: 'Lie down with knees bent and feet flat, hip-width apart.', move: 'Press through heels and lift hips comfortably.', finish: 'Lower with control and keep ribs relaxed.', avoid: 'Do not over-arch the lower back.' };
  if (kind === 'plank') return { start: 'Set elbows or hands below shoulders and brace gently.', move: 'Hold a long line while breathing steadily.', finish: 'Rest before alignment breaks down.', avoid: 'Do not hold through lower-back or shoulder pain.' };
  if (kind === 'push') return { start: 'Set a stable brace before you begin.', move: 'Use a slow, controlled range that feels comfortable.', finish: 'Return to a strong, balanced position.', avoid: 'Do not trade control for speed.' };
  return { start: exercise.instructions[0] ?? 'Set a stable, comfortable starting position.', move: exercise.instructions[1] ?? 'Move slowly and with control.', finish: exercise.instructions[2] ?? 'Return to the start position.', avoid: 'Do not force range, speed, or any painful movement.' };
}

/** Lightweight local SVG movement guide. It deliberately illustrates a motion
 * rather than pretending to be a video coach or a clinical form assessment. */
export function ExerciseMotionGuide({ exercise }: { exercise: Exercise }) {
  const reducedMotion = useReducedMotion();
  const kind = kindFor(exercise.id);
  const teaching = teachingFor(exercise, kind);
  const animate = reducedMotion ? undefined : loop;
  const phaseLabel = kind === 'squat' || kind === 'lunge' ? 'Stand → lower → stand' : kind === 'push' || kind === 'plank' ? 'Brace → move slowly → return' : 'Set position → move gently → return';

  return (
    <div className="relative overflow-hidden rounded-2xl border border-electric-500/20 bg-[radial-gradient(circle_at_72%_24%,rgba(34,224,255,0.13),transparent_34%),linear-gradient(145deg,rgba(10,20,44,0.92),rgba(5,9,19,0.9))] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-electric-300">Learn this movement</span>
        <span className="rounded-full border border-neon/20 bg-neon/5 px-2 py-1 text-[10px] font-semibold text-neon">Watch → practise → start</span>
      </div>
      <div className="mb-2 rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-center text-xs font-bold text-slate-200">{phaseLabel}</div>
      <svg viewBox="0 0 220 120" className="h-36 w-full sm:h-40" role="img" aria-label={`Illustrated movement guide for ${exercise.name}`}>
        <defs>
          <linearGradient id="guide-line" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#22e0ff" /><stop offset="1" stopColor="#2f8bff" /></linearGradient>
          <filter id="guide-glow"><feGaussianBlur stdDeviation="2" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <path d="M18 102H202" stroke="rgba(148,163,184,.28)" strokeWidth="2" strokeLinecap="round" />
        <path d="M26 94H194" stroke="rgba(34,224,255,.1)" strokeDasharray="4 6" />

        {kind === 'squat' && (
          <motion.g animate={reducedMotion ? undefined : { y: [0, 17, 0] }} transition={animate} filter="url(#guide-glow)">
            <circle cx="109" cy="25" r="10" fill="none" stroke="url(#guide-line)" strokeWidth="4" />
            <path d="M109 36L109 66M109 47L82 60M109 47L136 60M109 66L85 92M109 66L135 92" fill="none" stroke="url(#guide-line)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M83 92h-12M135 92h13" stroke="#a5d8ff" strokeWidth="5" strokeLinecap="round" />
          </motion.g>
        )}
        {kind === 'push' && (
          <motion.g animate={reducedMotion ? undefined : { y: [0, 12, 0] }} transition={animate} filter="url(#guide-glow)">
            <circle cx="70" cy="53" r="9" fill="none" stroke="url(#guide-line)" strokeWidth="4" />
            <path d="M79 58L119 69L155 89M91 62L82 90M94 64L107 92M119 69L142 96" fill="none" stroke="url(#guide-line)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M72 92h18M100 94h15M136 98h17" stroke="#a5d8ff" strokeWidth="4" strokeLinecap="round" />
          </motion.g>
        )}
        {kind === 'bridge' && (
          <motion.g animate={reducedMotion ? undefined : { y: [8, -8, 8] }} transition={animate} filter="url(#guide-glow)">
            <circle cx="57" cy="82" r="9" fill="none" stroke="url(#guide-line)" strokeWidth="4" />
            <path d="M66 80L100 66L133 77M100 66L126 96M133 77L157 96M89 72L80 96" fill="none" stroke="url(#guide-line)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M69 97h18M120 98h14M151 98h14" stroke="#a5d8ff" strokeWidth="4" strokeLinecap="round" />
          </motion.g>
        )}
        {kind === 'plank' && (
          <motion.g animate={reducedMotion ? undefined : { x: [0, 5, 0] }} transition={animate} filter="url(#guide-glow)">
            <circle cx="61" cy="60" r="9" fill="none" stroke="url(#guide-line)" strokeWidth="4" />
            <path d="M71 63L119 68L160 83M93 66L84 94M103 67L113 94M119 68L145 96" fill="none" stroke="url(#guide-line)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M75 96h17M105 96h17M139 98h18" stroke="#a5d8ff" strokeWidth="4" strokeLinecap="round" />
          </motion.g>
        )}
        {kind === 'lunge' && (
          <motion.g animate={reducedMotion ? undefined : { y: [0, 14, 0] }} transition={animate} filter="url(#guide-glow)">
            <circle cx="105" cy="25" r="10" fill="none" stroke="url(#guide-line)" strokeWidth="4" />
            <path d="M105 36L105 66M105 47L81 59M105 47L129 59M105 66L77 92M105 66L143 92" fill="none" stroke="url(#guide-line)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M67 93h20M137 93h19" stroke="#a5d8ff" strokeWidth="5" strokeLinecap="round" />
          </motion.g>
        )}
        {kind === 'mobility' && (
          <motion.g animate={reducedMotion ? undefined : { rotate: [-8, 8, -8] }} transition={animate} style={{ transformOrigin: '110px 65px' }} filter="url(#guide-glow)">
            <circle cx="110" cy="24" r="10" fill="none" stroke="url(#guide-line)" strokeWidth="4" />
            <path d="M110 35L110 68M110 47L78 38M110 47L142 38M110 68L88 96M110 68L132 96" fill="none" stroke="url(#guide-line)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M79 97h17M124 97h17" stroke="#a5d8ff" strokeWidth="4" strokeLinecap="round" />
          </motion.g>
        )}
      </svg>
      <div className="mt-2 grid gap-2 sm:grid-cols-3" aria-label="Movement teaching sequence">
        {([
          ['Start', teaching.start],
          ['Move', teaching.move],
          ['Finish', teaching.finish],
        ] as const).map(([label, cue], index) => (
          <div key={label} className="relative rounded-xl border border-white/8 bg-white/[.035] p-2.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-electric-500/20 text-[10px] font-black text-electric-200">{index + 1}</span>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[.13em] text-electric-300">{label}{index < 2 && <span className="ml-1.5 text-slate-500">→</span>}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{cue}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 rounded-xl border border-coral/20 bg-coral/[.045] px-3 py-2 text-[11px] leading-relaxed text-rose-100"><b>Common mistake to avoid:</b> {teaching.avoid}</p>
      {exercise.substitution && <p className="mt-2 rounded-xl border border-amber/20 bg-amber/5 px-3 py-2 text-[11px] leading-relaxed text-amber-100"><b>Make it easier:</b> {exercise.substitution}</p>}
      <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400"><IconInfo width={13} className="mt-0.5 shrink-0 text-electric-300" /> This guide is not a medical assessment. Stop for ankle, knee, back or other pain, and seek qualified advice if pain persists.</p>
    </div>
  );
}
