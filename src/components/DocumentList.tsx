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
      <p className="mt-10 text-sm text-zinc-500">
        まだSVGがありません。右上の「SVGをアップロード」から追加してください。
      </p>
    );
  }

  return (
    <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((doc) => (
        <li
          key={doc.id}
          className="flex flex-col justify-between rounded-lg border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-zinc-900"
        >
          <Link
            href={`/editor/${doc.id}`}
            className="truncate text-base font-medium text-blue-600 hover:underline"
          >
            {doc.name}
          </Link>
          <div className="mt-3 flex items-center justify-between">
            <span
              className="text-xs text-zinc-500"
              suppressHydrationWarning
            >
              {new Date(doc.updated_at).toLocaleString()}
            </span>
            <button
              onClick={() => del(doc)}
              disabled={deleting === doc.id}
              className="text-xs text-red-600 hover:underline disabled:opacity-60"
            >
              {deleting === doc.id ? "削除中..." : "削除"}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
