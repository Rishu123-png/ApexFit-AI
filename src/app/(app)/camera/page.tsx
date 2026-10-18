'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPoseEngine, type PoseEngine, type PoseFrame } from '@/lib/pose/engine';
import { AngleRepCounter, TRACKABLE_EXERCISES, type TrackableExercise, type RepQuality } from '@/lib/pose/repCounter';
import { kneeAngle, elbowAngle, keyJointsVisibility, JOINTS } from '@/lib/pose/angles';
import { drawSkeleton } from '@/lib/pose/skeleton';
import { GlassCard, Alert, Badge, Button } from '@/components/ui';
import { IconCamera, IconShield, IconAlert, IconCheck, IconInfo, IconPlay, IconStop, IconRefresh } from '@/components/icons';

type CameraState = 'idle' | 'requesting' | 'active' | 'denied' | 'error' | 'unsupported';
type EngineState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ready' } | { kind: 'failed'; reason: string };

const TRACK_JOINTS = [
  JOINTS.leftHip, JOINTS.rightHip, JOINTS.leftKnee, JOINTS.rightKnee,
  JOINTS.leftAnkle, JOINTS.rightAnkle, JOINTS.leftShoulder, JOINTS.rightShoulder,
  JOINTS.leftElbow, JOINTS.rightElbow, JOINTS.leftWrist, JOINTS.rightWrist,
];

function explainCameraError(error: unknown) {
  if (!window.isSecureContext) return { state: 'error' as const, message: 'Camera access requires HTTPS. Open the secure app URL, not an HTTP or in-app preview link.' };
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return { state: 'denied' as const, message: 'Camera permission is blocked. Tap the lock/settings icon beside the address bar, allow Camera for this site, then retry.' };
  if (name === 'NotReadableError' || name === 'TrackStartError') return { state: 'error' as const, message: 'Your camera is busy in another app or browser tab. Close it there, then retry.' };
  if (name === 'OverconstrainedError') return { state: 'error' as const, message: 'This camera cannot use the requested video mode. Retry to use your device default camera.' };
  if (name === 'NotFoundError') return { state: 'error' as const, message: 'No usable camera was found on this device.' };
  if (name === 'AbortError') return { state: 'error' as const, message: 'Camera startup was interrupted. Retry once the browser has finished switching camera apps.' };
  return { state: 'error' as const, message: 'Camera could not start. Check site permission, close other camera apps, and retry.' };
}

export default function CameraWorkoutPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const engineRef = useRef<PoseEngine | null>(null);
  const counterRef = useRef<AngleRepCounter>(new AngleRepCounter(TRACKABLE_EXERCISES[0].counter));
  const rafRef = useRef<number>(0);
  const lastDrawRef = useRef<PoseFrame | null>(null);
  const lastUiUpdateRef = useRef(0);

  const [state, setState] = useState<CameraState>('idle');
  const [cameraError, setCameraError] = useState('');
  const [engine, setEngine] = useState<EngineState>({ kind: 'idle' });
  const [videoReady, setVideoReady] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [exercise, setExercise] = useState<TrackableExercise>(TRACKABLE_EXERCISES[0]);
  const [reps, setReps] = useState(0);
  const [quality, setQuality] = useState<RepQuality | null>(null);
  const [visibility, setVisibility] = useState(0);
  const [phase, setPhase] = useState<'extended' | 'low'>('extended');

  const stopLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(
    () => () => {
      stopLoop();
      stopStream();
      engineRef.current?.dispose();
      engineRef.current = null;
    },
    [stopLoop, stopStream],
  );

  function onFrame(frame: PoseFrame) {
    lastDrawRef.current = frame;
    const { angle, visible } =
      exercise.kind === 'knee' ? kneeAngle(frame.landmarks) : elbowAngle(frame.landmarks);
    const vis = keyJointsVisibility(frame.landmarks, TRACK_JOINTS);
    const ev = counterRef.current.feed(angle, vis, frame.timestampMs);

    // MediaPipe is already throttled to ~12 fps. Limit React updates further so
    // the camera preview stays responsive on lower-end phones.
    if (frame.timestampMs - lastUiUpdateRef.current >= 150 || ev) {
      lastUiUpdateRef.current = frame.timestampMs;
      setVisibility(vis);
      setPhase(counterRef.current.currentPhase);
      if (ev) {
        setReps(ev.count);
        setQuality(ev.quality);
      } else if (!visible) {
        setQuality(null);
      }
    }
  }

  function loop() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && engineRef.current && video.readyState >= 2) {
      engineRef.current.processFrame(video, performance.now());
    }
    if (canvas) {
      const ctx = canvas.getContext('2d');
      const frame = lastDrawRef.current;
      if (ctx && frame) {
        if (canvas.width !== video!.videoWidth || canvas.height !== video!.videoHeight) {
          canvas.width = video!.videoWidth || 640;
          canvas.height = video!.videoHeight || 360;
        }
        drawSkeleton(ctx, frame.landmarks, canvas.width, canvas.height, visibility >= 0.6);
      } else if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    rafRef.current = requestAnimationFrame(loop);
  }

  async function waitForUsableVideo(video: HTMLVideoElement): Promise<void> {
    await video.play();
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) return;

    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => finish(new Error('Camera did not provide video frames.')), 8_000);
      const onReady = () => {
        if (video.videoWidth > 0) finish();
      };
      const finish = (err?: Error) => {
        window.clearTimeout(timeout);
        video.removeEventListener('loadedmetadata', onReady);
        video.removeEventListener('canplay', onReady);
        if (err) reject(err);
        else resolve();
      };
      video.addEventListener('loadedmetadata', onReady);
      video.addEventListener('canplay', onReady);
    });
  }

  async function startCamera() {
    if (!('mediaDevices' in navigator) || !navigator.mediaDevices.getUserMedia) {
      setState('unsupported');
      return;
    }
    if (!window.isSecureContext) {
      setCameraError('Camera access requires HTTPS. Open the secure app URL, not an HTTP or in-app preview link.');
      setState('error');
      return;
    }

    setCameraError('');
    stopLoop();
    stopStream();
    engineRef.current?.dispose();
    engineRef.current = null;
    setTracking(false);
    setVideoReady(false);
    setState('requesting');

    // Engine model loads in parallel with the permission prompt.
    const eng = createPoseEngine();
    engineRef.current = eng;
    setEngine({ kind: 'loading' });
    void eng.load()
      .then(() => {
        if (engineRef.current === eng) setEngine({ kind: 'ready' });
      })
      .catch((err: Error) => {
        if (engineRef.current === eng) setEngine({ kind: 'failed', reason: err.message });
      });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error('No video track was returned by the camera.');
      track.onended = () => {
        if (streamRef.current === stream) {
          stopTracking();
          setVideoReady(false);
          setCameraError('Camera access ended unexpectedly. Another app may have taken control of the camera.');
          setState('error');
        }
      };
      track.onmute = () => {
        if (streamRef.current === stream) {
          stopTracking();
          setVideoReady(false);
        }
      };
      track.onunmute = () => {
        if (streamRef.current === stream && videoRef.current?.videoWidth) setVideoReady(true);
      };

      const video = videoRef.current;
      if (!video) throw new Error('Camera preview is unavailable.');
      video.srcObject = stream;
      await waitForUsableVideo(video);
      if (streamRef.current !== stream) return;
      setVideoReady(true);
      setState('active');
    } catch (err) {
      stopStream();
      const problem = explainCameraError(err);
      setCameraError(problem.message);
      setState(problem.state);
    }
  }

  function startTracking() {
    if (!videoReady || !engineRef.current) return;
    engineRef.current.onResults(onFrame);
    stopLoop();
    lastDrawRef.current = null;
    lastUiUpdateRef.current = 0;
    counterRef.current = new AngleRepCounter(exercise.counter);
    setReps(0);
    setQuality(null);
    setPhase('extended');
    setVisibility(0);
    setTracking(true);
    rafRef.current = requestAnimationFrame(loop);
  }

  function stopTracking() {
    stopLoop();
    engineRef.current?.onResults(() => undefined);
    setTracking(false);
  }

  function resetReps() {
    counterRef.current.reset();
    setReps(0);
    setQuality(null);
    setPhase('extended');
  }

  function switchExercise(ex: TrackableExercise) {
    setExercise(ex);
    counterRef.current = new AngleRepCounter(ex.counter);
    setReps(0);
    setQuality(null);
    setPhase('extended');
  }

  function stopCamera() {
    stopTracking();
    stopStream();
    engineRef.current?.dispose();
    engineRef.current = null;
    lastDrawRef.current = null;
    setVideoReady(false);
    setEngine({ kind: 'idle' });
    setState('idle');
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          Vision <span className="neon-text">coach</span>
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          On-device pose tracking for rep counting. Video never leaves your phone — nothing is uploaded, recorded or shared.
        </p>
      </div>

      <Alert kind="info" className="flex items-start gap-2">
        <IconInfo width={16} className="mt-0.5 shrink-0" />
        <span>
          Counts and cues are guidance, not coaching verdicts or medical advice. Only sessions finished in{' '}
          <b>Train</b> earn XP — camera tracking never grants rewards.
        </span>
      </Alert>

      {/* Engine status */}
      {engine.kind === 'failed' && (
        <Alert kind="warning" className="flex items-start gap-2">
          <IconAlert width={16} className="mt-0.5 shrink-0" />
          <span>
            <b>Pose engine unavailable:</b> {engine.reason} Camera preview still works below; tracking turns on once the model can load (try reloading on Wi-Fi and without ad-blockers).
          </span>
        </Alert>
      )}

      {/* Permission explainer */}
      {state === 'idle' && (
        <GlassCard className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-electric-500/30 bg-electric-500/10 text-electric-300">
              <IconCamera width={20} />
            </div>
            <h2 className="text-lg font-bold">Camera check</h2>
          </div>
          <ul className="space-y-2.5 text-sm text-slate-300">
            <li className="flex gap-2.5"><IconShield width={16} className="mt-0.5 shrink-0 text-mint" /> Frames are processed locally and discarded — no upload, no recording.</li>
            <li className="flex gap-2.5"><IconInfo width={16} className="mt-0.5 shrink-0 text-electric-300" /> The pose model (~5 MB) downloads once from a CDN on first use, then your browser caches it.</li>
            <li className="flex gap-2.5"><IconCamera width={16} className="mt-0.5 shrink-0 text-violet" /> Stand 2–3 m back, whole body in frame, decent light, phone steady.</li>
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
          <p className="text-xs text-slate-500">Check your browser’s permission prompt. Loading the pose model in parallel…</p>
        </GlassCard>
      )}

      {state === 'active' && (
        <GlassCard className="space-y-3">
          <div className="relative overflow-hidden rounded-2xl border border-electric-500/20 bg-black">
            <video ref={videoRef} playsInline muted autoPlay className="mx-auto aspect-video w-full object-cover" aria-label="Live camera preview" />
            <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />

            <div className="absolute left-3 top-3 flex gap-2">
              <Badge tone="green">Live preview</Badge>
              {engine.kind === 'loading' && <Badge tone="blue">Loading model…</Badge>}
              {engine.kind === 'ready' && tracking && <Badge tone="amber">Tracking</Badge>}
            </div>

            {tracking && (
              <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
                <div className="rounded-2xl border border-neon/40 bg-ink/80 px-4 py-2 text-center backdrop-blur">
                  <p className="font-mono text-3xl font-extrabold tabular-nums text-neon" aria-live="polite">{reps}</p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">reps</p>
                </div>
                {quality && (
                  <Badge tone={quality === 'good' ? 'green' : 'amber'}>
                    {quality === 'good' ? 'good rep' : quality === 'shallow' ? 'go a bit deeper' : 'slow down'}
                  </Badge>
                )}
                {!videoReady ? (
                  <Badge tone="amber">waiting for camera frames</Badge>
                ) : visibility < 0.6 ? (
                  <Badge tone="amber">step back — joints not fully visible</Badge>
                ) : null}
              </div>
            )}
          </div>

          {/* Exercise picker */}
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Exercise to track">
            {TRACKABLE_EXERCISES.map((ex) => (
              <button
                key={ex.id}
                role="tab"
                aria-selected={exercise.id === ex.id}
                onClick={() => switchExercise(ex)}
                className={`rounded-xl border px-3.5 py-2 text-sm font-semibold transition ${
                  exercise.id === ex.id
                    ? 'border-electric-400 bg-electric-500/20 text-electric-200'
                    : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200'
                }`}
              >
                {ex.label}
              </button>
            ))}
          </div>

          <p className="flex items-start gap-1.5 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-slate-400">
            <IconInfo width={13} className="mt-0.5 shrink-0" /> {exercise.cue}
          </p>

          <div className="flex gap-2">
            {engine.kind === 'ready' ? (
              !tracking ? (
                <Button glow onClick={startTracking} disabled={!videoReady} className="flex-1 py-3">
                  <IconPlay width={15} /> {videoReady ? 'Start rep counting' : 'Waiting for camera frames…'}
                </Button>
              ) : (
                <>
                  <Button variant="danger" onClick={stopTracking} className="flex-1 py-3"><IconStop width={15} /> Stop tracking</Button>
                  <Button variant="outline" onClick={resetReps}><IconRefresh width={15} /> Reset reps</Button>
                </>
              )
            ) : engine.kind === 'loading' ? (
              <Button disabled className="flex-1 py-3">Model loading…</Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  engineRef.current?.dispose();
                  const next = createPoseEngine();
                  engineRef.current = next;
                  setEngine({ kind: 'loading' });
                  void next.load()
                    .then(() => {
                      if (engineRef.current === next) setEngine({ kind: 'ready' });
                    })
                    .catch((e: Error) => {
                      if (engineRef.current === next) setEngine({ kind: 'failed', reason: e.message });
                    });
                }}
                className="flex-1 py-3"
              >
                <IconRefresh width={15} /> Retry model load
              </Button>
            )}
            <Button variant="ghost" onClick={stopCamera}>Camera off</Button>
          </div>
          {phase === 'low' && tracking && <p className="text-center text-xs font-semibold text-electric-300" role="status">Depth reached — come back up</p>}
        </GlassCard>
      )}

      {state === 'denied' && (
        <Alert kind="error" className="space-y-3">
          <span className="flex items-start gap-2"><IconAlert width={16} className="mt-0.5 shrink-0" /><span><b>Camera permission blocked.</b> {cameraError}</span></span>
          <Button variant="outline" onClick={() => void startCamera()} className="w-full"><IconRefresh width={15} /> Try camera again</Button>
        </Alert>
      )}
      {state === 'error' && (
        <Alert kind="error" className="space-y-3">
          <span className="flex items-start gap-2"><IconAlert width={16} className="mt-0.5 shrink-0" /><span>{cameraError || 'Camera could not start. Check permission and retry.'}</span></span>
          <Button variant="outline" onClick={() => void startCamera()} className="w-full"><IconRefresh width={15} /> Retry camera</Button>
        </Alert>
      )}
      {state === 'unsupported' && (
        <Alert kind="warning">This browser doesn’t expose camera APIs. Chrome on Android or Safari on iOS work best.</Alert>
      )}

      {state === 'active' && !tracking && engine.kind === 'ready' && (
        <Alert kind="success" className="flex items-center gap-2">
          <IconCheck width={16} /> Model ready — picking an exercise starts counting as soon as you tap “Start rep counting”.
        </Alert>
      )}
    </div>
  );
}
