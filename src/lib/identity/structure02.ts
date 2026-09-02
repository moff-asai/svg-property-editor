// 02 を「構造テンプレート」化: 面取り四角形を土台に、モードで中身を切替。
//  - xyz: generator3 draw2 の canvas 版（箱が幅/高さ変形＋XYZ線）
//  - data-cube / grid-cube: 面取り四角形を静止フレームとして、内側に既存の
//    DATA CUBE / GRID CUBE レンダラをクリップ描画（見た目は元コンテンツと一致）
import { poly, fillBg } from "./engine";
import { XYZ_PAL, renderXyzLineSvg, type XyzPal } from "./xyzLine";
import {
  createDataCube,
  DATA_CUBE_DEFAULTS,
  DATA_CUBE_PRESETS,
  DATA_CUBE_CONTROLS,
} from "./dataCube";
import {
  createGridCube,
  GRID_CUBE_DEFAULTS,
  GRID_CUBE_PRESETS,
  GRID_CUBE_CONTROLS,
} from "./gridCube";
import type {
  CanvasRenderer,
  ControlGroup,
  ControlsSpec,
  MultiModeContent,
  Params,
} from "./types";

/* ---------- アニメ・エンベロープ (generator3 HTML:689-703) ---------- */
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function easeSharp(t: number, k = 3) {
  t = clamp01(t);
  k = Math.max(0.6, k || 1);
  const a = Math.pow(t, k),
    b = Math.pow(1 - t, k);
  return a / (a + b || 1);
}
function seqHold(ph: number, a: number, b: number, c: number, d: number, k = 3) {
  ph = ((ph % 1) + 1) % 1;
  if (ph < a || ph > d) return 0;
  if (ph < b) return easeSharp((ph - a) / (b - a), k);
  if (ph < c) return 1;
  return 1 - easeSharp((ph - c) / (d - c), k);
}

function chamfer(x0: number, y0: number, bw: number, bh: number, c2: number): number[][] {
  return [
    [x0 + c2, y0],
    [x0 + bw, y0],
    [x0 + bw, y0 + bh - c2],
    [x0 + bw - c2, y0 + bh],
    [x0, y0 + bh],
    [x0, y0 + c2],
  ];
}

/* ---------- XYZ モード（draw2 canvas 版） ---------- */
interface XyzModeParams {
  bg: string;
  pal: XyzPal;
  ch: number;
  pos: number;
  lw: number;
  transparent?: number; // 背景透過
}
function drawXyz(ctx: CanvasRenderingContext2D, W: number, H: number, ph: number, params: Params) {
  const P = params as unknown as XyzModeParams;
  const hGrow = seqHold(ph, 0.06, 0.34, 0.72, 0.94, 4.2);
  const wGrow = seqHold(ph, 0.42, 0.7, 0.72, 0.94, 4.2);
  const wv = lerp(0.22, 0.64, wGrow),
    hv = lerp(0.21, 0.64, hGrow);
  const bw = W * wv,
    bh = H * hv,
    m = Math.min(bw, bh),
    c2 = m * P.ch,
    x0 = W / 2 - bw / 2,
    y0 = H / 2 - bh / 2;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  ctx.globalCompositeOperation = "source-over";
  fillBg(ctx, W, H, P.bg, !!P.transparent);
  const pts = chamfer(x0, y0, bw, bh, c2);
  const pal = XYZ_PAL[P.pal];
  ctx.save();
  poly(ctx, pts);
  if (pal.fill.length === 2) {
    const g = ctx.createLinearGradient(x0, y0, x0 + bw, y0);
    g.addColorStop(0, pal.fill[0]);
    g.addColorStop(1, pal.fill[1]);
    ctx.fillStyle = g;
  } else ctx.fillStyle = pal.fill[0];
  ctx.fill();
  ctx.clip();
  const dmax = Math.min(bw, bh) - c2 * 1.4,
    d = c2 * 0.75 + P.pos * dmax,
    jx = x0 + bw - d,
    jy = y0 + bh - d;
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = Math.max(1.2, m * 0.012 * P.lw);
  ctx.lineJoin = "round";
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.moveTo(jx, jy);
  ctx.lineTo(jx, y0 - 2);
  ctx.moveTo(jx, jy);
  ctx.lineTo(x0 + bw + 2, jy);
  ctx.moveTo(jx, jy);
  const k = Math.min(jx - x0, y0 + bh - jy) + 4;
  ctx.lineTo(jx - k, jy + k);
  ctx.stroke();
  ctx.restore();
}
function createXyzMode(): CanvasRenderer {
  return {
    render: drawXyz,
    // XYZ はベクターSVG（アニメ付き・イラレ編集可）を直接生成
    toSvg: ({ loopSeconds, params }) => {
      const p = params as unknown as XyzModeParams;
      return renderXyzLineSvg({
        pal: p.pal,
        ch: p.ch,
        pos: p.pos,
        lw: p.lw,
        loopDur: loopSeconds,
        size: 1000,
        bg: p.bg,
        transparent: p.transparent,
      });
    },
  };
}

const XYZ_DEFAULTS: Params = {
  bg: "#ffffff",
  pal: "purple",
  ch: 0.13,
  pos: 0.18,
  lw: 0.9,
  transparent: 1,
};
const XYZ_PRESETS: Params[] = [
  { pal: "purple", ch: 0.13, pos: 0.18 },
  { pal: "grad", ch: 0.16, pos: 0.1 },
  { pal: "teal", ch: 0.12, pos: 0.12 },
  { pal: "ink", ch: 0.18, pos: 0.22 },
];
const XYZ_CONTROLS: ControlsSpec = [
  [
    "カラー / COLOR",
    [
      ["pal", "パレット", "s", ["purple", "teal", "grad", "ink"]],
      ["transparent", "背景透過", "c"],
      ["bg", "背景色", "k"],
    ],
  ],
  [
    "調整 / TUNE",
    [
      ["ch", "面取り", "r", 0.05, 0.25, 0.005, ""],
      ["pos", "交点位置", "r", 0, 1, 0.01, ""],
      ["lw", "線の太さ", "r", 0.3, 2.5, 0.05, ""],
    ],
  ],
];

/* ---------- 3D モード（面取り四角形フレーム＋内側にクリップ描画） ---------- */
interface FrameParams {
  frameSize: number;
  ch: number;
  frameColor: string;
  frameW: number;
  frameBg: string;
  transparent?: number; // 背景透過（外側・内側とも clear）
}
const FRAME_DEFAULTS = {
  frameSize: 0.72,
  ch: 0.13,
  frameColor: "#ffffff",
  frameW: 2,
  frameBg: "#000000",
  transparent: 1,
};
const FRAME_GROUP: ControlGroup = [
  "フレーム / FRAME",
  [
    ["frameSize", "四角形サイズ", "r", 0.4, 0.95, 0.01, ""],
    ["ch", "面取り", "r", 0, 0.25, 0.005, ""],
    ["frameColor", "枠線の色", "k"],
    ["frameW", "枠線の太さ", "r", 0, 6, 0.5, "px"],
    ["transparent", "背景透過", "c"],
    ["frameBg", "外側背景", "k"],
  ],
];

function framedRenderer(inner: CanvasRenderer): CanvasRenderer {
  return {
    render(ctx, W, H, ph, params) {
      const P = params as unknown as FrameParams;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.filter = "none";
      ctx.globalCompositeOperation = "source-over";
      fillBg(ctx, W, H, P.frameBg, !!P.transparent);
      const s = P.frameSize * Math.min(W, H);
      const x0 = W / 2 - s / 2,
        y0 = H / 2 - s / 2,
        c2 = s * P.ch;
      const pts = chamfer(x0, y0, s, s, c2);
      ctx.save();
      poly(ctx, pts);
      ctx.clip();
      inner.render(ctx, W, H, ph, params); // 内側3D（自前の bg を四角形内に敷いて描画）
      ctx.restore();
      if (P.frameW > 0) {
        ctx.strokeStyle = P.frameColor;
        ctx.lineWidth = Math.max(0.5, P.frameW * (W / 1280));
        ctx.lineJoin = "round";
        poly(ctx, pts);
        ctx.stroke();
      }
    },
  };
}

export const STRUCTURE_02: MultiModeContent = {
  slug: "xyz-line",
  no: "02",
  title: "02 XYZ / 3D",
  bgKey: "bg",
  modes: [
    {
      value: "xyz",
      label: "XYZ ライン",
      defaults: XYZ_DEFAULTS,
      presets: XYZ_PRESETS,
      controls: XYZ_CONTROLS,
      create: createXyzMode,
    },
    {
      value: "data-cube",
      label: "DATA CUBE",
      defaults: { ...(DATA_CUBE_DEFAULTS as unknown as Params), ...FRAME_DEFAULTS },
      presets: DATA_CUBE_PRESETS as unknown as Params[],
      controls: [FRAME_GROUP, ...DATA_CUBE_CONTROLS],
      create: () => framedRenderer(createDataCube()),
    },
    {
      value: "grid-cube",
      label: "GRID CUBE",
      defaults: { ...(GRID_CUBE_DEFAULTS as unknown as Params), ...FRAME_DEFAULTS },
      presets: GRID_CUBE_PRESETS as unknown as Params[],
      controls: [FRAME_GROUP, ...GRID_CUBE_CONTROLS],
      create: () => framedRenderer(createGridCube()),
    },
  ],
};
