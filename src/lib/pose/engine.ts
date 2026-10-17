/**
 * Pose estimation integration point.
 *
 * The camera workout UI depends ONLY on the `PoseEngine` interface below.
 * A real engine (e.g. MediaPipe Pose Landmarker via
 * `@mediapipe/tasks-vision`) can be dropped in by implementing the interface
 * without touching page code — that is the intended next iteration.
 *
 * Until a real model is loaded and validated on-device, the UI must surface
 * the honest "engine not installed" state instead of simulating results.
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
  constructor() {
    super(
      'No pose-estimation engine is installed. Implement `PoseEngine` in ' +
        'src/lib/pose/engine.ts (e.g. wrap @mediapipe/tasks-vision PoseLandmarker) ' +
        'and return it from createPoseEngine().',
    );
  }
}

/**
 * Factory consumed by the camera page. Deliberately throws until a real
 * engine is integrated — the UI catches this and shows the honest state.
 *
 * Example future implementation:
 *   const vision = await FilesetResolver.forVisionTasks(WASM_URL);
 *   const landmarker = await PoseLandmarker.createFromOptions(vision, {...});
 *   return new MediaPipePoseEngine(landmarker);
 */
export function createPoseEngine(): PoseEngine {
  throw new PoseEngineNotInstalledError();
}
