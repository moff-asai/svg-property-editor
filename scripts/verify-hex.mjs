import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';

const result = await build({
  stdin: {
    contents: `export * from './src/lib/identity/hexGeometry';
      export * from './src/lib/identity/liquidGlass';
      export * from './src/lib/identity/hexHalo';`,
    resolveDir: process.cwd(),
  },
  bundle: true, write: false, platform: 'node', format: 'esm',
});
const { hexagonDistance, hexDotWeight, hexDotAppearance, createHexRimPulse, createLiquidGlass, LIQUID_GLASS_DEFAULTS,
  createHexHalo, HEX_HALO_DEFAULTS } = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);

const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
for (const rot of [0, Math.PI / 6, 0.371, Math.PI * 2]) {
  const distance = hexagonDistance(100, rot);
  near(distance(0, 0), -100 * Math.sqrt(3) / 2);
  for (let i = 0; i < 6; i++) {
    const angle = rot + i * Math.PI / 3;
    near(distance(100 * Math.cos(angle), 100 * Math.sin(angle)), 0);
    near(distance(113 * Math.cos(angle), 113 * Math.sin(angle)), 13);
    const normal = angle + Math.PI / 6;
    const apothem = 100 * Math.sqrt(3) / 2;
    for (const offset of [-5, 0, 5]) {
      near(distance((apothem + offset) * Math.cos(normal), (apothem + offset) * Math.sin(normal)), offset);
    }
  }
}
assert.ok(hexDotWeight(-3, 15) > 0, 'Dots must remain visible just inside the nominal boundary');
assert.ok(hexDotWeight(0, 15) < 1, 'Boundary dots must taper');
for (let d = -30; d < 30; d += 0.1) {
  assert.ok(hexDotWeight(d, 15) <= hexDotWeight(d + 0.1, 15));
  near(hexDotWeight(d, 15), hexDotWeight(d * 2, 30));
}

for (let weight = 0; weight <= 1; weight += 0.01) {
  const one = hexDotAppearance(weight, 1);
  const two = hexDotAppearance(weight, 2);
  assert.equal(two.radius, 1, 'Pattern 2 must not shrink boundary dots');
  near(one.radius ** 2 * one.opacity, two.radius ** 2 * two.opacity);
  assert.deepEqual(hexDotAppearance(weight), one, 'Legacy saves use pattern 1');
}

// Pattern 3: sixfold symmetry, smooth seam and repeating bright/dim states.
for (const phase of [0, 1 / 48, 1 / 24, 1 / 16]) {
  const pulse = createHexRimPulse(100, 0, 10, phase);
  for (let side = 0; side < 6; side++) {
    const angle = (side + 0.5) * Math.PI / 3;
    near(pulse(Math.cos(angle) * 100, Math.sin(angle) * 100, 0), pulse(100 * Math.cos(Math.PI / 6), 50, 0));
  }
  near(pulse(200, 0, 100), 1, 0);
  near(pulse(100, 0.000001, 0), pulse(100, -0.000001, 0), 1e-6);
  near(pulse(100, 20, 0), createHexRimPulse(100, 0, 10, phase + 1)(100, 20, 0));
}
near(createHexRimPulse(100, 0, 10, 0)(75, Math.sqrt(3) * 25, 0), 1);
near(createHexRimPulse(100, 0, 10, 1 / 24)(75, Math.sqrt(3) * 25, 0), 0.12);
assert.equal(hexDotAppearance(0.2, 3).radius, 1);

// Record drawing commands, not raster pixels. The mock intentionally has no
// clip/erase API: a renderer that introduces clipping fails this verification.
const contexts = [];
function context() {
  const ctx = {
    dots: [], globalAlpha: 1, fillStyle: '', filter: 'none',
    save() {}, restore() {}, setTransform() {}, scale() {},
    clearRect() { this.dots = []; }, fillRect() {},
    beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {},
    createRadialGradient() { return { addColorStop() {} }; },
    getImageData(_x, _y, w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; },
    opacity() { return this.fillStyle.startsWith('rgba(') ? Number(this.fillStyle.split(',').at(-1).replace(')', '')) : this.globalAlpha; },
    arc(x, y, rx) { this.dots.push({ x, y, rx, ry: rx, opacity: this.opacity() }); },
    ellipse(x, y, rx, ry) { this.dots.push({ x, y, rx, ry, opacity: this.opacity() }); },
    drawImage() {},
  };
  contexts.push(ctx);
  return ctx;
}
globalThis.document = {
  createElement(tag) {
    assert.equal(tag, 'canvas');
    const ctx = context();
    return { width: 0, height: 0, getContext: () => ctx };
  },
};
function svgDots(svg) {
  assert.ok(!/<(?:mask|clipPath)|clip-path=|NaN|Infinity/.test(svg));
  return [...svg.matchAll(/<(circle|ellipse)\s+([^>]+)\/>/g)].map(([, tag, attributes]) => {
    const attr = Object.fromEntries([...attributes.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v]));
    return { x: +attr.cx, y: +attr.cy, rx: +(tag === 'circle' ? attr.r : attr.rx), ry: +(tag === 'circle' ? attr.r : attr.ry), opacity: +attr.opacity };
  });
}
function compare(canvas, svg) {
  assert.equal(canvas.length, svg.length);
  assert.ok(svg.length > 100);
  canvas.forEach((dot, i) => {
    near(dot.x, svg[i].x, 0.051); near(dot.y, svg[i].y, 0.051);
    near(dot.rx, svg[i].rx, 0.0051); near(dot.ry, svg[i].ry, 0.0051);
    near(dot.opacity, svg[i].opacity, 0.0011);
  });
}
const liquid = createLiquidGlass();
for (const phase of [0, 1 / 48, 1 / 24, 0.25, 0.5, 0.75, 1]) {
  for (const patch of [{}, { hexRot: 23, hexSpin: 1, dotAspect: 0.6 }, { hexMask: 0 }, { density: 180 }, { innerDotPattern: 2 }, { innerDotPattern: 2, hexSpin: 1, dotAspect: 0.6 }, { innerDotPattern: 3 }, { innerDotPattern: 3, hexSpin: 1, dotAspect: 0.6 }]) {
    const params = { ...LIQUID_GLASS_DEFAULTS, wordmark: 0, ...patch };
    const ctx = context();
    for (const c of contexts) c.dots = [];
    liquid.render(ctx, 1280, 720, phase, params);
    const drawn = contexts.flatMap(c => c.dots);
    const svg = liquid.toSvg({ phase, params, loopSeconds: 6 });
    compare(drawn, svgDots(svg));
    const small = context();
    for (const c of contexts) c.dots = [];
    liquid.render(small, 640, 360, phase, params);
    compare(contexts.flatMap(c => c.dots).map(d => ({ ...d, x: d.x * 2, y: d.y * 2, rx: d.rx * 2, ry: d.ry * 2 })), svgDots(svg));
  }
}
const halo = createHexHalo();
for (const phase of [0, 1 / 48, 1 / 24, 0.25, 0.5, 0.75, 1]) {
  for (const patch of [{}, { hexConcave: 0.4, v0: 1, v3: 0.6 }, { pattern: 4, fade: 8 }, { innerDotPattern: 2 }, { innerDotPattern: 2, hexConcave: 0.2, v0: 0.5 }, { innerDotPattern: 3 }, { innerDotPattern: 3, flowSpeed: 0 }]) {
    const params = { ...HEX_HALO_DEFAULTS, ...patch };
    const ctx = context();
    halo.render(ctx, 1080, 1080, phase, params);
    const dotContext = contexts.findLast(c => c !== ctx && c.dots.length > 100);
    compare(dotContext.dots, svgDots(halo.toSvg({ phase, params, loopSeconds: 6 })));
  }
}
// Compare whole dots against the same unmasked field: pattern 2 may only
// change opacity, never positions, sizes, or ellipse orientation.
for (const phase of [0, 0.137, 0.5, 0.821]) {
  const params = { ...LIQUID_GLASS_DEFAULTS, innerDotPattern: 2, wordmark: 0 };
  const whole = svgDots(liquid.toSvg({ phase, params: { ...params, hexMask: 0 }, loopSeconds: 6 }));
  const index = new Map(whole.map(dot => [`${dot.x}:${dot.y}`, dot]));
  const faded = svgDots(liquid.toSvg({ phase, params, loopSeconds: 6 }));
  let partial = 0;
  for (const dot of faded) {
    const original = index.get(`${dot.x}:${dot.y}`);
    if (!original) continue;
    near(dot.rx, original.rx); near(dot.ry, original.ry);
    assert.ok(dot.opacity <= original.opacity + 0.001);
    if (dot.opacity > 0.01 && dot.opacity < original.opacity * 0.9) partial++;
  }
  assert.ok(partial > 30, 'Multiple rows of full dots must fade, not a hard cutout');
  const svg = liquid.toSvg({ phase, params, loopSeconds: 6 });
  assert.equal(svg, liquid.toSvg({ phase, params: JSON.parse(JSON.stringify(params)), loopSeconds: 6 }));
}
for (const [renderer, defaults] of [[liquid, LIQUID_GLASS_DEFAULTS], [halo, HEX_HALO_DEFAULTS]]) {
  const legacy = { ...defaults };
  delete legacy.innerDotPattern;
  const expected = renderer.toSvg({ phase: 0.3, params: { ...defaults, innerDotPattern: 1 }, loopSeconds: 6 });
  renderer.toSvg({ phase: 0.3, params: { ...defaults, innerDotPattern: 2 }, loopSeconds: 6 });
  assert.equal(renderer.toSvg({ phase: 0.3, params: legacy, loopSeconds: 6 }), expected);
}
// Freeze the underlying field: pattern 3 still visibly blinks, but each dot
// keeps its position and radius and the outer field is not modulated.
for (const [renderer, defaults] of [[liquid, LIQUID_GLASS_DEFAULTS], [halo, HEX_HALO_DEFAULTS]]) {
  const params = { ...defaults, wordmark: 0, innerDotPattern: 3, animA: 0, animB: 0, flowSpeed: 0 };
  const first = svgDots(renderer.toSvg({ phase: 0, params, loopSeconds: 6 }));
  const second = svgDots(renderer.toSvg({ phase: 1 / 24, params, loopSeconds: 6 }));
  const index = new Map(first.map(dot => [`${dot.x}:${dot.y}`, dot]));
  let blinking = 0;
  let unchanged = 0;
  for (const dot of second) {
    const original = index.get(`${dot.x}:${dot.y}`);
    if (!original) continue;
    near(dot.rx, original.rx); near(dot.ry, original.ry);
    if (Math.abs(dot.opacity - original.opacity) > 0.05) blinking++;
    if (Math.abs(dot.opacity - original.opacity) < 0.001) unchanged++;
  }
  assert.ok(blinking > 30, 'Inner rim must visibly blink');
  assert.ok(unchanged > 100, 'Outer dots must remain unaffected');
  const svg = renderer.toSvg({ phase: 0.037, params, loopSeconds: 6 });
  assert.equal(svg, renderer.toSvg({ phase: 0.037, params: JSON.parse(JSON.stringify(params)), loopSeconds: 6 }));
}
console.log('PASS: pattern 1 compatibility, full-size pattern 2, geometric blinking pattern 3, smooth opacity, save roundtrip, six edges/vertices, rotation, scale invariance, Canvas/SVG geometry and opacity, animation phases and deformed hexagons');
if (process.argv[2]) {
  const output = process.argv[2];
  await mkdir(output, { recursive: true });
  for (const [name, renderer, params] of [
    ['liquid', liquid, LIQUID_GLASS_DEFAULTS], ['halo', halo, HEX_HALO_DEFAULTS],
  ]) {
    for (const phase of [0, 1 / 48, 1 / 24, 1 / 16, 0.25, 0.5, 0.75]) {
      await writeFile(`${output}/${name}-${phase}.svg`, renderer.toSvg({ phase, params, loopSeconds: 6 }));
      await writeFile(`${output}/${name}-pattern2-${phase}.svg`, renderer.toSvg({ phase, params: { ...params, innerDotPattern: 2 }, loopSeconds: 6 }));
      await writeFile(`${output}/${name}-pattern3-${phase}.svg`, renderer.toSvg({ phase, params: { ...params, innerDotPattern: 3 }, loopSeconds: 6 }));
    }
  }
}
