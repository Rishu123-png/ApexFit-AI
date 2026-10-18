'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPoseEngine, type PoseEngine, type PoseFrame } from '@/lib/pose/engine';
import { AngleRepCounter, trackableForWorkoutExercise, type RepQuality, type TrackableExercise } from '@/lib/pose/repCounter';
import { elbowAngle, JOINTS, kneeAngle, keyJointsVisibility } from '@/lib/pose/angles';
import { drawSkeleton } from '@/lib/pose/skeleton';
import { Badge, Button } from '@/components/ui';
import { IconCamera, IconCheck, IconInfo, IconRefresh, IconStop } from '@/components/icons';

const TRACK_JOINTS = [
  JOINTS.leftHip, JOINTS.rightHip, JOINTS.leftKnee, JOINTS.rightKnee, JOINTS.leftAnkle, JOINTS.rightAnkle,
  JOINTS.leftShoulder, JOINTS.rightShoulder, JOINTS.leftElbow, JOINTS.rightElbow, JOINTS.leftWrist, JOINTS.rightWrist,
];

type FormCameraState = 'off' | 'starting' | 'active' | 'error';

function cameraProblem(err: unknown) {
  const name = err instanceof DOMException ? err.name : '';
  if (!window.isSecureContext) return 'Camera requires HTTPS. Open ApexFit in the browser, not an insecure preview.';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Camera permission is blocked. Allow it in browser site settings, then retry.';
  if (name === 'NotReadableError' || name === 'TrackStartError') return 'Camera is currently in use by another app or tab. Close it and retry.';
  if (name === 'NotFoundError') return 'No usable camera was found on this device.';
  return 'Camera could not start. Check permission and try again.';
}

/** One consent tap per workout. Once active it automatically follows the
 * current supported exercise, all inference stays on-device, and rep counts
 * remain guidance only — it never completes a set or awards XP. */
export function LiveFormCoach({ exerciseId, exerciseName, onGuidanceStarted }: { exerciseId: string; exerciseName: string; onGuidanceStarted?: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const engineRef = useRef<PoseEngine | null>(null);
  const counterRef = useRef<AngleRepCounter | null>(null);
  const frameRef = useRef<PoseFrame | null>(null);
  const rafRef = useRef(0);
  const [state, setState] = useState<FormCameraState>('off');
  const [trackable, setTrackable] = useState<TrackableExercise | null>(() => trackableForWorkoutExercise(exerciseId));
  const [reps, setReps] = useState(0);
  const [quality, setQuality] = useState<RepQuality | null>(null);
  const [visibility, setVisibility] = useState(0);
  const [error, setError] = useState('');

  const stopLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  }, []);
  const stopCamera = useCallback(() => {
    stopLoop();
    engineRef.current?.dispose();
    engineRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [stopLoop]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    const next = trackableForWorkoutExercise(exerciseId);
    setTrackable(next);
    setReps(0);
    setQuality(null);
    setVisibility(0);
    if (next) {
      counterRef.current = new AngleRepCounter(next.counter);
    } else {
      counterRef.current = null;
      // Do not leave a private camera stream running for an exercise with no
      // supported on-device cue. The next supported movement offers one tap to resume.
      if (streamRef.current) {
        stopCamera();
        setState('off');
      }
    }
  }, [exerciseId, stopCamera]);

  const handleFrame = useCallback((frame: PoseFrame) => {
    const active = trackableForWorkoutExercise(exerciseId);
    const counter = counterRef.current;
    if (!active || !counter) return;
    frameRef.current = frame;
    const measured = active.kind === 'knee' ? kneeAngle(frame.landmarks) : elbowAngle(frame.landmarks);
    const vis = keyJointsVisibility(frame.landmarks, TRACK_JOINTS);
    const event = counter.feed(measured.angle, vis, frame.timestampMs);
    setVisibility(vis);
    if (event) {
      setReps(event.count);
      setQuality(event.quality);
    }
  }, [exerciseId]);

  const loop = useCallback(function renderLoop() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && engineRef.current && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      engineRef.current.processFrame(video, performance.now());
    }
    const frame = frameRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx && frame && video) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
        }
        drawSkeleton(ctx, frame.landmarks, canvas.width, canvas.height, visibility >= 0.6);
      }
    }
    rafRef.current = requestAnimationFrame(renderLoop);
  }, [visibility]);

  async function enable() {
    if (!trackable) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      setError(cameraProblem(new Error('unsupported')));
      setState('error');
      return;
    }
    setState('starting');
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error('Video unavailable');
      video.srcObject = stream;
      await video.play();
      await new Promise<void>((resolve, reject) => {
        if (video.videoWidth > 0) return resolve();
        const id = window.setTimeout(() => reject(new Error('No frames')), 8000);
        const ready = () => {
          window.clearTimeout(id);
          video.removeEventListener('loadedmetadata', ready);
          resolve();
        };
        video.addEventListener('loadedmetadata', ready, { once: true });
      });
      const engine = createPoseEngine();
      engineRef.current = engine;
      await Promise.race([
        engine.load(),
        new Promise<void>((_, reject) => window.setTimeout(() => reject(new DOMException('Pose model timed out', 'TimeoutError')), 12000)),
      ]);
      engine.onResults(handleFrame);
      counterRef.current = new AngleRepCounter(trackable.counter);
      setReps(0);
      setState('active');
      onGuidanceStarted?.();
      stopLoop();
      rafRef.current = requestAnimationFrame(loop);
    } catch (err) {
      stopCamera();
      setError(err instanceof DOMException && err.name === 'TimeoutError'
        ? 'The local pose model is taking too long to load. Camera guidance is unavailable right now; you can follow the visual guide or retry on a stronger connection.'
        : cameraProblem(err));
      setState('error');
    }
  }

  if (!trackable) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/[0.025] px-3.5 py-3 text-xs text-slate-400">
        <span className="font-semibold text-slate-300">Live form camera:</span> not automated for {exerciseName} yet. Follow the animated guide and written cues; no camera judgement is shown for unsupported movements.
      </div>
    );
  }

  if (state === 'off' || state === 'error') {
    return (
      <div className="rounded-2xl border border-violet/25 bg-violet/[0.055] p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-bold text-violet-100"><IconCamera width={16} /> Live form guidance is ready</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">One tap enables your local camera for this workout. It automatically follows {trackable.label} and never uploads or records video.</p>
          </div>
          <Button glow onClick={() => void enable()} className="shrink-0 px-3 py-2 text-xs"><IconCamera width={14} /> {state === 'error' ? 'Retry camera' : 'Enable once'}</Button>
        </div>
        {error && <p role="alert" className="mt-3 rounded-xl border border-coral/25 bg-coral/10 px-3 py-2 text-xs text-coral">{error}</p>}
      </div>
    );
  }

  if (state === 'starting') {
    return <div className="rounded-2xl border border-violet/25 bg-violet/[0.055] px-3.5 py-4 text-center text-sm text-violet-100"><span className="pulse-soft">Requesting camera and loading local pose guide…</span></div>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-violet/30 bg-black/45">
      <div className="relative aspect-video">
        <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-cover" aria-label="Live local form guide" />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />
        <div className="absolute left-2.5 top-2.5"><Badge tone="violet">Local camera · {trackable.label}</Badge></div>
        <div className="absolute right-2.5 top-2.5 rounded-xl border border-neon/35 bg-ink/85 px-3 py-1.5 text-center backdrop-blur"><p className="font-mono text-xl font-black text-neon">{reps}</p><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">guided reps</p></div>
      </div>
      <div className="flex flex-wrap items-center gap-2 p-3 text-xs">
        <p className="min-w-0 flex-1 text-slate-300">{visibility < 0.6 ? 'Step back so shoulders, hips, knees and ankles are visible.' : trackable.cue}</p>
        {quality && <Badge tone={quality === 'good' ? 'green' : 'amber'}>{quality === 'good' ? 'smooth rep' : quality === 'shallow' ? 'go deeper if comfortable' : 'slow down'}</Badge>}
        <Button variant="ghost" onClick={() => { stopCamera(); setState('off'); }} className="px-2.5 py-1.5 text-xs"><IconStop width={13} /> Off</Button>
      </div>
      <p className="flex gap-1.5 border-t border-white/8 px-3 py-2 text-[10px] text-slate-500"><IconInfo width={12} className="mt-0.5 shrink-0" /> Guidance only: it does not automatically mark a set complete or decide whether your form is safe.</p>
    </div>
  );
}
