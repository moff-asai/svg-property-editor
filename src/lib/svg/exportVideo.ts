import DOMPurify from "dompurify";
import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import { pickCodec, encodeDimensions } from "@/lib/media/h264";
import { applyEdits } from "./apply";
import { ANIMATION_KEYFRAMES } from "./animations";
import type { EditsMap } from "./types";

// SVGアニメーションをブラウザ内で H.264/MP4 に書き出す。
// 方式: ライブと同一のSVGをオフスクリーンに構築 → 各フレームで CSS アニメを
// currentTime でシーク → spin は解析的に回転を、pulse/blink は getComputedStyle の
// opacity を各フレームのクローンへ焼き込み → data URL 経由でラスタライズ →
// WebCodecs VideoEncoder(avc) でエンコード → mp4-muxer で .mp4 コンテナ化。
// Cloudflare Workers では動画エンコード不可のため、あえてクライアント側で実行する。

const SVG_NS = "http://www.w3.org/2000/svg";
const KF_ID = "svged-export-kf";
const DEFAULT_DURATION_SEC = 2; // アニメ未指定時のクリップ長 / applyAnimation の既定と一致

export type Mp4Progress = (done: number, total: number) => void;

function parseSize(svg: SVGSVGElement): { w: number; h: number } {
  const vb = svg.getAttribute("viewBox");
  if (vb) {
    const p = vb.split(/[\s,]+/).map(Number);
    if (p.length === 4 && p[2] > 0 && p[3] > 0) return { w: p[2], h: p[3] };
  }
  const w = parseFloat(svg.getAttribute("width") ?? "");
  const h = parseFloat(svg.getAttribute("height") ?? "");
  if (w > 0 && h > 0) return { w, h };
  return { w: 800, h: 600 };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("フレーム画像のデコードに失敗しました"));
    img.src = url;
  });
}

export async function exportMp4(opts: {
  baseSvg: string;
  edits: EditsMap;
  name: string;
  fps?: number;
  onProgress?: Mp4Progress;
}): Promise<void> {
  const { baseSvg, edits, name, fps = 30, onProgress } = opts;

  if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined") {
    throw new Error(
      "このブラウザは WebCodecs (VideoEncoder) に未対応です。Chrome / Edge / Safari 16.4+ でお試しください。",
    );
  }

  // 1. ライブと同一のSVGをオフスクリーンに構築（選択枠を含めないため live DOM は使わない）
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:fixed;left:-100000px;top:0;pointer-events:none;";
  host.innerHTML = DOMPurify.sanitize(baseSvg, {
    USE_PROFILES: { svg: true, svgFilters: true },
  });
  const svg = host.querySelector("svg") as SVGSVGElement | null;
  if (!svg) throw new Error("SVG の解析に失敗しました");

  const kf = document.createElementNS(SVG_NS, "style");
  kf.setAttribute("id", KF_ID);
  kf.textContent = ANIMATION_KEYFRAMES;
  svg.insertBefore(kf, svg.firstChild);
  document.body.appendChild(host);

  try {
    applyEdits(svg, edits);

    // アニメーションが走っている全 [data-eid] を getComputedStyle で検出。
    // 組込プリセット(spin/pulse/blink)も生成SVGの独自 @keyframes も同じ扱い。
    const animatedEids: string[] = [];
    let maxAnimDur = 0;
    svg.querySelectorAll<SVGElement>("[data-eid]").forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.animationName && cs.animationName !== "none") {
        const eid = el.getAttribute("data-eid");
        if (eid) animatedEids.push(eid);
        for (const tok of cs.animationDuration.split(",")) {
          const d = parseFloat(tok); // "4s" -> 4
          if (Number.isFinite(d) && d > maxAnimDur) maxAnimDur = d;
        }
      }
    });

    const { w, h } = parseSize(svg);
    // data URL 経由の <img> が intrinsic size を持つよう明示
    svg.setAttribute("width", String(w));
    svg.setAttribute("height", String(h));
    const { sw, sh } = encodeDimensions(w, h);

    const duration = maxAnimDur > 0 ? maxAnimDur : DEFAULT_DURATION_SEC;
    const frameCount = Math.max(1, Math.round(duration * fps));

    const codec = await pickCodec(sw, sh, fps);
    if (!codec) {
      throw new Error("対応する H.264 エンコーダが見つかりませんでした");
    }

    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: "avc", width: sw, height: sh, frameRate: fps },
      fastStart: "in-memory",
    });

    let encodeError: unknown = null;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => {
        encodeError = e;
      },
    });
    const config = {
      codec,
      width: sw,
      height: sh,
      framerate: fps,
      bitrate: Math.min(20_000_000, Math.max(1_000_000, Math.round(sw * sh * fps * 0.12))),
      avc: { format: "avc" },
    } as VideoEncoderConfig;
    encoder.configure(config);

    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D コンテキストを取得できませんでした");

    const anims = svg.getAnimations({ subtree: true });
    const frameDurUs = Math.round(1_000_000 / fps);

    for (let i = 0; i < frameCount; i++) {
      const t = i / fps; // 秒
      // 全アニメを当該時刻へシーク（pulse/blink の eased opacity 読み取りに必要）
      anims.forEach((a) => {
        try {
          a.currentTime = t * 1000;
          a.pause();
        } catch {
          // シーク不可のアニメは無視
        }
      });

      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.querySelector(`#${KF_ID}`)?.remove();

      // アニメ状態を各フレームのクローンへ焼き込む。シーク済みのライブ要素の
      // 算出スタイルを読み、transform/opacity をインライン化する。
      // spin=回転matrix+fill-box、pulse/blink=eased opacity、生成SVGの独自
      // アニメ(translate等)も同じ経路で正しく焼き込まれる。
      for (const eid of animatedEids) {
        const live = svg.querySelector<SVGElement>(`[data-eid="${eid}"]`);
        const target = clone.querySelector<SVGElement>(`[data-eid="${eid}"]`);
        if (!live || !target) continue;
        const cs = getComputedStyle(live);
        target.style.animation = "none";
        if (cs.transform && cs.transform !== "none") {
          target.style.transform = cs.transform;
          target.style.transformOrigin = cs.transformOrigin;
          target.style.setProperty(
            "transform-box",
            cs.getPropertyValue("transform-box"),
          );
        }
        target.style.opacity = cs.opacity;
      }

      // エディタ用データ属性を除去
      clone.querySelectorAll("*").forEach((el) => {
        for (const attr of Array.from(el.attributes)) {
          if (attr.name === "data-eid" || attr.name.startsWith("data-base-")) {
            el.removeAttribute(attr.name);
          }
        }
      });

      const svgStr = new XMLSerializer().serializeToString(clone);
      const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`;
      const img = await loadImage(url);

      // MP4 はアルファ非対応 → 白背景で合成
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, sw, sh);
      ctx.drawImage(img, 0, 0, sw, sh);

      const frame = new VideoFrame(canvas, {
        timestamp: i * frameDurUs,
        duration: frameDurUs,
      });
      encoder.encode(frame, { keyFrame: i % fps === 0 });
      frame.close();

      if (encodeError) throw encodeError;
      onProgress?.(i + 1, frameCount);
      if (i % 5 === 0) await new Promise((r) => setTimeout(r, 0)); // UIを止めない
    }

    await encoder.flush();
    encoder.close();
    if (encodeError) throw encodeError;
    muxer.finalize();

    const buffer = (muxer.target as ArrayBufferTarget).buffer;
    const blob = new Blob([buffer], { type: "video/mp4" });
    const dlUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = dlUrl;
    a.download = name.endsWith(".mp4") ? name : `${name}.mp4`;
    a.click();
    URL.revokeObjectURL(dlUrl);
  } finally {
    host.remove();
  }
}
