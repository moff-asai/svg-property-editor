import type { ControlsSpec, Params } from "./types";
import { blurCanvas, hasFilter } from "./engine";
import { influenceRanges, influencePixels, influenceSvg, INFLUENCE_GRID } from "./meshInfluence";
import { insetXyzShape, traceXyzShape, xyzShapePath } from "./xyzShape";

export const MESH_MOTION_PATTERNS = [
  ["orbit", "ゆるやかな回転"],
  ["drift", "ゆらゆら漂う"],
  ["wave", "波のうねり"],
  ["breathe", "集まる・広がる"],
] as const;
type MeshMotionPattern = typeof MESH_MOTION_PATTERNS[number][0];

// Four drifting color points. Canvas and SVG share the same radial color field and
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
  meshMotionPattern: MeshMotionPattern;
  meshTopLeftRange: number;
  meshTopRightRange: number;
  meshBottomLeftRange: number;
  meshBottomRightRange: number;
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
  meshMotionPattern: "orbit",
  meshTopLeftRange: 100,
  meshTopRightRange: 100,
  meshBottomLeftRange: 100,
  meshBottomRightRange: 100,
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
  ["影響範囲 / INFLUENCE", [
    ["meshTopLeftRange", "左上の影響範囲", "r", 20, 200, 1, "%"],
    ["meshTopRightRange", "右上の影響範囲", "r", 20, 200, 1, "%"],
    ["meshBottomLeftRange", "左下の影響範囲", "r", 20, 200, 1, "%"],
    ["meshBottomRightRange", "右下の影響範囲", "r", 20, 200, 1, "%"],
  ]],
  ["動き / MOTION", [
    ["meshMotionPattern", "動きのプリセット", "o", MESH_MOTION_PATTERNS],
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
  const number = (key: keyof MeshGradientParams, max: number, min = 0) => {
    const value = params[key];
    return typeof value === "number" && Number.isFinite(value)
      ? Math.max(min, Math.min(max, value)) : Number(MESH_DEFAULTS[key]);
  };
  return {
    meshTopLeft: color("meshTopLeft"), meshTopRight: color("meshTopRight"),
    meshBottomLeft: color("meshBottomLeft"), meshBottomRight: color("meshBottomRight"),
    meshInsetX: number("meshInsetX", 0.4), meshInsetY: number("meshInsetY", 0.4),
    meshLine: color("meshLine"), meshLineOpacity: number("meshLineOpacity", 1),
    meshPadding: number("meshPadding", 0.22), meshBlur: number("meshBlur", 0.15),
    meshBase: color("meshBase"),
    meshMotion: number("meshMotion", 0.35),
    meshMotionPattern: MESH_MOTION_PATTERNS.find(([key]) => key === params.meshMotionPattern)?.[0] ?? "orbit",
    meshTopLeftRange: number("meshTopLeftRange", 200, 20),
    meshTopRightRange: number("meshTopRightRange", 200, 20),
    meshBottomLeftRange: number("meshBottomLeftRange", 200, 20),
    meshBottomRightRange: number("meshBottomRightRange", 200, 20),
  };
}

type Point = readonly [number, number];

export function meshPoints(p: MeshGradientParams, phase: number): Point[] {
  const angle = (((phase % 1) + 1) % 1) * Math.PI * 2;
  // Drift together through all quadrants. Opposing orbits nearly collided,
  // making colors merge and reappear on the other side like a sudden swap.
  // Smaller, independently breathing ellipses overlap the color fields while
  // keeping their centers distinct and reducing travel per frame.
  const travel = Math.min(1, p.meshMotion / MESH_DEFAULTS.meshMotion);
  const breathing = 0.06 + 0.04 * p.meshMotion / 0.35;
  return [0, 1, 2, 3].map((i): Point => {
    const sx = i % 2 === 0 ? -1 : 1;
    const sy = i < 2 ? -1 : 1;
    const offset = i * 1.7;
    const t = Math.atan2(sy, sx) + angle + 0.1 * Math.sin(angle + offset);
    const rx = 0.7 + breathing * Math.sin(angle + offset);
    const ry = 0.7 + breathing * Math.cos(angle + offset);
    let px = rx * Math.cos(t), py = ry * Math.sin(t);
    // Non-rotating paths use smooth periodic waves without changing point IDs.
    // Their amplitudes leave room at the edges and between neighboring centers.
    switch (p.meshMotionPattern) {
      case "drift":
        px = sx * 0.42 + 0.34 * Math.sin(angle);
        py = sy * 0.5 + 0.16 * Math.sin(angle + i * 0.55);
        break;
      case "wave":
        px = sx * 0.48 + 0.16 * Math.sin(angle + sy * 0.7);
        py = sy * 0.42 + 0.32 * Math.sin(angle + sx * 1.1);
        break;
      case "breathe": {
        const spread = 0.5 + 0.22 * Math.sin(angle);
        px = sx * spread + 0.07 * Math.sin(angle + offset);
        py = sy * spread + 0.07 * Math.cos(angle + offset);
        break;
      }
    }
    return [
      0.5 + (0.5 - p.meshInsetX) * (sx * (1 - travel) + travel * px),
      0.5 + (0.5 - p.meshInsetY) * (sy * (1 - travel) + travel * py),
    ];
  });
}

export function createMeshPainter() {
  let tile: HTMLCanvasElement | undefined;
  let mask: HTMLCanvasElement | undefined;
  let field: HTMLCanvasElement | undefined;
  let lastKey = "";
  let lastMaskKey = "";
  return (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, p: MeshGradientParams, chamfer: number, radius: number, phase: number) => {
    const scale = 512 / Math.max(w, h);
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));
    const min = Math.min(tw, th);
    const cut = min * chamfer / Math.min(w, h);
    const cornerRadius = min * radius / Math.min(w, h);
    const points = meshPoints(p, phase);
    const ranges = influenceRanges(p);
    const maskKey = [p.meshPadding, p.meshBlur, tw, th, cut.toFixed(5), cornerRadius.toFixed(5)].join("|");
    const key = [p.meshTopLeft, p.meshTopRight, p.meshBottomLeft, p.meshBottomRight,
      p.meshBase, maskKey, ...ranges, ...points.flat()].join("|");
    if (!tile || key !== lastKey) {
      // Bound the cached texture size for video, rebuilding only when the field
      // or its contour changes. Padding/blur use the short side, not each axis.
      tile ??= document.createElement("canvas");
      tile.width = tw;
      tile.height = th;
      const c = tile.getContext("2d")!;
      field ??= document.createElement("canvas");
      field.width = field.height = INFLUENCE_GRID + 1;
      field.getContext("2d")!.putImageData(new ImageData(
        influencePixels(p, points), INFLUENCE_GRID + 1, INFLUENCE_GRID + 1), 0, 0);
      // All influence settings (including 100%) use the same smooth field.
      // Align pixel centers with the SVG grid vertices, including both edges.
      c.drawImage(field, -tw / (2 * INFLUENCE_GRID), -th / (2 * INFLUENCE_GRID),
        tw * (1 + 1 / INFLUENCE_GRID), th * (1 + 1 / INFLUENCE_GRID));

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
        const inset = insetXyzShape(tw, th, cut, cornerRadius, min * p.meshPadding);
        traceXyzShape(m, inset.x, inset.y, inset.width, inset.height, inset.chamfer, inset.radius);
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

export function meshSvg(p: MeshGradientParams, x: number, y: number, w: number, h: number, chamfer: number, radius: number, phase = 0, animatedSeconds?: number) {
  const min = Math.min(w, h);
  const inset = insetXyzShape(w, h, chamfer, radius, min * p.meshPadding);
  const contour = xyzShapePath(x + inset.x, y + inset.y, inset.width, inset.height, inset.chamfer, inset.radius);
  const field = influenceSvg(p, ph => meshPoints(p, ph), x, y, w, h, phase, animatedSeconds);
  return {
    defs: field.defs +
      `<filter id="xyz-mesh-blur" filterUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}" color-interpolation-filters="sRGB">` +
      `<feGaussianBlur stdDeviation="${min * p.meshBlur}"/></filter>` +
      `<mask id="xyz-mesh-edge" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}" style="mask-type:alpha">` +
      `<path d="${contour}" fill="white" filter="url(#xyz-mesh-blur)"/></mask>`,
    body: `<g data-eid="xyz-mesh" clip-path="url(#xyz-clip)">` +
      `<rect data-eid="xyz-mesh-base" x="${x}" y="${y}" width="${w}" height="${h}" fill="${p.meshBase}"/>` +
      `<g mask="url(#xyz-mesh-edge)">` +
      field.body + `</g></g>`,
  };
}
