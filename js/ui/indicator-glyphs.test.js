// @ts-check
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  alertLampSvg,
  alertLampDataUri,
  connStatusSvg,
  connStatusDataUri,
  tickMeterSvg,
  tickMeterDataUri,
  missionMarkSvg,
  missionMarkDataUri,
  accessGlyphSvg,
  accessGlyphDataUri,
} from "./indicator-glyphs.js";

/** Count non-overlapping occurrences of a substring in a string. */
function countOccurrences(str, sub) {
  let count = 0, idx = 0;
  while ((idx = str.indexOf(sub, idx)) !== -1) { count++; idx += sub.length; }
  return count;
}

/** Count coordinate pairs in a `points="..."` attribute value. */
function countPoints(pointsStr) {
  // Each pair is "x,y" separated by spaces
  return pointsStr.trim().split(/\s+/).length;
}

/** Extract the `points` attribute value from the first <polygon in an svg string. */
function extractPolygonPoints(svg) {
  const m = svg.match(/<polygon[^>]*points="([^"]+)"/);
  return m ? m[1] : null;
}

describe("indicator-glyphs — stroke-only SVG", () => {

  // ── shared stroke-only constraint ────────────────────────────────────────────

  describe("all glyphs are stroke-only (no shape fills)", () => {
    const cases = [
      ["alertLampSvg green",   () => alertLampSvg("green")],
      ["alertLampSvg yellow",  () => alertLampSvg("yellow")],
      ["alertLampSvg red",     () => alertLampSvg("red")],
      ["alertLampSvg trace",   () => alertLampSvg("trace")],
      ["connStatusSvg detecting", () => connStatusSvg("detecting")],
      ["connStatusSvg active", () => connStatusSvg("active")],
      ["connStatusSvg passive",() => connStatusSvg("passive")],
      ["tickMeterSvg 0.5",     () => tickMeterSvg(0.5)],
      ["tickMeterSvg 1",       () => tickMeterSvg(1)],
      ["tickMeterSvg 0",       () => tickMeterSvg(0)],
      ["missionMarkSvg complete", () => missionMarkSvg("complete")],
      ["missionMarkSvg failed",   () => missionMarkSvg("failed")],
    ];
    for (const [label, fn] of cases) {
      test(`${label} contains fill="none"`, () => {
        assert.ok(fn().includes(`fill="none"`), `${label} missing fill="none"`);
      });
      test(`${label} has no shape-level fill color`, () => {
        // The top-level SVG has fill="none". No shape inside should add fill="#...".
        // We allow the top-level attribute; forbid fill="#" elsewhere in the body.
        const svg = fn();
        // Strip the opening <svg ...> tag, then check the body.
        const bodyStart = svg.indexOf(">") + 1;
        const body = svg.slice(bodyStart);
        assert.ok(!body.includes(`fill="#`), `${label} body contains fill="#...": ${body}`);
      });
    }
  });

  // ── alertLampSvg ─────────────────────────────────────────────────────────────

  describe("alertLampSvg", () => {
    test("green → hexagon (6 coordinate pairs)", () => {
      const svg = alertLampSvg("green");
      const pts = extractPolygonPoints(svg);
      assert.ok(pts, "no <polygon> found in green lamp");
      assert.equal(countPoints(pts), 6, `expected 6 points, got: ${pts}`);
    });

    test("yellow → triangle (3 coordinate pairs)", () => {
      const svg = alertLampSvg("yellow");
      const pts = extractPolygonPoints(svg);
      assert.ok(pts, "no <polygon> found in yellow lamp");
      assert.equal(countPoints(pts), 3, `expected 3 points, got: ${pts}`);
    });

    test("red → triangle (3 coordinate pairs)", () => {
      const svg = alertLampSvg("red");
      const pts = extractPolygonPoints(svg);
      assert.ok(pts, "no <polygon> found in red lamp");
      assert.equal(countPoints(pts), 3, `expected 3 points, got: ${pts}`);
    });

    test("yellow and red triangle points differ (opposite orientation)", () => {
      const yellowPts = extractPolygonPoints(alertLampSvg("yellow"));
      const redPts    = extractPolygonPoints(alertLampSvg("red"));
      assert.notEqual(yellowPts, redPts,
        "yellow and red triangles should have different points (apex at different edge)");
    });

    test("green uses stroke color #39ff7a", () => {
      assert.ok(alertLampSvg("green").includes("#39ff7a"), "expected green color #39ff7a");
    });
    test("yellow uses stroke color #c9d11e", () => {
      assert.ok(alertLampSvg("yellow").includes("#c9d11e"), "expected amber color #c9d11e");
    });
    test("red uses stroke color #ff5a4d", () => {
      assert.ok(alertLampSvg("red").includes("#ff5a4d"), "expected red color #ff5a4d");
    });

    test("unknown level defaults to green hexagon (6 points)", () => {
      const svg = alertLampSvg("unknown-level");
      const pts = extractPolygonPoints(svg);
      assert.ok(pts, "no <polygon> in fallback lamp");
      assert.equal(countPoints(pts), 6);
      assert.ok(svg.includes("#39ff7a"));
    });

    test("trace → inverted triangle (3 coordinate pairs), not hexagon", () => {
      const svg = alertLampSvg("trace");
      const pts = extractPolygonPoints(svg);
      assert.ok(pts, "no <polygon> found in trace lamp");
      assert.equal(countPoints(pts), 3, `expected 3 points (triangle), got: ${pts}`);
    });

    test("trace uses danger color #ff5a4d", () => {
      assert.ok(alertLampSvg("trace").includes("#ff5a4d"), "expected red danger color #ff5a4d for trace");
    });

    test("trace and red produce the same polygon points (same danger shape)", () => {
      const tracePts = extractPolygonPoints(alertLampSvg("trace"));
      const redPts   = extractPolygonPoints(alertLampSvg("red"));
      assert.equal(tracePts, redPts,
        "trace and red should share the same inverted-triangle geometry");
    });
  });

  // ── connStatusSvg ─────────────────────────────────────────────────────────────

  describe("connStatusSvg", () => {
    test("detecting → red (#ff5a4d)", () => {
      assert.ok(connStatusSvg("detecting").includes("#ff5a4d"), "expected red");
    });
    test("active → cyan (#3fd9c9)", () => {
      assert.ok(connStatusSvg("active").includes("#3fd9c9"), "expected cyan");
    });
    test("passive → dim (#2a3a55)", () => {
      assert.ok(connStatusSvg("passive").includes("#2a3a55"), "expected dim");
    });
    test("empty string → dim (#2a3a55)", () => {
      assert.ok(connStatusSvg("").includes("#2a3a55"), "expected dim");
    });
    test("contains a hexagon (6-point polygon)", () => {
      const pts = extractPolygonPoints(connStatusSvg("active"));
      assert.ok(pts, "no <polygon>");
      assert.equal(countPoints(pts), 6);
    });
  });

  // ── tickMeterSvg ──────────────────────────────────────────────────────────────

  describe("tickMeterSvg", () => {
    const N = 5; // default tick count

    test("frac=1 → all N ticks are lit (full-height)", () => {
      const svg = tickMeterSvg(1);
      // Lit ticks have y1="3" (full height from top). Count them.
      const litCount = countOccurrences(svg, `y1="3"`);
      assert.equal(litCount, N, `expected ${N} lit ticks, got ${litCount}`);
    });

    test("frac=0 → zero lit ticks", () => {
      const svg = tickMeterSvg(0);
      const litCount = countOccurrences(svg, `y1="3"`);
      assert.equal(litCount, 0, `expected 0 lit ticks, got ${litCount}`);
    });

    test("frac=0.5 → round(N/2) lit ticks", () => {
      const expected = Math.round(0.5 * N);
      const svg = tickMeterSvg(0.5);
      const litCount = countOccurrences(svg, `y1="3"`);
      assert.equal(litCount, expected, `expected ${expected} lit ticks, got ${litCount}`);
    });

    test("frac > 0.6 → green tier (#39ff7a)", () => {
      assert.ok(tickMeterSvg(0.8).includes("#39ff7a"), "expected green for frac > 0.6");
    });

    test("frac 0.3 < x ≤ 0.6 → amber tier (#c9d11e)", () => {
      assert.ok(tickMeterSvg(0.5).includes("#c9d11e"), "expected amber for frac 0.3–0.6");
    });

    test("frac ≤ 0.3 → red tier (#ff5a4d)", () => {
      assert.ok(tickMeterSvg(0.2).includes("#ff5a4d"), "expected red for frac ≤ 0.3");
    });

    test("frac=1.5 clamps to frac=1 (same output as frac=1)", () => {
      assert.equal(tickMeterSvg(1.5), tickMeterSvg(1));
    });

    test("frac=-1 clamps to frac=0 (same output as frac=0)", () => {
      assert.equal(tickMeterSvg(-1), tickMeterSvg(0));
    });

    test("custom opts.ticks overrides N", () => {
      const svg = tickMeterSvg(1, { ticks: 3 });
      const litCount = countOccurrences(svg, `y1="3"`);
      assert.equal(litCount, 3);
    });

    test("frac=0 with custom N → all ticks are dim stubs (y1='10')", () => {
      const svg = tickMeterSvg(0, { ticks: 4 });
      // All 4 ticks should be unlit stubs (y1="10")
      const stubCount = countOccurrences(svg, `y1="10"`);
      assert.equal(stubCount, 4);
    });
  });

  // ── missionMarkSvg ────────────────────────────────────────────────────────────

  describe("missionMarkSvg", () => {
    test("complete → stroke-only green checkmark", () => {
      const svg = missionMarkSvg("complete");
      assert.ok(svg.includes("#39ff7a"), "expected green color");
      assert.ok(svg.includes("<polyline") || svg.includes("<line"), "expected a line/polyline element");
    });

    test("failed → stroke-only red X", () => {
      const svg = missionMarkSvg("failed");
      assert.ok(svg.includes("#ff5a4d"), "expected red color");
      assert.ok(svg.includes("<line"), "expected line elements for X");
    });

    test("complete and failed produce different SVG", () => {
      assert.notEqual(missionMarkSvg("complete"), missionMarkSvg("failed"));
    });
  });

  // ── determinism ───────────────────────────────────────────────────────────────

  describe("determinism", () => {
    test("identical args → identical string for alertLampSvg", () => {
      assert.equal(alertLampSvg("red"), alertLampSvg("red"));
    });
    test("identical args → identical string for tickMeterSvg", () => {
      assert.equal(tickMeterSvg(0.5), tickMeterSvg(0.5));
    });
    test("identical args → identical string for missionMarkSvg", () => {
      assert.equal(missionMarkSvg("complete"), missionMarkSvg("complete"));
    });
  });

  // ── accessGlyphSvg ────────────────────────────────────────────────────────────

  describe("accessGlyphSvg", () => {
    /** lit chevrons render at stroke-width 1.8; dim at 1.4. */
    const litCount = (svg) => countOccurrences(svg, `stroke-width="1.8"`);

    test("always renders exactly 3 chevron polylines", () => {
      for (const lvl of ["locked", "open", "owned", "—", "nonsense"]) {
        assert.equal(countOccurrences(accessGlyphSvg(lvl), "<polyline"), 3,
          `expected 3 polylines for "${lvl}"`);
      }
    });

    test("locked → 1 lit chevron", () => {
      assert.equal(litCount(accessGlyphSvg("locked")), 1);
    });
    test("open → 2 lit chevrons", () => {
      assert.equal(litCount(accessGlyphSvg("open")), 2);
    });
    test("owned → 3 lit chevrons", () => {
      assert.equal(litCount(accessGlyphSvg("owned")), 3);
    });
    test("unknown / obscured (—) → 0 lit chevrons", () => {
      assert.equal(litCount(accessGlyphSvg("—")), 0);
      assert.equal(litCount(accessGlyphSvg("nonsense")), 0);
    });

    test("locked lit hue is teal #45c4c4", () => {
      assert.ok(accessGlyphSvg("locked").includes("#45c4c4"));
    });
    test("open lit hue is azure #36a6e0", () => {
      assert.ok(accessGlyphSvg("open").includes("#36a6e0"));
    });
    test("owned lit hue is green-teal #2ad17a", () => {
      assert.ok(accessGlyphSvg("owned").includes("#2ad17a"));
    });

    test("unreached chevrons use the dim color #2a3a55", () => {
      // locked has 2 dim chevrons, open has 1.
      assert.ok(accessGlyphSvg("locked").includes("#2a3a55"));
      assert.ok(accessGlyphSvg("open").includes("#2a3a55"));
    });
    test("owned has no dim chevrons (no #2a3a55)", () => {
      assert.ok(!accessGlyphSvg("owned").includes("#2a3a55"));
    });

    test("stroke-only: top-level fill=none, no shape fill in body", () => {
      const svg = accessGlyphSvg("open");
      assert.ok(svg.includes(`fill="none"`));
      const body = svg.slice(svg.indexOf(">") + 1);
      assert.ok(!body.includes(`fill="#`), `body has a shape fill: ${body}`);
    });

    test("deterministic: identical args → identical string", () => {
      assert.equal(accessGlyphSvg("open"), accessGlyphSvg("open"));
    });

    test("accessGlyphDataUri starts with data:image/svg+xml,", () => {
      assert.ok(accessGlyphDataUri("owned").startsWith("data:image/svg+xml,"));
    });
  });

  // ── dataUri helpers ───────────────────────────────────────────────────────────

  describe("dataUri helpers", () => {
    const uriCases = [
      ["alertLampDataUri green",      () => alertLampDataUri("green")],
      ["alertLampDataUri yellow",     () => alertLampDataUri("yellow")],
      ["alertLampDataUri red",        () => alertLampDataUri("red")],
      ["connStatusDataUri active",    () => connStatusDataUri("active")],
      ["connStatusDataUri detecting", () => connStatusDataUri("detecting")],
      ["tickMeterDataUri 0.5",        () => tickMeterDataUri(0.5)],
      ["missionMarkDataUri complete", () => missionMarkDataUri("complete")],
      ["missionMarkDataUri failed",   () => missionMarkDataUri("failed")],
    ];
    for (const [label, fn] of uriCases) {
      test(`${label} starts with data:image/svg+xml,`, () => {
        assert.ok(fn().startsWith("data:image/svg+xml,"), `${label} missing data URI prefix`);
      });
    }
  });
});
