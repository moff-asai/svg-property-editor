import { strict as assert } from "node:assert";
import { test } from "node:test";
import { xyzFrameRatio, xyzFrameSize, type XyzFrameParams } from "./xyzFrame";

const ANIM: XyzFrameParams = { frameAnimation: 1, frameWidth: 90, frameHeight: 65 };

test("the configured ratio is the animation peak", () => {
  assert.deepEqual(xyzFrameRatio(ANIM), { width: 0.9, height: 0.65 });
  const peak = xyzFrameSize(1000, 1000, 0.7, ANIM);
  assert.equal(Math.round(peak.width), 900);
  assert.equal(Math.round(peak.height), 650);
});

test("the loop grows from a smaller start and shrinks back to it", () => {
  const start = xyzFrameSize(1000, 1000, 0, ANIM);
  const end = xyzFrameSize(1000, 1000, 0.999, ANIM);
  assert.equal(Math.round(start.width), 220);
  assert.equal(Math.round(start.height), 210);
  assert.ok(start.width < 900 && start.height < 650);
  assert.ok(Math.abs(end.width - start.width) < 1);
  assert.ok(Math.abs(end.height - start.height) < 1);
});

test("a peak under the start ratio still grows instead of inverting", () => {
  const tiny: XyzFrameParams = { frameAnimation: 1, frameWidth: 10, frameHeight: 10 };
  const start = xyzFrameSize(1000, 1000, 0, tiny);
  const peak = xyzFrameSize(1000, 1000, 0.7, tiny);
  assert.equal(Math.round(peak.width), 100);
  assert.equal(Math.round(peak.height), 100);
  assert.ok(start.width <= peak.width && start.height <= peak.height);
});

test("frame motion off keeps the configured ratio at every phase", () => {
  const still: XyzFrameParams = { frameAnimation: 0, frameWidth: 90, frameHeight: 65 };
  for (const ph of [0, 0.3, 0.7, 1]) {
    assert.deepEqual(xyzFrameSize(1000, 1000, ph, still), { width: 900, height: 650 });
  }
});
