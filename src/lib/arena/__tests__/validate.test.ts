import { describe, it, expect } from 'vitest';
import { validateDisplayName, isValidAvatarId, normalizeDisplayName, AVATAR_PRESETS, isValidEventType } from '../validate';

describe('display name validation', () => {
  it('accepts reasonable names', () => {
    expect(validateDisplayName('IronPriya')).toBeNull();
    expect(validateDisplayName('Arjun K.')).toBeNull();
    expect(validateDisplayName('Ravi_2026')).toBeNull();
    expect(validateDisplayName('गजेंद्र')).toBeNull(); // Devanagari letters allowed
  });
  it('rejects too short / too long', () => {
    expect(validateDisplayName('ab')).toBeTruthy();
    expect(validateDisplayName('a'.repeat(30))).toBeTruthy();
  });
  it('rejects emails and links (privacy)', () => {
    expect(validateDisplayName('priya@gmail.com')).toBeTruthy();
    expect(validateDisplayName('https://x.io/abc')).toBeTruthy();
    expect(validateDisplayName('visitmysite.com')).toBeTruthy();
  });
  it('rejects special characters', () => {
    expect(validateDisplayName('a<b>script')).toBeTruthy();
    expect(validateDisplayName('n@me')).toBeTruthy();
  });
  it('normalizes whitespace', () => {
    expect(normalizeDisplayName('  Iron   Priya ')).toBe('Iron Priya');
  });
});

describe('avatar & event type validation', () => {
  it('only preset avatars pass', () => {
    for (const a of AVATAR_PRESETS) expect(isValidAvatarId(a)).toBe(true);
    expect(isValidAvatarId('custom-upload.png')).toBe(false);
    expect(isValidAvatarId('')).toBe(false);
  });
  it('only known event types pass', () => {
    expect(isValidEventType('workout_completed')).toBe(true);
    expect(isValidEventType('give_me_xp')).toBe(false);
    expect(isValidEventType('admin_override')).toBe(false);
  });
});
