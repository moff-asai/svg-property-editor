import { rgbOf } from "./engine";
import type { MeshGradientParams } from "./meshGradient";

type Axis = readonly (readonly [number, number])[];
export const INFLUENCE_GRID = 64;

export function influenceRanges(p: MeshGradientParams) {
  return [p.meshTopLeftRange ?? 100, p.meshTopRightRange ?? 100,
    p.meshBottomLeftRange ?? 100, p.meshBottomRightRange ?? 100];
}

// Preserve the original moving gradient field at 100%. Raising each corner's
// weight to an independent power expands/contracts its level sets. Normalize
// afterwards to keep the field opaque and avoid additive whitening or stacking order.
export function influenceSampler(p: MeshGradientParams, axes: readonly Axis[], w: number, h: number) {
  const colors = [p.meshTopLeft, p.meshTopRight, p.meshBottomLeft, p.meshBottomRight].map(rgbOf);
  const powers = influenceRanges(p).map(r => 100 / r);
  // Regularize the zero-weight boundary so expanding a color does not create
  // an infinitely steep edge as its moving gradient axis crosses the field.
  const epsilon = 0.002;
  const offsets = powers.map(power => epsilon ** power);
  const projections = axes.map(([a, b]) => {
    const dx = (b[0] - a[0]) * w, dy = (b[1] - a[1]) * h;
    const d = dx * dx + dy * dy;
    return (x: number, y: number) => Math.max(0, Math.min(1,
      ((x - a[0]) * w * dx + (y - a[1]) * h * dy) / d));
  });
  return (x: number, y: number) => {
    const top = projections[0](x, y), bottom = projections[1](x, y), v = projections[2](x, y);
    const weights = [(1 - v) * (1 - top), (1 - v) * top, v * (1 - bottom), v * bottom]
      .map((weight, i) => (weight + epsilon) ** powers[i] - offsets[i]);
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    return [0, 1, 2].map(channel => Math.round(weights.reduce(
      (sum, weight, i) => sum + weight * colors[i][channel], 0) / total));
  };
}

export function influencePixels(p: MeshGradientParams, axes: readonly Axis[], w: number, h: number) {
  const sample = influenceSampler(p, axes, w, h);
  const size = INFLUENCE_GRID + 1;
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const rgb = sample(x / INFLUENCE_GRID, y / INFLUENCE_GRID);
    const i = (y * size + x) * 4;
    data.set(rgb, i);
    data[i + 3] = 255;
  }
  return data;
}

// A continuous grid of SVG gradients, not an embedded bitmap. Adjacent strips
// share their edge colors; vertical masks interpolate between the sampled rows.
export function influenceSvg(
  p: MeshGradientParams, axesAt: (phase: number) => readonly Axis[],
  x: number, y: number, w: number, h: number, phase: number, seconds?: number,
) {
  const animated = !!seconds && p.meshMotion > 0;
  const grid = animated ? 32 : INFLUENCE_GRID;
  const frames = animated ? 24 : 0;
  const samples = Array.from({ length: frames + 1 }, (_, i) =>
    influenceSampler(p, axesAt(phase + (frames ? i / frames : 0)), w, h));
  const hex = (rgb: number[]) => `#${rgb.map(c => c.toString(16).padStart(2, "0")).join("")}`;
  let defs = "", body = "";
  for (let row = 0; row <= grid; row++) {
    let stops = "";
    for (let col = 0; col <= grid; col++) {
      const colors = samples.map(sample => hex(sample(col / grid, row / grid)));
      stops += `<stop offset="${col / grid}" stop-color="${colors[0]}">` +
        (animated ? `<animate attributeName="stop-color" dur="${seconds}s" repeatCount="indefinite" values="${colors.join(";")}"/>` : "") + `</stop>`;
    }
    defs += `<linearGradient id="xyz-field-${row}" gradientUnits="userSpaceOnUse" x1="${x}" x2="${x + w}" y1="0" y2="0" color-interpolation="sRGB">${stops}</linearGradient>`;
  }
  for (let row = 0; row < grid; row++) {
    const sy = y + row * h / grid, sh = h / grid;
    // Carry the lower edge color into the next band. Its opaque underpainting
    // prevents fractional-pixel seams when the next band's top is antialiased.
    const rect = `x="${x}" y="${sy}" width="${w}" height="${sh * 2}"`;
    defs += `<linearGradient id="xyz-field-fade-${row}" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${sy}" y2="${sy + sh}">` +
      `<stop stop-color="white" stop-opacity="0"/><stop offset="1" stop-color="white"/></linearGradient>` +
      `<mask id="xyz-field-mask-${row}" maskUnits="userSpaceOnUse" ${rect} style="mask-type:alpha">` +
      `<rect ${rect} fill="url(#xyz-field-fade-${row})"/></mask>`;
    body += `<rect ${rect} fill="url(#xyz-field-${row})"/>` +
      `<rect ${rect} fill="url(#xyz-field-${row + 1})" mask="url(#xyz-field-mask-${row})"/>`;
  }
  return { defs, body };
}
