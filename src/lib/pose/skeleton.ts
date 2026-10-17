import type { PoseLandmark } from './engine';

/** Typical body connections, drawn as an on-device overlay. */
export const SKELETON_PAIRS: [number, number][] = [
  [11, 12], // shoulders
  [11, 13], [13, 15], // left arm
  [12, 14], [14, 16], // right arm
  [11, 23], [12, 24], // torso sides
  [23, 24], // hips
  [23, 25], [25, 27], // left leg
  [24, 26], [26, 28], // right leg
];

export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: PoseLandmark[],
  width: number,
  height: number,
  visible: boolean,
): void {
  ctx.clearRect(0, 0, width, height);
  const lineColor = visible ? 'rgba(34,224,255,0.85)' : 'rgba(251,191,36,0.55)';
  const dotColor = visible ? 'rgba(47,139,255,0.95)' : 'rgba(251,191,36,0.7)';

  ctx.lineWidth = 2.5;
  ctx.strokeStyle = lineColor;
  for (const [a, b] of SKELETON_PAIRS) {
    const A = landmarks[a];
    const B = landmarks[b];
    if (!A || !B) continue;
    if ((A.visibility ?? 1) < 0.4 || (B.visibility ?? 1) < 0.4) continue;
    ctx.beginPath();
    ctx.moveTo(A.x * width, A.y * height);
    ctx.lineTo(B.x * width, B.y * height);
    ctx.stroke();
  }

  ctx.fillStyle = dotColor;
  for (let i = 11; i <= 28; i++) {
    const lm = landmarks[i];
    if (!lm || (lm.visibility ?? 1) < 0.4) continue;
    ctx.beginPath();
    ctx.arc(lm.x * width, lm.y * height, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
}
