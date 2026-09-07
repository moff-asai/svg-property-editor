export const XYZ_ROUND_DEFAULT = 0.08;

export function xyzRoundRatio(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(0.25, value)) : XYZ_ROUND_DEFAULT;
}

export function traceXyzShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  chamfer: number,
  radius: number,
) {
  const c = Math.max(0, Math.min(chamfer, width, height));
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - c);
  ctx.lineTo(x + width - c, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

const f = (n: number) => Number(n.toFixed(3));

export function xyzShapePath(
  x: number,
  y: number,
  width: number,
  height: number,
  chamfer: number,
  radius: number,
) {
  const c = Math.max(0, Math.min(chamfer, width, height));
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  return `M${f(x + c)} ${f(y)}H${f(x + width - r)}` +
    (r > 0 ? `A${f(r)} ${f(r)} 0 0 1 ${f(x + width)} ${f(y + r)}` : `H${f(x + width)}`) +
    `V${f(y + height - c)}L${f(x + width - c)} ${f(y + height)}` +
    `H${f(x + r)}` +
    (r > 0 ? `A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + height - r)}` : `H${f(x)}`) +
    `V${f(y + c)}Z`;
}

export function insetXyzShape(
  width: number,
  height: number,
  chamfer: number,
  radius: number,
  padding: number,
) {
  return {
    x: padding,
    y: padding,
    width: Math.max(0, width - padding * 2),
    height: Math.max(0, height - padding * 2),
    chamfer: Math.max(0, chamfer - (2 - Math.SQRT2) * padding),
    radius: Math.max(0, radius - padding),
  };
}
