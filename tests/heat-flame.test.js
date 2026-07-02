import { test } from "node:test";
import assert from "node:assert/strict";
import {
  flameNoise,
  bandY,
  bandExists,
  bandColor,
  bandAlpha,
} from "../js/ui/heat-flame.js";

// Canonical geometry used across cases: 44px strip → base=41, span=37 (see component).
const g = { base: 41, span: 37, gap: 4, jag: 0 };

test("flameNoise is deterministic and bounded to (-1, 1)", () => {
  assert.equal(flameNoise(0.3, 1), flameNoise(0.3, 1));
  assert.equal(flameNoise(0.72, 5), flameNoise(0.72, 5));
  for (const [r, k] of [[0, 0], [0.7, 2], [0.999, 9], [0.15, 3]]) {
    assert.ok(Math.abs(flameNoise(r, k)) <= 1, `|flameNoise(${r},${k})| <= 1`);
  }
});

test("bandY: heat 0 keeps a small idle jitter near the baseline (deliberate liveliness)", () => {
  const jg = { base: 41, span: 37, gap: 4, jag: 0.5 };
  const bound = jg.jag * 3 * 0.4; // jitMag at level 0 = |noise|*jag*3*0.4, |noise| <= 1
  let sawJitter = false;
  for (const r of [0.1, 0.3, 0.55, 0.8, 0.95]) {
    const y = bandY(0, r, 0, jg);
    assert.ok(Math.abs(y - jg.base) <= bound + 1e-9, `idle jitter stays bounded near baseline (r=${r})`);
    if (y !== jg.base) sawJitter = true;
  }
  assert.ok(sawJitter, "some columns jitter at heat 0 — the resting baseline shimmers, not dead-flat");
  // With jitter disabled entirely (jag=0), heat 0 is exactly flat.
  assert.equal(bandY(0, 0.42, 0, { ...jg, jag: 0 }), jg.base);
});

test("bandY: with jag=0 the crown sits at heat height", () => {
  assert.equal(bandY(0.5, 0.9, 0, g), g.base - 0.5 * g.span);
  assert.equal(bandY(1, 0.5, 0, g), g.base - g.span);
  assert.equal(bandY(0, 0.5, 0, g), g.base);
});

test("bandY: bands are equidistant (fixed gap) below the crown", () => {
  assert.equal(bandY(0.8, 0.3, 2, g) - bandY(0.8, 0.3, 1, g), g.gap);
  assert.equal(bandY(0.8, 0.3, 3, g) - bandY(0.8, 0.3, 2, g), g.gap);
});

test("bandY: hotter flame lifts the crown (smaller y)", () => {
  assert.ok(bandY(1, 0.5, 0, g) < bandY(0.2, 0.5, 0, g));
});

test("bandExists: crown present whenever there is any flame", () => {
  assert.ok(bandExists(1, 0, g));
  assert.ok(bandExists(0.3, 0, g));
  assert.ok(!bandExists(0, 0, g));
});

test("bandExists: no room for deep bands when cold", () => {
  assert.ok(!bandExists(0.02, 4, g));
});

test("bandExists: bands are added/removed only from the bottom (monotone in j)", () => {
  for (const level of [0.1, 0.35, 0.6, 0.9, 1]) {
    for (let j = 1; j < 12; j++) {
      if (bandExists(level, j, g)) {
        assert.ok(bandExists(level, j - 1, g), `level ${level}: band ${j} implies band ${j - 1}`);
      }
    }
  }
});

test("bandExists: monotone in level for a fixed band", () => {
  for (let j = 0; j < 8; j++) {
    if (bandExists(0.4, j, g)) assert.ok(bandExists(0.95, j, g), `band ${j} survives more heat`);
  }
});

test("bandColor: crown is red, deepest band is yellow", () => {
  assert.equal(bandColor(0, 6), "rgb(255,40,40)");
  assert.equal(bandColor(5, 6), "rgb(255,225,55)");
});

test("bandColor: single-band cap yields the red crown", () => {
  assert.equal(bandColor(0, 1), "rgb(255,40,40)");
});

test("bandAlpha: crown opaque, lower bands progressively more transparent, non-negative", () => {
  assert.equal(bandAlpha(0, 6, 0.6), 1);
  assert.ok(bandAlpha(5, 6, 0.6) < bandAlpha(1, 6, 0.6));
  assert.ok(bandAlpha(5, 6, 0.6) >= 0);
  assert.equal(bandAlpha(3, 6, 0), 1); // fade=0 → all opaque
});
