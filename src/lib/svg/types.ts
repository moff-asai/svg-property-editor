// SVG要素に付与できる編集（オーバーライド）の型定義

export type AnimationPreset = "none" | "spin" | "pulse" | "blink";

// type エイリアスにすることで暗黙のインデックスシグネチャを持ち、
// 生成型 Json（documents.edits 列）へ代入可能になる。
export type ElementEdit = {
  fill?: string;
  stroke?: string;
  strokeWidth?: string;
  opacity?: string; // "0"〜"1"
  translateX?: number;
  translateY?: number;
  scale?: number;
  rotate?: number; // degrees
  animation?: AnimationPreset;
  animationDuration?: number; // seconds
};

// data-eid をキーにした要素ごとのオーバーライド集合（documents.edits に保存）
export type EditsMap = Record<string, ElementEdit>;

export const EDITABLE_TAGS = new Set([
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "g",
]);
