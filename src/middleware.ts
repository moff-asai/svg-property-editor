import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16 では慣習上 proxy.ts（Node ランタイム既定）だが、あえて旧規約の
// middleware.ts（Edge ランタイム）を維持する。@opennextjs/cloudflare 1.20.2 は
// Node.js proxy/middleware を未サポートで、proxy.ts に移行すると
// `next build` の deprecation 警告は消えるものの OpenNext ビルドが
// "Node.js middleware is not currently supported" で失敗するため。
// OpenNext が Node proxy をサポートしたら proxy.ts へ移行する。
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // 静的アセットと画像最適化を除く全ルートで実行
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
