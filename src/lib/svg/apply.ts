import type { EditsMap, ElementEdit } from "./types";
import { applyAnimation } from "./animations";

// スタイル系属性（編集キー -> SVG属性名）
const STYLE_ATTRS: [keyof ElementEdit, string][] = [
  ["fill", "fill"],
  ["stroke", "stroke"],
  ["strokeWidth", "stroke-width"],
  ["opacity", "opacity"],
];

// 元の値を data-base-<attr> に一度だけ退避し、その値を返す
function captureBase(el: SVGElement, attr: string): string {
  const key = `data-base-${attr}`;
  if (!el.hasAttribute(key)) {
    el.setAttribute(key, el.getAttribute(attr) ?? "");
  }
  return el.getAttribute(key) ?? "";
}

function applyStyleAttr(el: SVGElement, attr: string, value: string | undefined) {
  const base = captureBase(el, attr);
  const v = value !== undefined && value !== "" ? value : base;
  if (v === "") el.removeAttribute(attr);
  else el.setAttribute(attr, v);
}

function applyTransform(el: SVGElement, edit: ElementEdit) {
  // 元のtransformを退避
  const base = captureBase(el, "transform");

  const parts: string[] = [];
  if (base) parts.push(base);

  // 要素中心（回転/拡大の基点）
  let cx = 0;
  let cy = 0;
  try {
    const bbox = (el as SVGGraphicsElement).getBBox();
    cx = bbox.x + bbox.width / 2;
    cy = bbox.y + bbox.height / 2;
  } catch {
    // getBBox不可（未描画等）は原点基準にフォールバック
  }

  const tx = edit.translateX ?? 0;
  const ty = edit.translateY ?? 0;
  if (tx !== 0 || ty !== 0) parts.push(`translate(${tx} ${ty})`);
  if (edit.rotate) parts.push(`rotate(${edit.rotate} ${cx} ${cy})`);
  if (edit.scale !== undefined && edit.scale !== 1) {
    parts.push(`translate(${cx} ${cy}) scale(${edit.scale}) translate(${-cx} ${-cy})`);
  }

  const t = parts.join(" ").trim();
  if (t) el.setAttribute("transform", t);
  else el.removeAttribute("transform");
}

// 単一要素へ編集を適用（空editなら基底へ復元＝冪等）
export function applyEditToElement(el: SVGElement, edit: ElementEdit) {
  for (const [key, attr] of STYLE_ATTRS) {
    applyStyleAttr(el, attr, edit[key] as string | undefined);
  }
  applyTransform(el, edit);
  applyAnimation(el, edit.animation, edit.animationDuration);
}

// SVGルート配下の全 data-eid 要素へ edits を反映（未編集要素は基底へ復元）
export function applyEdits(svgRoot: Element, edits: EditsMap) {
  const els = svgRoot.querySelectorAll<SVGElement>("[data-eid]");
  els.forEach((el) => {
    const eid = el.getAttribute("data-eid");
    if (!eid) return;
    applyEditToElement(el, edits[eid] ?? {});
  });
}

// 要素の現在の基底値（パネル初期表示用）
export function readBaseValue(el: SVGElement, attr: string): string {
  const key = `data-base-${attr}`;
  return (el.hasAttribute(key) ? el.getAttribute(key) : el.getAttribute(attr)) ?? "";
}
