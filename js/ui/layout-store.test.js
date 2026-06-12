// @ts-check
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { clampSize, DEFAULT_LAYOUT, SIZE_BOUNDS, normalizeLayout } from "./layout-store.js";

// loadLayout/saveLayout touch localStorage (absent under node:test); only the
// pure helpers clampSize/normalizeLayout are covered here.

describe("clampSize", () => {
  test("passes through an in-range value", () => {
    assert.equal(clampSize(400, 280, 1200), 400);
  });
  test("clamps below min up to min", () => {
    assert.equal(clampSize(100, 280, 1200), 280);
  });
  test("clamps above max down to max", () => {
    assert.equal(clampSize(5000, 280, 1200), 1200);
  });
  test("non-finite falls back to min", () => {
    assert.equal(clampSize(NaN, 280, 1200), 280);
    assert.equal(clampSize(Infinity, 280, 1200), 280);
    assert.equal(clampSize("nope", 280, 1200), 280);
  });
});

describe("DEFAULT_LAYOUT / SIZE_BOUNDS", () => {
  test("defaults are within their static bounds", () => {
    for (const key of Object.keys(DEFAULT_LAYOUT)) {
      const { min, max } = SIZE_BOUNDS[key];
      const v = DEFAULT_LAYOUT[key];
      assert.ok(v >= min && v <= max, `${key}=${v} out of [${min},${max}]`);
    }
  });
});

describe("normalizeLayout", () => {
  test("non-object payload returns the defaults", () => {
    assert.deepEqual(normalizeLayout(null), DEFAULT_LAYOUT);
    assert.deepEqual(normalizeLayout("x"), DEFAULT_LAYOUT);
    assert.deepEqual(normalizeLayout(42), DEFAULT_LAYOUT);
  });
  test("missing keys fall back to per-key defaults", () => {
    assert.deepEqual(normalizeLayout({ sidebarW: 500 }), {
      sidebarW: 500, logH: DEFAULT_LAYOUT.logH, handH: DEFAULT_LAYOUT.handH,
    });
  });
  test("out-of-range values are clamped to static bounds", () => {
    const out = normalizeLayout({ sidebarW: 99999, logH: 1, handH: 0 });
    assert.equal(out.sidebarW, SIZE_BOUNDS.sidebarW.max);
    assert.equal(out.logH, SIZE_BOUNDS.logH.min);
    assert.equal(out.handH, SIZE_BOUNDS.handH.min);
  });
  test("ignores unknown keys", () => {
    assert.deepEqual(normalizeLayout({ sidebarW: 400, bogus: 1 }), DEFAULT_LAYOUT);
  });
  test("a null-valued key clamps to that axis min", () => {
    assert.equal(normalizeLayout({ sidebarW: null }).sidebarW, SIZE_BOUNDS.sidebarW.min);
  });
});
