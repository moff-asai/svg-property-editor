// 02 を「構造テンプレート」化: 面取り四角形を土台に、モードで中身を切替。
//  - xyz: generator3 draw2 の canvas 版（箱が幅/高さ変形＋XYZ線）
import { fillBg } from "./engine";
import {
  XYZ_CHAMFER_MAX,
  XYZ_CHAMFER_MIN,
  XYZ_LINE_WIDTH_MAX,
  XYZ_LINE_WIDTH_MIN,
  XYZ_PAL,
  renderXyzLineSvg,
  type XyzPal,
} from "./xyzLine";
import { createMeshPainter, meshParams, MESH_CONTROLS, MESH_DEFAULTS } from "./meshGradient";
import { xyzFrameSize, XYZ_FRAME_DEFAULTS, type XyzFrameParams } from "./xyzFrame";
import { traceXyzShape, xyzRoundRatio, XYZ_ROUND_DEFAULT } from "./xyzShape";
import { drawTypo } from "./xyzTypo";
import type { CanvasRenderer, ControlsSpec, MultiModeContent, Params } from "./types";

/* ---------- XYZ モード（draw2 canvas 版） ---------- */
interface XyzModeParams extends XyzFrameParams {
  bg: string;
  pal: XyzPal;
  ch: number;
  round?: number;
  pos: number;
  lw: number;
  transparent?: number; // 背景透過
}
function drawXyz(ctx: CanvasRenderingContext2D, W: number, H: number, ph: number, params: Params,
  paintMesh?: ReturnType<typeof createMeshPainter>) {
  const P = params as unknown as XyzModeParams;
  const mesh = paintMesh ? meshParams(params) : undefined;
  const { width: bw, height: bh } = xyzFrameSize(W, H, ph, P);
  const m = Math.min(bw, bh),
    c2 = m * P.ch,
    radius = m * xyzRoundRatio(P.round),
    x0 = W / 2 - bw / 2,
    y0 = H / 2 - bh / 2;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  ctx.globalCompositeOperation = "source-over";
  fillBg(ctx, W, H, P.bg, !!P.transparent);
  const pal = XYZ_PAL[P.pal];
  ctx.save();
  traceXyzShape(ctx, x0, y0, bw, bh, c2, radius);
  if (mesh && paintMesh) {
    ctx.clip();
    paintMesh(ctx, x0, y0, bw, bh, mesh, c2, radius, ph);
  } else if (pal.fill.length === 2) {
    const g = ctx.createLinearGradient(x0, y0, x0 + bw, y0);
    g.addColorStop(0, pal.fill[0]);
    g.addColorStop(1, pal.fill[1]);
    ctx.fillStyle = g;
  } else ctx.fillStyle = pal.fill[0];
  if (!mesh) ctx.fill();
  ctx.clip();
  const dmax = Math.min(bw, bh) - c2 * 1.4,
    d = c2 * 0.75 + P.pos * dmax,
    jx = x0 + bw - d,
    jy = y0 + bh - d;
  ctx.strokeStyle = mesh?.meshLine ?? pal.line;
  ctx.globalAlpha = mesh?.meshLineOpacity ?? 1;
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
  if (P.typoVisible !== 0) drawTypo(ctx, x0, y0, bw, bh, radius, P.typoColor);
}
function createXyzMode(mesh = false): CanvasRenderer {
  const paintMesh = mesh ? createMeshPainter() : undefined;
  return {
    render: (ctx, W, H, phase, params) => drawXyz(ctx, W, H, phase, params, paintMesh),
    // XYZ は「停止位置」の静止フレームをベクターSVG（イラレ編集可）で出力
    toSvg: ({ phase, loopSeconds, params }) => {
      const p = params as unknown as XyzModeParams;
      return renderXyzLineSvg({
        pal: p.pal,
        ch: p.ch,
        round: p.round,
        pos: p.pos,
        lw: p.lw,
        loopDur: loopSeconds,
        size: 900,
        // canvas(EXPORT_W:H=1280:720=16:9) と同じ比で書き出し、停止フレームと一致させる
        w: 1600,
        h: 900,
        bg: p.bg,
        transparent: p.transparent,
        phase,
        animated: false,
        frameAnimation: p.frameAnimation,
        frameWidth: p.frameWidth,
        frameHeight: p.frameHeight,
        typoVisible: p.typoVisible,
        typoColor: p.typoColor,
        mesh: mesh ? meshParams(params) : undefined,
      });
    },
  };
}

const XYZ_DEFAULTS: Params = {
  ...XYZ_FRAME_DEFAULTS,
  bg: "#ffffff",
  pal: "purple",
  ch: 0.13,
  round: XYZ_ROUND_DEFAULT,
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
const FRAME_CONTROLS: ControlsSpec = [
  ["枠 / FRAME", [["frameAnimation", "枠のサイズアニメーション", "c"]]],
  ["タイポ / TYPOGRAPHY", [
    ["typoVisible", "タイポを表示", "c"],
    ["typoColor", "タイポの色", "k"],
  ]],
  ["固定サイズ / SIZE", [
    ["frameWidth", "幅", "r", 10, 90, 1, "%"],
    ["frameHeight", "高さ", "r", 10, 90, 1, "%"],
  ], { key: "frameAnimation", equals: 0 }],
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
      ["ch", "面取り", "r", XYZ_CHAMFER_MIN, XYZ_CHAMFER_MAX, 0.005, ""],
      ["round", "右上・左下の角丸", "r", 0, 0.25, 0.005, ""],
      ["pos", "交点位置", "r", 0, 1, 0.01, ""],
      ["lw", "線の太さ", "r", XYZ_LINE_WIDTH_MIN, XYZ_LINE_WIDTH_MAX, 0.05, ""],
    ],
  ],
];

export const STRUCTURE_02: MultiModeContent = {
  slug: "xyz-line",
  no: "02",
  title: "02 XYZ LINE",
  bgKey: "bg",
  modes: [
    {
      value: "xyz",
      label: "XYZ ライン",
      defaults: XYZ_DEFAULTS,
      presets: XYZ_PRESETS,
      controls: [...FRAME_CONTROLS, ...XYZ_CONTROLS],
      create: createXyzMode,
    },
    {
      value: "xyz-mesh",
      label: "メッシュグラデーション",
      defaults: { ...XYZ_DEFAULTS, ...MESH_DEFAULTS },
      presets: [
        { ...MESH_DEFAULTS },
        { ...MESH_DEFAULTS, meshTopLeft: "#f7f6ff", meshTopRight: "#eeedff", meshBottomLeft: "#edfdf7", meshBottomRight: "#daeafa", meshLineOpacity: 0.6 },
        { ...MESH_DEFAULTS, meshTopLeft: "#ff728f", meshTopRight: "#ffd8a8", meshBottomLeft: "#b59aff", meshBottomRight: "#703be8" },
        { ...MESH_DEFAULTS, meshTopLeft: "#113d72", meshTopRight: "#378ab2", meshBottomLeft: "#64d9da", meshBottomRight: "#10233d" },
      ].map(preset => Object.fromEntries(
        Object.entries(preset).filter(([key]) => key !== "meshMotionPattern"),
      )),
      controls: [
        ...FRAME_CONTROLS,
        ...MESH_CONTROLS,
        ["背景 / BACKGROUND", [["transparent", "背景透過", "c"], ["bg", "背景色", "k"]]],
        XYZ_CONTROLS[1],
      ],
      create: () => createXyzMode(true),
    },
  ],
};
