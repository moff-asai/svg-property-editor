import type { MultiModeContent } from "./types";
import { HEX_LIQUID } from "./hexLiquid";
import { STRUCTURE_02 } from "./structure02";

// モード切替を持つ canvas コンテンツの登録。slug → MultiModeContent。
export const MULTI_CONTENTS: Record<string, MultiModeContent> = {
  [STRUCTURE_02.slug]: STRUCTURE_02,
  [HEX_LIQUID.slug]: HEX_LIQUID,
};
