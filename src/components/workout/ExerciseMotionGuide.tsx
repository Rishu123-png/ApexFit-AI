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

/** Lightweight local SVG movement guide. It deliberately illustrates a motion
 * rather than pretending to be a video coach or a clinical form assessment. */
export function ExerciseMotionGuide({ exercise }: { exercise: Exercise }) {
  const reducedMotion = useReducedMotion();
  const kind = kindFor(exercise.id);
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
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {exercise.instructions.slice(0, 3).map((instruction, index) => (
          <div key={instruction} className="rounded-xl border border-white/8 bg-white/[.035] p-2.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-electric-500/20 text-[10px] font-black text-electric-200">{index + 1}</span>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-300">{instruction}</p>
          </div>
        ))}
      </div>
      {exercise.substitution && <p className="mt-2 rounded-xl border border-amber/20 bg-amber/5 px-3 py-2 text-[11px] leading-relaxed text-amber-100"><b>Make it easier:</b> {exercise.substitution}</p>}
      <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400"><IconInfo width={13} className="mt-0.5 shrink-0 text-electric-300" /> This guide is not a medical assessment. Stop for ankle, knee, back or other pain, and seek qualified advice if pain persists.</p>
    </div>
  );
}
