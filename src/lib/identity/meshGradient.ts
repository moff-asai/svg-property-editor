import type { ControlsSpec, Params } from "./types";
import { blurCanvas, hasFilter, poly } from "./engine";

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
  meshPadding: number;
  meshBlur: number;
  meshBase: string;
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
  meshPadding: 0.055,
  meshBlur: 0.045,
  meshBase: "#eaeff4",
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
  ["外周 / EDGE", [
    ["meshPadding", "余白", "r", 0, 0.22, 0.005, ""],
    ["meshBlur", "外周のぼかし", "r", 0, 0.15, 0.005, ""],
    ["meshBase", "下地色", "k"],
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
    meshPadding: number("meshPadding", 0.22), meshBlur: number("meshBlur", 0.15),
    meshBase: color("meshBase"),
  };
}

// Offset every edge by the same distance, including the two 45° chamfers.
// Once an inset passes the chamfer, the inner contour becomes rectangular.
function insetContour(w: number, h: number, chamfer: number, padding: number) {
  const cut = Math.max(0, chamfer - (2 - Math.SQRT2) * padding);
  return [
    [padding + cut, padding], [w - padding, padding],
    [w - padding, h - padding - cut], [w - padding - cut, h - padding],
    [padding, h - padding], [padding, padding + cut],
  ];
}

export function createMeshPainter() {
  let tile: HTMLCanvasElement | undefined;
  let mask: HTMLCanvasElement | undefined;
  let lastKey = "";
  return (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, p: MeshGradientParams, chamfer: number) => {
    const scale = 512 / Math.max(w, h);
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));
    const min = Math.min(tw, th);
    const cut = min * chamfer / Math.min(w, h);
    const key = [p.meshTopLeft, p.meshTopRight, p.meshBottomLeft, p.meshBottomRight,
      p.meshInsetX, p.meshInsetY, p.meshPadding, p.meshBlur, p.meshBase, tw, th, cut].join("|");
    if (!tile || key !== lastKey) {
      // Bound the cached texture size for video, rebuilding only when the field
      // or its contour changes. Padding/blur use the short side, not each axis.
      tile ??= document.createElement("canvas");
      tile.width = tw;
      tile.height = th;
      const c = tile.getContext("2d")!;
      const horizontal = (left: string, right: string) => {
        const g = c.createLinearGradient(tw * p.meshInsetX, 0, tw * (1 - p.meshInsetX), 0);
        g.addColorStop(0, left);
        g.addColorStop(1, right);
        return g;
      };
      c.fillStyle = horizontal(p.meshBottomLeft, p.meshBottomRight);
      c.fillRect(0, 0, tw, th);
      c.globalCompositeOperation = "destination-in";
      const fade = c.createLinearGradient(0, th * p.meshInsetY, 0, th * (1 - p.meshInsetY));
      fade.addColorStop(0, "rgba(255,255,255,0)");
      fade.addColorStop(1, "rgba(255,255,255,1)");
      c.fillStyle = fade;
      c.fillRect(0, 0, tw, th);
      c.globalCompositeOperation = "destination-over";
      c.fillStyle = horizontal(p.meshTopLeft, p.meshTopRight);
      c.fillRect(0, 0, tw, th);

      mask ??= document.createElement("canvas");
      mask.width = tw;
      mask.height = th;
      const m = mask.getContext("2d")!;
      const blur = min * p.meshBlur;
      const nativeBlur = hasFilter();
      if (nativeBlur && blur > 0) m.filter = `blur(${blur}px)`;
      m.fillStyle = "white";
      poly(m, insetContour(tw, th, cut, min * p.meshPadding));
      m.fill();
      if (!nativeBlur && blur > 0) blurCanvas(mask, blur);
      c.globalCompositeOperation = "destination-in";
      c.drawImage(mask, 0, 0);
      // The outer silhouette stays crisp and opaque; only the color field fades.
      c.globalCompositeOperation = "destination-over";
      c.fillStyle = p.meshBase;
      c.fillRect(0, 0, tw, th);
      lastKey = key;
    }
    ctx.drawImage(tile, x, y, w, h);
  };
}

export function meshSvg(p: MeshGradientParams, x: number, y: number, w: number, h: number, chamfer: number) {
  const min = Math.min(w, h);
  const contour = insetContour(w, h, chamfer, min * p.meshPadding)
    .map(([px, py]) => `${x + px},${y + py}`).join(" ");
  const horizontal = (id: string, left: string, right: string) =>
    `<linearGradient id="${id}" x1="${p.meshInsetX}" x2="${1 - p.meshInsetX}" y1="0" y2="0" color-interpolation="sRGB">` +
    `<stop stop-color="${left}"/><stop offset="1" stop-color="${right}"/></linearGradient>`;
  return {
    defs: horizontal("xyz-mesh-top", p.meshTopLeft, p.meshTopRight) +
      horizontal("xyz-mesh-bottom", p.meshBottomLeft, p.meshBottomRight) +
      `<linearGradient id="xyz-mesh-fade" x1="0" x2="0" y1="${p.meshInsetY}" y2="${1 - p.meshInsetY}">` +
      `<stop stop-color="white" stop-opacity="0"/><stop offset="1" stop-color="white"/></linearGradient>` +
      `<mask id="xyz-mesh-mask" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}" style="mask-type:alpha">` +
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#xyz-mesh-fade)"/></mask>` +
      `<filter id="xyz-mesh-blur" filterUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}" color-interpolation-filters="sRGB">` +
      `<feGaussianBlur stdDeviation="${min * p.meshBlur}"/></filter>` +
      `<mask id="xyz-mesh-edge" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}" style="mask-type:alpha">` +
      `<polygon points="${contour}" fill="white" filter="url(#xyz-mesh-blur)"/></mask>`,
    body: `<g data-eid="xyz-mesh" clip-path="url(#xyz-clip)">` +
      `<rect data-eid="xyz-mesh-base" x="${x}" y="${y}" width="${w}" height="${h}" fill="${p.meshBase}"/>` +
      `<g mask="url(#xyz-mesh-edge)">` +
      `<rect data-eid="xyz-mesh-top" x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#xyz-mesh-top)"/>` +
      `<rect data-eid="xyz-mesh-bottom" x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#xyz-mesh-bottom)" mask="url(#xyz-mesh-mask)"/></g></g>`,
  };
}
