import { strict as assert } from "node:assert";
import { test } from "node:test";
import { insetXyzShape, xyzRoundRatio, xyzShapePath, XYZ_ROUND_DEFAULT } from "./xyzShape";

test("right-top and left-bottom corners share the selected radius", () => {
  const path = xyzShapePath(10, 20, 300, 200, 30, 24);
  assert.match(path, /H286A24 24 0 0 1 310 44/);
  assert.match(path, /H34A24 24 0 0 1 10 196/);
});

test("zero radius restores square right-top and left-bottom corners", () => {
  const path = xyzShapePath(0, 0, 300, 200, 30, 0);
  assert.doesNotMatch(path, /A/);
  assert.match(path, /^M30 0H300H300/);
  assert.match(path, /H0H0V30Z$/);
});

test("padding follows rounded corners without exceeding the frame", () => {
  assert.deepEqual(insetXyzShape(300, 200, 30, 24, 10), {
    x: 10,
    y: 10,
    width: 280,
    height: 180,
    chamfer: 30 - (2 - Math.SQRT2) * 10,
    radius: 14,
  });
  assert.equal(insetXyzShape(50, 50, 5, 5, 10).radius, 0);
});

test("saved corner values are normalized with a backward-compatible default", () => {
  assert.equal(xyzRoundRatio(undefined), XYZ_ROUND_DEFAULT);
  assert.equal(xyzRoundRatio(-1), 0);
  assert.equal(xyzRoundRatio(1), 0.25);
});
