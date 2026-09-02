// H.264 / WebCodecs 共通ヘルパ。SVG書き出し(exportVideo.ts)とcanvas書き出し
// (exportCanvasVideo.ts)の両方から再利用する。

export const MAX_DIMENSION = 1920; // H.264 Level 4.0 に収める上限

// 最大辺で縮小しつつ、H.264 が要求する偶数寸法に丸める
export function encodeDimensions(
  w: number,
  h: number,
  max = MAX_DIMENSION,
): { sw: number; sh: number } {
  let sw = w;
  let sh = h;
  const m = Math.max(w, h);
  if (m > max) {
    const s = max / m;
    sw = w * s;
    sh = h * s;
  }
  sw = Math.max(2, Math.round(sw / 2) * 2);
  sh = Math.max(2, Math.round(sh / 2) * 2);
  return { sw, sh };
}

// 対応する H.264 コーデック文字列を選ぶ（High(4.0)→Main(4.0)→Baseline の順）
export async function pickCodec(
  width: number,
  height: number,
  framerate: number,
): Promise<string | null> {
  const candidates = ["avc1.640028", "avc1.4D0028", "avc1.42E01E", "avc1.42001E"];
  for (const codec of candidates) {
    try {
      const { supported } = await VideoEncoder.isConfigSupported({
        codec,
        width,
        height,
        framerate,
      });
      if (supported) return codec;
    } catch {
      // 次の候補へ
    }
  }
  return null;
}
