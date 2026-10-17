/**
 * Voice command parsing — pure + unit-tested.
 * Keyword-based, tolerant of Hinglish phrasing. Parsing never executes
 * anything; callers map actions to confirmed UI operations.
 */

export type VoiceAction =
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'start' }
  | { type: 'finish'; requiresConfirmation: true }
  | { type: 'confirm_finish' }
  | { type: 'cancel' }
  | { type: 'next_exercise' }
  | { type: 'set_done' }
  | { type: 'navigate'; target: '/nutrition' | '/workouts' | '/arena' | '/dashboard' | '/camera' | '/insights' }
  | { type: 'log_water'; ml: number }
  | { type: 'read_progress' }
  | { type: 'unknown'; transcript: string };

const has = (t: string, ...words: string[]) => words.some((w) => t.includes(w));

export const CONFIRM_WORDS = ['confirm', 'yes', 'haan', 'ha', 'do it', 'karo', 'pakka', 'ok finish'];
export const CANCEL_WORDS = ['cancel', 'no ', 'nahi', 'stop that', 'ruk jao', 'rehne do'];

export function parseVoiceCommand(raw: string): VoiceAction {
  const t = ` ${raw.toLowerCase().trim().replace(/\s+/g, ' ')} `;
  if (t.length < 3) return { type: 'unknown', transcript: raw };

  // confirmations first (context-dependent, caller decides)
  if (has(t, ...CONFIRM_WORDS.map((w) => ` ${w}`))) return { type: 'confirm_finish' };
  if (has(t, ...CANCEL_WORDS)) return { type: 'cancel' };

  if (has(t, 'finish workout', 'end workout', 'complete workout', 'khatam workout', 'end session', 'finish session', 'khatam karo', 'workout khatam'))
    return { type: 'finish', requiresConfirmation: true };

  if (has(t, 'pause', 'ruko', 'hold on', 'tham jao')) return { type: 'pause' };
  if (has(t, 'resume', 'continue', 'chalu rakho', 'wapas shuru')) return { type: 'resume' };
  if (has(t, 'start workout', 'begin workout', 'shuru karo workout', 'workout shuru', 'start training')) return { type: 'start' };

  if (has(t, 'next exercise', 'skip exercise', 'aage', 'next one')) return { type: 'next_exercise' };
  if (has(t, 'set done', 'done set', 'set complete', 'hogaya set', 'mark set', 'set khatam')) return { type: 'set_done' };

  if (has(t, 'water', 'paani', 'pani')) {
    const num = t.match(/(\d{2,4})/);
    const ml = num ? Math.min(1000, Math.max(100, Number(num[1]))) : 250;
    return { type: 'log_water', ml };
  }

  if (has(t, 'nutrition', 'khana', 'food', 'diet')) return { type: 'navigate', target: '/nutrition' };
  if (has(t, 'arena', 'leaderboard')) return { type: 'navigate', target: '/arena' };
  if (has(t, 'camera', 'vision')) return { type: 'navigate', target: '/camera' };
  if (has(t, 'insight', 'summary', 'report')) return { type: 'navigate', target: '/insights' };
  if (has(t, 'workout', 'train')) return { type: 'navigate', target: '/workouts' };
  if (has(t, 'dashboard', 'home', 'ghar')) return { type: 'navigate', target: '/dashboard' };

  if (has(t, 'progress', 'kitna hua', 'status', 'how am i doing')) return { type: 'read_progress' };

  return { type: 'unknown', transcript: raw };
}
