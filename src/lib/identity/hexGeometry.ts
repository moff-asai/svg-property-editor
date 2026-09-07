export interface Point {
  x: number;
  y: number;
}

// Exact distance to the nearest edge/vertex, negative inside. Keeping this in
// scene units makes the transition identical in previews and exported artwork.
export function polygonDistance(vertices: Point[]) {
  return (x: number, y: number): number => {
    let squared = Infinity;
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const a = vertices[j];
      const b = vertices[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lengthSquared = dx * dx + dy * dy;
      const t = lengthSquared > 0
        ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / lengthSquared))
        : 0;
      squared = Math.min(squared, (x - a.x - t * dx) ** 2 + (y - a.y - t * dy) ** 2);
      if ((a.y > y) !== (b.y > y) && x < a.x + ((y - a.y) * dx) / dy) inside = !inside;
    }
    return Math.sqrt(squared) * (inside ? -1 : 1);
  };
}

export function hexagonDistance(radius: number, rotation: number) {
  return polygonDistance(Array.from({ length: 6 }, (_, i) => {
    const angle = rotation + i * Math.PI / 3;
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
  }));
}

// Whole dots taper over several rows, including just inside the nominal edge.
// No clipping, erasing, or all-or-nothing polygon membership test.
export function hexDotWeight(distance: number, width: number): number {
  const t = Math.max(0, Math.min(1, (distance + width * 0.8) / (width * 1.8)));
  return t * t * (3 - 2 * t);
}

// Patterns 1/2 (crisp) keep every dot whole — culling/push-out happens in the
// caller. Pattern 3 tapers area, pattern 4 transfers the fade to opacity; both
// have the same area × opacity at the boundary.
export function hexDotAppearance(weight: number, pattern = 1) {
  if (pattern === 3) return { radius: Math.sqrt(weight), opacity: 1 };
  if (pattern === 4) return { radius: 1, opacity: weight };
  return { radius: 1, opacity: 1 };
}

// Move the original dot field into a hexagonal annulus. The inner circle maps
// to six straight sides; the deformation smoothly reaches zero at the outer
// radius. Dot sizes and opacity are independent of this coordinate transform.
export function createHexInnerPlacement(
  radius: number,
  rotation: number,
  sourceInnerRadius = 0,
  boundaryRadius?: (angle: number) => number,
) {
  const sector = Math.PI / 3;
  const tau = Math.PI * 2;
  const reach = Math.max(radius, sourceInnerRadius) * 2.5;
  const reachSquared = reach * reach;
  const sourceSquared = sourceInnerRadius * sourceInnerRadius;
  const normalization = 1 - sourceSquared / reachSquared;
  return (x: number, y: number): Point => {
    const r = Math.hypot(x, y);
    if (r >= reach || reach <= 0) return { x, y };
    const angle = r > 1e-6 ? Math.atan2(y, x) : rotation;
    const local = ((angle - rotation) % tau + tau) % tau;
    const sideAngle = local % sector - sector / 2;
    const boundary = boundaryRadius
      ? boundaryRadius(angle)
      : radius * Math.cos(sector / 2) / Math.cos(sideAngle);
    const blend = ((1 - r * r / reachSquared) / normalization) ** 2;
    const placedRadius = Math.sqrt(Math.max(0, r * r + (boundary * boundary - sourceSquared) * blend));
    return { x: placedRadius * Math.cos(angle), y: placedRadius * Math.sin(angle) };
  };
}
