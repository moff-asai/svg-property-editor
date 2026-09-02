import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/types/database.types";
import type { Params } from "./types";

// canvas ジェネレータの設定(params)を Supabase に保存/更新する（ブラウザ・RLS）。
// 返り値は保存レコードの id。
export async function saveGenerator(opts: {
  id?: string | null;
  slug: string;
  name: string;
  params: Params;
}): Promise<string> {
  const supabase = createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims.sub;
  if (!uid) throw new Error("未認証です");

  const params = opts.params as unknown as Json;
  if (opts.id) {
    const { error } = await supabase
      .from("generators")
      .update({ name: opts.name, params, slug: opts.slug })
      .eq("id", opts.id);
    if (error) throw error;
    return opts.id;
  }
  const { data, error } = await supabase
    .from("generators")
    .insert({ user_id: uid, slug: opts.slug, name: opts.name, params })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function deleteGenerator(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("generators").delete().eq("id", id);
  if (error) throw error;
}
