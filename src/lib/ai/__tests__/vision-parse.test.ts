import { describe, it, expect } from 'vitest';
import { extractJsonObject, parseVisionEstimate } from '../vision-parse';

describe('extractJsonObject', () => {
  it('parses clean JSON', () => {
    expect(extractJsonObject('{"items":[],"notes":"ok"}')).toEqual({ items: [], notes: 'ok' });
  });

  it('tolerates markdown fences and surrounding prose', () => {
    const text = 'Sure! Here is the analysis:\n```json\n{"items":[],"notes":"mixed dish"}\n```\nDone.';
    expect(extractJsonObject(text)).toEqual({ items: [], notes: 'mixed dish' });
  });

  it('handles escaped quotes inside strings', () => {
    const obj = extractJsonObject('{"notes":"x\\"y\\""}');
    expect(obj).toEqual({ notes: 'x"y"' });
  });

  it('returns null when no object present', () => {
    expect(extractJsonObject('no json here')).toBeNull();
    expect(extractJsonObject('{broken')).toBeNull();
  });
});

describe('parseVisionEstimate — never trust the model', () => {
  it('parses a well-formed estimate and keeps item fields', () => {
    const out = parseVisionEstimate(
      '{"items":[{"name":"Rajma","portionLabel":"1 katori","calories":210,"protein":9.5,"carbs":30,"fat":4,"confidence":0.8}],"notes":"ok"}',
    );
    expect(out).not.toBeNull();
    expect(out!.items).toHaveLength(1);
    expect(out!.items[0]).toMatchObject({ name: 'Rajma', calories: 210, protein: 9.5, confidence: 0.8 });
    expect(out!.notes).toBe('ok');
  });

  it('clamps absurd invented values into safe bounds', () => {
    const out = parseVisionEstimate(
      '{"items":[{"name":"X","calories":99999,"protein":-5,"carbs":1e9,"fat":"lots","confidence":7}]}',
    );
    const it = out!.items[0];
    expect(it.calories).toBeLessThanOrEqual(3000);
    expect(it.protein).toBe(0);
    expect(it.carbs).toBeLessThanOrEqual(600);
    expect(it.fat).toBe(0);
    expect(it.confidence).toBeLessThanOrEqual(1);
  });

  it('drops items without names and caps item count', () => {
    const items = Array.from({ length: 12 }, (_, i) => `{${i % 3 === 0 ? '' : `"name":"dish${i}",`}"calories":10}`);
    const out = parseVisionEstimate(`{"items":[${items.join(',')}]}`);
    expect(out).not.toBeNull();
    const named = 12 - 4; // items missing names dropped
    expect(out!.items.length).toBeLessThanOrEqual(Math.min(6, named));
  });

  it('returns null for non-schema payloads instead of inventing numbers', () => {
    expect(parseVisionEstimate('{"macros":{"kcal":100}}')).toBeNull();
    expect(parseVisionEstimate('"just a string"')).toBeNull();
    expect(parseVisionEstimate('')).toBeNull();
  });

  it('empty items array (= not food) parses to empty, not error', () => {
    const out = parseVisionEstimate('{"items":[],"notes":"no food visible"}');
    expect(out).toEqual({ items: [], notes: 'no food visible' });
  });
});
