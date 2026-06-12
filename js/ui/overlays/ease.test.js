// @ts-check
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { easeToward } from "./ease.js";

const TAU = 120;

describe("easeToward", () => {
  test("identity when already at target", () => {
    assert.equal(easeToward(0.5, 0.5, 16, TAU), 0.5);
  });

  test("no movement on non-positive or non-finite dt", () => {
    assert.equal(easeToward(0.2, 1, 0, TAU), 0.2);
    assert.equal(easeToward(0.2, 1, -5, TAU), 0.2);
    assert.equal(easeToward(0.2, 1, NaN, TAU), 0.2);
    assert.equal(easeToward(0.2, 1, Infinity, TAU), 0.2);
  });

  test("non-positive or non-finite tau snaps to target (smoothing disabled)", () => {
    assert.equal(easeToward(0.2, 1, 16, 0), 1);
    assert.equal(easeToward(0.2, 1, 16, -10), 1);
    assert.equal(easeToward(0.2, 1, 16, NaN), 1);
    assert.equal(easeToward(0.2, 1, 16, Infinity), 1);
  });

  test("moves toward target, staying strictly between current and target", () => {
    const next = easeToward(0, 1, 16, TAU);
    assert.ok(next > 0 && next < 1, `expected (0,1), got ${next}`);
  });

  test("works downward too", () => {
    const next = easeToward(1, 0, 16, TAU);
    assert.ok(next > 0 && next < 1, `expected (0,1), got ${next}`);
  });

  test("larger dt advances further toward target", () => {
    const small = easeToward(0, 1, 8, TAU);
    const big = easeToward(0, 1, 32, TAU);
    assert.ok(big > small, `expected ${big} > ${small}`);
  });

  test("converges to target after many steps", () => {
    let v = 0;
    for (let i = 0; i < 500; i++) v = easeToward(v, 1, 16, TAU);
    assert.ok(Math.abs(v - 1) < 1e-3, `did not converge, v=${v}`);
  });

  test("frame-rate independent: two 8ms steps ≈ one 16ms step", () => {
    const oneStep = easeToward(0, 1, 16, TAU);
    let two = easeToward(0, 1, 8, TAU);
    two = easeToward(two, 1, 8, TAU);
    assert.ok(Math.abs(oneStep - two) < 1e-9, `${oneStep} vs ${two}`);
  });
});
