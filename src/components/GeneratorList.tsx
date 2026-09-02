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
    <section className="home-section">
      <div className="home-section-head">
        <div>
          <div className="home-eyebrow">SAVED</div>
          <h2>保存した生成物</h2>
        </div>
        <span className="home-count">{list.length} ITEMS</span>
      </div>
      <ul className="home-grid">
        {list.map((g) => (
          <li key={g.id} className="home-card">
            <Link
              href={`/generate/${g.slug}?id=${g.id}`}
              className="home-card-title"
            >
              {g.name}
            </Link>
            <div className="home-card-tag">{g.slug}</div>
            <div className="home-card-foot">
              <span suppressHydrationWarning>
                {new Date(g.updated_at).toLocaleString()}
              </span>
              <button
                onClick={() => del(g)}
                disabled={deleting === g.id}
                className="home-del"
              >
                {deleting === g.id ? "削除中..." : "削除"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
