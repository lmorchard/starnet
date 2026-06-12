// @ts-check
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { FrameStats, frameSparkline } from "./frame-stats.js";

describe("FrameStats", () => {
  test("60fps steady frames read as ~60", () => {
    const fs = new FrameStats(500);
    let rolled = false;
    for (let i = 0; i < 40; i++) rolled = fs.record(1000 / 60) || rolled;
    assert.ok(rolled, "window should roll over");
    assert.equal(fs.fps, 60);
  });

  test("30fps steady frames read as ~30", () => {
    const fs = new FrameStats(500);
    for (let i = 0; i < 40; i++) fs.record(1000 / 30);
    assert.equal(fs.fps, 30);
  });

  test("does not roll over before the window fills", () => {
    const fs = new FrameStats(500);
    assert.equal(fs.record(16), false);
    assert.equal(fs.fps, 0, "no reading published yet");
  });

  test("worstMs captures the slowest frame in the window", () => {
    const fs = new FrameStats(500);
    for (let i = 0; i < 20; i++) fs.record(16);
    fs.record(120); // one hitch
    while (!fs.record(16)) { /* fill the window */ }
    assert.ok(fs.worstMs >= 120, `worst ${fs.worstMs} should reflect the 120ms hitch`);
  });

  test("ignores non-finite and non-positive deltas", () => {
    const fs = new FrameStats(100);
    fs.record(NaN); fs.record(0); fs.record(-5);
    assert.equal(fs.fps, 0);
    assert.equal(fs.record(NaN), false);
  });

  test("resets cleanly between windows", () => {
    const fs = new FrameStats(500);
    for (let i = 0; i < 40; i++) fs.record(1000 / 60); // window 1 → 60
    for (let i = 0; i < 40; i++) fs.record(1000 / 20); // window 2 → 20
    assert.equal(fs.fps, 20);
  });
});

describe("frameSparkline", () => {
  const W = 90, H = 22, MAX = 50;

  test("empty history → no points", () => {
    assert.deepEqual(frameSparkline([], W, H, MAX), []);
  });

  test("x ascends, newest sample sits at x=width", () => {
    const pts = frameSparkline([16, 16, 16, 16], W, H, MAX);
    assert.ok(pts.every((p, i) => i === 0 || p.x >= pts[i - 1].x), "x ascending");
    assert.equal(pts[pts.length - 1].x, W);
  });

  test("a fast frame sits near the bottom, a slow frame spikes to the top, all in bounds", () => {
    const pts = frameSparkline([0, MAX, MAX * 2], W, H, MAX);
    assert.equal(pts[0].y, H, "0ms → bottom (y=height)");
    assert.equal(pts[1].y, 0, "full-scale → top (y=0)");
    assert.equal(pts[2].y, 0, "over-scale clamps to top");
    assert.ok(pts.every((p) => p.y >= 0 && p.y <= H), "within bounds");
  });

  test("a non-positive or non-finite maxMs falls back to a sane scale (finite, in-bounds coords)", () => {
    for (const bad of [0, -10, NaN, Infinity]) {
      const pts = frameSparkline([16, 33, 8], W, H, bad);
      assert.ok(
        pts.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
        `non-finite coords for maxMs=${bad}`,
      );
      assert.ok(
        pts.every((p) => p.y >= 0 && p.y <= H),
        `out-of-bounds y for maxMs=${bad}`,
      );
    }
  });
});
