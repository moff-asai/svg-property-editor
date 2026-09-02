"use client";

import { useEffect, type RefObject } from "react";
import DOMPurify from "dompurify";
import { applyEdits } from "@/lib/svg/apply";
import { ANIMATION_KEYFRAMES } from "@/lib/svg/animations";
import type { EditsMap } from "@/lib/svg/types";

const STYLE_ID = "svged-style";

export default function SvgCanvas({
  baseSvg,
  edits,
  selectedEid,
  onSelect,
  containerRef,
}: {
  baseSvg: string;
  edits: EditsMap;
  selectedEid: string | null;
  onSelect: (eid: string | null) => void;
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  // 初期描画: innerHTML へ一度だけ流し込み、keyframes と選択スタイルを注入
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // 多層防御: 保存済みの正規化SVGを描画前に再サニタイズ（data-eid等は保持）
    container.innerHTML = DOMPurify.sanitize(baseSvg, {
      USE_PROFILES: { svg: true, svgFilters: true },
    });
    const svg = container.querySelector("svg");
    if (!svg) return;

    svg.style.maxWidth = "100%";
    svg.style.maxHeight = "100%";
    svg.style.height = "auto";
    // 移動/アニメーションを viewBox 範囲でクリップしない（範囲外へも動かせる）
    svg.style.overflow = "visible";

    const style = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "style",
    );
    style.setAttribute("id", STYLE_ID);
    style.textContent = `${ANIMATION_KEYFRAMES}
[data-eid]{cursor:pointer;}
[data-selected="true"]{outline:2px solid #d7ff45;outline-offset:1px;}`;
    svg.insertBefore(style, svg.firstChild);

    applyEdits(svg, edits);
    // baseSvg が変わった時のみ再構築
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseSvg]);

  // edits 変更で再適用
  useEffect(() => {
    const svg = containerRef.current?.querySelector("svg");
    if (svg) applyEdits(svg, edits);
  }, [edits, containerRef]);

  // 選択ハイライト
  useEffect(() => {
    const svg = containerRef.current?.querySelector("svg");
    if (!svg) return;
    svg
      .querySelectorAll("[data-selected]")
      .forEach((el) => el.removeAttribute("data-selected"));
    if (selectedEid) {
      svg
        .querySelector(`[data-eid="${selectedEid}"]`)
        ?.setAttribute("data-selected", "true");
    }
  }, [selectedEid, containerRef]);

  function handleClick(e: React.MouseEvent) {
    const el = (e.target as Element).closest?.("[data-eid]");
    onSelect(el ? el.getAttribute("data-eid") : null);
  }

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      className="gen-stage editor-canvas"
    />
  );
}
