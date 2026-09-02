"use client";

import type { CSSProperties } from "react";
import type { ElementEdit, AnimationPreset } from "@/lib/svg/types";
import { ANIMATION_PRESETS } from "@/lib/svg/animations";

function isHex(v?: string): boolean {
  return !!v && /^#[0-9a-fA-F]{3,8}$/.test(v);
}

function fillStyle(num: number, min: number, max: number): CSSProperties {
  const pct = max > min ? ((num - min) / (max - min)) * 100 : 0;
  return { "--fill": `${Math.max(0, Math.min(100, pct))}%` } as CSSProperties;
}

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
      <>
        <div className="gen-inspector-head">
          <div>
            <div className="gen-eyebrow">INSPECTOR</div>
            <h1>プロパティ</h1>
          </div>
        </div>
        <div className="gen-section">
          <p className="ed-note">
            キャンバス内の要素をクリックして選択してください。
          </p>
        </div>
      </>
    );
  }

  const opacity = edit.opacity !== undefined ? parseFloat(edit.opacity) : 1;
  const scale = edit.scale ?? 1;
  const rotate = edit.rotate ?? 0;

  return (
    <>
      <div className="gen-inspector-head">
        <div>
          <div className="gen-eyebrow">ELEMENT</div>
          <h1>プロパティ</h1>
        </div>
      </div>

      <div className="gen-section">
        <div className="gen-section-title">
          <h2>要素 / ELEMENT</h2>
        </div>
        <p className="ed-note">
          選択中: <code>{selectedEid}</code>
        </p>
      </div>

      <div className="gen-section">
        <div className="gen-section-title">
          <h2>塗り・線 / PAINT</h2>
        </div>

        <div className="ed-row">
          <div className="ed-row-head">
            <span>塗り (fill)</span>
            <span className="ed-val">{edit.fill ?? "未変更"}</span>
          </div>
          <div className="ed-paint">
            <label className="gen-swatch">
              <i style={{ background: isHex(edit.fill) ? edit.fill! : "#000000" }} />
              <input
                type="color"
                value={isHex(edit.fill) ? edit.fill! : "#000000"}
                onChange={(e) => onChange({ fill: e.target.value })}
              />
            </label>
            <button className="ed-mini" onClick={() => onChange({ fill: "none" })}>
              なし
            </button>
            <button className="ed-mini" onClick={() => onChange({ fill: undefined })}>
              既定
            </button>
          </div>
        </div>

        <div className="ed-row">
          <div className="ed-row-head">
            <span>線 (stroke)</span>
            <span className="ed-val">{edit.stroke ?? "未変更"}</span>
          </div>
          <div className="ed-paint">
            <label className="gen-swatch">
              <i style={{ background: isHex(edit.stroke) ? edit.stroke! : "#000000" }} />
              <input
                type="color"
                value={isHex(edit.stroke) ? edit.stroke! : "#000000"}
                onChange={(e) => onChange({ stroke: e.target.value })}
              />
            </label>
            <button className="ed-mini" onClick={() => onChange({ stroke: "none" })}>
              なし
            </button>
            <button className="ed-mini" onClick={() => onChange({ stroke: undefined })}>
              既定
            </button>
          </div>
        </div>

        <div className="gen-field">
          <span>線幅</span>
          <input
            className="gen-number"
            type="number"
            min={0}
            step={0.5}
            value={edit.strokeWidth ?? ""}
            onChange={(e) =>
              onChange({
                strokeWidth: e.target.value === "" ? undefined : e.target.value,
              })
            }
          />
        </div>

        <div className="gen-row">
          <span>不透明度</span>
          <output>{opacity.toFixed(2)}</output>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={opacity}
            style={fillStyle(opacity, 0, 1)}
            onChange={(e) => onChange({ opacity: e.target.value })}
          />
        </div>
      </div>

      <div className="gen-section">
        <div className="gen-section-title">
          <h2>変形 / TRANSFORM</h2>
        </div>
        <div className="gen-row">
          <span>X移動</span>
          <output>{edit.translateX ?? 0}</output>
          <input
            type="range"
            min={-200}
            max={200}
            step={1}
            value={edit.translateX ?? 0}
            style={fillStyle(edit.translateX ?? 0, -200, 200)}
            onChange={(e) => onChange({ translateX: Number(e.target.value) })}
          />
        </div>
        <div className="gen-row">
          <span>Y移動</span>
          <output>{edit.translateY ?? 0}</output>
          <input
            type="range"
            min={-200}
            max={200}
            step={1}
            value={edit.translateY ?? 0}
            style={fillStyle(edit.translateY ?? 0, -200, 200)}
            onChange={(e) => onChange({ translateY: Number(e.target.value) })}
          />
        </div>
        <div className="gen-row">
          <span>拡大縮小</span>
          <output>{scale.toFixed(2)}x</output>
          <input
            type="range"
            min={0.1}
            max={3}
            step={0.1}
            value={scale}
            style={fillStyle(scale, 0.1, 3)}
            onChange={(e) => onChange({ scale: Number(e.target.value) })}
          />
        </div>
        <div className="gen-row">
          <span>回転</span>
          <output>{rotate}°</output>
          <input
            type="range"
            min={-180}
            max={180}
            step={1}
            value={rotate}
            style={fillStyle(rotate, -180, 180)}
            onChange={(e) => onChange({ rotate: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="gen-section">
        <div className="gen-section-title">
          <h2>アニメーション / ANIMATION</h2>
        </div>
        <div className="gen-field">
          <span>種類</span>
          <select
            className="gen-select"
            value={edit.animation ?? "none"}
            onChange={(e) =>
              onChange({ animation: e.target.value as AnimationPreset })
            }
          >
            {ANIMATION_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        {edit.animation && edit.animation !== "none" && (
          <div className="gen-row">
            <span>速度(秒)</span>
            <output>{edit.animationDuration ?? 2}</output>
            <input
              type="range"
              min={0.2}
              max={5}
              step={0.1}
              value={edit.animationDuration ?? 2}
              style={fillStyle(edit.animationDuration ?? 2, 0.2, 5)}
              onChange={(e) =>
                onChange({ animationDuration: Number(e.target.value) })
              }
            />
          </div>
        )}
      </div>

      <button className="ed-reset" onClick={onReset}>
        この要素の変更をリセット
      </button>
    </>
  );
}
