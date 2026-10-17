'use client';

import { levelProgress, levelTitle } from '@/lib/arena/levels';
import { AVATAR_EMOJI, type AvatarId } from '@/lib/arena/validate';

export function ArenaAvatar({ avatarId, size = 40 }: { avatarId: string; size?: number }) {
  const emoji = AVATAR_EMOJI[(avatarId as AvatarId)] ?? '⚡';
  return (
    <span
      className="inline-flex items-center justify-center rounded-full border border-electric-500/35 bg-gradient-to-br from-electric-600/30 to-neon/10"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
      role="img"
      aria-label={`Avatar ${avatarId}`}
    >
      {emoji}
    </span>
  );
}

export function LevelBadge({ level, size = 44 }: { level: number; size?: number }) {
  return (
    <span
      className="inline-flex flex-col items-center justify-center rounded-2xl border border-neon/40 bg-navy-800 font-extrabold text-neon"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        boxShadow: '0 0 16px rgba(34,224,255,0.25), inset 0 0 10px rgba(34,224,255,0.08)',
      }}
      aria-label={`Level ${level}`}
    >
      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">LV</span>
      {level}
    </span>
  );
}

export function XpBar({ xp, showNumbers = true }: { xp: number; showNumbers?: boolean }) {
  const prog = levelProgress(xp);
  return (
    <div className="w-full">
      {showNumbers && (
        <div className="mb-1 flex items-baseline justify-between text-xs">
          <span className="font-semibold text-slate-300">
            {prog.into.toLocaleString('en-IN')} / {prog.next - prog.base} XP <span className="text-slate-500">· {levelTitle(prog.level)}</span>
          </span>
          <span className="tabular-nums text-slate-500">{prog.toGo.toLocaleString('en-IN')} to LV {prog.level + 1}</span>
        </div>
      )}
      <div className="h-2.5 overflow-hidden rounded-full bg-white/8" role="progressbar" aria-valuenow={Math.round(prog.pct * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="XP progress to next level">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${prog.pct * 100}%`,
            background: 'linear-gradient(90deg, #2563eb, #2f8bff, #22e0ff)',
            boxShadow: '0 0 12px rgba(47,139,255,0.7)',
          }}
        />
      </div>
    </div>
  );
}
