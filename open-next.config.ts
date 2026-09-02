import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// MVPはISR/インクリメンタルキャッシュを使わないため、キャッシュ上書きなし。
// 将来ISRが必要になれば r2IncrementalCache 等をここで指定する。
export default defineCloudflareConfig();
