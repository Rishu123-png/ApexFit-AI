/**
 * Vision output parsing — pure + unit-tested.
 * The model is asked for strict JSON, but we never trust it: extract, parse,
 * schema-check, clamp to safe bounds, and label everything as estimates.
 */

export interface VisionFoodItem {
  name: string;
  portionLabel: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** 0..1 model-reported confidence (still an estimate) */
  confidence: number;
}

export interface VisionEstimate {
  items: VisionFoodItem[];
  notes: string;
}

export const VISION_PROMPT = `You are analyzing a food photo for an Indian nutrition-tracking app.
Identify visible dishes and estimate portions. Prefer Indian food context (katori, roti, pieces).
Respond with ONLY a JSON object, no markdown, exactly this shape:
{"items":[{"name":"string","portionLabel":"e.g. 1 katori (150 g)","calories":number,"protein":number,"carbs":number,"fat":number,"confidence":number 0..1}],"notes":"short uncertainty notes"}
Rules: be conservative; if the photo is not food or unreadable, return {"items":[],"notes":"reason"}; never invent exact values — everything is an estimate; ≤6 items; numbers may be decimals.`;

const clamp = (v: unknown, min: number, max: number, fallback = 0): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

/** Extract the first balanced {...} block from a model reply (tolerates markdown fences). */
export function extractJsonObject(text: string): unknown | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

export function parseVisionEstimate(rawModelText: string): VisionEstimate | null {
  const obj = extractJsonObject(rawModelText);
  if (typeof obj !== 'object' || obj === null) return null;
  const o = obj as Record<string, unknown>;
  if (!Array.isArray(o.items)) return null;

  const items: VisionFoodItem[] = [];
  for (const raw of o.items.slice(0, 6)) {
    if (typeof raw !== 'object' || raw === null) continue;
    const r = raw as Record<string, unknown>;
    const name = typeof r.name === 'string' ? r.name.trim().slice(0, 120) : '';
    if (!name) continue;
    items.push({
      name,
      portionLabel: typeof r.portionLabel === 'string' ? r.portionLabel.trim().slice(0, 80) : 'estimated portion',
      calories: Math.round(clamp(r.calories, 0, 3000)),
      protein: Math.round(clamp(r.protein, 0, 300) * 10) / 10,
      carbs: Math.round(clamp(r.carbs, 0, 600) * 10) / 10,
      fat: Math.round(clamp(r.fat, 0, 300) * 10) / 10,
      confidence: Math.round(clamp(r.confidence, 0, 1, 0.5) * 100) / 100,
    });
  }

  const notes = typeof o.notes === 'string' ? o.notes.trim().slice(0, 400) : '';
  return { items, notes };
}
