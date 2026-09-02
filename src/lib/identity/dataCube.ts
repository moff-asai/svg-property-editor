// dynamic-identity-generator3.html コンテンツ 05「DATA CUBE」(drawC5 HTML:1908-2014) を移植。
// 立方体の中で動く高さフィールド(dataZ)を surface/wire/points/bars/both で描画。raster。
import {
  TAU,
  RAD,
  clamp,
  pr,
  rot3,
  poly,
  cmap,
  cstr,
  vignette,
  grain,
  fillBg,
  type Cam,
} from "./engine";
import { CV, CF, CN, faceGrid, cubeEdges } from "./gridCube";
import type { CanvasRenderer, ControlsSpec, Params } from "./types";

export interface DataCubeParams {
  zoom: number;
  posX: number;
  posY: number;
  bg: string;
  mode: string; // skew|wave|ripple|gauss|noise
  style: string; // surface|both|wire|points|bars
  res: number;
  height: number;
  freq: number;
  cmap: string;
  fillAlpha: number;
  dotSize: number;
  barW: number;
  profile: number;
  wallDiv: number;
  wallAlpha: number;
  frameAlpha: number;
  gridColor: string;
  rotX: number;
  rotY: number;
  spin: number;
  persp: number;
  grain: number;
  vignette: number;
  seed: number;
  transparent?: number; // 背景透過（1でclear）
}

// 高さフィールド（HTML:1882-1906）。位相係数は整数のみ＝1ループで閉じる。
function dataZ(mode: string, u: number, v: number, ph: number, P: DataCubeParams): number {
  const t = TAU * ph;
  if (mode === "skew") {
    const s =
      Math.exp(-Math.pow((u - 0.28) * 3.1, 2)) * (1.05 + 0.28 * Math.sin(t)) +
      Math.exp(-Math.pow((u - 0.78) * 4.6, 2)) * (0.55 + 0.3 * Math.cos(t + 1.1));
    const term = Math.exp(-v * 2.3);
    return clamp(s * term + 0.1 + 0.05 * Math.sin(6 * v + t), 0, 1.4);
  }
  if (mode === "wave") {
    return 0.5 + 0.42 * Math.sin(P.freq * u * TAU + t) * Math.cos(P.freq * 0.7 * v * TAU - t);
  }
  if (mode === "ripple") {
    const dd = Math.hypot(u - 0.5, v - 0.5) * 2;
    return 0.5 + 0.44 * Math.sin(P.freq * dd * TAU - t) * Math.exp(-dd * 1.5);
  }
  if (mode === "gauss") {
    const cx = 0.5 + 0.26 * Math.cos(t),
      cy = 0.5 + 0.26 * Math.sin(t * 2);
    return 0.12 + 1.05 * Math.exp(-(Math.pow(u - cx, 2) + Math.pow(v - cy, 2)) * 14);
  }
  const s = Math.sin,
    k = P.freq;
  return clamp(
    0.5 +
      0.2 * s(k * 3.1 * u + t) +
      0.16 * s(k * 4.7 * v - t * 2) +
      0.12 * s(k * 6.3 * (u + v) + t * 3) +
      0.1 * s(k * 9.1 * (u - v) - t),
    0,
    1.2,
  );
}

function drawC5(c: CanvasRenderingContext2D, W: number, H: number, ph: number, P: DataCubeParams) {
  const S = W / 1280;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  c.filter = "none";
  c.globalCompositeOperation = "source-over";
  fillBg(c, W, H, P.bg, !!P.transparent);

  const cam: Cam = {
    rx: P.rotX * RAD,
    ry: ((((P.rotY + ph * 360 * P.spin) % 360) + 360) % 360) * RAD,
    d: P.persp,
    u: 0.46 * H * P.zoom,
    ox: P.posX * W,
    oy: P.posY * H,
  };
  const p2 = (p: number[]) => pr(cam, p);
  const M = Math.max(6, Math.round(P.res));
  const hh = P.height;

  const box = CV.map((v) => pr(cam, v));
  const nrm = CN.map((n) => rot3(cam, n));
  const lw = Math.max(0.4, 0.8 * S);
  if (P.wallAlpha > 0) {
    CF.forEach((f, i) => {
      if (nrm[i][2] >= 0) return;
      faceGrid(c, f.map((k) => box[k]), P.wallDiv, P.gridColor, P.wallAlpha, lw);
    });
  }
  cubeEdges(c, box, P.gridColor, P.frameAlpha, Math.max(0.6, 1.1 * S));

  const grid: { p: number[]; z: number; y: number }[][] = [];
  for (let j = 0; j <= M; j++) {
    const row: { p: number[]; z: number; y: number }[] = [];
    for (let i = 0; i <= M; i++) {
      const u = i / M,
        v = j / M;
      const z = dataZ(P.mode, u, v, ph, P);
      const y = -0.5 + clamp(z / 1.35, 0, 1) * hh;
      row.push({ p: p2([u - 0.5, y, v - 0.5]), z, y });
    }
    grid.push(row);
  }
  if (P.style === "surface" || P.style === "both") {
    const quads: { z: number; idx: number; pp: number[][]; v: number }[] = [];
    for (let j = 0; j < M; j++)
      for (let i = 0; i < M; i++) {
        const a = grid[j][i],
          b = grid[j][i + 1],
          d = grid[j + 1][i + 1],
          e = grid[j + 1][i];
        const zm = (a.p[2] + b.p[2] + d.p[2] + e.p[2]) / 4;
        quads.push({ z: zm, idx: j * M + i, pp: [a.p, b.p, d.p, e.p], v: (a.z + b.z + d.z + e.z) / 4 });
      }
    quads.sort((x, y) => x.z - y.z || x.idx - y.idx);
    quads.forEach((qd) => {
      const col = cmap(P.cmap, clamp(qd.v / 1.2, 0, 1));
      c.fillStyle = cstr(col, P.fillAlpha);
      poly(c, qd.pp);
      c.fill();
      if (P.style === "both") {
        c.strokeStyle = cstr(col, Math.min(1, P.fillAlpha + 0.35));
        c.lineWidth = Math.max(0.35, 0.6 * S);
        c.stroke();
      }
    });
  }
  if (P.style === "wire") {
    for (let j = 0; j <= M; j++) {
      c.beginPath();
      for (let i = 0; i <= M; i++) {
        const p = grid[j][i].p;
        if (i === 0) c.moveTo(p[0], p[1]);
        else c.lineTo(p[0], p[1]);
      }
      const col = cmap(P.cmap, clamp(grid[j][Math.floor(M / 2)].z / 1.2, 0, 1));
      c.strokeStyle = cstr(col, P.fillAlpha + 0.3);
      c.lineWidth = Math.max(0.4, 0.8 * S);
      c.stroke();
    }
    for (let i = 0; i <= M; i++) {
      c.beginPath();
      for (let j = 0; j <= M; j++) {
        const p = grid[j][i].p;
        if (j === 0) c.moveTo(p[0], p[1]);
        else c.lineTo(p[0], p[1]);
      }
      const col = cmap(P.cmap, clamp(grid[Math.floor(M / 2)][i].z / 1.2, 0, 1));
      c.strokeStyle = cstr(col, P.fillAlpha + 0.3);
      c.lineWidth = Math.max(0.4, 0.8 * S);
      c.stroke();
    }
  }
  if (P.style === "points") {
    for (let j = 0; j <= M; j++)
      for (let i = 0; i <= M; i++) {
        const g = grid[j][i],
          col = cmap(P.cmap, clamp(g.z / 1.2, 0, 1));
        const s = Math.max(1, P.dotSize * S * g.p[3]);
        c.fillStyle = cstr(col, clamp(P.fillAlpha + 0.35, 0, 1));
        c.beginPath();
        c.arc(g.p[0], g.p[1], s, 0, TAU);
        c.fill();
      }
  }
  if (P.style === "bars") {
    const bars: { z: number; idx: number; pp: number[][]; sd: number[][]; v: number }[] = [];
    for (let j = 0; j < M; j++)
      for (let i = 0; i < M; i++) {
        const u = (i + 0.5) / M - 0.5,
          v = (j + 0.5) / M - 0.5,
          g = grid[j][i];
        const w = (0.5 / M) * P.barW;
        const top = g.y;
        const pp = [p2([u - w, top, v - w]), p2([u + w, top, v - w]), p2([u + w, top, v + w]), p2([u - w, top, v + w])];
        const sd = [p2([u - w, -0.5, v + w]), p2([u + w, -0.5, v + w]), p2([u + w, top, v + w]), p2([u - w, top, v + w])];
        bars.push({ z: (pp[0][2] + pp[2][2]) / 2, idx: j * M + i, pp, sd, v: g.z });
      }
    bars.sort((a, b) => a.z - b.z || a.idx - b.idx);
    bars.forEach((bb) => {
      const col = cmap(P.cmap, clamp(bb.v / 1.2, 0, 1));
      c.fillStyle = cstr(col, P.fillAlpha * 0.7);
      poly(c, bb.sd);
      c.fill();
      c.fillStyle = cstr(col, clamp(P.fillAlpha + 0.2, 0, 1));
      poly(c, bb.pp);
      c.fill();
    });
  }
  if (P.profile > 0) {
    for (let j = 0; j <= M; j += Math.max(1, Math.round(M / 10))) {
      c.beginPath();
      for (let i = 0; i <= M; i++) {
        const u = i / M,
          v = j / M;
        const y = -0.5 + clamp(dataZ(P.mode, u, v, ph, P) / 1.35, 0, 1) * hh;
        const p = p2([u - 0.5, y, 0.5]);
        if (i === 0) c.moveTo(p[0], p[1]);
        else c.lineTo(p[0], p[1]);
      }
      c.strokeStyle = cstr(cmap(P.cmap, j / M), P.profile);
      c.lineWidth = Math.max(0.4, 0.9 * S);
      c.stroke();
    }
  }
  vignette(c, W, H, P.vignette);
  grain(c, W, H, P.grain, ph);
}

// defaults (D5 HTML:2067-2074)
export const DATA_CUBE_DEFAULTS: DataCubeParams = {
  zoom: 1,
  posX: 0.5,
  posY: 0.52,
  bg: "#000000",
  mode: "skew",
  style: "surface",
  res: 34,
  height: 0.95,
  freq: 3,
  cmap: "turbo",
  fillAlpha: 0.72,
  dotSize: 1.6,
  barW: 0.8,
  profile: 0.35,
  wallDiv: 8,
  wallAlpha: 0.16,
  frameAlpha: 0.5,
  gridColor: "#cfd3dd",
  rotX: 24,
  rotY: -32,
  spin: 1,
  persp: 6.5,
  grain: 0.2,
  vignette: 0.5,
  seed: 7,
};

// presets (PRESETS[5] HTML:2439-2444)
export const DATA_CUBE_PRESETS: Partial<DataCubeParams>[] = [
  { mode: "skew", style: "surface", cmap: "turbo", res: 34, height: 0.9, fillAlpha: 0.72, profile: 0.35 },
  { mode: "wave", style: "both", cmap: "ice", res: 28, height: 0.7, fillAlpha: 0.5, profile: 0.2 },
  { mode: "ripple", style: "wire", cmap: "viridis", res: 44, height: 0.8, fillAlpha: 0.45, profile: 0 },
  { mode: "noise", style: "bars", cmap: "ember", res: 22, height: 1.0, fillAlpha: 0.7, profile: 0.15 },
];

// controls (CTL5 HTML:2271-2295, VIEW/FIN 展開)
export const DATA_CUBE_CONTROLS: ControlsSpec = [
  [
    "表示 / VIEW",
    [
      ["zoom", "ズーム", "r", 0.3, 2.6, 0.01, "×"],
      ["posX", "位置 X", "r", 0.05, 0.95, 0.005, ""],
      ["posY", "位置 Y", "r", 0.05, 0.95, 0.005, ""],
    ],
  ],
  [
    "データ / DATA",
    [
      ["mode", "データの種類", "s", ["skew", "wave", "ripple", "gauss", "noise"]],
      ["style", "表示", "s", ["surface", "both", "wire", "points", "bars"]],
      ["res", "解像度", "r", 8, 60, 1, ""],
      ["height", "高さ", "r", 0.1, 1, 0.01, ""],
      ["freq", "周波数", "r", 1, 10, 1, ""],
      ["cmap", "カラーマップ", "s", ["turbo", "viridis", "ice", "ember", "mono"]],
      ["fillAlpha", "不透明度", "r", 0.1, 1, 0.01, ""],
      ["dotSize", "点のサイズ", "r", 0.5, 5, 0.1, "px"],
      ["barW", "バーの太さ", "r", 0.2, 1, 0.01, ""],
      ["profile", "側面プロファイル", "r", 0, 1, 0.01, ""],
    ],
  ],
  [
    "立方体 / CUBE",
    [
      ["wallDiv", "壁グリッドの分割", "r", 2, 16, 1, ""],
      ["wallAlpha", "壁グリッドの濃度", "r", 0, 0.6, 0.01, ""],
      ["frameAlpha", "外枠の濃度", "r", 0, 1, 0.01, ""],
      ["gridColor", "線の色", "k"],
    ],
  ],
  [
    "視点 / CAMERA",
    [
      ["rotX", "回転 X", "r", -70, 70, 1, "°"],
      ["rotY", "回転 Y", "r", -180, 180, 1, "°"],
      ["spin", "1ループの回転数", "r", -3, 3, 1, "周"],
      ["persp", "遠近（大=平行）", "r", 2.4, 16, 0.1, ""],
    ],
  ],
  [
    "質感 / FINISH",
    [
      ["grain", "グレイン", "r", 0, 1, 0.01, ""],
      ["vignette", "ビネット", "r", 0, 1, 0.01, ""],
      ["bg", "背景色", "k"],
      ["seed", "シード", "n"],
    ],
  ],
];

export function createDataCube(): CanvasRenderer {
  return {
    render(ctx, W, H, phase, params: Params) {
      drawC5(ctx, W, H, phase, params as unknown as DataCubeParams);
    },
  };
}
