import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GENERIC_PROCESS_SEGMENTS,
  GENERIC_PROCESS_GAP_FRAC,
  generateProcessRing,
} from "../js/ui/generic-process-glyph.js";

const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

test("GENERIC_PROCESS_SEGMENTS is 12, GENERIC_PROCESS_GAP_FRAC is 0.18", () => {
  assert.equal(GENERIC_PROCESS_SEGMENTS, 12);
  assert.equal(GENERIC_PROCESS_GAP_FRAC, 0.18);
});

test("progress 0 lights no edges", () => {
  const { edges, litCount } = generateProcessRing(0, 12);
  assert.equal(litCount, 0);
  assert.ok(edges.every((e) => e.lit === false));
});

test("progress 0.5 with 12 segments lights 6 edges", () => {
  const { edges, litCount } = generateProcessRing(0.5, 12);
  assert.equal(litCount, 6);
  assert.equal(edges.filter((e) => e.lit).length, 6);
});

test("progress 1 lights all 12 edges", () => {
  const { edges, litCount } = generateProcessRing(1, 12);
  assert.equal(litCount, 12);
  assert.ok(edges.every((e) => e.lit === true));
});

test("edges is always `segments` long, indexed 0..segments-1", () => {
  const { edges } = generateProcessRing(0.3, 12);
  assert.equal(edges.length, 12);
  edges.forEach((e, i) => assert.equal(e.index, i));
});

test("lit edges advance clockwise starting from the top (index 0 is 12 o'clock)", () => {
  // At progress just past the 5th slot (5/12), edges 0..4 should be lit, 5..11 not yet.
  const { edges } = generateProcessRing(5 / 12 + 0.01, 12);
  for (let i = 0; i < 5; i++) assert.equal(edges[i].lit, true, `edge ${i} should be lit`);
  for (let i = 5; i < 12; i++) assert.equal(edges[i].lit, false, `edge ${i} should not be lit yet`);

  // Edge 0 is centered at 12 o'clock: (x1+x2)/2, (y1+y2)/2 points straight up (x~0, y<0).
  const e0 = edges[0];
  assert.ok(near((e0.x1 + e0.x2) / 2, 0, 1e-3), "edge 0 midpoint x ~ 0 (top)");
  assert.ok((e0.y1 + e0.y2) / 2 < 0, "edge 0 midpoint y is negative (above center)");

  // Edge 1 (the next clockwise slot) should sit to the right and below edge 0's midpoint,
  // matching facet.js's established clockwise convention (next vertex is right-of and below top).
  const e1 = edges[1];
  const mid0y = (e0.y1 + e0.y2) / 2;
  const mid1x = (e1.x1 + e1.x2) / 2;
  const mid1y = (e1.y1 + e1.y2) / 2;
  assert.ok(mid1x > 0, "edge 1 midpoint is to the right of edge 0");
  assert.ok(mid1y > mid0y, "edge 1 midpoint is below (clockwise from) edge 0");
});

test("leading edge index is floor(progress * segments)", () => {
  assert.equal(generateProcessRing(0, 12).leadingIndex, 0);
  assert.equal(generateProcessRing(0.5, 12).leadingIndex, Math.floor(0.5 * 12));
  assert.equal(generateProcessRing(0.5, 12).leadingIndex, 6);
  assert.equal(generateProcessRing(0.3, 12).leadingIndex, Math.floor(0.3 * 12));
  assert.equal(generateProcessRing(0.7, 12).leadingIndex, Math.floor(0.7 * 12));
});

test("leading edge index is null once progress reaches 1 (nothing left to fill)", () => {
  assert.equal(generateProcessRing(1, 12).leadingIndex, null);
});

test("the `leading` flag on an edge matches leadingIndex", () => {
  const { edges, leadingIndex } = generateProcessRing(0.3, 12);
  edges.forEach((e) => assert.equal(e.leading, e.index === leadingIndex));
});

test("out-of-range progress is clamped (negative -> 0, >1 -> 1)", () => {
  assert.equal(generateProcessRing(-0.5, 12).litCount, 0);
  assert.equal(generateProcessRing(1.5, 12).litCount, 12);
});

test("non-finite progress is treated as 0", () => {
  assert.equal(generateProcessRing(NaN, 12).litCount, 0);
});

test("gap fraction shortens each drawn edge symmetrically around its center", () => {
  // 4 segments, radius 1, no rotation: edge 0 is centered at 12 o'clock (angle -90deg).
  // With gapFrac 0, adjacent edges touch (chord length = 2*sin(45deg) = sqrt(2)).
  // With gapFrac 0.2, edge 0's half-angle shrinks from 45deg to 36deg (chord = 2*sin(36deg)).
  const noGap = generateProcessRing(1, 4, 0, 0, 1);
  const withGap = generateProcessRing(1, 4, 0.2, 0, 1);
  const chordLen = (e) => Math.hypot(e.x2 - e.x1, e.y2 - e.y1);

  assert.ok(near(chordLen(noGap.edges[0]), Math.SQRT2, 1e-6), "gapFrac 0 chord is the full sqrt(2) span");
  assert.ok(near(chordLen(withGap.edges[0]), 2 * Math.sin(36 * Math.PI / 180), 1e-6), "gapFrac 0.2 chord matches the shrunk half-angle");
  assert.ok(chordLen(withGap.edges[0]) < chordLen(noGap.edges[0]), "a bigger gap yields a shorter drawn edge");

  // Symmetry: the gap removed from each end is equal, so the endpoints' angles straddle the
  // segment's center angle (-90deg) evenly — check via atan2 that ang1 and -90deg are as far
  // apart as ang2 and -90deg.
  const e = withGap.edges[0];
  const ang1 = Math.atan2(e.y1, e.x1);
  const ang2 = Math.atan2(e.y2, e.x2);
  const center = -Math.PI / 2;
  assert.ok(near(Math.abs(ang1 - center), Math.abs(ang2 - center), 1e-6), "endpoints are equidistant (in angle) from the segment center");
});

test("exact vertex coordinates for a known small case (4 segments, no gap, no rotation, unit radius)", () => {
  // segments=4 -> step = 90deg, half = 45deg (gapFrac 0). Edge i is centered at
  // -90deg + i*90deg (top, right, bottom, left), spanning +/-45deg around that center.
  const SQRT2_2 = Math.SQRT1_2; // 0.7071067811865476
  const { edges } = generateProcessRing(1, 4, 0, 0, 1);

  // Edge 0: centered at top (-90deg), spans -135deg..-45deg.
  assert.ok(near(edges[0].x1, -SQRT2_2) && near(edges[0].y1, -SQRT2_2), "edge0 p1 at -135deg");
  assert.ok(near(edges[0].x2, SQRT2_2) && near(edges[0].y2, -SQRT2_2), "edge0 p2 at -45deg");

  // Edge 1: centered at right (0deg), spans -45deg..45deg — its first point coincides with
  // edge 0's second point (gapFrac 0, so adjacent edges touch).
  assert.ok(near(edges[1].x1, SQRT2_2) && near(edges[1].y1, -SQRT2_2), "edge1 p1 at -45deg");
  assert.ok(near(edges[1].x2, SQRT2_2) && near(edges[1].y2, SQRT2_2), "edge1 p2 at 45deg");

  // Edge 2: centered at bottom (90deg), spans 45deg..135deg.
  assert.ok(near(edges[2].x1, SQRT2_2) && near(edges[2].y1, SQRT2_2), "edge2 p1 at 45deg");
  assert.ok(near(edges[2].x2, -SQRT2_2) && near(edges[2].y2, SQRT2_2), "edge2 p2 at 135deg");

  // Edge 3: centered at left (180deg), spans 135deg..225deg.
  assert.ok(near(edges[3].x1, -SQRT2_2) && near(edges[3].y1, SQRT2_2), "edge3 p1 at 135deg");
  assert.ok(near(edges[3].x2, -SQRT2_2) && near(edges[3].y2, -SQRT2_2), "edge3 p2 at 225deg");
});

test("rotationRad rotates every edge by the same offset (idle spin)", () => {
  const base = generateProcessRing(1, 4, 0, 0, 1).edges[0];
  const rotated = generateProcessRing(1, 4, 0, Math.PI / 2, 1).edges[0]; // rotate 90deg CW
  // Rotating the whole ring 90deg CW moves edge 0's span to where edge 1 was.
  const unrotatedEdge1 = generateProcessRing(1, 4, 0, 0, 1).edges[1];
  assert.ok(near(rotated.x1, unrotatedEdge1.x1, 1e-6) && near(rotated.y1, unrotatedEdge1.y1, 1e-6));
  assert.ok(near(rotated.x2, unrotatedEdge1.x2, 1e-6) && near(rotated.y2, unrotatedEdge1.y2, 1e-6));
});

test("radius scales the geometry linearly", () => {
  const unit = generateProcessRing(1, 4, 0, 0, 1).edges[0];
  const scaled = generateProcessRing(1, 4, 0, 0, 10).edges[0];
  assert.ok(near(scaled.x1, unit.x1 * 10, 1e-6));
  assert.ok(near(scaled.y1, unit.y1 * 10, 1e-6));
});
