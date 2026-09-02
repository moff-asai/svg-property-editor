"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import "../home.css";

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
    <div className="auth">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="home-brand-mark">
            <i />
            <i />
            <i />
          </span>
          SVG PROPERTY EDITOR
        </div>
        <p className="auth-sub">ログインまたは新規登録してください</p>

        <form
          className="auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            handle("signin");
          }}
        >
          <label className="auth-field">
            メールアドレス
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
              placeholder="you@example.com"
            />
          </label>
          <label className="auth-field">
            パスワード
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input"
              placeholder="6文字以上"
            />
          </label>

          {error && <p className="auth-error">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="home-btn home-btn-primary auth-submit"
          >
            {loading ? "処理中..." : "ログイン"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handle("signup")}
            className="home-btn auth-alt"
          >
            新規登録
          </button>
        </form>
      </div>
    </div>
  );
}
