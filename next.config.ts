import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // Cloudflare Images 未設定のため最適化はオフ（SVGはインラインで扱う）
  images: { unoptimized: true },
};

export default nextConfig;

// `next dev` から Cloudflare バインディングへアクセスできるようにする。
// 本番/ビルド時は no-op。
initOpenNextCloudflareForDev();
