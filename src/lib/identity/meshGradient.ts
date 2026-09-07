import type { ControlsSpec, Params } from "./types";
import { blurCanvas, hasFilter, poly } from "./engine";

// Four drifting color points. Canvas and SVG share the same gradient axes and
// periodic paths so seeking, video and still exports agree. No bitmap needed.
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
  meshMotion: number;
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
  meshMotion: 0.2,
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
  ["動き / MOTION", [
    ["meshMotion", "ポイントの移動量", "r", 0, 0.35, 0.01, ""],
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
    meshMotion: number("meshMotion", 0.35),
  };
}

type Point = readonly [number, number];

export function meshPoints(p: MeshGradientParams, phase: number): Point[] {
  const angle = (((phase % 1) + 1) % 1) * Math.PI * 2;
  // Independent, gently elliptical orbits move toward/away from one another.
  // Keep each point in its own quadrant, even at the maximum inset/motion.
  const ax = Math.min(p.meshMotion, 0.46 - p.meshInsetX);
  const ay = Math.min(p.meshMotion, 0.46 - p.meshInsetY);
  return [0, 1, 2, 3].map((i): Point => {
    const t = angle + [0, 1.7, 4.1, 2.8][i];
    const dx = p.meshInsetX + ax * (0.5 + 0.5 * Math.sin(t));
    const dy = p.meshInsetY + ay * (0.5 + 0.5 * Math.cos(t + i * 0.4));
    return [i % 2 === 0 ? dx : 1 - dx, i < 2 ? dy : 1 - dy];
  });
}

function meshAxes(p: MeshGradientParams, phase: number): Point[][] {
  const [tl, tr, bl, br] = meshPoints(p, phase);
  return [[tl, tr], [bl, br], [
    [(tl[0] + tr[0]) / 2, (tl[1] + tr[1]) / 2],
    [(bl[0] + br[0]) / 2, (bl[1] + br[1]) / 2],
  ]];
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
  let lastMaskKey = "";
  return (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, p: MeshGradientParams, chamfer: number, phase: number) => {
    const scale = 512 / Math.max(w, h);
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));
    const min = Math.min(tw, th);
    const cut = min * chamfer / Math.min(w, h);
    const axes = meshAxes(p, phase);
    const maskKey = [p.meshPadding, p.meshBlur, tw, th, cut.toFixed(5)].join("|");
    const key = [p.meshTopLeft, p.meshTopRight, p.meshBottomLeft, p.meshBottomRight,
      p.meshBase, maskKey, ...axes.flat(2)].join("|");
    if (!tile || key !== lastKey) {
      // Bound the cached texture size for video, rebuilding only when the field
      // or its contour changes. Padding/blur use the short side, not each axis.
      tile ??= document.createElement("canvas");
      tile.width = tw;
      tile.height = th;
      const c = tile.getContext("2d")!;
      const gradient = (axis: Point[], left: string, right: string) => {
        const [a, b] = axis;
        const g = c.createLinearGradient(tw * a[0], th * a[1], tw * b[0], th * b[1]);
        g.addColorStop(0, left);
        g.addColorStop(1, right);
        return g;
      };
      c.fillStyle = gradient(axes[1], p.meshBottomLeft, p.meshBottomRight);
      c.fillRect(0, 0, tw, th);
      c.globalCompositeOperation = "destination-in";
      c.fillStyle = gradient(axes[2], "rgba(255,255,255,0)", "rgba(255,255,255,1)");
      c.fillRect(0, 0, tw, th);
      c.globalCompositeOperation = "destination-over";
      c.fillStyle = gradient(axes[0], p.meshTopLeft, p.meshTopRight);
      c.fillRect(0, 0, tw, th);

      // Color motion does not invalidate the more expensive blurred contour.
      if (!mask || maskKey !== lastMaskKey) {
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
        lastMaskKey = maskKey;
      }
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

export function meshSvg(p: MeshGradientParams, x: number, y: number, w: number, h: number, chamfer: number, phase = 0, animatedSeconds?: number) {
  const min = Math.min(w, h);
  const contour = insetContour(w, h, chamfer, min * p.meshPadding)
    .map(([px, py]) => `${x + px},${y + py}`).join(" ");
  const coords = (axis: Point[]) => [x + axis[0][0] * w, y + axis[0][1] * h, x + axis[1][0] * w, y + axis[1][1] * h];
  const axes = meshAxes(p, phase);
  const samples = animatedSeconds && p.meshMotion > 0
    ? Array.from({ length: 49 }, (_, i) => meshAxes(p, phase + i / 48).map(coords)) : [];
  const gradient = (id: string, index: number, stops: string) => {
    const names = ["x1", "y1", "x2", "y2"];
    const attributes = coords(axes[index]).map((v, i) => `${names[i]}="${v}"`).join(" ");
    const animation = samples.length ? names.map((name, i) =>
      `<animate attributeName="${name}" dur="${animatedSeconds}s" repeatCount="indefinite" values="${samples.map(s => s[index][i].toFixed(4)).join(";")}"/>`).join("") : "";
    return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" ${attributes} color-interpolation="sRGB">${stops}${animation}</linearGradient>`;
  };
  const stops = (left: string, right: string) => `<stop stop-color="${left}"/><stop offset="1" stop-color="${right}"/>`;
  return {
    defs: gradient("xyz-mesh-top", 0, stops(p.meshTopLeft, p.meshTopRight)) +
      gradient("xyz-mesh-bottom", 1, stops(p.meshBottomLeft, p.meshBottomRight)) +
      gradient("xyz-mesh-fade", 2, `<stop stop-color="white" stop-opacity="0"/><stop offset="1" stop-color="white"/>`) +
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
