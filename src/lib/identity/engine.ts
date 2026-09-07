// dynamic-identity-generator2.html の共有エンジン(HTML:133-328, 338-378)を
// TypeScript へ移植。アルゴリズムは原典と同一。canvas 2D 前提のブラウザ専用。
// 原典のモジュールグローバル offscreen キャッシュ layer() は LayerCache クラスに
// 置換し、プレビューと書き出しで独立インスタンスを持てるようにした。

export const TAU = Math.PI * 2;
export const RAD = Math.PI / 180;

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rng = (s: number) => () => (
  (s = (s * 1664525 + 1013904223) | 0), ((s >>> 8) & 0xffffff) / 0x1000000
);
export function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function smoothstep(e0: number, e1: number, v: number) {
  const t = clamp((v - e0) / Math.max(1e-5, e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

// simplex noise 3D (Gustavson) — HTML:338-378。seed から決定論的。
export function makeNoise(seedVal: number): (x: number, y: number, z: number) => number {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let n = (seedVal >>> 0) || 1;
  const rnd = () => (n = (n * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 255; i > 0; i--) {
    const j = (rnd() * (i + 1)) | 0;
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  const perm = new Uint8Array(512),
    pm12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
    pm12[i] = perm[i] % 12;
  }
  const g = new Float32Array([
    1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1,
    1, 0, 1, -1, 0, -1, -1,
  ]);
  const F3 = 1 / 3,
    G3 = 1 / 6;
  return function (xin: number, yin: number, zin: number) {
    let n0, n1, n2, n3;
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s),
      j = Math.floor(yin + s),
      k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const x0 = xin - (i - t),
      y0 = yin - (j - t),
      z0 = zin - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) {
        i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
      } else if (x0 >= z0) {
        i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1;
      } else {
        i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1;
      }
    } else {
      if (y0 < z0) {
        i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1;
      } else if (x0 < z0) {
        i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1;
      } else {
        i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
      }
    }
    const x1 = x0 - i1 + G3,
      y1 = y0 - j1 + G3,
      z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3,
      y2 = y0 - j2 + 2 * G3,
      z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3,
      y3 = y0 - 1 + 3 * G3,
      z3 = z0 - 1 + 3 * G3;
    const ii = i & 255,
      jj = j & 255,
      kk = k & 255;
    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 < 0) n0 = 0;
    else {
      const gi = pm12[ii + perm[jj + perm[kk]]] * 3;
      t0 *= t0;
      n0 = t0 * t0 * (g[gi] * x0 + g[gi + 1] * y0 + g[gi + 2] * z0);
    }
    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 < 0) n1 = 0;
    else {
      const gi = pm12[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3;
      t1 *= t1;
      n1 = t1 * t1 * (g[gi] * x1 + g[gi + 1] * y1 + g[gi + 2] * z1);
    }
    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 < 0) n2 = 0;
    else {
      const gi = pm12[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3;
      t2 *= t2;
      n2 = t2 * t2 * (g[gi] * x2 + g[gi + 1] * y2 + g[gi + 2] * z2);
    }
    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 < 0) n3 = 0;
    else {
      const gi = pm12[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3;
      t3 *= t3;
      n3 = t3 * t3 * (g[gi] * x3 + g[gi + 1] * y3 + g[gi + 2] * z3);
    }
    return 32 * (n0 + n1 + n2 + n3);
  };
}

/* ---------- color ---------- */
export function rgbOf(h: string): number[] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgba(h: string, a: number) {
  const c = rgbOf(h);
  return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + (a < 0 ? 0 : a > 1 ? 1 : a) + ")";
}
export const cstr = (c: number[], a: number) =>
  "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")";

// 背景の塗り（透過ONなら塗らずにクリア＝透明）。全レンダラで共通。
export function fillBg(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  bg: string,
  transparent: boolean,
) {
  if (transparent) {
    ctx.clearRect(0, 0, W, H);
  } else {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
  }
}

/* ---------- offscreen layers ---------- */
export interface Layer {
  c: HTMLCanvasElement;
  x: CanvasRenderingContext2D;
}
export class LayerCache {
  private map = new Map<string, Layer>();
  get(key: string, w: number, h: number): Layer {
    let L = this.map.get(key);
    if (!L || L.c.width !== w || L.c.height !== h) {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const x = c.getContext("2d", {
        willReadFrequently: key === "sample",
      }) as CanvasRenderingContext2D;
      L = { c, x };
      this.map.set(key, L);
    }
    const x = L.x;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalAlpha = 1;
    x.globalCompositeOperation = "source-over";
    x.filter = "none";
    x.clearRect(0, 0, w, h);
    return L;
  }
}

/* ---------- blur ---------- */
let _hasFilter: boolean | null = null;
export function hasFilter() {
  if (_hasFilter !== null) return _hasFilter;
  try {
    const t = document.createElement("canvas");
    t.width = t.height = 11;
    const x = t.getContext("2d") as CanvasRenderingContext2D;
    x.fillStyle = "#000";
    x.fillRect(0, 0, 11, 11);
    x.filter = "blur(3px)";
    x.fillStyle = "#fff";
    x.fillRect(5, 5, 1, 1);
    x.filter = "none";
    _hasFilter = x.getImageData(3, 5, 1, 1).data[0] > 2;
  } catch {
    _hasFilter = false;
  }
  return _hasFilter;
}
function blurPass(
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  w: number,
  h: number,
  r: number,
  horiz: boolean,
) {
  const n = horiz ? w : h,
    m = horiz ? h : w,
    d = 2 * r + 1;
  for (let j = 0; j < m; j++)
    for (let ch = 0; ch < 4; ch++) {
      const at = (i: number) => (horiz ? (j * w + i) * 4 + ch : (i * w + j) * 4 + ch);
      let sum = 0;
      for (let i = -r; i <= r; i++) sum += src[at(clamp(i, 0, n - 1))];
      for (let i = 0; i < n; i++) {
        dst[at(i)] = sum / d;
        sum += src[at(clamp(i + r + 1, 0, n - 1))] - src[at(clamp(i - r, 0, n - 1))];
      }
    }
}
export function blurCanvas(cnv: HTMLCanvasElement, r: number) {
  r = Math.round(r);
  if (r < 1) return;
  const x = cnv.getContext("2d") as CanvasRenderingContext2D,
    w = cnv.width,
    h = cnv.height;
  const img = x.getImageData(0, 0, w, h),
    a = img.data,
    b = new Uint8ClampedArray(a.length);
  for (let p = 0; p < 2; p++) {
    blurPass(a, b, w, h, r, true);
    blurPass(b, a, w, h, r, false);
  }
  x.putImageData(img, 0, 0);
}
export function softDraw(
  dst: CanvasRenderingContext2D,
  src: HTMLCanvasElement,
  px: number,
  alpha: number,
  comp: GlobalCompositeOperation | undefined,
  W: number,
  H: number,
  cache: LayerCache,
) {
  dst.save();
  dst.globalAlpha = alpha;
  dst.globalCompositeOperation = comp || "source-over";
  if (px <= 0.3) {
    dst.filter = "none";
    dst.drawImage(src, 0, 0, W, H);
  } else if (hasFilter()) {
    dst.filter = "blur(" + px.toFixed(2) + "px)";
    dst.drawImage(src, 0, 0, W, H);
    dst.filter = "none";
  } else {
    const t = cache.get("_blur", src.width, src.height);
    t.x.drawImage(src, 0, 0);
    blurCanvas(t.c, px * (src.width / W));
    dst.drawImage(t.c, 0, 0, W, H);
  }
  dst.restore();
}

/* ---------- path ---------- */
export function poly(c: CanvasRenderingContext2D, ps: number[][]) {
  c.beginPath();
  c.moveTo(ps[0][0], ps[0][1]);
  for (let i = 1; i < ps.length; i++) c.lineTo(ps[i][0], ps[i][1]);
  c.closePath();
}

/* ---------- finish ---------- */
let _tiles: HTMLCanvasElement[] = [];
export function noiseTiles(): HTMLCanvasElement[] {
  if (_tiles.length) return _tiles;
  const tiles: HTMLCanvasElement[] = [];
  for (let t = 0; t < 4; t++) {
    const cn = document.createElement("canvas");
    cn.width = cn.height = 192;
    const x = cn.getContext("2d") as CanvasRenderingContext2D,
      id = x.createImageData(192, 192),
      r = rng(9173 + t * 7919);
    for (let i = 0; i < id.data.length; i += 4) {
      const v = (r() * 255) | 0;
      id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
      id.data[i + 3] = 255;
    }
    x.putImageData(id, 0, 0);
    tiles.push(cn);
  }
  _tiles = tiles;
  return _tiles;
}
export function grain(c: CanvasRenderingContext2D, W: number, H: number, amt: number, ph: number) {
  if (amt <= 0) return;
  const tiles = noiseTiles();
  const t = tiles[((Math.floor(ph * 24) % 4) + 4) % 4];
  if (!t) return;
  const pat = c.createPattern(t, "repeat");
  if (!pat) return;
  c.save();
  c.globalCompositeOperation = "overlay";
  c.globalAlpha = 0.05 + amt * 0.15;
  c.fillStyle = pat;
  c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = "lighter";
  c.globalAlpha = amt * 0.022;
  c.fillStyle = pat;
  c.fillRect(0, 0, W, H);
  c.restore();
}
export function vignette(c: CanvasRenderingContext2D, W: number, H: number, amt: number) {
  if (amt <= 0) return;
  const g = c.createRadialGradient(
    W / 2,
    H / 2,
    Math.min(W, H) * 0.18,
    W / 2,
    H / 2,
    Math.hypot(W, H) * 0.62,
  );
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0," + amt * 0.92 + ")");
  c.save();
  c.globalCompositeOperation = "source-over";
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  c.restore();
}
