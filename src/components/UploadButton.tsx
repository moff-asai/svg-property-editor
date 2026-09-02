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
    <div className="home-upload">
      {error && <span className="home-error">{error}</span>}
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
        className="home-btn home-btn-primary"
      >
        {busy ? "アップロード中..." : "SVGをアップロード"}
      </button>
    </div>
  );
}
