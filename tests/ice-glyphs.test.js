import test from "node:test";
import assert from "node:assert/strict";
import { iceStrikeCage, detectionPolygonSegments } from "../js/ui/ice-glyphs.js";

test("iceStrikeCage returns stroke-only SVG markup (no curves)", () => {
  const s = iceStrikeCage();
  assert.match(s, /<svg[\s>]/, "is an svg");
  assert.ok(/polyline|line|polygon/.test(s), "uses straight primitives");
  assert.ok(!/<(path|circle|ellipse)\b/.test(s), "no curved primitives (no-curves principle)");
});

test("detectionPolygonSegments returns `sides` segments forming a closed ring", () => {
  const segs = detectionPolygonSegments(12, 30);
  assert.equal(segs.length, 12);
  // each segment connects to the next (chain closes)
  for (let i = 0; i < segs.length; i++) {
    const next = segs[(i + 1) % segs.length];
    assert.ok(Math.hypot(segs[i].x2 - next.x1, segs[i].y2 - next.y1) < 1e-6,
      `segment ${i} end meets segment ${i + 1} start`);
  }
});

test("detectionPolygonSegments vertices sit on radius r about the origin", () => {
  const r = 30;
  for (const s of detectionPolygonSegments(12, r)) {
    assert.ok(Math.abs(Math.hypot(s.x1, s.y1) - r) < 1e-6, "vertex on radius");
  }
});

test("detectionPolygonSegments ordering is counter-clockwise from the top", () => {
  const segs = detectionPolygonSegments(12, 30);
  // first vertex at top (0,-r); next vertex moves to -x (screen CCW)
  assert.ok(Math.abs(segs[0].x1) < 1e-6 && segs[0].y1 < 0, "starts at top");
  assert.ok(segs[0].x2 < 0, "proceeds counter-clockwise (toward -x)");
});
