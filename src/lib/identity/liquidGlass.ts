// dynamic-identity-generator3.html コンテンツ 03「LIQUID GLASS / HALFTONE FIELD」
// (drawC3 HTML:1644-1742 ほか) を移植。orbitype 方式のドット場＋中央の形状(soft/glass)。
// raster（getImageDataで色サンプリング・ブラー）。アルゴリズムは原典と同一。
// 注: 原典の「円ごとの設定(PER BLOB, 'p')」UIは今回のコントロールには含めず、
//     circles は既定値を使用する。
import {
  TAU,
  RAD,
  clamp,
  rgba,
  rgbOf,
  cstr,
  smoothstep,
  mulberry32,
  softDraw,
  vignette,
  grain,
  fillBg,
  LayerCache,
} from "./engine";
import type { CanvasRenderer, ControlsSpec, Params } from "./types";

interface CircleDef {
  col: string;
  x: number;
  y: number;
  r: number;
  a: number;
  ring: number;
  wob: number;
}

export interface LiquidGlassParams {
  zoom: number;
  bg: string;
  hexMode: string; // soft|glass|none
  hexR: number;
  hexRot: number;
  hexSpin: number;
  white: number;
  softBlur: number;
  glass: number;
  rim: number;
  refract: number;
  hexMask: number;
  halftone: number;
  density: number;
  ringR: number;
  thickness: number;
  fieldBlur: number;
  threshold: number;
  frequency: number;
  wave: number;
  turbulence: number;
  swirl: number;
  contrast: number;
  dotScale: number;
  dotAspect: number;
  fieldRot: number;
  fieldScale: number;
  dotAlpha: number;
  dotSource: string; // blob|solid
  dotColor: string;
  animA: number;
  animB: number;
  count: number;
  blend: string;
  wobble: number;
  blur: number;
  scale: number;
  grid: number;
  gridColor: string;
  gridOpacity: number;
  gridCell: number;
  gridFade: number;
  gridW: number;
  grain: number;
  vignette: number;
  seed: number;
  circles: CircleDef[];
  transparent?: number; // 背景透過（1でclear）
}

function honeyGrid(
  c: CanvasRenderingContext2D,
  W: number,
  H: number,
  P: LiquidGlassParams,
  S: number,
  cache: LayerCache,
) {
  const L = cache.get("c3g", W, H),
    x = L.x;
  const R = P.gridCell * S,
    px = 1.5 * R,
    pz = Math.sqrt(3) * R;
  x.strokeStyle = rgba(P.gridColor, 1);
  x.lineWidth = Math.max(0.4, P.gridW * S);
  x.beginPath();
  const qn = Math.ceil(W / px) + 1,
    rn = Math.ceil(H / pz) + 1;
  for (let q = -qn; q <= qn; q++)
    for (let r = -rn; r <= rn; r++) {
      const cx = W / 2 + px * q,
        cy = H / 2 + pz * (r + q / 2);
      if (cx < -R * 2 || cx > W + R * 2 || cy < -R * 2 || cy > H + R * 2) continue;
      for (let k = 0; k < 6; k++) {
        const a1 = (TAU * k) / 6,
          a2 = (TAU * (k + 1)) / 6;
        x.moveTo(cx + R * Math.cos(a1), cy + R * Math.sin(a1));
        x.lineTo(cx + R * Math.cos(a2), cy + R * Math.sin(a2));
      }
    }
  x.stroke();
  x.globalCompositeOperation = "destination-in";
  const g = x.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.6);
  const inner = clamp(1 - P.gridFade, 0.02, 0.96);
  g.addColorStop(0, "rgba(0,0,0,1)");
  g.addColorStop(inner, "rgba(0,0,0,1)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = "source-over";
  c.globalAlpha = P.gridOpacity;
  c.drawImage(L.c, 0, 0);
  c.globalAlpha = 1;
}

function wobblyRing(
  x: CanvasRenderingContext2D,
  cc: CircleDef,
  i: number,
  ph: number,
  P: LiquidGlassParams,
  W: number,
  H: number,
) {
  const w = P.wobble * cc.wob;
  const R = cc.r * H * P.scale * P.zoom;
  const f1 = 1 + (i % 2),
    f2 = 2 + (i % 3),
    f3 = 3 + (i % 2);
  const X = W / 2 + cc.x * H * P.zoom + Math.sin(TAU * (ph * f1) + i * 1.1) * w * H * 0.045;
  const Y = H / 2 + cc.y * H * P.zoom + Math.cos(TAU * (ph * f2) + i * 0.7) * w * H * 0.045;
  const N = 72,
    pts: number[][] = [];
  for (let k = 0; k < N; k++) {
    const t = (k / N) * TAU;
    const m =
      1 +
      0.1 * w * Math.sin(3 * t + TAU * ph * f1 + i) +
      0.06 * w * Math.sin(5 * t - TAU * ph * f3 + i * 2) +
      0.04 * w * Math.sin(2 * t + TAU * ph * f2);
    pts.push([X + Math.cos(t) * R * m, Y + Math.sin(t) * R * m]);
  }
  const g = x.createRadialGradient(X, Y, Math.max(1, R * cc.ring * 0.55), X, Y, R * 1.02);
  g.addColorStop(0, rgba(cc.col, cc.ring > 0.04 ? 0 : cc.a));
  g.addColorStop(clamp(cc.ring, 0.02, 0.92), rgba(cc.col, cc.a));
  g.addColorStop(1, rgba(cc.col, 0));
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k < N; k++) x.lineTo(pts[k][0], pts[k][1]);
  x.closePath();
  x.fill();
}

function inHex(px: number, py: number, cx: number, cy: number, r: number, rot: number, pad: number) {
  const inr = r * Math.cos(Math.PI / 6) - (pad || 0);
  const dx = px - cx,
    dy = py - cy;
  for (let k = 0; k < 6; k++) {
    const m = rot + (TAU * k) / 6 - Math.PI / 2 + Math.PI / 6;
    if (dx * Math.cos(m) + dy * Math.sin(m) > inr) return false;
  }
  return true;
}
function hexPath(x: CanvasRenderingContext2D, cx: number, cy: number, r: number, rot: number) {
  x.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = rot + (TAU * k) / 6 - Math.PI / 2;
    const px = cx + r * Math.cos(a),
      py = cy + r * Math.sin(a);
    if (k === 0) x.moveTo(px, py);
    else x.lineTo(px, py);
  }
  x.closePath();
}
const spacingPx = (P: LiquidGlassParams, u: number) =>
  (2.06 / (Math.max(17, Math.round(P.density)) - 1)) * u;

interface Dot {
  x: number;
  y: number;
  i: number;
  ang: number;
  sr: number;
}
function dotField(P: LiquidGlassParams, ph: number): Dot[] {
  const count = Math.max(17, Math.round(P.density));
  const r = mulberry32(P.seed);
  const phaseA = r() * TAU + TAU * ph * P.animA;
  const phaseB = r() * TAU - TAU * ph * P.animB;
  const spacing = 2.06 / (count - 1);
  const rotation = P.fieldRot * RAD;
  const out: Dot[] = [];
  const thr = P.threshold;
  for (let row = 0; row < count; row++)
    for (let col = 0; col < count; col++) {
      const gx = -1.03 + col * spacing,
        gy = -1.03 + row * spacing;
      const sr = Math.hypot(gx, gy),
        sa = Math.atan2(gy, gx);
      const dist =
        0.64 * Math.sin(P.frequency * sa + phaseA) +
        0.24 * Math.sin(2 * sa - phaseB) +
        0.12 * Math.sin(7 * sa + phaseB);
      const rough = P.turbulence * 0.045 * (0.65 * Math.sin(3 * sa + phaseB) + 0.35 * Math.sin(9 * sa - phaseA));
      const ringR = clamp(P.ringR + P.wave * 0.15 * dist + rough, 0.12, 0.95);
      const dc = Math.abs(sr - ringR);
      const dOut = Math.max(0, dc - P.thickness / 2);
      const sig = Math.max(0.012, P.fieldBlur);
      const blurred = Math.exp(-0.5 * Math.pow(dOut / sig, 2));
      const light = 0.9 + 0.1 * Math.sin(sa * 2 - phaseA);
      const val = clamp(blurred * light, 0, 1);
      const th = smoothstep(thr, Math.min(1, thr + 0.72), val);
      const inten = Math.pow(th, 0.58 + P.contrast * 0.78);
      if (inten < 0.015) continue;
      const env = Math.exp(-Math.pow((sr - ringR) / Math.max(0.18, P.fieldBlur * 2.4), 2));
      const aFlow = P.swirl * 0.2 * env + P.turbulence * 0.075 * Math.sin(3 * sa + sr * 8 + phaseB);
      const rFlow =
        P.swirl * 0.018 * env * Math.sin(P.frequency * sa + phaseA) +
        P.turbulence * 0.018 * Math.sin(gx * 9 - gy * 7 + phaseB);
      const wr = Math.max(0, sr + rFlow),
        wa = sa + aFlow;
      let x = wr * Math.cos(wa),
        y = wr * Math.sin(wa);
      x += P.turbulence * 0.035 * Math.sin(y * 6 + phaseA);
      y += P.turbulence * 0.028 * Math.sin(x * 7 - phaseB);
      const rx0 = x * Math.cos(rotation) - y * Math.sin(rotation);
      const ry0 = x * Math.sin(rotation) + y * Math.cos(rotation);
      out.push({ x: rx0, y: ry0, i: inten, ang: wa + Math.PI / 2 + rotation, sr });
    }
  return out;
}

function drawC3(
  c: CanvasRenderingContext2D,
  W: number,
  H: number,
  ph: number,
  P: LiquidGlassParams,
  cache: LayerCache,
) {
  const S = W / 1280;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  c.filter = "none";
  c.globalCompositeOperation = "source-over";
  fillBg(c, W, H, P.bg, !!P.transparent);
  if (P.grid && P.gridOpacity > 0) honeyGrid(c, W, H, P, S, cache);

  const q = 0.5,
    fw = Math.max(2, Math.round(W * q)),
    fh = Math.max(2, Math.round(H * q));
  const F = cache.get("c3f", fw, fh),
    fx = F.x;
  fx.save();
  fx.scale(q, q);
  fx.globalCompositeOperation = P.blend as GlobalCompositeOperation;
  for (let i = 0; i < P.count; i++) wobblyRing(fx, P.circles[i], i, ph, P, W, H);
  fx.restore();

  const rot = P.hexRot * RAD + ph * TAU * P.hexSpin;
  const hr = P.hexR * H * P.zoom;

  if (P.halftone) {
    const sw = Math.max(8, Math.round(W / 6)),
      sh = Math.max(8, Math.round(H / 6));
    const SM = cache.get("sample", sw, sh);
    softDraw(SM.x, F.c, P.blur * S * q * (sw / W), 1, "source-over", sw, sh, cache);
    const d = SM.x.getImageData(0, 0, sw, sh).data;
    const field = dotField(P, ph);
    const u = Math.min(W, H) * 0.395 * P.zoom * P.fieldScale;
    const cellPx = spacingPx(P, u);
    const base = rgbOf(P.dotColor);
    for (let i = 0; i < field.length; i++) {
      const dt = field[i];
      const px = W / 2 + dt.x * u,
        py = H / 2 + dt.y * u;
      if (px < -20 || px > W + 20 || py < -20 || py > H + 20) continue;
      const rx = cellPx * 0.5 * P.dotScale * (0.35 + 0.75 * Math.sqrt(dt.i));
      const ry = rx * P.dotAspect;
      if (rx < 0.25) continue;
      if (P.hexMask && P.hexMode !== "none" && inHex(px, py, W / 2, H / 2, hr, rot, -rx)) continue;
      let col = base,
        sa = 1;
      if (P.dotSource === "blob") {
        const sx = clamp(Math.round((px / W) * sw), 0, sw - 1),
          sy = clamp(Math.round((py / H) * sh), 0, sh - 1);
        const k = (sy * sw + sx) * 4;
        sa = d[k + 3] / 255;
        col = sa > 0.06 ? [d[k], d[k + 1], d[k + 2]] : base;
      }
      const a = clamp(dt.i * P.dotAlpha * (P.dotSource === "blob" ? 0.25 + 0.75 * sa : 1), 0, 1);
      if (a < 0.02) continue;
      c.fillStyle = cstr(col, a);
      c.beginPath();
      if (Math.abs(P.dotAspect - 1) < 0.02) c.arc(px, py, rx, 0, TAU);
      else c.ellipse(px, py, rx, ry, dt.ang, 0, TAU);
      c.fill();
    }
  } else {
    softDraw(c, F.c, P.blur * S * q, 1, "source-over", W, H, cache);
  }

  if (P.hexMode === "soft") {
    const L = cache.get("c3h", Math.round(W * 0.5), Math.round(H * 0.5)),
      hx = L.x;
    hx.save();
    hx.scale(0.5, 0.5);
    hexPath(hx, W / 2, H / 2, hr, rot);
    hx.fillStyle = "rgba(255,255,255," + P.white + ")";
    hx.fill();
    hx.restore();
    softDraw(c, L.c, Math.max(2, P.softBlur) * S * 0.5, 1, "source-over", W, H, cache);
  } else if (P.hexMode === "glass") {
    const T = cache.get("c3t", Math.round(W * 0.5), Math.round(H * 0.5));
    T.x.drawImage(c.canvas, 0, 0, T.c.width, T.c.height);
    c.save();
    hexPath(c, W / 2, H / 2, hr, rot);
    c.clip();
    if (P.glass > 0) softDraw(c, T.c, P.glass * S * 0.5, 1, "source-over", W, H, cache);
    else c.drawImage(T.c, 0, 0, W, H);
    if (P.refract > 0) {
      c.save();
      hexPath(c, W / 2, H / 2, hr * clamp(1 - P.refract * 0.22, 0.4, 0.99), rot);
      c.globalCompositeOperation = "destination-out";
      c.fillStyle = "#000";
      c.fill();
      c.restore();
      c.save();
      hexPath(c, W / 2, H / 2, hr, rot);
      c.clip();
      c.translate(W / 2, H / 2);
      c.scale(1 + P.refract * 0.1, 1 + P.refract * 0.1);
      c.translate(-W / 2, -H / 2);
      c.globalAlpha = 0.9;
      c.drawImage(T.c, 0, 0, W, H);
      c.globalAlpha = 1;
      c.restore();
      c.save();
      hexPath(c, W / 2, H / 2, hr, rot);
      c.clip();
    }
    c.fillStyle = "rgba(255,255,255," + P.white + ")";
    c.fillRect(0, 0, W, H);
    if (P.rim > 0) {
      const g = c.createLinearGradient(W / 2 - hr, H / 2 - hr, W / 2 + hr, H / 2 + hr);
      g.addColorStop(0, "rgba(255,255,255," + P.rim * 0.6 + ")");
      g.addColorStop(0.45, "rgba(255,255,255,0)");
      g.addColorStop(1, "rgba(255,255,255," + P.rim * 0.32 + ")");
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
    }
    if (P.refract > 0) c.restore();
    c.restore();
    if (P.rim > 0) {
      c.save();
      hexPath(c, W / 2, H / 2, hr, rot);
      c.strokeStyle = "rgba(255,255,255," + clamp(0.22 + P.rim * 0.6, 0, 1) + ")";
      c.lineWidth = Math.max(0.8, 1.4 * S);
      c.stroke();
      c.restore();
    }
  }
  vignette(c, W, H, P.vignette);
  grain(c, W, H, P.grain, ph);
}

// defaults (D3 HTML:2039-2058)
// 既定値は Downloads のスクリーンショット3枚（generator3 の LIQUID GLASS 設定）に準拠。
// transparent は当アプリの方針として維持（bg は透過ONなら無視）。
export const LIQUID_GLASS_DEFAULTS: LiquidGlassParams = {
  zoom: 0.65,
  bg: "#000000",
  hexMode: "soft",
  hexR: 0.175,
  hexRot: 0,
  hexSpin: 0,
  white: 0,
  softBlur: 26,
  glass: 44,
  rim: 0.7,
  refract: 0.22,
  hexMask: 1,
  halftone: 1,
  density: 49,
  ringR: 0.6,
  thickness: 0.44,
  fieldBlur: 0.105,
  threshold: 0.54,
  frequency: 9,
  wave: 0,
  turbulence: 0.76,
  swirl: 0,
  contrast: 1.26,
  dotScale: 0.62,
  dotAspect: 0.6,
  fieldRot: 9,
  fieldScale: 1,
  dotAlpha: 1,
  dotSource: "blob",
  dotColor: "#ffffff",
  animA: 2,
  animB: 3,
  count: 6,
  blend: "lighter",
  wobble: 1,
  blur: 80,
  scale: 1,
  grid: 0,
  gridColor: "#9aa0b5",
  gridOpacity: 0,
  gridCell: 22,
  gridFade: 0.6,
  gridW: 1,
  grain: 0.06,
  vignette: 0.15,
  seed: 77,
  transparent: 1,
  circles: [
    { col: "#4b3bf5", x: -0.09, y: -0.05, r: 0.4, a: 0.9, ring: 0.52, wob: 1.0 },
    { col: "#db0000", x: 0.11, y: 0.07, r: 0.34, a: 0.8, ring: 0.6, wob: 1.4 },
    { col: "#2f6bff", x: 0.02, y: 0.13, r: 0.3, a: 0.65, ring: 0.38, wob: 0.8 },
    { col: "#a08bff", x: -0.06, y: 0.02, r: 0.24, a: 0.6, ring: 0.68, wob: 1.2 },
    { col: "#3ad2ff", x: 0.15, y: -0.11, r: 0.2, a: 0.5, ring: 0.48, wob: 1.6 },
    { col: "#ff7ad9", x: -0.17, y: 0.09, r: 0.18, a: 0.45, ring: 0.58, wob: 1.0 },
  ],
};

// presets (PRESETS[3] HTML:2427-2432)
export const LIQUID_GLASS_PRESETS: Partial<LiquidGlassParams>[] = [
  { hexMode: "soft", white: 0.95, softBlur: 26, halftone: 1, dotSource: "blob", blend: "lighter", bg: "#000000", grid: 0, swirl: 1.15, turbulence: 0.55 },
  { hexMode: "soft", white: 1, softBlur: 34, halftone: 1, dotSource: "solid", dotColor: "#ffffff", bg: "#000000", grid: 0, swirl: 1.9, turbulence: 1.1, density: 120, thickness: 0.2, ringR: 0.66 },
  { hexMode: "glass", white: 0.14, glass: 44, rim: 0.7, halftone: 0, blend: "lighter", bg: "#050508", grid: 1, gridOpacity: 0.2, gridCell: 30, blur: 80 },
  { hexMode: "none", halftone: 1, dotSource: "blob", blend: "lighter", bg: "#000000", grid: 1, gridOpacity: 0.12, gridCell: 22, density: 140, ringR: 0.5, thickness: 0.5, swirl: 0.4, turbulence: 0.2, dotScale: 0.7 },
];

// controls (CTL3 HTML:2186-2238, VIEW3/FIN 展開。PER BLOB 'p' は除外)
export const LIQUID_GLASS_CONTROLS: ControlsSpec = [
  ["表示 / VIEW", [["zoom", "ズーム", "r", 0.3, 2.6, 0.01, "×"]]],
  [
    "中央の形状 / CENTER",
    [
      ["hexMode", "モード", "s", ["soft", "glass", "none"]],
      ["hexR", "サイズ", "r", 0.05, 0.62, 0.005, ""],
      ["white", "白の不透明度", "r", 0, 1, 0.01, ""],
      ["softBlur", "ソフトのぼかし", "r", 0, 120, 1, "px"],
      ["glass", "ガラスの背景ぼかし", "r", 0, 80, 1, "px"],
      ["refract", "ガラスの縁の屈折", "r", 0, 1, 0.01, ""],
      ["rim", "ガラスの縁ハイライト", "r", 0, 1, 0.01, ""],
      ["hexMask", "内側のドットを抜く", "c"],
      ["hexRot", "回転", "r", 0, 360, 1, "°"],
      ["hexSpin", "1ループの回転数", "r", -2, 2, 1, "周"],
    ],
  ],
  [
    "ドット場 / HALFTONE",
    [
      ["halftone", "ドット表現", "c"],
      ["density", "密度（格子数）", "r", 24, 180, 1, ""],
      ["ringR", "リング半径", "r", 0.15, 0.9, 0.005, ""],
      ["thickness", "リングの太さ", "r", 0.02, 0.8, 0.005, ""],
      ["fieldBlur", "リングのぼかし", "r", 0.02, 0.5, 0.005, ""],
      ["threshold", "しきい値", "r", 0, 0.6, 0.005, ""],
      ["contrast", "コントラスト", "r", 0, 1.4, 0.01, ""],
      ["frequency", "歪みの周波数", "r", 1, 12, 1, ""],
      ["wave", "歪み量", "r", 0, 2.5, 0.01, ""],
      ["turbulence", "乱れ", "r", 0, 2, 0.01, ""],
      ["swirl", "渦", "r", 0, 3, 0.01, ""],
      ["dotScale", "ドット径", "r", 0.2, 2, 0.01, ""],
      ["dotAspect", "ドット縦横比", "r", 0.3, 2.4, 0.01, ""],
      ["fieldRot", "場の回転", "r", -180, 180, 1, "°"],
      ["fieldScale", "場のスケール", "r", 0.4, 1.8, 0.01, ""],
      ["animA", "歪みの周回数", "r", 0, 3, 1, "周"],
      ["animB", "渦の周回数", "r", 0, 3, 1, "周"],
    ],
  ],
  [
    "色 / COLOR",
    [
      ["dotSource", "ドットの色", "s", ["blob", "solid"]],
      ["dotColor", "単色時のカラー", "k"],
      ["dotAlpha", "ドットの不透明度", "r", 0, 1, 0.01, ""],
      ["count", "ブラー円の数", "r", 1, 6, 1, ""],
      ["scale", "円のスケール", "r", 0.4, 2, 0.01, ""],
      ["blur", "円のブラー", "r", 0, 140, 1, "px"],
      ["wobble", "円の揺らぎ", "r", 0, 3, 0.05, ""],
      ["blend", "円の合成", "s", ["source-over", "lighter", "multiply"]],
    ],
  ],
  [
    "背景ハニカム / GRID",
    [
      ["grid", "ハニカムを描く", "c"],
      ["gridColor", "色", "k"],
      ["gridOpacity", "濃度", "r", 0, 1, 0.01, ""],
      ["gridCell", "セルサイズ", "r", 8, 140, 1, "px"],
      ["gridW", "線の太さ", "r", 0.3, 3, 0.05, "px"],
      ["gridFade", "フチの透過", "r", 0, 1, 0.01, ""],
    ],
  ],
  [
    "質感 / FINISH",
    [
      ["transparent", "背景透過", "c"],
      ["grain", "グレイン", "r", 0, 1, 0.01, ""],
      ["vignette", "ビネット", "r", 0, 1, 0.01, ""],
      ["bg", "背景色", "k"],
      ["seed", "シード", "n"],
    ],
  ],
];

const rgbHex = (c: number[]) =>
  "#" +
  c
    .slice(0, 3)
    .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
    .join("");

// ハーフトーンのドット場を <circle>/<ellipse> で出力（イラレ編集可）。
// 色は原典と同じくブラー円レイヤーからサンプリング（solid時は単色）。
// glass/blur/背景ブロブ等の raster 効果は省略。
function liquidGlassSvg(P: LiquidGlassParams, ph: number, cache: LayerCache): string {
  const W = 1280,
    H = 720,
    S = W / 1280;
  const q = 0.5,
    fw = Math.max(2, Math.round(W * q)),
    fh = Math.max(2, Math.round(H * q));
  const F = cache.get("c3f", fw, fh),
    fx = F.x;
  fx.save();
  fx.scale(q, q);
  fx.globalCompositeOperation = P.blend as GlobalCompositeOperation;
  for (let i = 0; i < P.count; i++) wobblyRing(fx, P.circles[i], i, ph, P, W, H);
  fx.restore();

  let d: Uint8ClampedArray | null = null,
    sw = 0,
    sh = 0;
  if (P.dotSource === "blob") {
    sw = Math.max(8, Math.round(W / 6));
    sh = Math.max(8, Math.round(H / 6));
    const SM = cache.get("sample", sw, sh);
    softDraw(SM.x, F.c, P.blur * S * q * (sw / W), 1, "source-over", sw, sh, cache);
    d = SM.x.getImageData(0, 0, sw, sh).data;
  }

  const field = dotField(P, ph);
  const u = Math.min(W, H) * 0.395 * P.zoom * P.fieldScale;
  const cellPx = spacingPx(P, u);
  const base = rgbOf(P.dotColor);
  const rot = P.hexRot * RAD + ph * TAU * P.hexSpin;
  const hr = P.hexR * H * P.zoom;
  const shapes: string[] = [];
  for (let i = 0; i < field.length; i++) {
    const dt = field[i];
    const px = W / 2 + dt.x * u,
      py = H / 2 + dt.y * u;
    if (px < -20 || px > W + 20 || py < -20 || py > H + 20) continue;
    const rx = cellPx * 0.5 * P.dotScale * (0.35 + 0.75 * Math.sqrt(dt.i));
    const ry = rx * P.dotAspect;
    if (rx < 0.25) continue;
    if (P.hexMask && P.hexMode !== "none" && inHex(px, py, W / 2, H / 2, hr, rot, -rx)) continue;
    let col = base,
      sa = 1;
    if (d && P.dotSource === "blob") {
      const sx = clamp(Math.round((px / W) * sw), 0, sw - 1),
        sy = clamp(Math.round((py / H) * sh), 0, sh - 1);
      const k = (sy * sw + sx) * 4;
      sa = d[k + 3] / 255;
      col = sa > 0.06 ? [d[k], d[k + 1], d[k + 2]] : base;
    }
    const a = clamp(dt.i * P.dotAlpha * (P.dotSource === "blob" ? 0.25 + 0.75 * sa : 1), 0, 1);
    if (a < 0.02) continue;
    const fill = rgbHex(col);
    const o = a.toFixed(3);
    if (Math.abs(P.dotAspect - 1) < 0.02) {
      shapes.push(`<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${rx.toFixed(2)}" fill="${fill}" opacity="${o}"/>`);
    } else {
      const deg = ((dt.ang * 180) / Math.PI).toFixed(2);
      shapes.push(
        `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}" fill="${fill}" opacity="${o}" transform="rotate(${deg} ${px.toFixed(1)} ${py.toFixed(1)})"/>`,
      );
    }
  }
  const bgRect = P.transparent ? "" : `<rect width="${W}" height="${H}" fill="${P.bg}"/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    bgRect +
    shapes.join("") +
    `</svg>`
  );
}

export function createLiquidGlass(): CanvasRenderer {
  const cache = new LayerCache();
  return {
    render(ctx, W, H, phase, params: Params) {
      drawC3(ctx, W, H, phase, params as unknown as LiquidGlassParams, cache);
    },
    toSvg({ phase, params }) {
      return liquidGlassSvg(params as unknown as LiquidGlassParams, phase, cache);
    },
  };
}
