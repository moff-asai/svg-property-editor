// dynamic-identity-generator3.html コンテンツ 08「XYZ LINE」(draw2) を SVG 生成へ移植。
// アニメは generator3 の「箱の幅/高さ変形ループ」(seqHold エンベロープ)を再現する。
// 幅/高さ変形は CSS scale キーフレームで近似（箱は viewBox 中心固定なので中心拡縮）。
// scale は translate→scale→translate の行列に落ちるため exportVideo.ts が各フレーム
// getComputedStyle(transform) で正しく焼き込め、SVG書き出しでも単体でアニメする。
// 純粋関数（DOM 非依存）。

import { meshSvg, type MeshGradientParams } from "./meshGradient";
import { xyzFrameSize, XYZ_FRAME_DEFAULTS, type XyzFrameParams } from "./xyzFrame";
import { xyzRoundRatio, xyzShapePath, XYZ_ROUND_DEFAULT } from "./xyzShape";
import { typoSvg } from "./xyzTypo";

export const XYZ_PALS = ["purple", "teal", "grad", "ink"] as const;
export type XyzPal = (typeof XYZ_PALS)[number];

export const XYZ_CHAMFER_MIN = 0.05;
export const XYZ_CHAMFER_MAX = 0.4;
export const XYZ_LINE_WIDTH_MIN = 0.3;
export const XYZ_LINE_WIDTH_MAX = 5;

// PAL2 (generator3 HTML:777-782)
export const XYZ_PAL: Record<XyzPal, { fill: string[]; line: string }> = {
  purple: { fill: ["#662DF5"], line: "#874FF6" },
  teal: { fill: ["#64D9DA"], line: "#8FE9E6" },
  grad: { fill: ["#662DF5", "#B9A2FA"], line: "#C4B1FB" },
  ink: { fill: ["#101012"], line: "#4A4A4E" },
};

export interface XyzLineParams extends XyzFrameParams {
  pal: XyzPal;
  ch: number; // 面取り .05–.4
  round?: number; // 右上・左下の角丸 0–.25
  pos: number; // 交点位置 0–1
  lw: number; // 線の太さ .3–5
  loopDur: number; // ループ長(秒)
  size: number; // 正方 viewBox 一辺
  bg?: string; // 背景色（transparent 未指定時に背景 rect を出力）
  transparent?: number; // 1で背景 rect を出さない（透過）
  phase?: number; // 静止書き出し時の位相 0..1
  animated?: boolean; // false で phase の静止フレームを出力（アニメ無し）
  w?: number; // viewBox 幅（未指定時は size）。canvas と同じ比で書き出すため
  h?: number; // viewBox 高（未指定時は size）
  mesh?: MeshGradientParams; // 四隅の色を補間するメッシュ塗り
}

export const XYZ_DEFAULTS: XyzLineParams = {
  ...XYZ_FRAME_DEFAULTS,
  pal: "purple",
  ch: 0.13,
  round: XYZ_ROUND_DEFAULT,
  pos: 0.18,
  lw: 0.9,
  loopDur: 6,
  size: 1000,
};

export const XYZ_PRESETS: Partial<XyzLineParams>[] = [
  { pal: "purple", ch: 0.13, pos: 0.18 },
  { pal: "grad", ch: 0.16, pos: 0.1 },
  { pal: "teal", ch: 0.12, pos: 0.12 },
  { pal: "ink", ch: 0.18, pos: 0.22 },
];

export const XYZ_CONTROLS: {
  key: "ch" | "pos" | "lw" | "loopDur";
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: "ch", label: "面取り", min: XYZ_CHAMFER_MIN, max: XYZ_CHAMFER_MAX, step: 0.005 },
  { key: "pos", label: "交点位置", min: 0, max: 1, step: 0.01 },
  { key: "lw", label: "線の太さ", min: XYZ_LINE_WIDTH_MIN, max: XYZ_LINE_WIDTH_MAX, step: 0.05 },
  { key: "loopDur", label: "ループ長(秒)", min: 2, max: 10, step: 0.5 },
];

// アニメの最大サイズ（w/h ともに 0.64 まで成長）。この基準で描画し scale で縮める。
const WMAX = 0.64;
const HMAX = 0.64;
const KF_STOPS = 26;

const f = (n: number) => n.toFixed(2);

// 停止位置(phase)の静止フレームをベクターSVGで出力する。
// キャンバス drawXyz と同じ式で phase の箱サイズ/交点を求め、クリップした光線を描く
// （キーフレーム/スケール無し＝そのまま止まった見た目のイラレ編集可ベクター）。
function renderXyzStatic(p: XyzLineParams, W: number, H: number): string {
  const ph = (((p.phase ?? 0) % 1) + 1) % 1;
  const { width: bw, height: bh } = xyzFrameSize(W, H, ph, p);
  const m = Math.min(bw, bh);
  const c = m * p.ch;
  const radius = m * xyzRoundRatio(p.round);
  const x0 = W / 2 - bw / 2;
  const y0 = H / 2 - bh / 2;
  const shape = xyzShapePath(x0, y0, bw, bh, c, radius);
  const dmax = Math.min(bw, bh) - c * 1.4;
  const d = c * 0.75 + p.pos * dmax;
  const jx = x0 + bw - d;
  const jy = y0 + bh - d;
  const k = Math.min(jx - x0, y0 + bh - jy) + 4;
  const rayD =
    `M ${f(jx)} ${f(jy)} L ${f(jx)} ${f(y0 - 2)} ` +
    `M ${f(jx)} ${f(jy)} L ${f(x0 + bw + 2)} ${f(jy)} ` +
    `M ${f(jx)} ${f(jy)} L ${f(jx - k)} ${f(jy + k)}`;
  const lineW = Math.max(1.2, m * 0.012 * p.lw);
  const pal = XYZ_PAL[p.pal];
  const isGrad = pal.fill.length > 1;
  const fillAttr = isGrad ? "url(#xyz-grad)" : pal.fill[0];
  const gradDef = isGrad
    ? `<linearGradient id="xyz-grad" gradientUnits="userSpaceOnUse" x1="${f(x0)}" y1="${f(y0)}" x2="${f(x0 + bw)}" y2="${f(y0)}">` +
      `<stop offset="0" stop-color="${pal.fill[0]}"/><stop offset="1" stop-color="${pal.fill[1]}"/></linearGradient>`
    : "";
  const bgRect =
    p.bg && !p.transparent ? `<rect width="${W}" height="${H}" fill="${p.bg}"/>` : "";
  const mesh = p.mesh ? meshSvg(p.mesh, x0, y0, bw, bh, c, radius, ph) : undefined;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    bgRect +
    `<defs><clipPath id="xyz-clip"><path d="${shape}"/></clipPath>${mesh?.defs ?? gradDef}</defs>` +
    (mesh?.body ?? `<path data-eid="xyz-fill" d="${shape}" fill="${fillAttr}"/>`) +
    `<g data-eid="xyz-clip-g" clip-path="url(#xyz-clip)">` +
    `<path data-eid="xyz-ray" d="${rayD}" fill="none" stroke="${p.mesh?.meshLine ?? pal.line}" stroke-opacity="${p.mesh?.meshLineOpacity ?? 1}" ` +
    `stroke-width="${f(lineW)}" stroke-linejoin="round" stroke-linecap="butt"/>` +
    `</g>` + (p.typoVisible === 0 ? "" : typoSvg(x0, y0, bw, bh, radius, p.typoColor)) + `</svg>`
  );
}

export function renderXyzLineSvg(p: XyzLineParams): string {
  const W = p.w ?? p.size;
  const H = p.h ?? p.size;
  if (p.animated === false) return renderXyzStatic(p, W, H);
  // 基準（最大）ジオメトリ。draw2 の式（generator3 HTML:790-818）を最大サイズで評価。
  const { width: bw, height: bh } = xyzFrameSize(W, H, 0.7, p);
  const m = Math.min(bw, bh);
  const c = m * p.ch;
  const radius = m * xyzRoundRatio(p.round);
  const x0 = W / 2 - bw / 2;
  const y0 = H / 2 - bh / 2;

  const shape = xyzShapePath(x0, y0, bw, bh, c, radius);

  // 交点 J: 右下チャンファー起点から左上へ（pos で位置指定）
  const dmax = Math.min(bw, bh) - c * 1.4;
  const d = c * 0.75 + p.pos * dmax;
  const jx = x0 + bw - d;
  const jy = y0 + bh - d;

  // 光線（遠端を延長 → clip で切り取り）
  const EXT = 2 * Math.max(bw, bh);
  const rayY = `M ${f(jx)} ${f(jy)} L ${f(jx)} ${f(y0 - EXT)}`;
  const rayX = `M ${f(jx)} ${f(jy)} L ${f(x0 + bw + EXT)} ${f(jy)}`;
  const rayZ = `M ${f(jx)} ${f(jy)} L ${f(jx - EXT)} ${f(jy + EXT)}`;
  const rayD = `${rayY} ${rayX} ${rayZ}`;

  const lineW = Math.max(1.2, m * 0.012 * p.lw);
  const pal = XYZ_PAL[p.pal];
  const isGrad = pal.fill.length > 1;
  const fillAttr = isGrad ? "url(#xyz-grad)" : pal.fill[0];
  const gradDef = isGrad
    ? `<linearGradient id="xyz-grad" gradientUnits="userSpaceOnUse" x1="${f(x0)}" y1="${f(y0)}" x2="${f(x0 + bw)}" y2="${f(y0)}">` +
      `<stop offset="0" stop-color="${pal.fill[0]}"/><stop offset="1" stop-color="${pal.fill[1]}"/></linearGradient>`
    : "";

  // 幅/高さ変形を中心拡縮の CSS scale キーフレームで再現（seqHold をサンプリング）
  const cx = W / 2;
  const cy = H / 2;
  let frames = "";
  for (let i = 0; p.frameAnimation !== 0 && i < KF_STOPS; i++) {
    const ph = i / (KF_STOPS - 1);
    const { width: wv, height: hv } = xyzFrameSize(1, 1, ph, p);
    const sx = (wv / WMAX).toFixed(4);
    const sy = (hv / HMAX).toFixed(4);
    const pct = ((ph * 100).toFixed(2) + "%").replace(".00%", "%");
    frames += `${pct}{transform:translate(${f(cx)}px,${f(cy)}px) scale(${sx},${sy}) translate(${f(-cx)}px,${f(-cy)}px)}`;
  }
  const style =
    `@keyframes xyz-morph{${frames}}` +
    `.xyz-anim{animation:xyz-morph ${p.loopDur}s linear infinite}`;

  const bgRect =
    p.bg && !p.transparent ? `<rect width="${W}" height="${H}" fill="${p.bg}"/>` : "";
  const mesh = p.mesh ? meshSvg(p.mesh, x0, y0, bw, bh, c, radius, 0, p.loopDur) : undefined;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    bgRect +
    (p.frameAnimation === 0 ? "" : `<style>${style}</style>`) +
    `<defs><clipPath id="xyz-clip"><path d="${shape}"/></clipPath>${mesh?.defs ?? gradDef}</defs>` +
    `<g data-eid="xyz-box"${p.frameAnimation === 0 ? "" : ' class="xyz-anim"'}>` +
    (mesh?.body ?? `<path data-eid="xyz-fill" d="${shape}" fill="${fillAttr}"/>`) +
    `<g data-eid="xyz-clip-g" clip-path="url(#xyz-clip)">` +
    // vector-effect: 箱の scale アニメで線幅が変わらない（非等方scaleでの太さ歪みを防ぐ）
    `<path data-eid="xyz-ray" d="${rayD}" fill="none" stroke="${p.mesh?.meshLine ?? pal.line}" stroke-opacity="${p.mesh?.meshLineOpacity ?? 1}" ` +
    `stroke-width="${f(lineW)}" vector-effect="non-scaling-stroke" ` +
    `stroke-linejoin="round" stroke-linecap="butt"/>` +
    `</g>` + (p.typoVisible === 0 ? "" : typoSvg(x0, y0, bw, bh, radius, p.typoColor)) + `</g></svg>`
  );
}
