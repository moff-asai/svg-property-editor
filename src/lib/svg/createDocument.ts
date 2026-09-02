import { createClient } from "@/lib/supabase/client";
import { normalizeSvg } from "./normalize";

// 生のSVGをサニタイズ＋正規化(data-eid採番)し、Storageへアップロードして
// documents 行を作成する。アップロード起点(UploadButton)と生成起点(各Generator)で
// 共有する唯一の作成経路。ブラウザ専用（DOMParser/DOMPurify + browser Supabase）。
// 返り値は作成した docId（= /editor/{id} への遷移に使う）。
export async function createDocumentFromSvg(
  rawSvg: string,
  name: string,
): Promise<string> {
  const { svg } = normalizeSvg(rawSvg);

  const supabase = createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims.sub;
  if (!uid) throw new Error("未認証です");

  const docId = crypto.randomUUID();
  const path = `${uid}/${docId}.svg`;

  const up = await supabase.storage
    .from("svgs")
    .upload(path, new Blob([svg], { type: "image/svg+xml" }), {
      contentType: "image/svg+xml",
      upsert: true,
    });
  if (up.error) throw up.error;

  const ins = await supabase.from("documents").insert({
    id: docId,
    user_id: uid,
    name,
    storage_path: path,
  });
  if (ins.error) throw ins.error;

  return docId;
}
