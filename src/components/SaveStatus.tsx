import type { SaveState } from "@/lib/hooks/useAutoSave";

const LABEL: Record<SaveState, string> = {
  idle: "編集を開始できます",
  saving: "保存中…",
  saved: "保存済み",
  error: "保存に失敗しました",
};

export default function SaveStatus({ state }: { state: SaveState }) {
  return (
    <span className={`gen-save is-${state}`}>
      <i aria-hidden />
      {LABEL[state]}
    </span>
  );
}
