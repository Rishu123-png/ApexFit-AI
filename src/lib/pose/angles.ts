import type { PoseLandmark } from './engine';

/**
 * Geometry from raw landmarks — pure + unit-tested.
 * MediaPipe BlazePose indices (33 joints).
 */

export const JOINTS = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const;

/** Internal angle (degrees) at point b, triangle a-b-c. Returns null if degenerate. */
export function jointAngle(a: PoseLandmark, b: PoseLandmark, c: PoseLandmark): number | null {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const dab = Math.hypot(abx, aby);
  const dcb = Math.hypot(cbx, cby);
  if (dab < 1e-6 || dcb < 1e-6) return null;
  const cos = (abx * cbx + aby * cby) / (dab * dcb);
  // clamp for float noise
  const deg = (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
  return Number.isFinite(deg) ? deg : null;
}

/** Average of available sides — whichever joints are visible enough. */
export function averagedJointAngle(
  landmarks: PoseLandmark[],
  triplet: [number, number, number][],
  minVisibility = 0.45,
): { angle: number | null; visible: boolean } {
  const angles: number[] = [];
  for (const [ia, ib, ic] of triplet) {
    const a = landmarks[ia];
    const b = landmarks[ib];
    const c = landmarks[ic];
    if (!a || !b || !c) continue;
    if ((a.visibility ?? 1) < minVisibility || (b.visibility ?? 1) < minVisibility || (c.visibility ?? 1) < minVisibility) continue;
    const ang = jointAngle(a, b, c);
    if (ang !== null) angles.push(ang);
  }
  if (angles.length === 0) return { angle: null, visible: false };
  return { angle: angles.reduce((x, y) => x + y, 0) / angles.length, visible: true };
}

export function kneeAngle(landmarks: PoseLandmark[]): { angle: number | null; visible: boolean } {
  return averagedJointAngle(landmarks, [
    [JOINTS.leftHip, JOINTS.leftKnee, JOINTS.leftAnkle],
    [JOINTS.rightHip, JOINTS.rightKnee, JOINTS.rightAnkle],
  ]);
}

export function elbowAngle(landmarks: PoseLandmark[]): { angle: number | null; visible: boolean } {
  return averagedJointAngle(landmarks, [
    [JOINTS.leftShoulder, JOINTS.leftElbow, JOINTS.leftWrist],
    [JOINTS.rightShoulder, JOINTS.rightElbow, JOINTS.rightWrist],
  ]);
}

/** Fraction of key tracking joints currently visible — used for confidence gating. */
export function keyJointsVisibility(landmarks: PoseLandmark[], indices: number[]): number {
  if (indices.length === 0) return 0;
  let ok = 0;
  for (const i of indices) {
    const lm = landmarks[i];
    if (lm && (lm.visibility ?? 1) >= 0.45) ok++;
  }
  return ok / indices.length;
}
