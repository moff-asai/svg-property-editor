"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export interface DocSummary {
  id: string;
  name: string;
  storage_path: string;
  updated_at: string;
}

export default function DocumentList({ docs }: { docs: DocSummary[] }) {
  const router = useRouter();
  const [items, setItems] = useState<DocSummary[]>(docs);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function del(doc: DocSummary) {
    if (!confirm(`「${doc.name}」を削除しますか？`)) return;
    setDeleting(doc.id);
    const supabase = createClient();
    await supabase.storage.from("svgs").remove([doc.storage_path]);
    await supabase.from("documents").delete().eq("id", doc.id);
    setItems((prev) => prev.filter((d) => d.id !== doc.id));
    setDeleting(null);
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <p className="home-empty">
        まだSVGがありません。右上の「SVGをアップロード」から追加してください。
      </p>
    );
  }

  return (
    <ul className="home-grid">
      {items.map((doc) => (
        <li key={doc.id} className="home-card">
          <Link href={`/editor/${doc.id}`} className="home-card-title">
            {doc.name}
          </Link>
          <div className="home-card-foot">
            <span suppressHydrationWarning>
              {new Date(doc.updated_at).toLocaleString()}
            </span>
            <button
              onClick={() => del(doc)}
              disabled={deleting === doc.id}
              className="home-del"
            >
              {deleting === doc.id ? "削除中..." : "削除"}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
