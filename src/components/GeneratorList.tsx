"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteGenerator } from "@/lib/identity/persist";

export interface GeneratorSummary {
  id: string;
  slug: string;
  name: string;
  updated_at: string;
}

export default function GeneratorList({ items }: { items: GeneratorSummary[] }) {
  const router = useRouter();
  const [list, setList] = useState<GeneratorSummary[]>(items);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function del(g: GeneratorSummary) {
    if (!confirm(`「${g.name}」を削除しますか？`)) return;
    setDeleting(g.id);
    await deleteGenerator(g.id);
    setList((prev) => prev.filter((x) => x.id !== g.id));
    setDeleting(null);
    router.refresh();
  }

  if (list.length === 0) return null;

  return (
    <div className="mt-10">
      <h2 className="text-base font-medium">保存した生成物</h2>
      <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((g) => (
          <li
            key={g.id}
            className="flex flex-col justify-between rounded-lg border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-zinc-900"
          >
            <Link
              href={`/generate/${g.slug}?id=${g.id}`}
              className="truncate text-base font-medium text-blue-600 hover:underline"
            >
              {g.name}
            </Link>
            <div className="mt-1 text-xs text-zinc-400">{g.slug}</div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-zinc-500" suppressHydrationWarning>
                {new Date(g.updated_at).toLocaleString()}
              </span>
              <button
                onClick={() => del(g)}
                disabled={deleting === g.id}
                className="text-xs text-red-600 hover:underline disabled:opacity-60"
              >
                {deleting === g.id ? "削除中..." : "削除"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
