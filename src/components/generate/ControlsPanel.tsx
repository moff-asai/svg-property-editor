"use client";

import type { ControlsSpec, Params, ParamValue } from "@/lib/identity/types";

// 数値文字列は number 化（buildPanel HTML:2253/2274 と同じ挙動）。
// "full"/"inner" 等は NaN → 文字列のまま。
function coerce(v: string): ParamValue {
  const n = Number(v);
  return v.trim() !== "" && !Number.isNaN(n) ? n : v;
}

export default function ControlsPanel({
  spec,
  params,
  onChange,
}: {
  spec: ControlsSpec;
  params: Params;
  onChange: (patch: Params) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {spec.map(([title, controls]) => (
        <div key={title} className="flex flex-col gap-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            {title}
          </div>
          {controls.map((ctl) => {
            const key = ctl[0];
            const label = ctl[1];
            const val = params[key];
            if (ctl[2] === "r") {
              const [, , , min, max, step, unit] = ctl;
              const num = typeof val === "number" ? val : Number(val);
              return (
                <div key={key} className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-500">
                    {label}: {num.toFixed(step < 0.01 ? 3 : step < 1 ? 2 : 0)}
                    {unit}
                  </label>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={num}
                    onChange={(e) => onChange({ [key]: Number(e.target.value) })}
                  />
                </div>
              );
            }
            if (ctl[2] === "k") {
              return (
                <div key={key} className="flex items-center justify-between gap-2">
                  <label className="text-xs font-medium text-zinc-500">{label}</label>
                  <input
                    type="color"
                    value={typeof val === "string" ? val : "#000000"}
                    onChange={(e) => onChange({ [key]: e.target.value })}
                    className="h-8 w-10 cursor-pointer rounded border border-black/15 dark:border-white/20"
                  />
                </div>
              );
            }
            if (ctl[2] === "n") {
              return (
                <div key={key} className="flex items-center justify-between gap-2">
                  <label className="text-xs font-medium text-zinc-500">{label}</label>
                  <input
                    type="number"
                    step={1}
                    value={typeof val === "number" ? val : Number(val) || 0}
                    onChange={(e) => onChange({ [key]: parseInt(e.target.value, 10) || 0 })}
                    className="w-24 rounded border border-black/15 px-2 py-1 text-sm dark:border-white/20 dark:bg-zinc-800"
                  />
                </div>
              );
            }
            if (ctl[2] === "c") {
              return (
                <label
                  key={key}
                  className="flex items-center justify-between gap-2 text-xs font-medium text-zinc-500"
                >
                  {label}
                  <input
                    type="checkbox"
                    checked={!!val}
                    onChange={(e) => onChange({ [key]: e.target.checked ? 1 : 0 })}
                  />
                </label>
              );
            }
            // "s" | "o"
            const options =
              ctl[2] === "s"
                ? ctl[3].map((o) => [o, o] as const)
                : ctl[3];
            return (
              <div key={key} className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-zinc-500">{label}</label>
                <select
                  value={String(val)}
                  onChange={(e) => onChange({ [key]: coerce(e.target.value) })}
                  className="rounded border border-black/15 px-2 py-1 text-sm dark:border-white/20 dark:bg-zinc-800"
                >
                  {options.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
