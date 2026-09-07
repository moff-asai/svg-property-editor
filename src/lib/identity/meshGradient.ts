import type { ControlsSpec, Params } from "./types";

// Four-corner bilinear color field. Canvas and SVG use the same two horizontal
// gradients, with the lower pair blended in vertically. No source bitmap needed.
export interface MeshGradientParams {
  meshTopLeft: string;
  meshTopRight: string;
  meshBottomLeft: string;
  meshBottomRight: string;
  meshInsetX: number;
  meshInsetY: number;
  meshLine: string;
  meshLineOpacity: number;
}

export const MESH_DEFAULTS: MeshGradientParams = {
  meshTopLeft: "#653bff",
  meshTopRight: "#b7a8fc",
  meshBottomLeft: "#a0ecda",
  meshBottomRight: "#0083b3",
  meshInsetX: 0.08,
  meshInsetY: 0.08,
  meshLine: "#ffffff",
  meshLineOpacity: 0.35,
};

export const MESH_CONTROLS: ControlsSpec = [
  ["4点のカラー / MESH", [
    ["meshTopLeft", "左上", "k"],
    ["meshTopRight", "右上", "k"],
    ["meshBottomLeft", "左下", "k"],
    ["meshBottomRight", "右下", "k"],
    ["meshInsetX", "ポイントの内側距離 X", "r", 0, 0.4, 0.01, ""],
    ["meshInsetY", "ポイントの内側距離 Y", "r", 0, 0.4, 0.01, ""],
  ]],
  ["ライン / LINE", [
    ["meshLine", "ライン色", "k"],
    ["meshLineOpacity", "ライン不透明度", "r", 0, 1, 0.01, ""],
  ]],
];

// Normalize persisted values before using them in Canvas or SVG attributes.
export function meshParams(params: Params): MeshGradientParams {
  const color = (key: keyof MeshGradientParams) => {
    const value = params[key];
    return typeof value === "string" && /^#[\da-f]{6}$/i.test(value)
      ? value : String(MESH_DEFAULTS[key]);
  };
  const number = (key: keyof MeshGradientParams, max: number) => {
    const value = params[key];
    return typeof value === "number" && Number.isFinite(value)
      ? Math.max(0, Math.min(max, value)) : Number(MESH_DEFAULTS[key]);
  };
  return {
    meshTopLeft: color("meshTopLeft"), meshTopRight: color("meshTopRight"),
    meshBottomLeft: color("meshBottomLeft"), meshBottomRight: color("meshBottomRight"),
    meshInsetX: number("meshInsetX", 0.4), meshInsetY: number("meshInsetY", 0.4),
    meshLine: color("meshLine"), meshLineOpacity: number("meshLineOpacity", 1),
  };
}

export function createMeshPainter() {
  let tile: HTMLCanvasElement | undefined;
  let lastKey = "";
  return (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, p: MeshGradientParams) => {
    const key = [p.meshTopLeft, p.meshTopRight, p.meshBottomLeft, p.meshBottomRight,
      p.meshInsetX, p.meshInsetY].join("|");
    if (!tile || key !== lastKey) {
      // The field is smooth and independent of geometry/phase. Rebuild only on
      // color/point edits, then scale the cached tile for preview and video frames.
      const size = 512;
      tile ??= document.createElement("canvas");
      tile.width = tile.height = size;
      const c = tile.getContext("2d")!;
      const horizontal = (left: string, right: string) => {
        const g = c.createLinearGradient(size * p.meshInsetX, 0, size * (1 - p.meshInsetX), 0);
        g.addColorStop(0, left);
        g.addColorStop(1, right);
        return g;
      };
      c.fillStyle = horizontal(p.meshBottomLeft, p.meshBottomRight);
      c.fillRect(0, 0, size, size);
      c.globalCompositeOperation = "destination-in";
      const fade = c.createLinearGradient(0, size * p.meshInsetY, 0, size * (1 - p.meshInsetY));
      fade.addColorStop(0, "rgba(255,255,255,0)");
      fade.addColorStop(1, "rgba(255,255,255,1)");
      c.fillStyle = fade;
      c.fillRect(0, 0, size, size);
      c.globalCompositeOperation = "destination-over";
      c.fillStyle = horizontal(p.meshTopLeft, p.meshTopRight);
      c.fillRect(0, 0, size, size);
      lastKey = key;
    }
    ctx.drawImage(tile, x, y, w, h);
  };
}

export function meshSvg(p: MeshGradientParams, x: number, y: number, w: number, h: number) {
  const horizontal = (id: string, left: string, right: string) =>
    `<linearGradient id="${id}" x1="${p.meshInsetX}" x2="${1 - p.meshInsetX}" y1="0" y2="0" color-interpolation="sRGB">` +
    `<stop stop-color="${left}"/><stop offset="1" stop-color="${right}"/></linearGradient>`;
  return {
    defs: horizontal("xyz-mesh-top", p.meshTopLeft, p.meshTopRight) +
      horizontal("xyz-mesh-bottom", p.meshBottomLeft, p.meshBottomRight) +
      `<linearGradient id="xyz-mesh-fade" x1="0" x2="0" y1="${p.meshInsetY}" y2="${1 - p.meshInsetY}">` +
      `<stop stop-color="white" stop-opacity="0"/><stop offset="1" stop-color="white"/></linearGradient>` +
      `<mask id="xyz-mesh-mask" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}" style="mask-type:alpha">` +
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#xyz-mesh-fade)"/></mask>`,
    body: `<g data-eid="xyz-mesh" clip-path="url(#xyz-clip)">` +
      `<rect data-eid="xyz-mesh-top" x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#xyz-mesh-top)"/>` +
      `<rect data-eid="xyz-mesh-bottom" x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#xyz-mesh-bottom)" mask="url(#xyz-mesh-mask)"/></g>`,
  };
}
