'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthProvider';
import { addNutritionEntries } from '@/lib/db';
import { claimArena } from '@/lib/arena/client';
import { dateKey } from '@/lib/dates';
import type { MealType } from '@/lib/types';
import type { VisionFoodItem } from '@/lib/ai/vision-parse';
import { GlassCard, Alert, Badge, Button } from '@/components/ui';
import { IconScan, IconCamera, IconAlert, IconCheck, IconInfo, IconPlus, IconX } from '@/components/icons';

type ScanState = 'idle' | 'preview' | 'calling' | 'results';
interface EditableItem extends VisionFoodItem {
  servings: number;
  include: boolean;
}

const NUTRITION_LIMITS = {
  calories: 3000,
  protein: 300,
  carbs: 600,
  fat: 300,
} as const;

/** Downscale a photo before upload (slow-network friendly). */
async function downscaleToDataUrl(file: File, maxDim = 1024, quality = 0.82): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bmp.close();
    throw new Error('Canvas unavailable');
  }
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return canvas.toDataURL('image/jpeg', quality);
}

export default function FoodScanPage() {
  const { user, getIdToken } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ScanState>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [notes, setNotes] = useState('');
  const [notice, setNotice] = useState<{ kind: 'warning' | 'error' | 'success' | 'info'; text: string } | null>(null);
  const [meal, setMeal] = useState<MealType>('lunch');
  const [logging, setLogging] = useState(false);

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setDataUrl(null);
    setItems([]);
    setNotes('');
    setNotice(null);
    setState('idle');
    if (fileRef.current) fileRef.current.value = '';
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setNotice(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setNotice({ kind: 'error', text: 'Please choose an image file (JPG/PNG/WebP).' });
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    try {
      setDataUrl(await downscaleToDataUrl(file));
      setState('preview');
    } catch {
      setNotice({ kind: 'error', text: 'Couldn’t process that image in this browser.' });
    }
  }

  async function analyse() {
    if (!dataUrl) return;
    setState('calling');
    setNotice(null);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/ai/food-scan', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string; message?: string; items?: VisionFoodItem[]; notes?: string;
      };
      if (res.ok && data.items) {
        setItems(data.items.map((it) => ({ ...it, servings: 1, include: true })));
        setNotes(data.notes ?? '');
        setState('results');
      } else if (res.status === 503 && (data.error === 'VISION_NOT_CONFIGURED' || data.error === 'GROQ_NOT_CONFIGURED')) {
        setNotice({
          kind: 'warning',
          text: 'Food-photo analysis isn’t enabled on the server yet (GROQ_VISION_ENABLED + Groq keys). Nothing was analysed and no numbers were invented — log accurately via the nutrition tracker instead.',
        });
        setState('preview');
      } else if (res.status === 429) {
        setNotice({ kind: 'warning', text: 'Scan limit reached for now — try again later.' });
        setState('preview');
      } else if (res.status === 413 || res.status === 400 || res.status === 422) {
        setNotice({ kind: 'error', text: data.message ?? 'The photo couldn’t be analysed.' });
        setState('preview');
      } else if (res.status === 401) {
        setNotice({ kind: 'error', text: 'Your session expired. Please sign in again.' });
        setState('preview');
      } else {
        setNotice({ kind: 'error', text: 'The scan service is unavailable right now. Try again shortly.' });
        setState('preview');
      }
    } catch {
      setNotice({ kind: 'error', text: 'Network error while contacting the scan service.' });
      setState('preview');
    }
  }

  function setItem(i: number, patch: Partial<EditableItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  async function logItems() {
    const chosen = items.filter((i) => i.include);
    if (chosen.length === 0 || !user) return;
    setLogging(true);
    setNotice(null);
    try {
      const invalid = chosen.some((it) =>
        !it.name.trim() ||
        it.name.length > 120 ||
        it.portionLabel.length > 80 ||
        !Number.isFinite(it.servings) || it.servings <= 0 || it.servings > 20 ||
        !Number.isFinite(it.calories) || it.calories < 0 || it.calories > NUTRITION_LIMITS.calories ||
        !Number.isFinite(it.protein) || it.protein < 0 || it.protein > NUTRITION_LIMITS.protein ||
        !Number.isFinite(it.carbs) || it.carbs < 0 || it.carbs > NUTRITION_LIMITS.carbs ||
        !Number.isFinite(it.fat) || it.fat < 0 || it.fat > NUTRITION_LIMITS.fat,
      );
      if (invalid) {
        setNotice({ kind: 'error', text: 'Correct the item names, portions, servings, or macro values before logging.' });
        return;
      }

      const today = dateKey();
      const loggedAt = Date.now();
      // One RTDB update: either every selected item is logged or none are.
      await addNutritionEntries(user.uid, today, chosen.map((it) => ({
        name: it.name.trim(),
        portionLabel: it.portionLabel.trim() || 'estimated portion',
        meal,
        servings: it.servings,
        calories: it.calories,
        protein: it.protein,
        carbs: it.carbs,
        fat: it.fat,
        source: 'estimate',
        loggedAt,
      })));
      // Best-effort missions (server re-validates)
      try {
        const token = await getIdToken();
        await claimArena(token, 'nutrition_milestone').catch(() => undefined);
        await claimArena(token, 'daily_mission').catch(() => undefined);
      } catch { /* arena optional */ }
      setNotice({ kind: 'success', text: `${chosen.length} item${chosen.length > 1 ? 's' : ''} logged to ${meal} as estimates.` });
      setState('idle');
      setItems([]);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setDataUrl(null);
    } catch {
      setNotice({ kind: 'error', text: 'Couldn’t save to your tracker. Check your connection.' });
    } finally {
      setLogging(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          Food <span className="neon-text">scanner</span>
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Photo → editable macro estimates → one-tap logging. Every value is an AI estimate you confirm before saving.
        </p>
      </div>

      <Alert kind="info" className="flex items-start gap-2">
        <IconInfo width={16} className="mt-0.5 shrink-0" />
        <span>
          Photos are sent to the server once (over HTTPS) when you press <b>Analyse</b> — they are
          never stored. Estimates carry uncertainty; for accuracy, prefer the{' '}
          <Link href="/nutrition" className="font-semibold text-electric-200 underline">nutrition tracker</Link>.
        </span>
      </Alert>

      <GlassCard className="space-y-4">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={onFile} aria-label="Choose a food photo" />

        {state === 'idle' && !previewUrl && (
          <button
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-electric-500/30 bg-electric-500/5 px-6 py-12 text-center transition hover:border-electric-400/60 hover:bg-electric-500/10"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-electric-500/30 bg-electric-500/10 text-electric-300">
              <IconCamera width={26} />
            </div>
            <p className="font-semibold text-slate-200">Tap to take a photo or choose from gallery</p>
            <p className="text-xs text-slate-500">Auto-downscaled for slow networks · nothing uploaded until you press Analyse</p>
          </button>
        )}

        {previewUrl && (state === 'preview' || state === 'calling') && (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-2xl border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Selected food" className="mx-auto max-h-[300px] w-auto object-contain" />
            </div>
            {notice && (
              <Alert kind={notice.kind === 'info' ? 'info' : notice.kind} className="flex items-start gap-2">
                <IconAlert width={16} className="mt-0.5 shrink-0" />
                <span>{notice.text}</span>
              </Alert>
            )}
            <div className="flex gap-2">
              <Button glow onClick={analyse} loading={state === 'calling'} className="flex-1">
                <IconScan width={15} /> {state === 'calling' ? 'Analysing…' : 'Analyse photo'}
              </Button>
              <Button variant="ghost" onClick={reset} disabled={state === 'calling'}>Remove</Button>
            </div>
          </div>
        )}

        {state === 'results' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Detected items</h2>
              <Badge tone="amber"><IconAlert width={11} /> all estimates</Badge>
            </div>
            {notes && <p className="text-xs text-slate-400">{notes}</p>}
            {items.map((it, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                <div className="mb-2 flex items-center gap-2">
                  <input
                    className="input flex-1 py-1.5 text-sm"
                    value={it.name}
                    onChange={(e) => setItem(i, { name: e.target.value.slice(0, 120) })}
                    aria-label={`Name of item ${i + 1}`}
                  />
                  <Badge tone={it.confidence >= 0.7 ? 'blue' : 'amber'}>{Math.round(it.confidence * 100)}%</Badge>
                  <button
                    onClick={() => setItem(i, { include: !it.include })}
                    className={`rounded-lg p-1.5 transition ${it.include ? 'text-mint' : 'text-slate-600'}`}
                    aria-label={it.include ? `Exclude ${it.name}` : `Include ${it.name}`}
                  >
                    {it.include ? <IconCheck width={16} /> : <IconX width={16} />}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {(['portionLabel', 'calories', 'protein', 'carbs', 'fat'] as const).map((k) => (
                    <label key={k} className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {k === 'portionLabel' ? 'portion' : k}
                      {k === 'portionLabel' ? (
                        <input className="input mt-1 w-full py-1 text-xs" value={it.portionLabel} onChange={(e) => setItem(i, { portionLabel: e.target.value.slice(0, 80) })} />
                      ) : (
                        <input
                          className="input mt-1 w-full py-1 text-xs"
                          inputMode="decimal"
                          value={it[k]}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            const max = NUTRITION_LIMITS[k];
                            if (Number.isFinite(n)) setItem(i, { [k]: Math.min(max, Math.max(0, n)) } as Partial<EditableItem>);
                          }}
                        />
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex items-center gap-2">
              <label htmlFor="scan-meal" className="text-xs font-semibold uppercase tracking-wider text-slate-400">Log to</label>
              <select id="scan-meal" className="input w-auto py-1.5 text-sm" value={meal} onChange={(e) => setMeal(e.target.value as MealType)}>
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="snacks">Snacks</option>
                <option value="dinner">Dinner</option>
              </select>
              <div className="flex-1" />
              <Button glow onClick={logItems} loading={logging} disabled={items.every((i) => !i.include)}>
                <IconPlus width={15} /> Log {items.filter((i) => i.include).length} item{items.filter((i) => i.include).length !== 1 ? 's' : ''}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setState('preview')}>Back to photo</Button>
              <Button variant="ghost" onClick={reset}>Discard</Button>
            </div>
          </div>
        )}

        {state === 'idle' && notice && (
          <Alert kind={notice.kind === 'info' ? 'info' : notice.kind} className="flex items-start gap-2">
            <IconAlert width={16} className="mt-0.5 shrink-0" />
            <span>{notice.text}</span>
          </Alert>
        )}
      </GlassCard>

      <GlassCard>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.15em] text-slate-400">How estimates work</h2>
        <ol className="space-y-2.5 text-sm text-slate-300">
          {[
            'Your photo is downscaled on-device, sent once to the server with your verified session, and analysed by a vision model.',
            'Dishes and portions come back as labelled estimates with confidence scores — never as “verified” data.',
            'You correct names, portions and macros before anything is logged. Corrections are what gets saved.',
            'Estimates can be wrong, especially for mixed dishes, gravies and drinks — when in doubt, adjust the portion.',
          ].map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-electric-500/15 text-xs font-bold text-electric-300">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </GlassCard>
    </div>
  );
}
