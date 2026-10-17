/** Arena input validation. Pure + unit-tested. */
import { isValidTimeZone } from './periods';
import { ARENA_XP_CONFIG } from './xp';
import type { ArenaEventType } from './types';

export const AVATAR_PRESETS = [
  'bolt', 'tiger', 'flame', 'lotus', 'cobra', 'falcon',
  'rhino', 'peacock', 'comet', 'summit', 'wave', 'mask',
] as const;

export type AvatarId = (typeof AVATAR_PRESETS)[number];

export const AVATAR_EMOJI: Record<AvatarId, string> = {
  bolt: '⚡', tiger: '🐯', flame: '🔥', lotus: '🪷', cobra: '🐍', falcon: '🦅',
  rhino: '🦏', peacock: '🦚', comet: '☄️', summit: '🏔️', wave: '🌊', mask: '🛡️',
};

export function isValidAvatarId(id: unknown): id is AvatarId {
  return typeof id === 'string' && (AVATAR_PRESETS as readonly string[]).includes(id);
}

// Letters, numbers, combining marks (Indic matras), space, dot, underscore, dash
const NAME_RE = /^\p{L}[\p{L}\p{N}\p{M} ._-]{1,22}[\p{L}\p{N}\p{M}.]$/u;

/**
 * Display-name rules: 3–24 visible chars, letters/numbers plus space/dot/underscore/dash,
 * must start with a letter; nothing that looks like an email or URL — we never
 * publish contact details in the Arena.
 */
export function validateDisplayName(name: unknown): string | null {
  if (typeof name !== 'string') return 'Display name must be text.';
  const trimmed = name.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (trimmed.length < 3 || trimmed.length > 24) return 'Use 3–24 characters.';
  if (trimmed.includes('@') || /https?:\/\//i.test(trimmed) || /\.(com|in|net|org|io)\b/i.test(trimmed))
    return 'Display names can’t look like emails or links.';
  if (!NAME_RE.test(trimmed))
    return 'Use letters and numbers with optional spaces, dots, dashes or underscores.';
  return null;
}

export function normalizeDisplayName(name: string): string {
  return name.normalize('NFC').trim().replace(/\s+/g, ' ');
}

export function isValidVisibility(v: unknown): v is { global: boolean; friends: boolean } {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as Record<string, unknown>).global === 'boolean' &&
    typeof (v as Record<string, unknown>).friends === 'boolean'
  );
}

export function isValidEventType(t: unknown): t is ArenaEventType {
  return (
    typeof t === 'string' &&
    Object.prototype.hasOwnProperty.call(ARENA_XP_CONFIG.xp, t)
  );
}

export { isValidTimeZone };
