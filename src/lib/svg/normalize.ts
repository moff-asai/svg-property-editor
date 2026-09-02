import DOMPurify from "dompurify";
import { EDITABLE_TAGS } from "./types";

export interface NormalizeResult {
  svg: string; // data-eid 付与済みの正規化SVG文字列
  eids: string[];
}

// SVGテキストをサニタイズし、編集対象要素へ data-eid を採番して正規化する。
// ブラウザ環境（DOMParser/DOMPurify/XMLSerializer）でのみ動作。
export function normalizeSvg(rawSvg: string): NormalizeResult {
  // 1) サニタイズ（script/on*属性/外部参照を除去。SVGプロファイル）
  const clean = DOMPurify.sanitize(rawSvg, {
    USE_PROFILES: { svg: true, svgFilters: true },
  });

  // 2) パース
  const doc = new DOMParser().parseFromString(clean, "image/svg+xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("SVGの解析に失敗しました");
  }
  const svgEl = doc.querySelector("svg");
  if (!svgEl) {
    throw new Error("有効なSVGではありません");
  }

  // 3) data-eid 採番（defs配下など非描画要素は除外）
  const eids: string[] = [];
  let counter = 0;
  const walk = (el: Element) => {
    const tag = el.tagName.toLowerCase();
    if (tag === "defs") return; // 参照定義は編集対象外
    if (EDITABLE_TAGS.has(tag)) {
      let eid = el.getAttribute("data-eid");
      if (!eid) {
        eid = `e${counter++}`;
        el.setAttribute("data-eid", eid);
      }
      eids.push(eid);
    }
    for (const child of Array.from(el.children)) walk(child);
  };
  for (const child of Array.from(svgEl.children)) walk(child);

  // 4) レスポンシブ表示のため viewBox を補完
  if (!svgEl.getAttribute("viewBox")) {
    const w = parseFloat(svgEl.getAttribute("width") ?? "");
    const h = parseFloat(svgEl.getAttribute("height") ?? "");
    if (!Number.isNaN(w) && !Number.isNaN(h)) {
      svgEl.setAttribute("viewBox", `0 0 ${w} ${h}`);
    }
  }

  const serialized = new XMLSerializer().serializeToString(svgEl);
  return { svg: serialized, eids };
}
