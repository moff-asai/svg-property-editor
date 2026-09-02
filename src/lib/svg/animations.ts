import type { AnimationPreset } from "./types";

// アニメーション用 keyframes（ライブ描画時はSVGへ<style>注入、エクスポート時も同じものを埋込）
export const ANIMATION_KEYFRAMES = `
@keyframes svged-spin { to { transform: rotate(360deg); } }
@keyframes svged-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
@keyframes svged-blink { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }
`.trim();

export const ANIMATION_PRESETS: { value: AnimationPreset; label: string }[] = [
  { value: "none", label: "なし" },
  { value: "spin", label: "回転" },
  { value: "pulse", label: "点滅（明暗）" },
  { value: "blink", label: "点滅（オンオフ）" },
];

// 要素へCSSアニメーションを適用（none/未指定で解除）
export function applyAnimation(
  el: SVGElement,
  animation: AnimationPreset | undefined,
  durationSec: number | undefined,
) {
  const duration = durationSec && durationSec > 0 ? durationSec : 2;

  if (!animation || animation === "none") {
    el.style.animation = "";
    return;
  }

  const defs: Record<Exclude<AnimationPreset, "none">, string> = {
    spin: `svged-spin ${duration}s linear infinite`,
    pulse: `svged-pulse ${duration}s ease-in-out infinite`,
    blink: `svged-blink ${duration}s steps(1) infinite`,
  };

  if (animation === "spin") {
    // 要素自身の中心を回転軸にする
    el.style.transformBox = "fill-box";
    el.style.transformOrigin = "center";
  }
  el.style.animation = defs[animation];
}
