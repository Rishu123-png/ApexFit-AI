import { describe, expect, it } from 'vitest';
import { coachSafetyCheck } from '@/lib/ai/safety';

describe('coachSafetyCheck', () => {
  it('short-circuits potential emergencies before an AI call', () => {
    expect(coachSafetyCheck('I have chest pain after my workout')?.kind).toBe('urgent');
    expect(coachSafetyCheck('I fainted while training')?.reply).toMatch(/urgent medical help/i);
  });

  it('does not offer exercise advice for pain or illness', () => {
    const result = coachSafetyCheck('My knee pain is sharp when I squat');
    expect(result?.kind).toBe('pain-or-illness');
    expect(result?.reply).toMatch(/pause the workout/i);
  });

  it('blocks dangerous food and weight-loss tactics', () => {
    expect(coachSafetyCheck('How can I starve myself for faster fat loss?')?.kind).toBe('unsafe-restriction');
    expect(coachSafetyCheck('Make a safe beginner workout') ).toBeNull();
  });
});
