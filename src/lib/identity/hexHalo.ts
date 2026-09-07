// dynamic-identity-generator2.html コンテンツ 05「HEX HALO」(内部 TAB 6, HexHalo
// モジュール HTML:334-661) を移植。ドットの分布とサイズで六角形を表現する。
import { makeNoise, fillBg } from "./engine";
import { polygonDistance, hexDotWeight, createHexInnerPlacement, type Point } from "./hexGeometry";
import type { CanvasRenderer, ControlsSpec, Params } from "./types";

export interface HexHaloParams {
  spacing: number;
  maxDot: number;
  hexSize: number;
  hexRot: number;
  innerR: number;
  outerR: number;
  flowSpeed: number;
  distortion: number;
  depth: number;
  fade: number;
  bloom: number;
  theme: string; // aurora|neon|mono|sunset|gray
  seed: number;
  bg: string;
  pattern: number; // 1|3|4
  zoom: number;
  hexConcave: number;
  innerDotPattern?: number; // 1=サイズ変化（従来）, 2=内側のサイズを保ってフェード, 3=元の粒感＋六角形配置
  v0: number;
  v1: number;
  v2: number;
  v3: number;
  v4: number;
  v5: number;
  transparent?: number; // 背景透過（1でclear）
}

// 最新の HEX HALO 保存設定（2026-09-07 15:09 JST）。
export const HEX_HALO_DEFAULTS: HexHaloParams = {
  spacing: 11,
  maxDot: 7.5,
  hexSize: 0.195,
  hexRot: 30,
  innerR: 150,
  outerR: 505,
  flowSpeed: 1.25,
  distortion: 71,
  depth: 1.55,
  fade: 34,
  bloom: 0,
  theme: "aurora",
  seed: 1234,
  bg: "#ffffff",
  pattern: 1,
  zoom: 0.75,
  hexConcave: 0,
  innerDotPattern: 1,
  transparent: 1,
  v0: 0,
  v1: 0,
  v2: 0,
  v3: 0,
  v4: 0,
  v5: 0,
};

// PRESETS[6] (HTML:2133-2138)
export const HEX_HALO_PRESETS: Partial<HexHaloParams>[] = [
  { theme: "aurora", pattern: 1, distortion: 16, bloom: 7, bg: "#ffffff" },
  { theme: "neon", pattern: 3, distortion: 48, bloom: 12, bg: "#0d0d0d" },
  { theme: "sunset", pattern: 4, distortion: 28, v0: 0.4, v3: 0.4, bg: "#ffffff" },
  { theme: "gray", pattern: 1, distortion: 8, bloom: 4, bg: "#ffffff" },
];

// controls: LIQUID GLASS と共通の並び（表示→中央の六角形→フォルム→色→モーション→背景）に
// 揃え、モード切替時も同機能セクションが同じ位置に来るようにする。
export const HEX_HALO_CONTROLS: ControlsSpec = [
  ["表示 / VIEW", [["zoom", "ズーム", "r", 0.5, 1.6, 0.05, "×"]]],
  [
    "中央の六角形 / CENTER",
    [
      ["innerDotPattern", "内側ドット", "o", [["1", "パターン1：サイズ変化"], ["2", "パターン2：出現・消失"], ["3", "パターン3：元の粒感・六角形配置"]]],
      ["hexSize", "六角形サイズ", "r", 0.13, 0.3, 0.005, ""],
      ["hexRot", "回転", "r", 0, 60, 1, "°"],
      ["hexConcave", "辺の凹み", "r", 0, 0.4, 0.01, ""],
      ["v0", "頂点1 伸び（右）", "r", 0, 1, 0.02, ""],
      ["v1", "頂点2 伸び（右下）", "r", 0, 1, 0.02, ""],
      ["v2", "頂点3 伸び（左下）", "r", 0, 1, 0.02, ""],
      ["v3", "頂点4 伸び（左）", "r", 0, 1, 0.02, ""],
      ["v4", "頂点5 伸び（左上）", "r", 0, 1, 0.02, ""],
      ["v5", "頂点6 伸び（右上）", "r", 0, 1, 0.02, ""],
    ],
  ],
  [
    "フォルム / FORM",
    [
      ["spacing", "ドット間隔", "r", 8, 20, 1, ""],
      ["maxDot", "ドット最大径", "r", 3, 14, 0.5, ""],
      ["innerR", "最小半径", "r", 150, 420, 5, ""],
      ["outerR", "最大半径", "r", 300, 530, 5, ""],
    ],
  ],
  [
    "色 / COLOR",
    [
      ["theme", "テーマ", "o", [["aurora", "オーロラ"], ["neon", "ネオン"], ["mono", "モノ"], ["sunset", "サンセット"], ["gray", "グレー"]]],
    ],
  ],
  [
    "モーション / MOTION",
    [
      ["flowSpeed", "流動スピード", "r", 0, 2, 0.05, ""],
      ["pattern", "うねり", "o", [["1", "フロー"], ["3", "渦"], ["4", "収束"]]],
      ["distortion", "うねりの強さ", "r", 0, 132, 1, ""],
      ["depth", "立体感", "r", 0.4, 2, 0.05, ""],
      ["fade", "六角形まわりのなじみ", "r", 8, 90, 2, ""],
      ["bloom", "ブルーム", "r", 0, 40, 1, ""],
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

const BASE = 1080,
  CX = 540,
  CY = 540;
const THEMES: Record<string, { h0: number; h1: number; sat: number }> = {
  aurora: { h0: 198, h1: 288, sat: 78 },
  neon: { h0: 180, h1: 322, sat: 92 },
  mono: { h0: 226, h1: 252, sat: 76 },
  sunset: { h0: 330, h1: 402, sat: 86 },
  gray: { h0: 0, h1: 0, sat: 0 },
};
const SECTOR = Math.PI / 3;
const TAU = Math.PI * 2;
const HEX_CR = 2 / Math.sqrt(3);
const sm = (x: number) => {
  x = x < 0 ? 0 : x > 1 ? 1 : x;
  return x * x * (3 - 2 * x);
};

// hsl(h, s%, l%) → #rrggbb（Illustrator 互換のため hsl() でなく hex で出力）
function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const mm = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const to = (v: number) =>
    Math.round((v + mm) * 255)
      .toString(16)
      .padStart(2, "0");
  return "#" + to(r) + to(g) + to(b);
}

interface Dot {
  r: number;
  a: number;
  i: number;
  ring: number;
}
interface View {
  k: number;
  S: number;
  dotCv: HTMLCanvasElement;
  dotCtx: CanvasRenderingContext2D;
}

export function createHexHalo(): CanvasRenderer {
  const P: HexHaloParams = { ...HEX_HALO_DEFAULTS };
  const vExt = (k: number) => (P as unknown as Record<string, number>)["v" + k] || 0;
  let noise = makeNoise(P.seed);
  let noiseSeed = P.seed;
  let dots: Dot[] = [];
  let dotKey = "";
  const colorCache = new Map<number, string>();
  let cachedS = 0;
  let cachedView: View | null = null;
  let cachedOff: HTMLCanvasElement | null = null;

  function buildDots() {
    dots = [];
    const hexR = P.hexSize * BASE;
    const r0 = Math.max(60, hexR * (1 - P.hexConcave) * 0.82);
    let ring = 0;
    for (let r = r0; r <= P.outerR + P.spacing * 2; r += P.spacing, ring++) {
      const count = Math.max(6, Math.round((2 * Math.PI * r) / P.spacing));
      const off = (ring % 2) * 0.5;
      for (let i = 0; i < count; i++) {
        const a = ((i + off) / count) * Math.PI * 2;
        dots.push({ r, a, i, ring });
      }
    }
  }

  function hexDist(x: number, y: number, rot: number) {
    const r = Math.sqrt(x * x + y * y);
    if (r < 1e-6) return 0;
    let psi = Math.atan2(y, x) - rot;
    psi = ((psi % TAU) + TAU) % TAU;
    const k1 = Math.floor(psi / SECTOR) % 6,
      k2 = (k1 + 1) % 6;
    const dd = psi - k1 * SECTOR;
    const r1 = HEX_CR * (1 + vExt(k1));
    const r2 = HEX_CR * (1 + vExt(k2));
    let rb = (r1 * r2 * Math.sin(SECTOR)) / (r2 * Math.sin(SECTOR - dd) + r1 * Math.sin(dd));
    const cc = P.hexConcave;
    if (cc > 0) rb *= 1 - cc * Math.sin(3 * dd);
    return r / rb;
  }

  let boundaryKey = "";
  let boundaryDistance = polygonDistance([]);
  function syncBoundary() {
    const key = [P.hexSize, P.hexRot, P.hexConcave, ...Array.from({ length: 6 }, (_, i) => vExt(i))].join("|");
    if (key === boundaryKey) return;
    boundaryKey = key;
    const rot = P.hexRot * Math.PI / 180;
    const steps = P.hexConcave > 0 ? 24 : 1;
    const vertices: Point[] = [];
    for (let i = 0; i < 6 * steps; i++) {
      const angle = rot + i * SECTOR / steps;
      const x = Math.cos(angle);
      const y = Math.sin(angle);
      const radius = P.hexSize * BASE / hexDist(x, y, rot);
      vertices.push({ x: x * radius, y: y * radius });
    }
    boundaryDistance = polygonDistance(vertices);
  }

  function hslFor(hue: number, sat: number, li: number) {
    const key = (hue | 0) * 100000 + (li | 0) * 100 + (sat | 0);
    let v = colorCache.get(key);
    if (!v) {
      v = "hsl(" + (hue | 0) + "," + (sat | 0) + "%," + (li | 0) + "%)";
      colorCache.set(key, v);
    }
    return v;
  }

  function makeView(k: number): View {
    const S = BASE * k;
    const dotCv = document.createElement("canvas");
    dotCv.width = S;
    dotCv.height = S;
    return {
      k,
      S,
      dotCv,
      dotCtx: dotCv.getContext("2d") as CanvasRenderingContext2D,
    };
  }

  // ドット群を計算し、各ドットごとに plot を呼ぶ（canvas 描画とベクターSVG出力で共有）
  function forEachDot(
    t: number,
    plot: (x: number, y: number, size: number, hue: number, sat: number, li: number, alpha: number) => void,
  ) {
    const th = THEMES[P.theme];
    const hexR = P.hexSize * BASE;
    const rot = (P.hexRot * Math.PI) / 180;
    const amp = P.distortion;
    const f = 0.0016,
      cf = 0.0011;
    const fadePx = Math.max(P.fade, P.spacing * 2.5),
      outerFade = 70;
    const originalBandIn = Math.max(hexR * 1.02, P.innerR);
    const placeInner = createHexInnerPlacement(hexR * HEX_CR, rot, originalBandIn,
      angle => hexR / hexDist(Math.cos(angle), Math.sin(angle), rot));
    const fullInnerDots = P.innerDotPattern === 2;
    const drift = t * 0.03;
    const outerR = P.outerR;
    const tc = t * 0.35;
    const tips: { x: number; y: number; rad: number; push: number; wob: number }[] = [];
    for (let vk = 0; vk < 6; vk++) {
      const ext = vExt(vk);
      if (ext > 0.01) {
        const b = rot + vk * SECTOR;
        const tr = hexR * HEX_CR * (1 + ext);
        tips.push({
          x: CX + Math.cos(b) * tr,
          y: CY + Math.sin(b) * tr,
          rad: hexR * (0.55 + 0.9 * ext),
          push: hexR * 0.55 * ext,
          wob: vk * 2.1,
        });
      }
    }
    const convShift = (t * 48) % (P.spacing * 2);
    const convW = P.spacing * 0.6;
    const convP =
      P.pattern === 4 ? Math.max(0, (convShift - (P.spacing * 2 - convW)) / convW) : 0;
    const passCount = convP > 0 ? 2 : 1;
    for (let pass = 0; pass < passCount; pass++) {
      const passShift = pass === 0 ? convShift : convShift - P.spacing * 2;
      const passW = convP > 0 ? (pass === 0 ? Math.sqrt(1 - convP) : Math.sqrt(convP)) : 1;
      for (let idx = 0; idx < dots.length; idx++) {
        const dot = dots[idx];
        let baseR = dot.r;
        const a = dot.a + drift,
          seamA = passW;
        if (P.pattern === 4) {
          baseR = dot.r - passShift;
          if (baseR < 5) continue;
        }
        const bx = CX + baseR * Math.cos(a),
          by = CY + baseR * Math.sin(a);
        const n1 = noise(bx * f, by * f, t * 0.6);
        const n2 = noise(bx * f + 137, by * f + 91, t * 0.6);
        let x, y;
        if (P.pattern === 3) {
          const aa = a + Math.sin(dot.r * 0.018 + t * 1.2) * amp * 0.004 + n1 * amp * 0.0015;
          const rr = dot.r + n2 * amp * 0.6;
          x = CX + rr * Math.cos(aa);
          y = CY + rr * Math.sin(aa);
        } else if (P.pattern === 4) {
          const rr = baseR + n1 * amp * 0.4;
          const aa = a + n2 * amp * 0.0015;
          x = CX + rr * Math.cos(aa);
          y = CY + rr * Math.sin(aa);
        } else {
          x = bx + n1 * amp;
          y = by + n2 * amp;
        }
        for (let ti = 0; ti < tips.length; ti++) {
          const tp = tips[ti];
          const dxv = x - tp.x,
            dyv = y - tp.y;
          const dv = Math.sqrt(dxv * dxv + dyv * dyv);
          if (dv < tp.rad && dv > 0.001) {
            const gg = sm(1 - dv / tp.rad);
            const pu = tp.push * gg * (0.85 + 0.15 * Math.sin(t * 1.6 + tp.wob));
            x += (dxv / dv) * pu;
            y += (dyv / dv) * pu;
          }
        }
        const rx = x - CX,
          ry = y - CY;
        const dist = Math.sqrt(rx * rx + ry * ry);
        const edgeDistance = boundaryDistance(rx, ry);
        const innerK = P.innerDotPattern === 3
          ? sm((dist - originalBandIn) / P.fade)
          : hexDotWeight(edgeDistance, fadePx);
        const outerK = sm((outerR - dist) / outerFade);
        if (innerK <= (fullInnerDots ? 0.001 : 0.01) || outerK <= 0.01) continue;
        // Follow all six sides with the size envelope too; a circular inner
        // radius otherwise hides the corners even with an accurate distance.
        const bandIn = P.innerDotPattern === 3 ? originalBandIn : Math.max(P.innerR, dist - edgeDistance - fadePx * 0.8);
        const bandSpan = Math.max(40, outerR - bandIn);
        let band = (dist - bandIn) / bandSpan;
        band = band < 0 ? 0 : band > 1 ? 1 : band;
        // Pattern 2 keeps the inner half of the ring at full size; only its
        // opacity follows the hexagon. The outer size falloff stays intact.
        const sizeBand = fullInnerDots ? Math.max(0.5, band) : band;
        let sfac = Math.pow(Math.sin(Math.PI * sizeBand), P.depth);
        const n3 = noise(bx * f * 1.9 + 310, by * f * 1.9 + 310, t * 0.5);
        sfac *= 0.6 + 0.4 * (n3 * 0.5 + 0.5);
        // 元のサイズ補正を維持し、境界では透明度で自然に出現させる。
        if (!fullInnerDots) sfac *= 0.35 + 0.65 * innerK;
        const size = P.maxDot * sfac;
        if (size < 0.4) continue;
        const alpha = seamA * innerK * outerK * (0.82 + 0.18 * (n1 * 0.5 + 0.5));
        const nc = noise(x * cf, y * cf, tc);
        let hueT = (nc + 1) * 0.5;
        hueT = 0.5 + (hueT - 0.5) * 0.92;
        const hue = th.h0 + (th.h1 - th.h0) * hueT;
        let li = 48 + 16 * (1 - sfac);
        if (P.bg !== "#ffffff") li += 10;
        const position = P.innerDotPattern === 3 ? placeInner(rx, ry) : { x: rx, y: ry };
        plot(P.innerDotPattern === 3 ? CX + position.x : x, P.innerDotPattern === 3 ? CY + position.y : y, size, hue, th.sat, li, alpha);
      }
    }
  }

  function drawDots(view: View, t: number) {
    const d = view.dotCtx,
      k = view.k,
      z = P.zoom;
    d.setTransform(1, 0, 0, 1, 0, 0);
    d.clearRect(0, 0, view.S, view.S);
    d.setTransform(k * z, 0, 0, k * z, k * CX * (1 - z), k * CY * (1 - z));
    forEachDot(t, (x, y, size, hue, sat, li, alpha) => {
      d.globalAlpha = alpha;
      d.fillStyle = hslFor(hue, sat, li);
      d.beginPath();
      d.arc(x, y, size, 0, Math.PI * 2);
      d.fill();
    });
    d.globalAlpha = 1;
  }

  function drawScene(targetCtx: CanvasRenderingContext2D, view: View, t: number, transparent: boolean) {
    const S = view.S;
    drawDots(view, t);
    targetCtx.setTransform(1, 0, 0, 1, 0, 0);
    targetCtx.clearRect(0, 0, S, S);
    if (!transparent) {
      targetCtx.fillStyle = P.bg;
      targetCtx.fillRect(0, 0, S, S);
    }
    if (P.bloom > 0) {
      targetCtx.filter = "blur(" + P.bloom * view.k + "px)";
      targetCtx.globalAlpha = 0.5;
      targetCtx.drawImage(view.dotCv, 0, 0);
      targetCtx.filter = "none";
      targetCtx.globalAlpha = 1;
    }
    targetCtx.drawImage(view.dotCv, 0, 0);
  }

  function syncDots() {
    const key = [P.spacing, P.hexSize, P.hexConcave, P.outerR].join("|");
    if (key !== dotKey) {
      dotKey = key;
      buildDots();
    }
  }
  function syncNoise() {
    if (P.seed !== noiseSeed) {
      noise = makeNoise(P.seed);
      noiseSeed = P.seed;
    }
  }

  function draw(c: CanvasRenderingContext2D, W: number, H: number, ph: number, params: Params) {
    Object.assign(P, params);
    P.innerDotPattern = params.innerDotPattern === 3 ? 3 : params.innerDotPattern === 2 ? 2 : 1;
    syncNoise();
    syncDots();
    syncBoundary();
    const t = 5 + ph * 8 * P.flowSpeed;
    const S = Math.min(W, H);
    if (cachedS !== S || !cachedView || !cachedOff) {
      cachedS = S;
      cachedView = makeView(S / BASE);
      cachedOff = document.createElement("canvas");
      cachedOff.width = cachedView.S;
      cachedOff.height = cachedView.S;
    }
    const transparent = !!P.transparent;
    drawScene(cachedOff.getContext("2d") as CanvasRenderingContext2D, cachedView, t, transparent);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.filter = "none";
    c.globalCompositeOperation = "source-over";
    fillBg(c, W, H, P.bg, transparent);
    c.drawImage(cachedOff, (W - cachedView.S) / 2, (H - cachedView.S) / 2);
  }

  // イラレ編集可能なベクターSVG（各ドットを <circle> で出力）。glow/bloom は raster のため省略。
  function toSvg({ phase, params }: { phase: number; loopSeconds: number; params: Params }): string {
    Object.assign(P, params);
    P.innerDotPattern = params.innerDotPattern === 3 ? 3 : params.innerDotPattern === 2 ? 2 : 1;
    syncNoise();
    syncDots();
    syncBoundary();
    const t = 5 + phase * 8 * P.flowSpeed;
    const z = P.zoom;
    const circles: string[] = [];
    forEachDot(t, (x, y, size, hue, sat, li, alpha) => {
      circles.push(
        `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${size.toFixed(2)}" fill="${hslToHex(hue, sat, li)}" opacity="${Math.min(1, alpha).toFixed(3)}"/>`,
      );
    });
    const bgRect = P.transparent ? "" : `<rect width="${BASE}" height="${BASE}" fill="${P.bg}"/>`;
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BASE} ${BASE}" width="${BASE}" height="${BASE}">` +
      bgRect +
      `<g transform="matrix(${z},0,0,${z},${(CX * (1 - z)).toFixed(2)},${(CY * (1 - z)).toFixed(2)})">` +
      circles.join("") +
      `</g></svg>`
    );
  }

  buildDots();
  return {
    render(ctx, W, H, phase, params) {
      draw(ctx, W, H, phase, params);
    },
    toSvg,
  };
}
