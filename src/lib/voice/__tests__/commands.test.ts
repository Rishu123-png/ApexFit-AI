import { describe, it, expect } from 'vitest';
import { parseVoiceCommand } from '../commands';

describe('parseVoiceCommand', () => {
  it('parses session controls', () => {
    expect(parseVoiceCommand('pause').type).toBe('pause');
    expect(parseVoiceCommand('ruko').type).toBe('pause');
    expect(parseVoiceCommand('resume please').type).toBe('resume');
    expect(parseVoiceCommand('continue').type).toBe('resume');
    expect(parseVoiceCommand('next exercise').type).toBe('next_exercise');
    expect(parseVoiceCommand('set done').type).toBe('set_done');
  });

  it('flags workout finish as requiring confirmation', () => {
    const a = parseVoiceCommand('finish workout');
    expect(a.type).toBe('finish');
    if (a.type === 'finish') expect(a.requiresConfirmation).toBe(true);
  });

  it('confirm and cancel are distinct intents', () => {
    expect(parseVoiceCommand('confirm').type).toBe('confirm_finish');
    expect(parseVoiceCommand('yes haan').type).toBe('confirm_finish');
    expect(parseVoiceCommand('cancel that').type).toBe('cancel');
    expect(parseVoiceCommand('nahi rehne do').type).toBe('cancel');
  });

  it('log water with an amount parses ml; default is 250', () => {
    const a = parseVoiceCommand('log 300 ml water');
    expect(a).toEqual({ type: 'log_water', ml: 300 });
    expect(parseVoiceCommand('paani')).toEqual({ type: 'log_water', ml: 250 });
    expect(parseVoiceCommand('log 5000 ml water')).toEqual({ type: 'log_water', ml: 1000 }); // clamped
  });

  it('navigational commands map to routes', () => {
    expect(parseVoiceCommand('open nutrition')).toEqual({ type: 'navigate', target: '/nutrition' });
    expect(parseVoiceCommand('khana dikhao')).toEqual({ type: 'navigate', target: '/nutrition' });
    expect(parseVoiceCommand('open arena')).toEqual({ type: 'navigate', target: '/arena' });
    expect(parseVoiceCommand('go home')).toEqual({ type: 'navigate', target: '/dashboard' });
    expect(parseVoiceCommand('show insights')).toEqual({ type: 'navigate', target: '/insights' });
  });

  it('read progress intent recognized', () => {
    expect(parseVoiceCommand('kitna hua').type).toBe('read_progress');
    expect(parseVoiceCommand('read my progress').type).toBe('read_progress');
  });

  it('unknowns surface honestly (no fake action)', () => {
    expect(parseVoiceCommand('xyzzy blorp').type).toBe('unknown');
    expect(parseVoiceCommand('a').type).toBe('unknown');
  });
});
