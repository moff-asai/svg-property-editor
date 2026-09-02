import { ANIMATION_KEYFRAMES } from "./animations";

// 編集済みの生きたSVG DOMを、単体で使える文字列へ直列化してエクスポートする。
// - 編集用データ属性（data-eid, data-base-*）を除去
// - アニメーション用 keyframes を <style> として埋め込み
export function serializeSvg(svgRoot: SVGSVGElement): string {
  const clone = svgRoot.cloneNode(true) as SVGSVGElement;

  // 移動/アニメーションで viewBox 範囲外へ出た要素もクリップされないようにする
  // （UA既定 svg:not(:root){overflow:hidden} をインラインstyleで上書き）
  clone.style.overflow = "visible";

  // エディタが注入した選択/カーソル用スタイルを除去（エクスポートに残さない）
  clone.querySelector("#svged-style")?.remove();

  // 編集用データ属性を除去
  clone.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name === "data-eid" || attr.name.startsWith("data-base-")) {
        el.removeAttribute(attr.name);
      }
    }
  });

  // keyframes を埋め込み（インラインの style.animation が単体でも効くように）
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = ANIMATION_KEYFRAMES;
  clone.insertBefore(style, clone.firstChild);

  return new XMLSerializer().serializeToString(clone);
}

// ダウンロードをトリガ
export function downloadSvg(filename: string, svgText: string) {
  const blob = new Blob([svgText], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".svg") ? filename : `${filename}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}
