import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EditorClient from "@/components/EditorClient";
import type { EditsMap } from "@/lib/svg/types";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: doc, error } = await supabase
    .from("documents")
    .select("id,name,storage_path,edits,updated_at")
    .eq("id", id)
    .single();

  if (error || !doc) notFound();

  // 基底SVGをStorageからダウンロード（RLSにより所有者のみ取得可）
  const { data: blob, error: dlError } = await supabase.storage
    .from("svgs")
    .download(doc.storage_path);
  if (dlError || !blob) notFound();

  const baseSvg = await blob.text();

  return (
    <EditorClient
      docId={doc.id}
      name={doc.name}
      baseSvg={baseSvg}
      initialEdits={(doc.edits as EditsMap) ?? {}}
      updatedAt={doc.updated_at}
    />
  );
}
