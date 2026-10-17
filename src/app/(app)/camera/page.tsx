'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createPoseEngine, PoseEngineNotInstalledError } from '@/lib/pose/engine';
import { GlassCard, Alert, Badge, Button } from '@/components/ui';
import { IconCamera, IconShield, IconAlert, IconCheck, IconInfo, IconScan, IconMic } from '@/components/icons';

type CameraState = 'idle' | 'requesting' | 'active' | 'denied' | 'error' | 'unsupported';

export default function CameraWorkoutPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>('idle');
  const [engineStatus, setEngineStatus] = useState<'unknown' | 'missing' | 'ready'>('unknown');

  useEffect(() => {
    // Probe the integration point (not the network) so the page can honestly
    // report whether a pose engine exists.
    try {
      createPoseEngine();
      setEngineStatus('ready');
    } catch (err) {
      if (err instanceof PoseEngineNotInstalledError) setEngineStatus('missing');
    }
    return stopStream; // cleanup on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  async function startCamera() {
    if (!('mediaDevices' in navigator) || !navigator.mediaDevices.getUserMedia) {
      setState('unsupported');
      return;
    }
    setState('requesting');
    try {
      // Camera is requested ONLY after this explicit user action.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setState('active');
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error');
    }
  }

  function stopCamera() {
    stopStream();
    setState('idle');
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          Vision <span className="neon-text">studio</span>
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Camera-assisted workouts: rep counting and form feedback, processed on your device.
        </p>
      </div>

      {/* Honest capability status */}
      {engineStatus === 'missing' ? (
        <Alert kind="warning" className="flex items-start gap-2">
          <IconAlert width={16} className="mt-0.5 shrink-0" />
          <span>
            <b>Pose engine not installed yet.</b> The integration point is ready (
            <code className="code">src/lib/pose/engine.ts</code>) — install MediaPipe Pose
            Landmarker (or another real engine), wrap it in the <code className="code">PoseEngine</code>{' '}
            interface, and this screen will switch to live tracking. Until then you can verify camera
            access below; no pose data is analysed or simulated.
          </span>
        </Alert>
      ) : engineStatus === 'ready' ? (
        <Alert kind="success" className="flex items-center gap-2">
          <IconCheck width={16} /> Pose engine loaded — live tracking available.
        </Alert>
      ) : null}

      {/* Permission explainer — shown before any camera request */}
      {state === 'idle' && (
        <GlassCard className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-electric-500/30 bg-electric-500/10 text-electric-300">
              <IconCamera width={20} />
            </div>
            <h2 className="text-lg font-bold">Camera check</h2>
          </div>
          <ul className="space-y-2.5 text-sm text-slate-300">
            <li className="flex gap-2.5"><IconShield width={16} className="mt-0.5 shrink-0 text-mint" /> Video stays on this device — nothing is uploaded or recorded.</li>
            <li className="flex gap-2.5"><IconInfo width={16} className="mt-0.5 shrink-0 text-electric-300" /> Your browser will ask for permission. The camera starts only if you tap the button below.</li>
            <li className="flex gap-2.5"><IconCamera width={16} className="mt-0.5 shrink-0 text-violet" /> Stand 2–3 metres back so your whole body is visible, in decent light.</li>
          </ul>
          <Button glow onClick={startCamera} className="w-full py-3">
            <IconCamera width={16} /> Enable camera — start preview
          </Button>
        </GlassCard>
      )}

      {state === 'requesting' && (
        <GlassCard className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-electric-500 border-t-transparent" role="status" aria-label="Requesting camera permission" />
          <p className="text-sm text-slate-300">Waiting for camera permission…</p>
          <p className="text-xs text-slate-500">Check your browser’s permission prompt.</p>
        </GlassCard>
      )}

      {state === 'active' && (
        <GlassCard className="space-y-3">
          <div className="relative overflow-hidden rounded-2xl border border-electric-500/20 bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="mx-auto aspect-video w-full object-cover"
              aria-label="Live camera preview"
            />
            {/* Neutral framing guide — not a simulation of pose landmarks */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-4/5 w-3/5 rounded-[50%] border-2 border-dashed border-neon/40" aria-hidden="true" />
            </div>
            <div className="absolute left-3 top-3"><Badge tone="green">Live preview</Badge></div>
          </div>
          <p className="text-xs text-slate-500">
            The overlay is a framing guide only — pose landmarks will render here once a real engine
            is integrated.
          </p>
          <Button variant="danger" onClick={stopCamera} className="w-full">Stop camera</Button>
        </GlassCard>
      )}

      {state === 'denied' && (
        <GlassCard className="space-y-3">
          <Alert kind="error" className="flex items-start gap-2">
            <IconAlert width={16} className="mt-0.5 shrink-0" />
            <span>
              Camera access was denied. ApexFit can’t see you — and that’s okay. You can train with
              the <Link href="/workouts" className="font-semibold text-electric-200 underline">regular workout mode</Link> instead.
            </span>
          </Alert>
          <p className="text-sm text-slate-400">To enable it later: open your browser’s site settings for this page, allow camera access, then retry.</p>
          <Button variant="outline" onClick={startCamera} className="w-full">Try again</Button>
        </GlassCard>
      )}

      {state === 'error' && (
        <GlassCard className="space-y-3">
          <Alert kind="error">Couldn’t access the camera (it may be in use by another app, or not present on this device).</Alert>
          <Button variant="outline" onClick={startCamera} className="w-full">Retry</Button>
        </GlassCard>
      )}

      {state === 'unsupported' && (
        <Alert kind="warning">This browser doesn’t support camera access (<code className="code">getUserMedia</code>). Try a recent Chrome, Edge, Safari or Firefox.</Alert>
      )}

      {/* Roadmap of modular features */}
      <GlassCard>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.15em] text-slate-400">Module roadmap</h2>
        <ul className="space-y-2.5 text-sm">
          <li className="flex items-center gap-2.5 text-slate-400"><IconScan width={16} className="text-violet" /> MediaPipe pose landmarks → rep counting <Badge tone="amber">Planned</Badge></li>
          <li className="flex items-center gap-2.5 text-slate-400"><IconMic width={16} className="text-violet" /> Voice commands (start / pause / count) <Badge tone="amber">Planned</Badge></li>
          <li className="flex items-center gap-2.5 text-slate-300"><IconCheck width={16} className="text-mint" /> Guided workout sessions <Badge tone="green">Live</Badge></li>
        </ul>
      </GlassCard>
    </div>
  );
}
