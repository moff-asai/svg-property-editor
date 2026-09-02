import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// メールリンク / OAuth のコード交換用コールバック
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // オープンリダイレクト対策: 同一オリジンの相対パスのみ許可
  const nextRaw = searchParams.get("next") ?? "/";
  const next =
    nextRaw.startsWith("/") &&
    !nextRaw.startsWith("//") &&
    !nextRaw.startsWith("/\\")
      ? nextRaw
      : "/";

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
