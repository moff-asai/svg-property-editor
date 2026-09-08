// Original vector outlines from the supplied typo.svg (viewBox 0 0 314.89 121.13).
const TYPO_PATHS = [
  "M131.42,121.13v-41.58c0-1.71-1.38-3.09-3.09-3.09h-12.98v-10.3h43.84v10.3h-12.9c-1.71,0-3.09,1.38-3.09,3.09v41.58h-11.79Z",
  "M196.74,121.13l-9.92-18.09c-.54-.99-1.58-1.61-2.71-1.61h-3.65c-1.71,0-3.09,1.38-3.09,3.09v16.61h-11.7v-54.97h25.71c11.46,0,18.46,7.5,18.46,17.72s-6.1,14.92-12.03,16.32l12.36,20.93h-13.43ZM189.65,76.22h-9.19c-1.71,0-3.09,1.38-3.09,3.09v8.98c0,1.71,1.38,3.09,3.09,3.09h9.19c4.7,0,8.24-2.97,8.24-7.58s-3.54-7.58-8.24-7.58Z",
  "M218.67,121.13v-54.97h11.7v54.97h-11.7Z",
  "M277.1,121.13l-12.49-18.25c-.61-.9-1.93-.9-2.55,0l-12.57,18.25h-13.93l18.69-26.41c.75-1.06.76-2.49.01-3.56l-17.46-25h13.93l11.32,16.86c.61.92,1.96.91,2.57,0l11.16-16.86h14.09l-17.46,24.92c-.75,1.07-.75,2.49,0,3.56l18.69,26.49h-14.01Z",
  "M43.1,66.16l-11.91,30.59c-.51,1.31-2.37,1.31-2.88,0l-11.91-30.59H0v54.97h11.7v-34.1c0-1.14,1.57-1.44,1.99-.38l12.71,32.45h6.7l12.71-32.45c.42-1.06,1.99-.76,1.99.38v34.1h11.79v-54.97h-16.48Z",
  "M84.44,98.22h20.82v-10.05h-20.82c-1.71,0-3.09-1.38-3.09-3.09v-5.77c0-1.71,1.38-3.09,3.09-3.09h24.1v-10.05h-38.9v54.97h38.9v-10.13h-24.1c-1.71,0-3.09-1.38-3.09-3.09v-6.59c0-1.71,1.38-3.09,3.09-3.09Z",
  "M239.03,56.1V1.13h21.67c17.23,0,29.18,10.96,29.18,27.53s-11.95,27.44-29.18,27.44h-21.67ZM250.73,42.71c0,1.71,1.38,3.09,3.09,3.09h6.88c10.88,0,17.23-7.83,17.23-17.14s-5.93-17.22-17.23-17.22h-6.88c-1.71,0-3.09,1.38-3.09,3.09v28.19Z",
  "M43.1,1.13l-11.91,30.59c-.51,1.31-2.37,1.31-2.88,0L16.4,1.13H0v54.97h11.7V22c0-1.14,1.57-1.44,1.99-.38l12.71,32.45h6.7l12.71-32.45c.42-1.06,1.99-.76,1.99.38v34.1h11.78V1.13h-16.48Z",
  "M126.95,12.28c7.46,0,16.05,5.08,16.05,16.33s-8.6,16.33-16.05,16.33-16.05-5.07-16.05-16.33,8.6-16.33,16.05-16.33h0ZM126.95,0c-13.73,0-28.33,10.03-28.33,28.62s14.6,28.61,28.33,28.61,28.33-10.03,28.33-28.61S140.68,0,126.95,0h0Z",
  "M171.66,12.28c7.46,0,16.05,5.08,16.05,16.33s-8.6,16.33-16.05,16.33-16.05-5.07-16.05-16.33,8.6-16.33,16.05-16.33h0ZM171.66,0c-13.73,0-28.33,10.03-28.33,28.62s14.6,28.61,28.33,28.61,28.33-10.03,28.33-28.61S185.4,0,171.66,0h0Z",
  "M101.55,3.44c-4.93,8.03-9.15,16.11-9.12,25.18-.02,9.2,4.34,17.4,9.33,25.53.44.73.21,1.68-.52,2.12-.45.27-1,.28-1.45.08-2.64-1.22-4.82-2.83-6.96-4.68-14.2-12.49-14.18-33.61,0-46.09,2.13-1.84,4.32-3.46,6.95-4.68.77-.36,1.69-.02,2.05.75.31.64.08,1.28-.29,1.8h0Z",
  "M83.77,5.05c-10.39,17.19-10.35,29.94,0,47.13.68.86-.19,2.11-1.23,1.66-14.99-6.91-20.55-26.68-11.34-40.38,2.86-4.38,6.66-7.94,11.34-10.06,1.04-.44,1.91.78,1.23,1.66h0Z",
  "M198.81.89c16.42,8.03,23.09,28.99,12.51,44.37-3.21,4.74-7.35,8.59-12.51,11.08-.77.36-1.69.02-2.04-.75-.31-.63-.08-1.27.29-1.79,2.69-4.43,5.11-8.71,6.68-12.89,5.59-13.69.77-25.81-6.89-37.81-.8-1.26.63-2.86,1.96-2.2h0Z",
  "M216.06,3.39c9.51,4.39,15.87,14.64,15.87,25.22-.01,10.48-6.33,20.89-15.87,25.22-1.04.44-1.91-.79-1.23-1.66,10.36-17.2,10.38-29.95,0-47.13-.69-.86.19-2.11,1.23-1.66h0Z",
  "M304.41,118.98c-4.55,0-8.08-3.64-8.08-8.36s3.53-8.34,8.08-8.34,8.08,3.64,8.08,8.34-3.55,8.36-8.08,8.36ZM304.41,100.1c-5.78,0-10.41,4.72-10.41,10.5s4.64,10.53,10.41,10.53,10.47-4.72,10.47-10.53-4.69-10.5-10.47-10.5Z",
  "M304.61,110.06h-1.4v-3.16h1.4c1.14,0,1.79.6,1.79,1.59s-.66,1.57-1.79,1.57ZM308.91,108.47c0-2.02-1.69-3.64-3.9-3.64h-4.24v11.41h2.45v-4.1h.83l2.17,4.1h2.79l-2.42-4.41c1.4-.54,2.33-1.79,2.33-3.36Z"
];
const TYPO_WIDTH = 314.89;
const TYPO_HEIGHT = 121.13;
const TYPO_SUPERSAMPLE = 4;
export const XYZ_TYPO_COLOR_DEFAULT = "#ffffff";

export function xyzTypoColor(value: string | undefined) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value
    : XYZ_TYPO_COLOR_DEFAULT;
}

export function typoLayout(x: number, y: number, w: number, h: number, radius: number) {
  const min = Math.min(w, h);
  // Keep the lower-left corner inside the rounded silhouette at large radii.
  const margin = Math.max(min / 15, radius * (1 - Math.SQRT1_2) + min * 0.01);
  const width = Math.min(w * 0.51, (h - 2 * margin) * 0.45 * TYPO_WIDTH / TYPO_HEIGHT);
  const scale = width / TYPO_WIDTH;
  return { x: x + margin, y: y + h - margin - TYPO_HEIGHT * scale, scale };
}

let canvasPaths: Path2D[] | undefined;
let rasterCanvas: HTMLCanvasElement | undefined;
let rasterColor: string | undefined;

function typoRaster(color: string) {
  canvasPaths ??= TYPO_PATHS.map(d => new Path2D(d));
  rasterCanvas ??= document.createElement("canvas");
  const canvas = rasterCanvas;
  const width = Math.ceil(TYPO_WIDTH * TYPO_SUPERSAMPLE);
  const height = Math.ceil(TYPO_HEIGHT * TYPO_SUPERSAMPLE);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    rasterColor = undefined;
  }
  if (rasterColor !== color) {
    const rasterCtx = canvas.getContext("2d");
    if (!rasterCtx) return undefined;
    rasterCtx.setTransform(1, 0, 0, 1, 0, 0);
    rasterCtx.clearRect(0, 0, width, height);
    rasterCtx.setTransform(TYPO_SUPERSAMPLE, 0, 0, TYPO_SUPERSAMPLE, 0, 0);
    rasterCtx.fillStyle = color;
    canvasPaths.forEach(path => rasterCtx.fill(path));
    rasterColor = color;
  }
  return canvas;
}

export function drawTypo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  color?: string,
) {
  const layout = typoLayout(x, y, w, h, radius);
  const raster = typoRaster(xyzTypoColor(color));
  if (!raster) return;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    raster,
    layout.x,
    layout.y,
    TYPO_WIDTH * layout.scale,
    TYPO_HEIGHT * layout.scale,
  );
  ctx.restore();
}

export function typoSvg(
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  color?: string,
) {
  const layout = typoLayout(x, y, w, h, radius);
  return `<g data-eid="xyz-typo" fill="${xyzTypoColor(color)}" transform="translate(${layout.x} ${layout.y}) scale(${layout.scale})">` +
    TYPO_PATHS.map(d => `<path d="${d}"/>`).join("") + "</g>";
}
