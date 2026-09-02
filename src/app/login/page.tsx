"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // オープンリダイレクト対策: 同一オリジンの相対パスのみ許可
  const rawRedirect = searchParams.get("redirect") || "/";
  const redirectTo =
    rawRedirect.startsWith("/") &&
    !rawRedirect.startsWith("//") &&
    !rawRedirect.startsWith("/\\")
      ? rawRedirect
      : "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  async function handle(mode: "signin" | "signup") {
    setError(null);
    setLoading(true);
    try {
      const fn =
        mode === "signin"
          ? supabase.auth.signInWithPassword({ email, password })
          : supabase.auth.signUp({ email, password });
      const { error } = await fn;
      if (error) {
        setError(error.message);
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/15 dark:bg-zinc-900">
        <h1 className="mb-1 text-xl font-semibold">SVG Property Editor</h1>
        <p className="mb-6 text-sm text-zinc-500">
          ログインまたは新規登録してください
        </p>

        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            handle("signin");
          }}
        >
          <label className="flex flex-col gap-1 text-sm">
            メールアドレス
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/20 dark:bg-zinc-800"
              placeholder="you@example.com"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            パスワード
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/20 dark:bg-zinc-800"
              placeholder="6文字以上"
            />
          </label>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "処理中..." : "ログイン"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handle("signup")}
            className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium hover:bg-black/[.03] disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/[.06]"
          >
            新規登録
          </button>
        </form>
      </div>
    </div>
  );
}
