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

test("each moving point visits every quadrant and changes order with its neighbors", () => {
  const quadrants = Array.from({ length: 4 }, () => new Set<string>());
  const horizontalOrder = new Set<boolean>();
  for (let frame = 0; frame < 120; frame++) {
    const points = meshPoints(MESH_DEFAULTS, frame / 120);
    points.forEach(([x, y], i) => quadrants[i].add(`${x < 0.5},${y < 0.5}`));
    horizontalOrder.add(points[0][0] < points[1][0]);
  }
  quadrants.forEach(visited => assert.equal(visited.size, 4));
  assert.equal(horizontalOrder.size, 2);
});

test("mixing paths stay inside the inset and join with continuous velocity", () => {
  for (const meshMotion of [0, 0.01, 0.2, 0.35]) {
    for (const [meshInsetX, meshInsetY] of [[0, 0.4], [0.4, 0], [0.08, 0.08]]) {
      const p = { ...MESH_DEFAULTS, meshMotion, meshInsetX, meshInsetY };
      for (let frame = 0; frame <= 120; frame++) {
        for (const [x, y] of meshPoints(p, frame / 120)) {
          assert(x >= meshInsetX - 1e-12 && x <= 1 - meshInsetX + 1e-12);
          assert(y >= meshInsetY - 1e-12 && y <= 1 - meshInsetY + 1e-12);
        }
      }
      const h = 1e-5;
      const before = meshPoints(p, 1 - h), start = meshPoints(p, 0), after = meshPoints(p, h);
      assert.deepEqual(start, meshPoints(p, 1));
      start.forEach((point, i) => point.forEach((value, axis) => {
        const velocityJump = Math.abs((after[i][axis] - value) / h - (value - before[i][axis]) / h);
        assert(velocityJump < 0.001);
      }));
    }
  }
});
