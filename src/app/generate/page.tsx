import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import { GENERATE_CONTENTS } from "@/lib/identity/contents";

export default function GeneratePickerPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-black/10 px-6 py-4 dark:border-white/15">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="rounded-md border border-black/15 px-2.5 py-1.5 text-sm hover:bg-black/[.03] dark:border-white/20 dark:hover:bg-white/[.06]"
          >
            ← 一覧
          </Link>
          <h1 className="text-lg font-semibold">アイデンティティを生成</h1>
        </div>
        <SignOutButton />
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <p className="mb-6 text-sm text-zinc-500">
          生成したいコンテンツを選んでください。
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GENERATE_CONTENTS.map((c) => (
            <Link
              key={c.slug}
              href={`/generate/${c.slug}`}
              className="group flex flex-col rounded-xl border border-black/10 bg-white p-5 transition-colors hover:border-blue-500 dark:border-white/15 dark:bg-zinc-900"
            >
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs text-zinc-400">{c.no}</span>
                <span className="text-base font-semibold">{c.title}</span>
              </div>
              <p className="mt-2 text-sm text-zinc-500">{c.blurb}</p>
              <span className="mt-4 text-xs font-medium text-blue-600 group-hover:underline">
                SVG／MP4／PNG で生成 →
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
