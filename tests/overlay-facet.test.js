import { test } from "node:test";
import assert from "node:assert/strict";
import { FACET_SIDES, facetVertices, ringPoints, arcPoints } from "../js/ui/overlays/facet.js";

const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

test("FACET_SIDES is 12", () => assert.equal(FACET_SIDES, 12));

test("facetVertices returns `sides` points, first at 12 o'clock", () => {
  const v = facetVertices(50, 50, 10);
  assert.equal(v.length, 12);
  assert.ok(near(v[0].x, 50) && near(v[0].y, 40), "first vertex is top (cx, cy-r)");
  for (const p of v) assert.ok(near(Math.hypot(p.x - 50, p.y - 50), 10), "all on radius");
});

test("facetVertices second vertex steps clockwise (toward +x, +y)", () => {
  const v = facetVertices(0, 0, 10);
  assert.ok(v[1].x > 0 && v[1].y > v[0].y, "clockwise: next vertex is right of and below the top");
});

test("ringPoints returns `sides` 'x,y' pairs", () => {
  const s = ringPoints(0, 0, 10);
  assert.equal(s.trim().split(/\s+/).length, 12);
});

test("arcPoints empty at progress<=0", () => {
  assert.equal(arcPoints(0, 0, 10, 0), "");
  assert.equal(arcPoints(0, 0, 10, -0.5), "");
});

test("arcPoints clockwise half-turn ends near 6 o'clock", () => {
  const pts = arcPoints(0, 0, 10, 0.5, 1).trim().split(/\s+/).map(s => s.split(",").map(Number));
  const last = pts[pts.length - 1];
  assert.ok(near(last[0], 0, 1e-3) && near(last[1], 10, 1e-3), "ends at (0, +r)");
});

test("arcPoints counter-clockwise half-turn also ends near 6 o'clock but via the left", () => {
  const pts = arcPoints(0, 0, 10, 0.5, -1).trim().split(/\s+/).map(s => s.split(",").map(Number));
  const last = pts[pts.length - 1];
  assert.ok(near(last[0], 0, 1e-3) && near(last[1], 10, 1e-3), "ends at (0, +r)");
  // a midpoint should be on the left (negative x) for CCW
  const mid = pts[Math.floor(pts.length / 2)];
  assert.ok(mid[0] <= 1e-6, "CCW sweep passes through negative x (left side)");
});

test("arcPoints point count grows with progress", () => {
  const n = p => arcPoints(0, 0, 10, p, 1).trim().split(/\s+/).length;
  assert.ok(n(0.25) < n(0.6) && n(0.6) < n(0.95));
});

test("arcPoints at progress>=1 is the full closed ring (sides points)", () => {
  assert.equal(arcPoints(0, 0, 10, 1, 1).trim().split(/\s+/).length, 12);
});
