"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    // local スコープでローカルセッション(クッキー)を確実に破棄。
    // 認証サーバ到達性に依存せず、失敗しても遷移する。
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // 到達不能でも遷移する
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <button onClick={signOut} className="home-btn home-btn-ghost">
      ログアウト
    </button>
  );
}
