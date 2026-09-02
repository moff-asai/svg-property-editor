"use client";

import type { ReactNode } from "react";
import type { ElementEdit, AnimationPreset } from "@/lib/svg/types";
import { ANIMATION_PRESETS } from "@/lib/svg/animations";

function isHex(v?: string): boolean {
  return !!v && /^#[0-9a-fA-F]{3,8}$/.test(v);
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-zinc-500">{label}</label>
      {children}
    </div>
  );
}

const btn =
  "rounded border border-black/15 px-2 py-1 text-xs hover:bg-black/[.04] dark:border-white/20 dark:hover:bg-white/[.06]";

export default function PropertyPanel({
  selectedEid,
  edit,
  onChange,
  onReset,
}: {
  selectedEid: string | null;
  edit: ElementEdit;
  onChange: (patch: Partial<ElementEdit>) => void;
  onReset: () => void;
}) {
  if (!selectedEid) {
    return (
      <div className="p-4 text-sm text-zinc-500">
        キャンバス内の要素をクリックして選択してください。
      </div>
    );
  }

  const opacity = edit.opacity !== undefined ? parseFloat(edit.opacity) : 1;
  const scale = edit.scale ?? 1;
  const rotate = edit.rotate ?? 0;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="text-xs text-zinc-400">
        選択中: <code>{selectedEid}</code>
      </div>

      <Row label="塗り (fill)">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="color"
            value={isHex(edit.fill) ? edit.fill! : "#000000"}
            onChange={(e) => onChange({ fill: e.target.value })}
            className="h-8 w-10 cursor-pointer rounded border border-black/15 dark:border-white/20"
          />
          <button className={btn} onClick={() => onChange({ fill: "none" })}>
            なし
          </button>
          <button className={btn} onClick={() => onChange({ fill: undefined })}>
            既定
          </button>
          <span className="text-xs text-zinc-400">{edit.fill ?? "（未変更）"}</span>
        </div>
      </Row>

      <Row label="線 (stroke)">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="color"
            value={isHex(edit.stroke) ? edit.stroke! : "#000000"}
            onChange={(e) => onChange({ stroke: e.target.value })}
            className="h-8 w-10 cursor-pointer rounded border border-black/15 dark:border-white/20"
          />
          <button className={btn} onClick={() => onChange({ stroke: "none" })}>
            なし
          </button>
          <button className={btn} onClick={() => onChange({ stroke: undefined })}>
            既定
          </button>
          <span className="text-xs text-zinc-400">
            {edit.stroke ?? "（未変更）"}
          </span>
        </div>
      </Row>

      <Row label={`線幅: ${edit.strokeWidth ?? "（未変更）"}`}>
        <input
          type="number"
          min={0}
          step={0.5}
          value={edit.strokeWidth ?? ""}
          onChange={(e) =>
            onChange({
              strokeWidth: e.target.value === "" ? undefined : e.target.value,
            })
          }
          className="w-28 rounded border border-black/15 px-2 py-1 text-sm dark:border-white/20 dark:bg-zinc-800"
        />
      </Row>

      <Row label={`不透明度: ${opacity.toFixed(2)}`}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(e) => onChange({ opacity: e.target.value })}
        />
      </Row>

      <hr className="border-black/10 dark:border-white/15" />

      <Row label={`X移動: ${edit.translateX ?? 0}`}>
        <input
          type="range"
          min={-200}
          max={200}
          step={1}
          value={edit.translateX ?? 0}
          onChange={(e) => onChange({ translateX: Number(e.target.value) })}
        />
      </Row>
      <Row label={`Y移動: ${edit.translateY ?? 0}`}>
        <input
          type="range"
          min={-200}
          max={200}
          step={1}
          value={edit.translateY ?? 0}
          onChange={(e) => onChange({ translateY: Number(e.target.value) })}
        />
      </Row>
      <Row label={`拡大縮小: ${scale.toFixed(2)}x`}>
        <input
          type="range"
          min={0.1}
          max={3}
          step={0.1}
          value={scale}
          onChange={(e) => onChange({ scale: Number(e.target.value) })}
        />
      </Row>
      <Row label={`回転: ${rotate}°`}>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={rotate}
          onChange={(e) => onChange({ rotate: Number(e.target.value) })}
        />
      </Row>

      <hr className="border-black/10 dark:border-white/15" />

      <Row label="アニメーション">
        <select
          value={edit.animation ?? "none"}
          onChange={(e) =>
            onChange({ animation: e.target.value as AnimationPreset })
          }
          className="rounded border border-black/15 px-2 py-1 text-sm dark:border-white/20 dark:bg-zinc-800"
        >
          {ANIMATION_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </Row>
      {edit.animation && edit.animation !== "none" && (
        <Row label={`速度(秒): ${edit.animationDuration ?? 2}`}>
          <input
            type="range"
            min={0.2}
            max={5}
            step={0.1}
            value={edit.animationDuration ?? 2}
            onChange={(e) =>
              onChange({ animationDuration: Number(e.target.value) })
            }
          />
        </Row>
      )}

      <button
        onClick={onReset}
        className="mt-2 rounded-md border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
      >
        この要素の変更をリセット
      </button>
    </div>
  );
}
