import { notFound } from "next/navigation";
import { getContentMeta } from "@/lib/identity/contents";
import { createClient } from "@/lib/supabase/server";
import CanvasGenerator, { type GenInitial } from "@/components/generate/CanvasGenerator";
import type { Params } from "@/lib/identity/types";

export default async function GenerateContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ content: string }>;
  searchParams: Promise<{ id?: string }>;
}) {
  const { content } = await params;
  const { id } = await searchParams;
  const meta = getContentMeta(content);
  if (!meta) notFound();

  // 保存済み設定の読み込み（?id=）。slug 不一致は無視。
  let initial: GenInitial | undefined;
  if (id) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("generators")
      .select("id,name,params,slug")
      .eq("id", id)
      .single();
    if (data && data.slug === meta.slug) {
      initial = {
        id: data.id,
        name: data.name,
        params: data.params as unknown as Params,
      };
    }
  }
  return <CanvasGenerator slug={meta.slug} initial={initial} />;
}
