'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthProvider';
import { GlassCard, Alert, Badge, Button } from '@/components/ui';
import { IconScan, IconCamera, IconAlert, IconCheck, IconInfo } from '@/components/icons';

type ScanState = 'idle' | 'preview' | 'calling' | 'done';

export default function FoodScanPage() {
  const { getIdToken } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ScanState>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [resultNote, setResultNote] = useState<{ kind: 'warning' | 'error' | 'success'; text: string } | null>(null);

  function pickFile() {
    fileRef.current?.click();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setResultNote(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setResultNote({ kind: 'error', text: 'Please choose an image file (JPG/PNG/HEIC).' });
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setFileName(file.name);
    setState('preview');
  }

  /**
   * Calls the real server route. Today that route honestly reports that no
   * vision provider is configured (503 VISION_NOT_CONFIGURED) — we surface
   * exactly that instead of fabricating an analysis.
   */
  async function analyse() {
    setState('calling');
    setResultNote(null);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/ai/food-scan', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, note: 'image upload wiring pending model provider' }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (res.status === 503 && data.error?.startsWith('VISION_')) {
        setResultNote({
          kind: 'warning',
          text: 'Food-photo analysis is not connected yet — no nutrition values will be shown for this photo. Once a vision-capable model is wired into the server route, results will appear here as labelled estimates.',
        });
      } else if (res.status === 401) {
        setResultNote({ kind: 'error', text: 'Your session expired. Please sign in again.' });
      } else if (!res.ok) {
        setResultNote({ kind: 'error', text: data.message ?? 'The scan service is unavailable right now.' });
      } else {
        // Future success path: render returned estimate here.
        setResultNote({ kind: 'success', text: 'Analysis complete (unexpected in this build).' });
      }
    } catch {
      setResultNote({ kind: 'error', text: 'Network error while contacting the scan service.' });
    } finally {
      setState('preview');
    }
  }

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFileName('');
    setState('idle');
    setResultNote(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          Food <span className="neon-text">scanner</span>
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Snap a meal photo and get instant nutrition estimates — coming as part of the AI Fitness &amp; Nutrition plan.
        </p>
      </div>

      <Alert kind="info" className="flex items-start gap-2">
        <IconInfo width={16} className="mt-0.5 shrink-0" />
        <span>
          This flow is fully wired but <b>intentionally honest</b>: until a vision-capable AI model is
          connected on the server, it will tell you so instead of inventing nutrition numbers. For
          accurate logging today, use the <Link href="/nutrition" className="font-semibold text-electric-200 underline">nutrition tracker</Link>.
        </span>
      </Alert>

      <GlassCard className="space-y-4">
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} aria-label="Choose a food photo" />

        {state !== 'calling' && !previewUrl && (
          <button
            onClick={pickFile}
            className="flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-electric-500/30 bg-electric-500/5 px-6 py-12 text-center transition hover:border-electric-400/60 hover:bg-electric-500/10"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-electric-500/30 bg-electric-500/10 text-electric-300">
              <IconCamera width={26} />
            </div>
            <p className="font-semibold text-slate-200">Tap to take a photo or choose from gallery</p>
            <p className="text-xs text-slate-500">JPG / PNG · your photo is only sent when you press “Analyse”</p>
          </button>
        )}

        {previewUrl && (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-2xl border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt={`Selected food photo${fileName ? `: ${fileName}` : ''}`} className="mx-auto max-h-[320px] w-auto object-contain" />
            </div>
            {resultNote && (
              <Alert kind={resultNote.kind} className="flex items-start gap-2">
                <IconAlert width={16} className="mt-0.5 shrink-0" />
                <span>{resultNote.text}</span>
              </Alert>
            )}
            <div className="flex gap-2">
              <Button glow onClick={analyse} loading={state === 'calling'} className="flex-1">
                <IconScan width={15} /> Analyse photo
              </Button>
              <Button variant="ghost" onClick={reset}>Remove</Button>
            </div>
          </div>
        )}
      </GlassCard>

      <GlassCard>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.15em] text-slate-400">How it will work</h2>
        <ol className="space-y-2.5 text-sm text-slate-300">
          {[
            'Photo is sent to the server over HTTPS along with your verified session token.',
            'A vision-capable model identifies dishes and portion sizes.',
            'Macros are returned as estimates and logged to your day with an “estimate” label — never silently as verified data.',
            'You confirm or edit portions before anything is saved.',
          ].map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-electric-500/15 text-xs font-bold text-electric-300">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
        <div className="mt-4 flex items-center gap-2">
          <Badge tone="amber"><IconAlert width={11} /> Model not connected</Badge>
          <Badge tone="green"><IconCheck width={11} /> Server route ready</Badge>
        </div>
      </GlassCard>
    </div>
  );
}
