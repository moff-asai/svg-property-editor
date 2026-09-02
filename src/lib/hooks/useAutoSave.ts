import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EditsMap } from "@/lib/svg/types";

export type SaveState = "idle" | "saving" | "saved" | "error";

// edits の変更を debounce してサーバへ保存し、localStorage にも即時ミラーする。
export function useAutoSave(
  docId: string,
  edits: EditsMap,
  opts?: { delay?: number },
): SaveState {
  const delay = opts?.delay ?? 800;
  const [state, setState] = useState<SaveState>("idle");
  const firstRun = useRef(true);
  const lastSaved = useRef<string>("");

  useEffect(() => {
    // localStorage への即時ミラー（下書き復元用）
    try {
      localStorage.setItem(
        `svged:draft:${docId}`,
        JSON.stringify({ edits, ts: Date.now() }),
      );
    } catch {
      // 保存不能でも致命的でない
    }

    // マウント直後の初期 edits は保存対象外
    if (firstRun.current) {
      firstRun.current = false;
      lastSaved.current = JSON.stringify(edits);
      return;
    }

    const serialized = JSON.stringify(edits);
    if (serialized === lastSaved.current) return;

    setState("saving");
    const handle = setTimeout(async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from("documents")
        .update({ edits })
        .eq("id", docId);
      if (error) {
        setState("error");
      } else {
        lastSaved.current = serialized;
        setState("saved");
      }
    }, delay);

    return () => clearTimeout(handle);
  }, [docId, edits, delay]);

  return state;
}
