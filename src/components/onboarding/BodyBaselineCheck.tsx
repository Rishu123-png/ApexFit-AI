'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Alert } from '@/components/ui';
import { IconCamera, IconCheck, IconShield, IconStop } from '@/components/icons';

type State = 'idle' | 'starting' | 'ready' | 'error';

/** Optional, local-only framing check. It never captures, stores, uploads, or
 * classifies a body. It helps the user set up later live exercise guidance. */
export function BodyBaselineCheck({ onCompleted }: { onCompleted: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('');

  function stop() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  useEffect(() => () => stop(), []);

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      setError('A secure HTTPS browser with camera access is required for this optional local check.');
      setState('error');
      return;
    }
    setState('starting');
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      if (!videoRef.current) throw new Error('Preview unavailable');
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setState('ready');
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      setError(name === 'NotAllowedError' ? 'Camera permission is blocked. You can skip this and use live camera guidance later.' : 'Camera could not start. Close other camera apps or skip this optional step.');
      setState('error');
    }
  }

  if (state === 'ready') {
    return (
      <div className="space-y-3">
        <div className="relative overflow-hidden rounded-3xl border border-electric-500/30 bg-black">
          <video ref={videoRef} muted playsInline autoPlay className="aspect-[3/4] w-full object-cover" aria-label="Local body framing preview" />
          <div className="pointer-events-none absolute inset-x-[20%] inset-y-[8%] rounded-[45%] border-2 border-dashed border-neon/70 shadow-[0_0_24px_rgba(34,224,255,.3)]" aria-hidden="true" />
          <p className="absolute bottom-3 left-3 right-3 rounded-xl bg-ink/80 px-3 py-2 text-center text-xs text-slate-200 backdrop-blur">Stand 2–3 m back with your full body inside the outline. Nothing is captured or uploaded.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => { stop(); setState('idle'); }}><IconStop width={14} /> Camera off</Button>
          <Button glow onClick={() => { stop(); onCompleted(); }}><IconCheck width={14} /> Framing looks good</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-3xl border border-violet/25 bg-violet/[0.045] p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-violet/35 bg-violet/15 text-violet-200"><IconCamera width={19} /></span>
        <div>
          <p className="font-bold text-slate-100">Optional local camera check</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-400">Use a live preview to practise full-body framing for future exercise guidance. ApexFit does not take a photo, infer body type, or upload any frame.</p>
        </div>
      </div>
      <p className="flex gap-1.5 text-xs text-slate-500"><IconShield width={13} className="mt-0.5 shrink-0 text-mint" /> Your height, weight and goals come from your own entries — camera view is not used to judge your body.</p>
      {error && <Alert kind="warning">{error}</Alert>}
      {state === 'starting' ? <p className="text-center text-sm text-violet-100"><span className="pulse-soft">Opening local camera…</span></p> : <Button variant="outline" onClick={() => void start()} className="w-full"><IconCamera width={15} /> Open local preview</Button>}
    </div>
  );
}
