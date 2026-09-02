import type { SaveState } from "@/lib/hooks/useAutoSave";

const LABEL: Record<SaveState, string> = {
  idle: "編集を開始できます",
  saving: "保存中…",
  saved: "保存済み",
  error: "保存に失敗しました",
};

const COLOR: Record<SaveState, string> = {
  idle: "text-zinc-400",
  saving: "text-amber-500",
  saved: "text-green-600",
  error: "text-red-600",
};

export default function SaveStatus({ state }: { state: SaveState }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm ${COLOR[state]}`}>
      <span
        className="inline-block h-2 w-2 rounded-full bg-current"
        aria-hidden
      />
      {LABEL[state]}
    </span>
  );
}
