// dynamic-identity-generator3.html コンテンツ 03「LIQUID GLASS / HALFTONE FIELD」
// (drawC3 HTML:1644-1742 ほか) を移植。orbitype 方式のドット場＋中央の六角形の抜き穴。
// raster（getImageDataで色サンプリング・ブラー）。
// 注: HEX HALO と大きさ・位置を揃えるため既定を調整。中央形状のモード(soft/glass)・
//     白ぬり・背景ハニカム・質感(グレイン/ビネット)は当アプリの方針で廃止し、
//     モードは soft 相当（六角形の抜き穴）に固定。円ごとの設定(PER BLOB)は非対応。
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
  hexR: number;
  hexRot: number;
  hexSpin: number;
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
  seed: number;
  circles: CircleDef[];
  transparent?: number; // 背景透過（1でclear）
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
  // 「円のスケール」を大きくすると各ブラー円の着色帯が画面外へ逃げ、ドットが白(base)へ
  // フォールバックして色が飛ぶ。knee(2.2)を超える分は半径の伸びを緩やかに圧縮し、
  // スケールを大きくしても着色帯が画面内に残って色が全ドットへ反映されるようにする。
  // scale≦2.2（既定=1 を含む）は等倍で原典と同一。
  const sEff = P.scale <= 2.2 ? P.scale : 2.2 + (P.scale - 2.2) * 0.35;
  const R = cc.r * H * sEff * P.zoom;
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
      if (P.hexMask && inHex(px, py, W / 2, H / 2, hr, rot, -rx)) continue;
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
}

// defaults (D3 HTML:2039-2058)
// 既定値は Downloads のスクリーンショット3枚（generator3 の LIQUID GLASS 設定）に準拠。
// transparent は当アプリの方針として維持（bg は透過ONなら無視）。
export const LIQUID_GLASS_DEFAULTS: LiquidGlassParams = {
  // zoom 1.36 / hexR 0.125 は HEX HALO とハローの外径・六角穴の径が揃うよう調整済み。
  zoom: 1.36,
  bg: "#000000",
  hexR: 0.125,
  hexRot: 0,
  hexSpin: 0,
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

// presets（原典 PRESETS[3] を、モード=soft固定・ハニカム/ガラス廃止に合わせて再構成）
export const LIQUID_GLASS_PRESETS: Partial<LiquidGlassParams>[] = [
  { halftone: 1, dotSource: "blob", blend: "lighter", bg: "#000000", swirl: 1.15, turbulence: 0.55, scale: 1 },
  { halftone: 1, dotSource: "solid", dotColor: "#ffffff", bg: "#000000", swirl: 1.9, turbulence: 1.1, density: 120, thickness: 0.2, ringR: 0.66 },
  { halftone: 1, dotSource: "blob", blend: "lighter", bg: "#050508", swirl: 0.6, turbulence: 0.4, blur: 110, scale: 2, density: 60 },
  { halftone: 1, dotSource: "blob", blend: "lighter", bg: "#000000", density: 140, ringR: 0.5, thickness: 0.5, swirl: 0.4, turbulence: 0.2, dotScale: 0.7 },
];

// controls: HEX HALO と共通の並び（表示→中央の六角形→フォルム→色→モーション→背景）に
// 揃え、モード切替時も同機能セクションが同じ位置に来るようにする。
export const LIQUID_GLASS_CONTROLS: ControlsSpec = [
  ["表示 / VIEW", [["zoom", "ズーム", "r", 0.3, 2.6, 0.01, "×"]]],
  [
    "中央の六角形 / CENTER",
    [
      ["hexR", "穴サイズ", "r", 0.05, 0.62, 0.005, ""],
      ["hexRot", "回転", "r", 0, 360, 1, "°"],
      ["hexSpin", "1ループの回転数", "r", -2, 2, 1, "周"],
      ["hexMask", "内側のドットを抜く", "c"],
    ],
  ],
  [
    "フォルム / FORM",
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
    ],
  ],
  [
    "色 / COLOR",
    [
      ["dotSource", "ドットの色", "s", ["blob", "solid"]],
      ["dotColor", "単色時のカラー", "k"],
      ["dotAlpha", "ドットの不透明度", "r", 0, 1, 0.01, ""],
      ["count", "ブラー円の数", "r", 1, 6, 1, ""],
      ["scale", "円のスケール", "r", 0.4, 6, 0.01, ""],
      ["blur", "円のブラー", "r", 0, 140, 1, "px"],
      ["wobble", "円の揺らぎ", "r", 0, 3, 0.05, ""],
      ["blend", "円の合成", "s", ["source-over", "lighter", "multiply"]],
    ],
  ],
  [
    "モーション / MOTION",
    [
      ["animA", "歪みの周回数", "r", 0, 3, 1, "周"],
      ["animB", "渦の周回数", "r", 0, 3, 1, "周"],
    ],
  ],
  [
    "背景 / BACKGROUND",
    [
      ["transparent", "背景透過", "c"],
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
// 色はブラー円レイヤーからサンプリング（solid時は単色）。blur/背景ブロブ等の
// raster 効果は省略。
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
    if (P.hexMask && inHex(px, py, W / 2, H / 2, hr, rot, -rx)) continue;
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
