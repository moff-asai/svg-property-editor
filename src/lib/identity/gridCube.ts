// dynamic-identity-generator2.html コンテンツ 07「GRID CUBE LIGHT」(内部 TAB 1,
// drawC1 HTML:1198-1294) を移植。raster(canvas 2D)なので SVG 化はせずライブ描画＋
// canvas MP4 書き出しに用いる。アルゴリズムは原典と同一。
import {
  TAU,
  RAD,
  clamp,
  lerp2,
  rng,
  rgba,
  shifted,
  isLightBg,
  pr,
  rot3,
  poly,
  bbox,
  hull,
  softDraw,
  vignette,
  grain,
  dust,
  fillBg,
  LayerCache,
  type Cam,
} from "./engine";
import type { CanvasRenderer, ControlsSpec, Params } from "./types";

export interface GridCubeParams {
  zoom: number;
  posX: number;
  posY: number;
  bg: string;
  lights: number;
  coreColor: string;
  edgeColor: string;
  hueSpread: number;
  alpha: number;
  glow: number;
  spread: number;
  falloff: number;
  core: number;
  coreSize: number;
  bound: string; // "full" | "inner"
  boundScale: number;
  showBound: number;
  amp: number;
  speed: number;
  div: number;
  gridOuter: number;
  gridInner: number;
  gridBack: number;
  gridColor: string;
  gridW: number;
  edgeMode: number;
  edgeStr: number;
  edgeWide: number;
  rotX: number;
  rotY: number;
  spin: number;
  persp: number;
  blur: number;
  bloom: number;
  grain: number;
  stars: number;
  vignette: number;
  seed: number;
  transparent?: number; // 背景透過（1でclear）
}

// cube geometry (HTML:1156-1162) — DATA CUBE と共有
export const CV = [
  [-1, -1, -1],
  [1, -1, -1],
  [1, 1, -1],
  [-1, 1, -1],
  [-1, -1, 1],
  [1, -1, 1],
  [1, 1, 1],
  [-1, 1, 1],
].map((v) => v.map((a) => a * 0.5));
export const CF = [
  [0, 1, 2, 3],
  [5, 4, 7, 6],
  [4, 0, 3, 7],
  [1, 5, 6, 2],
  [4, 5, 1, 0],
  [3, 2, 6, 7],
];
export const CN = [
  [0, 0, -1],
  [0, 0, 1],
  [-1, 0, 0],
  [1, 0, 0],
  [0, -1, 0],
  [0, 1, 0],
];
const CE = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
];
const CFC = CF.map((f) => {
  const p = [0, 0, 0];
  f.forEach((k) => {
    p[0] += CV[k][0] / 4;
    p[1] += CV[k][1] / 4;
    p[2] += CV[k][2] / 4;
  });
  return p;
});
// 4光源が離れて見えるよう正四面体の頂点をアンカーに
const TETRA = [
  [1, 1, 1],
  [-1, -1, 1],
  [-1, 1, -1],
  [1, -1, -1],
].map((v) => v.map((a) => a / Math.sqrt(3)));

function lightP(i: number, ph: number, P: GridCubeParams): number[] {
  const range = (P.bound === "inner" ? P.boundScale : 0.98) * 0.5;
  const A = range * P.amp;
  const anc = TETRA[i % 4];
  const sp = P.speed;
  if (sp === 0) return [anc[0] * A, anc[1] * A, anc[2] * A];
  const r = rng(700 + i * 131);
  const fx = 1 + Math.floor(r() * 2),
    fy = 1 + Math.floor(r() * 2),
    fz = 1 + Math.floor(r() * 2);
  const ox = r(),
    oy = r(),
    oz = r();
  const orb = range * 0.34;
  return [
    anc[0] * A + Math.sin(TAU * (ph * fx * sp + ox)) * orb,
    anc[1] * A + Math.sin(TAU * (ph * fy * sp + oy)) * orb,
    anc[2] * A + Math.sin(TAU * (ph * fz * sp + oz)) * orb,
  ];
}
export function faceGrid(
  c: CanvasRenderingContext2D,
  quad: number[][],
  div: number,
  col: string,
  a: number,
  lw: number,
) {
  if (a <= 0.002 || div < 1) return;
  const p0 = quad[0],
    p1 = quad[1],
    p2 = quad[2],
    p3 = quad[3];
  c.strokeStyle = rgba(col, a);
  c.lineWidth = lw;
  c.beginPath();
  for (let s = 1; s < div; s++) {
    const t = s / div;
    const A = lerp2(p0, p1, t),
      B = lerp2(p3, p2, t),
      C = lerp2(p0, p3, t),
      D = lerp2(p1, p2, t);
    c.moveTo(A[0], A[1]);
    c.lineTo(B[0], B[1]);
    c.moveTo(C[0], C[1]);
    c.lineTo(D[0], D[1]);
  }
  c.stroke();
}
export function cubeEdges(
  c: CanvasRenderingContext2D,
  pts: number[][],
  col: string,
  a: number,
  lw: number,
) {
  if (a <= 0.002) return;
  c.strokeStyle = rgba(col, a);
  c.lineWidth = lw;
  c.beginPath();
  CE.forEach((e) => {
    c.moveTo(pts[e[0]][0], pts[e[0]][1]);
    c.lineTo(pts[e[1]][0], pts[e[1]][1]);
  });
  c.stroke();
}

function drawC1(
  c: CanvasRenderingContext2D,
  W: number,
  H: number,
  ph: number,
  P: GridCubeParams,
  cache: LayerCache,
) {
  const S = W / 1280;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  c.filter = "none";
  c.globalCompositeOperation = "source-over";
  fillBg(c, W, H, P.bg, !!P.transparent);
  dust(c, W, H, S, P.stars, P.seed, ph);

  const cam: Cam = {
    rx: P.rotX * RAD,
    ry: ((((P.rotY + ph * 360 * P.spin) % 360) + 360) % 360) * RAD,
    d: P.persp,
    u: 0.4 * H * P.zoom,
    ox: P.posX * W,
    oy: P.posY * H,
  };
  const pts = CV.map((v) => pr(cam, v));
  const nrm = CN.map((n) => rot3(cam, n));
  const isBack = (i: number) => nrm[i][2] < 0;

  const L: { p3: number[]; p2: number[]; dh: number }[] = [];
  for (let i = 0; i < P.lights; i++) {
    const p3 = lightP(i, ph, P),
      p2 = pr(cam, p3);
    const dh = P.lights > 1 ? (i / (P.lights - 1) - 0.5) * P.hueSpread : 0;
    L.push({ p3, p2, dh });
  }

  const q = 0.5,
    gw = Math.max(2, Math.round(W * q)),
    gh = Math.max(2, Math.round(H * q));
  const G = cache.get("c1g", gw, gh),
    gx = G.x;
  gx.save();
  gx.scale(q, q);
  gx.globalCompositeOperation = "lighter";
  const gl = (P.glow * P.alpha * 1.9) / Math.pow(Math.max(1, P.lights), 0.45);

  CF.forEach((f, i) => {
    if (!isBack(i)) return;
    const quad = f.map((k) => pts[k]);
    const bb = bbox(quad, 60 * S);
    gx.save();
    poly(gx, quad);
    gx.clip();
    L.forEach((l) => {
      const fc = CFC[i];
      const d = Math.hypot(l.p3[0] - fc[0], l.p3[1] - fc[1], l.p3[2] - fc[2]);
      const att = 1 / (1 + d * d * P.falloff * 3.2);
      const rad = Math.max(4, P.spread * cam.u * l.p2[3]);
      const g = gx.createRadialGradient(l.p2[0], l.p2[1], 0, l.p2[0], l.p2[1], rad);
      g.addColorStop(0, shifted(P.coreColor, l.dh, clamp(0.95 * att * gl, 0, 1)));
      g.addColorStop(0.3, shifted(P.coreColor, l.dh, clamp(0.46 * att * gl, 0, 1)));
      g.addColorStop(0.62, shifted(P.edgeColor, l.dh, clamp(0.2 * att * gl, 0, 1)));
      g.addColorStop(1, shifted(P.edgeColor, l.dh, 0));
      gx.fillStyle = g;
      gx.fillRect(bb[0], bb[1], bb[2], bb[3]);
    });
    gx.restore();
  });
  if (P.core) {
    L.forEach((l) => {
      const r = Math.max(2, P.coreSize * 22 * S * l.p2[3]);
      const g = gx.createRadialGradient(l.p2[0], l.p2[1], 0, l.p2[0], l.p2[1], r);
      g.addColorStop(0, "rgba(255,255,255,.98)");
      g.addColorStop(0.35, shifted(P.coreColor, l.dh, 0.85));
      g.addColorStop(1, shifted(P.coreColor, l.dh, 0));
      gx.fillStyle = g;
      gx.beginPath();
      gx.arc(l.p2[0], l.p2[1], r, 0, TAU);
      gx.fill();
    });
  }
  gx.restore();

  if (P.edgeMode && P.edgeStr > 0) {
    const hp = hull(pts);
    let hx = 0,
      hy = 0;
    hp.forEach((p) => {
      hx += p[0] / hp.length;
      hy += p[1] / hp.length;
    });
    let energy = 0;
    L.forEach((l) => {
      energy += 1 / (1 + (l.p3[0] * l.p3[0] + l.p3[1] * l.p3[1] + l.p3[2] * l.p3[2]) * 2.2);
    });
    energy = clamp(0.4 + energy * 0.45, 0, 1.35);
    const R = cache.get("c1r", gw, gh),
      rx = R.x;
    rx.save();
    rx.scale(q, q);
    const lg = rx.createLinearGradient(hx, hy - cam.u, hx, hy + cam.u);
    lg.addColorStop(0, shifted(P.coreColor, 0, 1));
    lg.addColorStop(1, shifted(P.edgeColor, 0, 1));
    rx.fillStyle = lg;
    poly(rx, hp);
    rx.fill();
    rx.globalCompositeOperation = "destination-out";
    for (let i = 1; i <= 20; i++) {
      const ff = 1 - (i / 20) * P.edgeWide;
      rx.globalAlpha = 0.15;
      rx.save();
      rx.translate(hx, hy);
      rx.scale(ff, ff);
      rx.translate(-hx, -hy);
      poly(rx, hp);
      rx.fill();
      rx.restore();
    }
    rx.restore();
    G.x.save();
    G.x.globalCompositeOperation = "lighter";
    G.x.globalAlpha = clamp(P.edgeStr * energy * P.alpha, 0, 1);
    G.x.drawImage(R.c, 0, 0);
    G.x.restore();
  }

  const lw = Math.max(0.5, P.gridW * S);
  const glowComp: GlobalCompositeOperation = isLightBg(P.bg) ? "multiply" : "lighter";
  CF.forEach((f, i) => {
    if (isBack(i))
      faceGrid(c, f.map((k) => pts[k]), P.div, P.gridColor, P.gridInner * P.gridBack, lw);
  });
  softDraw(c, G.c, P.blur * S * q, 1, glowComp, W, H, cache);
  if (P.bloom > 0)
    softDraw(c, G.c, Math.max(6, P.blur * 2.6 + 14) * S * q, P.bloom, glowComp, W, H, cache);
  c.globalCompositeOperation = "source-over";
  CF.forEach((f, i) => {
    if (!isBack(i)) faceGrid(c, f.map((k) => pts[k]), P.div, P.gridColor, P.gridInner, lw);
  });
  cubeEdges(c, pts, P.gridColor, P.gridOuter, Math.max(0.6, P.gridW * 1.15 * S));

  if (P.bound === "inner" && P.showBound) {
    const ip = CV.map((v) =>
      pr(cam, [v[0] * P.boundScale, v[1] * P.boundScale, v[2] * P.boundScale]),
    );
    c.setLineDash([4 * S, 4 * S]);
    cubeEdges(c, ip, P.gridColor, P.gridOuter * 0.5, Math.max(0.5, P.gridW * 0.85 * S));
    c.setLineDash([]);
  }
  vignette(c, W, H, P.vignette);
  grain(c, W, H, P.grain, ph);
}

// defaults (D1 HTML:1777-1786)
export const GRID_CUBE_DEFAULTS: GridCubeParams = {
  zoom: 1,
  posX: 0.5,
  posY: 0.5,
  bg: "#ffffff",
  lights: 1,
  coreColor: "#8ea6ff",
  edgeColor: "#1f2fb4",
  hueSpread: 172,
  alpha: 0.67,
  glow: 1.48,
  spread: 0.65,
  falloff: 0.95,
  core: 1,
  coreSize: 0.42,
  bound: "inner",
  boundScale: 0.49,
  showBound: 0,
  amp: 0.83,
  speed: 0,
  div: 5,
  gridOuter: 0.53,
  gridInner: 0.16,
  gridBack: 0,
  gridColor: "#464a70",
  gridW: 1.35,
  edgeMode: 0,
  edgeStr: 1.98,
  edgeWide: 0.88,
  rotX: -24,
  rotY: 111,
  spin: 1,
  persp: 5.0,
  blur: 0,
  bloom: 1.2,
  grain: 0.2,
  stars: 0.2,
  vignette: 0.15,
  seed: 1631,
};

// presets (PRESETS[1] HTML:2108-2113)
export const GRID_CUBE_PRESETS: Partial<GridCubeParams>[] = [
  { lights: 1, bound: "inner", boundScale: 0.49, amp: 0.83, speed: 0, edgeMode: 0, coreColor: "#8ea6ff", edgeColor: "#1f2fb4", hueSpread: 172, spread: 0.65, glow: 1.48, blur: 0, bloom: 1.2, gridBack: 0, gridInner: 0.16 },
  { lights: 4, speed: 1, amp: 0.9, bound: "full", spread: 0.9, glow: 1.1, hueSpread: 120, div: 6, gridInner: 0.24, gridBack: 0.6, blur: 14, bloom: 0.6, coreColor: "#ffffff", edgeColor: "#5a5a7a" },
  { lights: 1, edgeMode: 1, edgeStr: 1.5, edgeWide: 0.55, core: 1, coreSize: 0.5, div: 4, gridInner: 0.2, gridOuter: 0.5, spread: 1.1, glow: 1, blur: 18, bloom: 0.7, coreColor: "#b9aaff", edgeColor: "#4b32d8" },
  { lights: 3, speed: 2, spread: 1.6, falloff: 1.6, div: 9, gridInner: 0.18, gridOuter: 0.7, gridBack: 0.8, hueSpread: 40, glow: 1, blur: 22, bloom: 0.5, grain: 0.35, coreColor: "#e8f2ff", edgeColor: "#2a4a8f" },
];

// controls (CTL1 HTML:1850-1890, VIEW/FIN 展開)
export const GRID_CUBE_CONTROLS: ControlsSpec = [
  [
    "表示 / VIEW",
    [
      ["zoom", "ズーム", "r", 0.3, 2.6, 0.01, "×"],
      ["posX", "位置 X", "r", 0.05, 0.95, 0.005, ""],
      ["posY", "位置 Y", "r", 0.05, 0.95, 0.005, ""],
    ],
  ],
  [
    "光源 / LIGHT",
    [
      ["lights", "光源の数", "r", 1, 4, 1, ""],
      ["coreColor", "光源カラー（芯）", "k"],
      ["edgeColor", "光源カラー（外）", "k"],
      ["hueSpread", "色相のばらつき", "r", 0, 180, 1, "°"],
      ["alpha", "不透明度", "r", 0, 1, 0.01, ""],
      ["glow", "発光量", "r", 0, 3, 0.01, ""],
      ["spread", "光の広がり", "r", 0.2, 4, 0.05, ""],
      ["falloff", "距離減衰", "r", 0, 3, 0.05, ""],
      ["core", "光源の芯を描く", "c"],
      ["coreSize", "芯のサイズ", "r", 0.1, 2, 0.05, ""],
    ],
  ],
  [
    "可動範囲 / BOUNDS",
    [
      ["bound", "範囲", "s", ["full", "inner"]],
      ["boundScale", "内側立方体のサイズ", "r", 0.15, 0.95, 0.01, ""],
      ["showBound", "内側立方体を表示", "c"],
      ["amp", "配置の広がり", "r", 0, 1, 0.01, ""],
      ["speed", "動きの速さ（整数周）", "r", 0, 4, 1, ""],
    ],
  ],
  [
    "グリッド / GRID",
    [
      ["div", "分割数", "r", 1, 14, 1, ""],
      ["gridOuter", "外枠の濃度", "r", 0, 1, 0.01, ""],
      ["gridInner", "内側グリッドの濃度", "r", 0, 1, 0.01, ""],
      ["gridBack", "奥面の濃度（比率）", "r", 0, 1.4, 0.01, ""],
      ["gridColor", "グリッド色", "k"],
      ["gridW", "線の太さ", "r", 0.4, 3, 0.05, "px"],
    ],
  ],
  [
    "縁の発光 / EDGE",
    [
      ["edgeMode", "縁を濃くする", "c"],
      ["edgeStr", "縁の強さ", "r", 0, 2, 0.01, ""],
      ["edgeWide", "縁の幅", "r", 0.05, 0.95, 0.01, ""],
    ],
  ],
  [
    "視点 / CAMERA",
    [
      ["rotX", "回転 X", "r", -70, 70, 1, "°"],
      ["rotY", "回転 Y", "r", -180, 180, 1, "°"],
      ["spin", "1ループの回転数", "r", -3, 3, 1, "周"],
      ["persp", "遠近（大=平行）", "r", 2.4, 14, 0.1, ""],
    ],
  ],
  [
    "質感 / FINISH",
    [
      ["grain", "グレイン", "r", 0, 1, 0.01, ""],
      ["blur", "グロー拡散", "r", 0, 60, 1, "px"],
      ["bloom", "ブルーム", "r", 0, 1.4, 0.01, ""],
      ["stars", "ダスト", "r", 0, 1, 0.01, ""],
      ["vignette", "ビネット", "r", 0, 1, 0.01, ""],
      ["bg", "背景色", "k"],
      ["seed", "シード", "n"],
    ],
  ],
];

export function createGridCube(): CanvasRenderer {
  const cache = new LayerCache();
  return {
    render(ctx, W, H, phase, params: Params) {
      drawC1(ctx, W, H, phase, params as unknown as GridCubeParams, cache);
    },
  };
}
