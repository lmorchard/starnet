// @ts-check
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ecgPoints,
  pulsePoints,
  sampleY,
  pointsToPath,
  hash01,
} from "./waveform.js";

const W = 120;
const H = 28;
const MID = H / 2; // 14

const maxDev = (pts) => Math.max(...pts.map((p) => Math.abs(p.y - MID)));
const inBounds = (pts) =>
  pts.every((p) => p.x >= -0.01 && p.x <= W + 0.01 && p.y >= 0 && p.y <= H);
const ascending = (pts) => pts.every((p, i) => i === 0 || p.x >= pts[i - 1].x);

describe("hash01", () => {
  test("returns a value in [0,1)", () => {
    for (let i = 0; i < 20; i++) {
      const v = hash01(i);
      assert.ok(v >= 0 && v < 1, `hash01(${i}) = ${v} not in [0,1)`);
    }
  });
  test("is deterministic", () => {
    assert.equal(hash01(42), hash01(42));
    assert.equal(hash01(999), hash01(999));
  });
  test("varies across inputs", () => {
    const unique = new Set([0, 1, 2, 3, 4, 5].map((n) => hash01(n).toFixed(4)));
    assert.ok(unique.size > 3);
  });
});

describe("ecgPoints", () => {
  test("frac 0 → flat 2-point baseline at mid", () => {
    const pts = ecgPoints({ frac: 0, width: W, height: H });
    assert.deepEqual(pts, [{ x: 0, y: MID }, { x: W, y: MID }]);
  });

  test("frac 1 → many points with a visible R spike", () => {
    const pts = ecgPoints({ frac: 1, width: W, height: H });
    assert.ok(pts.length > 2);
    assert.ok(maxDev(pts) > H * 0.3, `expected tall R spike, maxDev=${maxDev(pts)}`);
  });

  test("points ascending in x and within bounds across frac", () => {
    for (const frac of [0.1, 0.4, 0.7, 1.0]) {
      const pts = ecgPoints({ frac, width: W, height: H });
      assert.ok(ascending(pts), `not ascending at frac=${frac}`);
      assert.ok(inBounds(pts), `out of bounds at frac=${frac}`);
    }
  });

  test("wide strip renders a partial final beat, not a near-full-period flatline", () => {
    // Regression: ecgPoints used Math.floor(W/period) for the beat count, so any
    // leftover width up to almost a whole period was filled with flat baseline. At
    // sidebar widths where that remainder approached a full period, the trace dropped
    // the final beat and flatlined for nearly a beat-width at the right edge. A partial
    // beat clipped at the edge should fill that space instead.
    const period = H * 2.0; // lerp(1.15, 2.0, 1) — frac=1 is the slowest heart, longest period
    // Width with a large floor() remainder (~0.85 period) — worst case for the old bug.
    const width = Math.round(2 * period + 0.85 * period);
    const pts = ecgPoints({ frac: 1, width, height: H });
    const feature = (p) => Math.abs(p.y - MID) > H * 0.05;
    const lastFeatureX = pts.filter(feature).reduce((mx, p) => Math.max(mx, p.x), 0);
    const trailingFlat = width - lastFeatureX;
    assert.ok(
      trailingFlat < period,
      `trailing flat gap ${trailingFlat.toFixed(1)}px should be < one period ${period.toFixed(1)}px ` +
        `(expected a partial beat near the edge, not a flatline)`,
    );
  });

  test("beat count increases with damage", () => {
    // R peaks sit well above the midline (small y); P/T/U humps stay below the threshold.
    const peaks = (pts) => pts.filter((p) => MID - p.y > H * 0.25).length;
    const healthy = peaks(ecgPoints({ frac: 1, width: W, height: H }));
    const damaged = peaks(ecgPoints({ frac: 0.2, width: W, height: H }));
    assert.ok(damaged > healthy, `damaged ${damaged} should exceed healthy ${healthy}`);
  });

  test("deterministic", () => {
    assert.deepEqual(
      ecgPoints({ frac: 0.6, width: W, height: H }),
      ecgPoints({ frac: 0.6, width: W, height: H }),
    );
  });

  test("different frac produces different output", () => {
    assert.notDeepEqual(
      ecgPoints({ frac: 1, width: W, height: H }),
      ecgPoints({ frac: 0.5, width: W, height: H }),
    );
  });
});

describe("ecgPoints — health-degradation cascade", () => {
  // Farthest the trace strays below the baseline (downward, larger y).
  const maxBelow = (pts) => Math.max(0, ...pts.map((p) => p.y - MID));
  // A horizontal segment (two consecutive equal-y vertices) sitting clearly above
  // baseline — the signature of an elevated ST segment.
  const hasFlatAboveBaseline = (pts) =>
    pts.some(
      (p, i) =>
        i > 0 &&
        p.x > pts[i - 1].x &&
        Math.abs(p.y - pts[i - 1].y) < 0.01 &&
        MID - p.y > 0.5,
    );

  test("ventricular fibrillation below 7%: no organized R spike, but not flatline", () => {
    const vf = ecgPoints({ frac: 0.05, width: W, height: H });
    assert.ok(vf.length > 2, "VF should not collapse to the 2-point flatline");
    const dev = maxDev(vf);
    assert.ok(dev > 0, "VF trace should oscillate, not sit flat");
    assert.ok(dev < H * 0.3, `VF should have no R-height spike, maxDev=${dev}`);
  });

  test("organized R spike returns just above the 7% fibrillation threshold", () => {
    assert.ok(maxDev(ecgPoints({ frac: 0.05, width: W, height: H })) < H * 0.3);
    assert.ok(maxDev(ecgPoints({ frac: 0.08, width: W, height: H })) > H * 0.3);
  });

  test("ST elevation: damaged trace lifts a flat segment above baseline; healthy does not", () => {
    assert.equal(hasFlatAboveBaseline(ecgPoints({ frac: 1, width: W, height: H })), false);
    for (const frac of [0.66, 0.4, 0.2]) {
      assert.ok(
        hasFlatAboveBaseline(ecgPoints({ frac, width: W, height: H })),
        `expected elevated ST segment at frac=${frac}`,
      );
    }
  });

  test("ectopy/T-inversion deepens below-baseline excursion as health falls", () => {
    const healthy = maxBelow(ecgPoints({ frac: 1, width: W, height: H }));
    const damaged = maxBelow(ecgPoints({ frac: 0.2, width: W, height: H }));
    assert.ok(damaged > healthy, `damaged ${damaged} should dip below baseline further than healthy ${healthy}`);
  });

  test("deterministic across the cascade", () => {
    for (const frac of [0.05, 0.1, 0.3, 0.6]) {
      assert.deepEqual(
        ecgPoints({ frac, width: W, height: H }),
        ecgPoints({ frac, width: W, height: H }),
      );
    }
  });
});

describe("pulsePoints", () => {
  test("frac 0 → flat 2-point baseline at mid", () => {
    const pts = pulsePoints({ frac: 0, width: W, height: H });
    assert.deepEqual(pts, [{ x: 0, y: MID }, { x: W, y: MID }]);
  });

  test("frac 1 → defined pulse with substantial amplitude", () => {
    const pts = pulsePoints({ frac: 1, width: W, height: H });
    assert.ok(pts.length > 2);
    assert.ok(maxDev(pts) > H * 0.25, `expected bold pulse, maxDev=${maxDev(pts)}`);
  });

  test("amplitude stays substantial as integrity falls (does not flatten)", () => {
    for (const frac of [1, 0.5, 0.2]) {
      const dev = maxDev(pulsePoints({ frac, width: W, height: H }));
      assert.ok(dev > H * 0.2, `frac=${frac} collapsed to maxDev=${dev}`);
    }
  });

  test("symmetric clock: rings both above and below the midline", () => {
    // Up-pulses overshoot above the high level, down-pulses below the low level — so the
    // trace must reach well past mid in BOTH directions, roughly symmetrically.
    const pts = pulsePoints({ frac: 1, width: W, height: H });
    const above = Math.max(...pts.map((p) => MID - p.y)); // up excursion
    const below = Math.max(...pts.map((p) => p.y - MID)); // down excursion
    assert.ok(above > H * 0.25 && below > H * 0.25, `not both-sided: up=${above} down=${below}`);
    assert.ok(Math.abs(above - below) < H * 0.12, `not symmetric: up=${above} down=${below}`);
  });

  test("points ascending in x and within bounds across frac", () => {
    for (const frac of [0.1, 0.4, 0.7, 1.0]) {
      const pts = pulsePoints({ frac, width: W, height: H });
      assert.ok(ascending(pts), `not ascending at frac=${frac}`);
      assert.ok(inBounds(pts), `out of bounds at frac=${frac}`);
    }
  });

  test("deterministic", () => {
    assert.deepEqual(
      pulsePoints({ frac: 0.4, width: W, height: H }),
      pulsePoints({ frac: 0.4, width: W, height: H }),
    );
  });

  test("fixed cycle width: a wider strip shows MORE pulses, not stretched ones", () => {
    // Cycle width is anchored to height (like ecgPoints' period), so widening the
    // strip adds clock cycles rather than stretching a fixed few to fill. A 4×
    // wider strip should yield substantially more vertices, not the same count.
    const narrow = pulsePoints({ frac: 0.7, width: 200, height: H });
    const wide = pulsePoints({ frac: 0.7, width: 800, height: H });
    assert.ok(
      wide.length > narrow.length * 2,
      `expected wide (${wide.length}) >> narrow (${narrow.length}) — pulse appears width-stretched`,
    );
  });
});

describe("frac clamping (both)", () => {
  test("ecg: frac 1.5 == frac 1; frac -0.5 == flat", () => {
    assert.deepEqual(
      ecgPoints({ frac: 1.5, width: W, height: H }),
      ecgPoints({ frac: 1, width: W, height: H }),
    );
    assert.deepEqual(ecgPoints({ frac: -0.5, width: W, height: H }),
      [{ x: 0, y: MID }, { x: W, y: MID }]);
  });
  test("pulse: frac 1.5 == frac 1; frac -0.5 == flat", () => {
    assert.deepEqual(
      pulsePoints({ frac: 1.5, width: W, height: H }),
      pulsePoints({ frac: 1, width: W, height: H }),
    );
    assert.deepEqual(pulsePoints({ frac: -0.5, width: W, height: H }),
      [{ x: 0, y: MID }, { x: W, y: MID }]);
  });
});

describe("sampleY", () => {
  test("flat line returns the baseline anywhere", () => {
    const flat = [{ x: 0, y: 14 }, { x: 120, y: 14 }];
    assert.equal(sampleY(flat, 0), 14);
    assert.equal(sampleY(flat, 60), 14);
    assert.equal(sampleY(flat, 120), 14);
  });
  test("interpolates linearly along a segment", () => {
    const line = [{ x: 0, y: 0 }, { x: 10, y: 10 }];
    assert.equal(sampleY(line, 0), 0);
    assert.equal(sampleY(line, 5), 5);
    assert.equal(sampleY(line, 10), 10);
  });
  test("past the last point returns the last y", () => {
    const line = [{ x: 0, y: 0 }, { x: 10, y: 10 }];
    assert.equal(sampleY(line, 15), 10);
  });
  test("empty array returns 0", () => {
    assert.equal(sampleY([], 5), 0);
  });
});

describe("pointsToPath", () => {
  test("starts with M, uses L thereafter", () => {
    const path = pointsToPath([{ x: 0, y: 14 }, { x: 60, y: 4 }, { x: 120, y: 14 }]);
    assert.ok(path.startsWith("M"));
    assert.ok(path.includes("L"));
  });
  test("only M/L/digits/dot/minus/space, 2-decimal rounding", () => {
    const path = pointsToPath([{ x: 1.23456, y: 7.89123 }, { x: 10.5, y: 4 }]);
    assert.match(path, /^[ML0-9.\- ]+$/);
    assert.ok(path.includes("1.23"));
    assert.ok(!path.includes("1.2345"));
  });
  test("single point is only M; empty is ''", () => {
    assert.ok(pointsToPath([{ x: 5, y: 10 }]).startsWith("M"));
    assert.ok(!pointsToPath([{ x: 5, y: 10 }]).includes("L"));
    assert.equal(pointsToPath([]), "");
  });
});
