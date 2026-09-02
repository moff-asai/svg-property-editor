import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import UploadButton from "@/components/UploadButton";
import DocumentList from "@/components/DocumentList";
import GeneratorList from "@/components/GeneratorList";
import SignOutButton from "@/components/SignOutButton";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const email = claimsData?.claims.email as string | undefined;

  const { data: docs } = await supabase
    .from("documents")
    .select("id,name,storage_path,updated_at")
    .order("updated_at", { ascending: false });

  const { data: gens } = await supabase
    .from("generators")
    .select("id,slug,name,updated_at")
    .order("updated_at", { ascending: false });

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-black/10 px-6 py-4 dark:border-white/15">
        <h1 className="text-lg font-semibold">SVG Property Editor</h1>
        <div className="flex items-center gap-3">
          {email && (
            <span className="hidden text-sm text-zinc-500 sm:inline">
              {email}
            </span>
          )}
          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium">あなたのSVG</h2>
          <div className="flex items-center gap-3">
            <Link
              href="/generate"
              className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium hover:bg-black/[.03] dark:border-white/20 dark:hover:bg-white/[.06]"
            >
              生成
            </Link>
            <UploadButton />
          </div>
        </div>
        <DocumentList docs={docs ?? []} />
        <GeneratorList items={gens ?? []} />
      </main>
    </div>
  );
}
