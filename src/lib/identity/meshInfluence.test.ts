import { strict as assert } from "node:assert";
import { test } from "node:test";
import { influenceSampler } from "./meshInfluence";
import { MESH_DEFAULTS, meshPoints } from "./meshGradient";

const colors = ["meshTopLeft", "meshTopRight", "meshBottomLeft", "meshBottomRight"] as const;
const ranges = ["meshTopLeftRange", "meshTopRightRange", "meshBottomLeftRange", "meshBottomRightRange"] as const;

test("moving gradient endpoints do not introduce straight derivative discontinuities", () => {
  const h = 0.00001;
  for (const phase of [0, 0.13, 0.37, 0.7, 0.95]) {
    for (const range of [20, 100, 200]) {
      const p = { ...MESH_DEFAULTS, meshTopLeftRange: range };
      const points = meshPoints(p, phase);
      const sample = influenceSampler(p, points);
      for (const [a, b] of [[points[0], points[1]], [points[2], points[3]]]) {
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const dx = (b[0] - a[0]) / length, dy = (b[1] - a[1]) / length;
        // Cross the old clamped gradient's start/stop lines perpendicularly.
        for (const end of [a, b]) {
          const x = end[0] - dy * 0.1, y = end[1] + dx * 0.1;
          const left = sample(x - dx * h, y - dy * h);
          const center = sample(x, y);
          const right = sample(x + dx * h, y + dy * h);
          for (let c = 0; c < 3; c++) {
            const slopeJump = Math.abs((right[c] - center[c]) / h - (center[c] - left[c]) / h);
            assert(slopeJump < 0.2, `crease at phase=${phase}, range=${range}: ${slopeJump}`);
          }
        }
      }
    }
  }
});

test("color mixing depends on radial distance, not the orientation of a line", () => {
  const points = meshPoints(MESH_DEFAULTS, 0.37);
  const a = influenceSampler(MESH_DEFAULTS, points)(0.3, 0.6);
  const b = influenceSampler(MESH_DEFAULTS, points.map(([x, y]) => [1 - y, x]))(0.4, 0.3);
  a.forEach((v, i) => assert(Math.abs(v - b[i]) < 1e-10));
});

test("each influence range expands its own color without gaps or invalid colors", () => {
  for (let i = 0; i < 4; i++) {
    const p = { ...MESH_DEFAULTS, ...Object.fromEntries(colors.map((key, j) => [key, i === j ? "#ffffff" : "#000000"])) };
    const values = [20, 100, 200].map(range => {
      const params = { ...p, [ranges[i]]: range };
      return influenceSampler(params, meshPoints(params, 0.3))(0.5, 0.5)[0];
    });
    assert(values[0] < values[1] && values[1] < values[2]);
  }
  for (const range of [20, 200]) {
    const p = { ...MESH_DEFAULTS, ...Object.fromEntries(ranges.map(key => [key, range])) };
    const sample = influenceSampler(p, meshPoints(p, 0.5));
    for (let y = 0; y <= 10; y++) for (let x = 0; x <= 10; x++) {
      assert(sample(x / 10, y / 10).every(v => Number.isFinite(v) && v >= 0 && v <= 255));
    }
  }
});

test("the color loop is seamless and motion zero holds the field still", () => {
  const color = (phase: number, motion = MESH_DEFAULTS.meshMotion) => {
    const p = { ...MESH_DEFAULTS, meshMotion: motion };
    return influenceSampler(p, meshPoints(p, phase))(0.35, 0.6);
  };
  assert.deepEqual(color(0), color(1));
  assert.notDeepEqual(color(0), color(0.5));
  assert.deepEqual(color(0, 0), color(0.5, 0));
});
