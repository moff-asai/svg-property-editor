import { XYZ_TYPO_COLOR_DEFAULT } from "./xyzTypo";

export interface XyzFrameParams {
  frameAnimation?: 0 | 1;
  frameWidth?: number;
  frameHeight?: number;
  typoVisible?: number;
  typoColor?: string;
}

export const XYZ_FRAME_DEFAULTS = {
  frameAnimation: 1,
  frameWidth: 64,
  frameHeight: 64,
  typoVisible: 1,
  typoColor: XYZ_TYPO_COLOR_DEFAULT,
} as const;

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
function easeSharp(t: number) {
  const a = Math.pow(clamp01(t), 4.2);
  const b = Math.pow(1 - clamp01(t), 4.2);
  return a / (a + b || 1);
}
function seqHold(ph: number, a: number, b: number, c: number, d: number) {
  ph = ((ph % 1) + 1) % 1;
  if (ph < a || ph > d) return 0;
  if (ph < b) return easeSharp((ph - a) / (b - a));
  if (ph < c) return 1;
  return 1 - easeSharp((ph - c) / (d - c));
}

function fixedRatio(value: number | undefined) {
  return (typeof value === "number" && Number.isFinite(value)
    ? Math.max(10, Math.min(90, value)) : 64) / 100;
}

// Where the grow/shrink loop begins and ends, as a share of the peak. Scaling
// both axes by one factor keeps the small start the same shape as the peak
// (0.34 is the .22/.64 the loop used before the peak became configurable).
const ANIM_START_SCALE = 0.34;

// The configured size ratio: the still frame size, and the animation peak.
export function xyzFrameRatio(p: XyzFrameParams) {
  return { width: fixedRatio(p.frameWidth), height: fixedRatio(p.frameHeight) };
}

// One size calculation for Canvas, still SVG and animated SVG. The phase
// remains independent so disabling frame motion never stops the color points.
export function xyzFrameSize(W: number, H: number, phase: number, p: XyzFrameParams) {
  const { width: wMax, height: hMax } = xyzFrameRatio(p);
  if (p.frameAnimation === 0) return { width: W * wMax, height: H * hMax };
  const hg = seqHold(phase, 0.06, 0.34, 0.72, 0.94);
  const wg = seqHold(phase, 0.42, 0.7, 0.72, 0.94);
  const w0 = wMax * ANIM_START_SCALE;
  const h0 = hMax * ANIM_START_SCALE;
  return { width: W * (w0 + (wMax - w0) * wg), height: H * (h0 + (hMax - h0) * hg) };
}
