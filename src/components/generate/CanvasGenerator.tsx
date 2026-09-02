"use client";

import { useEffect, useRef, useState } from "react";
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

export interface GenInitial {
  id: string;
  name: string;
  params: Params; // 保存された params（mode を含む）
}

const EXPORT_W = 1280;
const EXPORT_H = 720;

const btn =
  "rounded border border-black/15 px-2 py-1 text-xs hover:bg-black/[.04] dark:border-white/20 dark:hover:bg-white/[.06]";

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
          ← 生成一覧へ
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
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-black/10 px-4 py-3 dark:border-white/15">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/generate"
            className="shrink-0 rounded-md border border-black/15 px-2.5 py-1.5 text-sm hover:bg-black/[.03] dark:border-white/20 dark:hover:bg-white/[.06]"
          >
            ← 生成
          </Link>
          <span className="truncate text-sm font-medium">
            {content.no} {content.title}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {error && <span className="max-w-xs truncate text-sm text-red-600">{error}</span>}
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            placeholder="名前"
            className="w-28 rounded border border-black/15 px-2 py-1 text-sm dark:border-white/20 dark:bg-zinc-800"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-black/[.03] disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/[.06]"
          >
            {saving ? "保存中..." : saved ? "保存済み" : "保存"}
          </button>
          <button className={btn} onClick={() => setPlaying((v) => !v)}>
            {playing ? "停止" : "再生"}
          </button>
          <button
            onClick={handleSvg}
            className="rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-black/[.03] dark:border-white/20 dark:hover:bg-white/[.06]"
          >
            SVG
          </button>
          <button
            onClick={handlePng}
            className="rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-black/[.03] dark:border-white/20 dark:hover:bg-white/[.06]"
          >
            PNG
          </button>
          <button
            onClick={handleMp4}
            disabled={mp4Pct !== null}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {mp4Pct !== null ? `MP4書き出し中 ${mp4Pct}%` : "MP4を書き出し"}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 items-center justify-center overflow-auto bg-zinc-100 p-6 dark:bg-zinc-950">
          <canvas
            ref={canvasRef}
            width={EXPORT_W}
            height={EXPORT_H}
            className="max-h-full max-w-full"
            style={{ aspectRatio: "16 / 9", width: "100%", height: "auto" }}
          />
        </div>

        <aside className="flex w-80 shrink-0 flex-col gap-5 overflow-y-auto border-l border-black/10 p-4 dark:border-white/15">
          {content.modes.length > 1 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                モード / MODE
              </label>
              <select
                value={mode}
                onChange={(e) => switchMode(e.target.value)}
                className="rounded border border-black/15 px-2 py-1 text-sm dark:border-white/20 dark:bg-zinc-800"
              >
                {content.modes.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              出力 / OUTPUT
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">
                ループ長: {loopSeconds}s
              </label>
              <input
                type="range"
                min={2}
                max={20}
                step={1}
                value={loopSeconds}
                onChange={(e) => setLoopSeconds(Number(e.target.value))}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-zinc-500">FPS</label>
              <select
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                className="rounded border border-black/15 px-2 py-1 text-sm dark:border-white/20 dark:bg-zinc-800"
              >
                <option value={24}>24</option>
                <option value={30}>30</option>
                <option value={60}>60</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">
                ビットレート: {bitrateMbps} Mbps
              </label>
              <input
                type="range"
                min={4}
                max={40}
                step={1}
                value={bitrateMbps}
                onChange={(e) => setBitrateMbps(Number(e.target.value))}
              />
            </div>
          </div>

          <ControlsPanel spec={active.controls} params={params} onChange={applyPatch} />

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">プリセット</label>
            <div className="flex flex-wrap gap-2">
              {active.presets.map((preset, i) => (
                <button key={i} className={btn} onClick={() => applyPatch({ ...preset })}>
                  {"0" + (i + 1)}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-zinc-400">
            SVG は XYZ / HEX HALO / LIQUID GLASS は編集可能なベクター（各図形）、3Dモード（DATA
            CUBE / GRID CUBE）は現在フレームを埋め込んだ静止画で書き出します。
          </p>
        </aside>
      </div>
    </div>
  );
}
