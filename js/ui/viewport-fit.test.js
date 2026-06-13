// @ts-check
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { viewportMatchesFit } from "./viewport-fit.js";

describe("viewportMatchesFit", () => {
  const at = (zoom, x, y) => ({ zoom, pan: { x, y } });

  test("exact match → true (a re-fit to the same framing is a no-op)", () => {
    assert.equal(viewportMatchesFit(at(1.5, 100, 200), at(1.5, 100, 200)), true);
  });

  test("sub-pixel pan + tiny zoom drift still counts as matched", () => {
    assert.equal(viewportMatchesFit(at(1.5, 100, 200), at(1.503, 101, 201)), true);
  });

  test("a real reframe (large pan) → false, so the fit still animates", () => {
    assert.equal(viewportMatchesFit(at(1.5, 100, 200), at(1.5, 260, 200)), false);
  });

  test("a real zoom change (>2%) → false", () => {
    assert.equal(viewportMatchesFit(at(1.0, 100, 200), at(1.2, 100, 200)), false);
  });

  test("zoom delta is relative to current zoom, not absolute", () => {
    // 0.05 absolute is 2.5% of zoom 2.0 → exceeds the 2% default → not matched
    assert.equal(viewportMatchesFit(at(2.0, 0, 0), at(2.05, 0, 0)), false);
    // same 0.05 absolute is well within tolerance at a higher zoom baseline
    assert.equal(viewportMatchesFit(at(10.0, 0, 0), at(10.05, 0, 0)), true);
  });

  test("tolerances are configurable", () => {
    assert.equal(viewportMatchesFit(at(1.5, 100, 200), at(1.5, 140, 200), { panTol: 50 }), true);
    assert.equal(viewportMatchesFit(at(1.5, 100, 200), at(1.5, 102, 200), { panTol: 1 }), false);
  });

  test("null/missing target → false (fall through to animating the fit)", () => {
    assert.equal(viewportMatchesFit(at(1.5, 100, 200), null), false);
    assert.equal(viewportMatchesFit(at(1.5, 100, 200), undefined), false);
  });
});
