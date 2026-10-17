/**
 * Pose estimation engine — on-device via MediaPipe Pose Landmarker.
 *
 * - Model/runtine URLs are CDN defaults, overridable via NEXT_PUBLIC_ env
 *   vars for self-hosting. Frames NEVER leave the device.
 * - The package is imported lazily so the camera page loads fine even when
 *   the engine can't (slow network, CDN blocked) — the UI then shows the
 *   honest "engine unavailable" state instead of simulating anything.
 */

export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface PoseFrame {
  landmarks: PoseLandmark[];
  timestampMs: number;
}

export interface RepEvent {
  exercise: string;
  count: number;
  quality?: 'good' | 'shallow' | 'rushed';
}

export interface PoseEngine {
  /** Load model weights. Resolves when ready, rejects with a reason. */
  load(): Promise<void>;
  /** Feed one camera frame; engines emit results via onResults. */
  processFrame(video: HTMLVideoElement, timestampMs: number): void;
  onResults(cb: (frame: PoseFrame) => void): void;
  onRep(cb: (event: RepEvent) => void): void;
  dispose(): void;
}

export class PoseEngineNotInstalledError extends Error {
  readonly code = 'POSE_ENGINE_NOT_INSTALLED';
  constructor(reason?: string) {
    super(
      'Pose engine unavailable. ' +
        (reason ?? 'The @mediapipe/tasks-vision package or its CDN runtime could not be loaded.'),
    );
  }
}

const WASM_URL =
  process.env.NEXT_PUBLIC_POSE_WASM_URL ??
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm';
const MODEL_URL =
  process.env.NEXT_PUBLIC_POSE_MODEL_URL ??
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

interface LandmarkResultLike {
  landmarks?: { x: number; y: number; z: number; visibility?: number }[][];
}

interface LandmarkerLike {
  detectForVideo(video: HTMLVideoElement, timestampMs: number): LandmarkResultLike;
  close(): void;
}

interface TasksVisionModule {
  FilesetResolver: { forVisionTasks(basePath: string): Promise<unknown> };
  PoseLandmarker: {
    createFromOptions(v: unknown, opts: Record<string, unknown>): Promise<LandmarkerLike>;
  };
}

class MediaPipePoseEngine implements PoseEngine {
  private landmarker: LandmarkerLike | null = null;
  private frameCb: ((f: PoseFrame) => void) | null = null;
  private repCb: ((e: RepEvent) => void) | null = null;
  /** Throttle: peak ~12 fps is plenty for rep counting on phone GPUs. */
  private lastTs = 0;

  async load(): Promise<void> {
    let mod: TasksVisionModule;
    try {
      mod = (await import('@mediapipe/tasks-vision')) as unknown as TasksVisionModule;
    } catch {
      throw new PoseEngineNotInstalledError(
        'The pose-vision package is not available in this build.',
      );
    }
    let vision: unknown;
    try {
      vision = await mod.FilesetResolver.forVisionTasks(WASM_URL);
    } catch {
      throw new PoseEngineNotInstalledError(
        'Couldn’t download the pose runtime (check network/ad-blockers).',
      );
    }
    try {
      this.landmarker = await mod.PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numPoses: 1,
      });
    } catch {
      throw new PoseEngineNotInstalledError(
        'The pose model could not be loaded on this device (GPU/WebGL missing?).',
      );
    }
  }

  processFrame(video: HTMLVideoElement, timestampMs: number): void {
    if (!this.landmarker || !this.frameCb) return;
    if (timestampMs - this.lastTs < 80) return; // graceful throttle
    this.lastTs = timestampMs;
    try {
      const res = this.landmarker.detectForVideo(video, timestampMs);
      const landmarks = res.landmarks?.[0];
      if (landmarks) this.frameCb({ landmarks, timestampMs });
    } catch {
      // A malformed frame should never crash the page.
    }
  }

  onResults(cb: (frame: PoseFrame) => void): void {
    this.frameCb = cb;
  }

  onRep(cb: (event: RepEvent) => void): void {
    this.repCb = cb;
  }

  dispose(): void {
    try {
      this.landmarker?.close();
    } catch {
      /* already freed */
    }
    this.landmarker = null;
    this.frameCb = null;
    this.repCb = null;
  }
}

/** Factory — always returns an engine; failures surface during load(). */
export function createPoseEngine(): PoseEngine {
  return new MediaPipePoseEngine();
}
