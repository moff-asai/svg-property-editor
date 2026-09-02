"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import SvgCanvas from "./SvgCanvas";
import PropertyPanel from "./PropertyPanel";
import SaveStatus from "./SaveStatus";
import { useAutoSave } from "@/lib/hooks/useAutoSave";
import { serializeSvg, downloadSvg } from "@/lib/svg/serialize";
import { exportMp4 } from "@/lib/svg/exportVideo";
import type { EditsMap, ElementEdit } from "@/lib/svg/types";

export default function EditorClient({
  docId,
  name,
  baseSvg,
  initialEdits,
  updatedAt,
}: {
  docId: string;
  name: string;
  baseSvg: string;
  initialEdits: EditsMap;
  updatedAt: string;
}) {
  const [edits, setEdits] = useState<EditsMap>(initialEdits);
  const [selectedEid, setSelectedEid] = useState<string | null>(null);
  const [restore, setRestore] = useState<EditsMap | null>(null);
  const [mp4Pct, setMp4Pct] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const saveState = useAutoSave(docId, edits);

  // マウント時: サーバより新しいローカル下書きがあれば復元を提案
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`svged:draft:${docId}`);
      if (!raw) return;
      const draft = JSON.parse(raw) as { edits: EditsMap; ts: number };
      const serverTs = Date.parse(updatedAt);
      if (
        draft.ts > serverTs &&
        JSON.stringify(draft.edits) !== JSON.stringify(initialEdits)
      ) {
        // マウント時に外部(localStorage)を読んで復元候補を提示する正当な用途
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRestore(draft.edits);
      }
    } catch {
      // 破損時は無視
    }
  }, [docId, updatedAt, initialEdits]);

  const updateEdit = useCallback(
    (patch: Partial<ElementEdit>) => {
      if (!selectedEid) return;
      setEdits((prev) => ({
        ...prev,
        [selectedEid]: { ...(prev[selectedEid] ?? {}), ...patch },
      }));
    },
    [selectedEid],
  );

  const resetSelected = useCallback(() => {
    if (!selectedEid) return;
    setEdits((prev) => {
      const next = { ...prev };
      delete next[selectedEid];
      return next;
    });
  }, [selectedEid]);

  const currentEdit: ElementEdit = selectedEid
    ? (edits[selectedEid] ?? {})
    : {};

  function handleExport() {
    const svg = containerRef.current?.querySelector(
      "svg",
    ) as SVGSVGElement | null;
    if (!svg) return;
    downloadSvg(name, serializeSvg(svg));
  }

  async function handleExportMp4() {
    if (mp4Pct !== null) return; // 実行中は多重起動を防ぐ
    setMp4Pct(0);
    try {
      await exportMp4({
        baseSvg,
        edits,
        name,
        onProgress: (done, total) =>
          setMp4Pct(Math.round((done / total) * 100)),
      });
    } catch (e) {
      alert(
        `MP4の書き出しに失敗しました:\n${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setMp4Pct(null);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-black/10 px-4 py-3 dark:border-white/15">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            className="shrink-0 rounded-md border border-black/15 px-2.5 py-1.5 text-sm hover:bg-black/[.03] dark:border-white/20 dark:hover:bg-white/[.06]"
          >
            ← 一覧
          </Link>
          <span className="truncate text-sm font-medium">{name}</span>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <SaveStatus state={saveState} />
          <button
            onClick={handleExport}
            className="rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-black/[.03] dark:border-white/20 dark:hover:bg-white/[.06]"
          >
            SVGを書き出し
          </button>
          <button
            onClick={handleExportMp4}
            disabled={mp4Pct !== null}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {mp4Pct !== null ? `MP4書き出し中 ${mp4Pct}%` : "MP4を書き出し"}
          </button>
        </div>
      </header>

      {restore && (
        <div className="flex items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <span>保存されていないローカル下書きがあります。復元しますか？</span>
          <span className="flex gap-2">
            <button
              onClick={() => {
                setEdits(restore);
                setRestore(null);
              }}
              className="rounded bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700"
            >
              復元
            </button>
            <button
              onClick={() => setRestore(null)}
              className="rounded border border-amber-400 px-2.5 py-1 text-xs hover:bg-amber-100 dark:border-amber-800 dark:hover:bg-amber-900/40"
            >
              破棄
            </button>
          </span>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <SvgCanvas
            baseSvg={baseSvg}
            edits={edits}
            selectedEid={selectedEid}
            onSelect={setSelectedEid}
            containerRef={containerRef}
          />
        </div>
        <aside className="w-80 shrink-0 overflow-y-auto border-l border-black/10 dark:border-white/15">
          <PropertyPanel
            selectedEid={selectedEid}
            edit={currentEdit}
            onChange={updateEdit}
            onReset={resetSelected}
          />
        </aside>
      </div>
    </div>
  );
}
