"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createDocumentFromSvg } from "@/lib/svg/createDocument";

export default function UploadButton() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const raw = await file.text();
      // インポート時の正規化（サニタイズ＋data-eid採番）＝「動的プロパティの自動付与」
      const docId = await createDocumentFromSvg(
        raw,
        file.name.replace(/\.svg$/i, ""),
      );
      router.push(`/editor/${docId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "アップロードに失敗しました");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-3">
      {error && <span className="text-sm text-red-600">{error}</span>}
      <input
        ref={inputRef}
        type="file"
        accept="image/svg+xml,.svg"
        hidden
        onChange={onFile}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {busy ? "アップロード中..." : "SVGをアップロード"}
      </button>
    </div>
  );
}
