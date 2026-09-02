"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { MULTI_CONTENTS } from "@/lib/identity/registry";
import type { CanvasRenderer, Params } from "@/lib/identity/types";
import ControlsPanel from "./ControlsPanel";
import {
  exportCanvasMp4,
  exportCanvasPng,
  exportCanvasSvg,
} from "@/lib/identity/exportCanvasVideo";
import { saveGenerator } from "@/lib/identity/persist";
import { downloadSvg } from "@/lib/svg/serialize";
import "./orbitype.css";

export interface GenInitial {
  id: string;
  name: string;
  params: Params; // 保存された params（mode を含む）
}

const EXPORT_W = 1280;
const EXPORT_H = 720;

// スライダー進捗（--fill）。
function fill(num: number, min: number, max: number): CSSProperties {
  const pct = max > min ? ((num - min) / (max - min)) * 100 : 0;
  return { "--fill": `${Math.max(0, Math.min(100, pct))}%` } as CSSProperties;
}

export default function CanvasGenerator({
  slug,
  initial,
}: {
  slug: string;
  initial?: GenInitial;
}) {
  const content = MULTI_CONTENTS[slug];
  if (!content) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-sm text-zinc-500">このコンテンツは準備中です。</p>
        <Link
          href="/generate"
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm hover:bg-black/[.03] dark:border-white/20 dark:hover:bg-white/[.06]"
        >
          ← テンプレ一覧へ
        </Link>
      </div>
    );
  }
  return <CanvasGeneratorInner slug={slug} initial={initial} />;
}

function CanvasGeneratorInner({ slug, initial }: { slug: string; initial?: GenInitial }) {
  const content = MULTI_CONTENTS[slug];

  const initialMode =
    typeof initial?.params?.mode === "string"
      ? (initial.params.mode as string)
      : content.modes[0].value;

  const [mode, setMode] = useState(initialMode);
  const active = content.modes.find((m) => m.value === mode) ?? content.modes[0];

  const [params, setParams] = useState<Params>(() => {
    const base = content.modes.find((m) => m.value === initialMode) ?? content.modes[0];
    const init: Params = initial?.params ? { ...initial.params } : {};
    delete (init as Record<string, unknown>).mode;
    return { ...base.defaults, ...init };
  });
  const [name, setName] = useState(initial?.name ?? content.title);
  const [genId, setGenId] = useState<string | null>(initial?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [loopSeconds, setLoopSeconds] = useState(6);
  const [fps, setFps] = useState(30);
  const [bitrateMbps, setBitrateMbps] = useState(16);
  const [mp4Pct, setMp4Pct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  if (rendererRef.current == null) {
    rendererRef.current = active.create();
  }

  const paramsRef = useRef(params);
  const playingRef = useRef(playing);
  const loopRef = useRef(loopSeconds);
  const phaseRef = useRef(0);
  const exportingRef = useRef(false);
  useEffect(() => {
    paramsRef.current = params;
    playingRef.current = playing;
    loopRef.current = loopSeconds;
  }, [params, playing, loopSeconds]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      raf = requestAnimationFrame(tick);
      if (exportingRef.current) return;
      if (playingRef.current) {
        phaseRef.current = (phaseRef.current + dt / loopRef.current) % 1;
      }
      const r = rendererRef.current;
      if (r) r.render(ctx, canvas.width, canvas.height, phaseRef.current, paramsRef.current);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  function switchMode(v: string) {
    const m = content.modes.find((x) => x.value === v);
    if (!m) return;
    setMode(v);
    setParams({ ...m.defaults });
    rendererRef.current = m.create();
    phaseRef.current = 0;
    setSaved(false);
  }

  function applyPatch(patch: Params) {
    setParams((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const id = await saveGenerator({
        id: genId,
        slug,
        name: name.trim() || content.title,
        params: { mode, ...params },
      });
      setGenId(id);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleMp4() {
    if (mp4Pct !== null) return;
    setMp4Pct(0);
    setError(null);
    exportingRef.current = true;
    try {
      const r = active.create();
      await exportCanvasMp4({
        paint: (ctx, W, H, phase) => r.render(ctx, W, H, phase, paramsRef.current),
        width: EXPORT_W,
        height: EXPORT_H,
        fps,
        loopSeconds,
        bitrateMbps,
        name: `identity_${content.no}_${mode}`,
        onProgress: (d, t) => setMp4Pct(Math.round((d / t) * 100)),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "MP4の書き出しに失敗しました");
    } finally {
      setMp4Pct(null);
      exportingRef.current = false;
    }
  }

  async function handlePng() {
    setError(null);
    try {
      const r = active.create();
      await exportCanvasPng(
        (ctx, W, H, phase) => r.render(ctx, W, H, phase, paramsRef.current),
        phaseRef.current,
        `identity_${content.no}_${mode}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "PNGの書き出しに失敗しました");
    }
  }

  function handleSvg() {
    setError(null);
    try {
      const r = active.create();
      if (r.toSvg) {
        // ベクターSVG（イラレ編集可: XYZ=図形、HEX/LIQUID=各ドットを図形化）
        downloadSvg(
          name.trim() || content.title,
          r.toSvg({ phase: phaseRef.current, loopSeconds, params: paramsRef.current }),
        );
        return;
      }
      // 非対応レンダラ: 現在フレームを高解像度で埋め込んだ SVG（ピクセル等価）
      exportCanvasSvg(
        (ctx, W, H, phase) => r.render(ctx, W, H, phase, paramsRef.current),
        phaseRef.current,
        `identity_${content.no}_${mode}`,
        EXPORT_W * 2,
        EXPORT_H * 2,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "SVGの書き出しに失敗しました");
    }
  }

  return (
    <div className="gen">
      {/* ---------- topbar ---------- */}
      <div className="gen-topbar">
        <Link href="/generate" className="gen-brand" title="テンプレ一覧へ戻る">
          <span className="gen-brand-mark">
            <i />
            <i />
            <i />
          </span>
          TEMPLATE
        </Link>

        <div className="gen-project-meta">
          <span className="gen-title">
            {content.no} · {content.title}
          </span>
          <span className={`gen-status${playing ? "" : " is-off"}`}>
            <i />
            {playing ? "LIVE" : "PAUSED"} · {active.label}
          </span>
        </div>

        <div className="gen-actions">
          <input
            className="gen-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            placeholder="名前"
          />
          <button className="gen-tbtn" onClick={handleSave} disabled={saving}>
            {saving ? "…" : saved ? "SAVED" : "SAVE"}
          </button>
          <button
            className={`gen-tbtn${playing ? " is-active" : ""}`}
            onClick={() => setPlaying((v) => !v)}
          >
            {playing ? "停止" : "再生"}
          </button>
          <button className="gen-tbtn" onClick={handleSvg}>
            SVG
          </button>
          <button className="gen-tbtn" onClick={handlePng}>
            PNG
          </button>
          <button className="gen-export" onClick={handleMp4} disabled={mp4Pct !== null}>
            <span>{mp4Pct !== null ? `書き出し中 ${mp4Pct}%` : "MP4を書き出し"}</span>
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" />
            </svg>
          </button>
        </div>
      </div>

      {/* ---------- workspace ---------- */}
      <div className="gen-workspace">
        {/* stage: 画面内固定（スクロールしない） */}
        <div className="gen-stage-wrap">
          <div className="gen-stage-toolbar">
            <span>
              {content.no} / {active.label}
            </span>
            <span>
              {EXPORT_W}×{EXPORT_H}
            </span>
          </div>
          <div className="gen-stage">
            <canvas
              ref={canvasRef}
              width={EXPORT_W}
              height={EXPORT_H}
              className="gen-canvas"
              style={{ aspectRatio: "16 / 9" }}
            />
          </div>
          <div className="gen-stage-footer">
            <span>{playing ? "PLAYING" : "PAUSED"}</span>
            {error ? (
              <span className="gen-err">{error}</span>
            ) : (
              <span>
                LOOP {loopSeconds}s · {fps}FPS
              </span>
            )}
            <span>16 : 9</span>
          </div>
        </div>

        {/* inspector: プロパティ変更部（唯一のスクロール領域） */}
        <aside className="gen-inspector">
          <div className="gen-inspector-head">
            <div>
              <div className="gen-eyebrow">IDENTITY / {content.no}</div>
              <h1>{active.label}</h1>
            </div>
          </div>

          {content.modes.length > 1 && (
            <div className="gen-section">
              <div className="gen-section-title">
                <h2>モード / MODE</h2>
              </div>
              <div className="gen-mode-switch">
                {content.modes.map((m) => (
                  <button
                    key={m.value}
                    className={m.value === mode ? "is-active" : ""}
                    onClick={() => switchMode(m.value)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="gen-section">
            <div className="gen-section-title">
              <h2>出力 / OUTPUT</h2>
            </div>
            <div className="gen-row">
              <span>ループ長</span>
              <output>{loopSeconds}s</output>
              <input
                type="range"
                min={2}
                max={20}
                step={1}
                value={loopSeconds}
                style={fill(loopSeconds, 2, 20)}
                onChange={(e) => setLoopSeconds(Number(e.target.value))}
              />
            </div>
            <div className="gen-field">
              <span>FPS</span>
              <select
                className="gen-select"
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
              >
                <option value={24}>24</option>
                <option value={30}>30</option>
                <option value={60}>60</option>
              </select>
            </div>
            <div className="gen-row">
              <span>ビットレート</span>
              <output>{bitrateMbps} Mbps</output>
              <input
                type="range"
                min={4}
                max={40}
                step={1}
                value={bitrateMbps}
                style={fill(bitrateMbps, 4, 40)}
                onChange={(e) => setBitrateMbps(Number(e.target.value))}
              />
            </div>
          </div>

          <ControlsPanel spec={active.controls} params={params} onChange={applyPatch} />

          <div className="gen-section">
            <div className="gen-section-title">
              <h2>プリセット / PRESETS</h2>
              <span>{active.presets.length}</span>
            </div>
            <div className="gen-preset-grid">
              {active.presets.map((preset, i) => (
                <button
                  key={i}
                  className="gen-preset"
                  onClick={() => applyPatch({ ...preset })}
                >
                  {"0" + (i + 1)}
                </button>
              ))}
            </div>
          </div>

          <p className="gen-note">
            SVG は XYZ / HEX HALO / LIQUID GLASS は編集可能なベクター（各図形）、3Dモード（DATA
            CUBE / GRID CUBE）は現在フレームを埋め込んだ静止画で書き出します。
          </p>
        </aside>
      </div>
    </div>
  );
}
