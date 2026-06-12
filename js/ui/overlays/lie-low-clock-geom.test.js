import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ledOpacity, handAngles, LED_OFF, LED_ON, TOP, SPIN_RPS } from "./lie-low-clock-geom.js";

describe("lie-low clock geom — ledOpacity (chunky, one edge at a time)", () => {
  const S = 12;

  test("an edge is dim (OFF) until progress reaches its slot", () => {
    assert.equal(ledOpacity(0, 0, S), LED_OFF);
    assert.equal(ledOpacity(0.4, 11, S), LED_OFF, "edge 11 not reached at 40% progress");
    // edge 5's slot starts at 5/12 ≈ 0.4167 — still dim just before it
    assert.equal(ledOpacity(0.41, 5, S), LED_OFF);
  });

  test("an edge fades to fully lit (ON) once progress passes its fade window", () => {
    // edge 0 slot is [0, 1/12); fade window = (1/12)*0.35. Past it → ON.
    assert.equal(ledOpacity(0.05, 0, S), LED_ON);
    assert.equal(ledOpacity(1, 11, S), LED_ON, "last edge lit at full progress");
  });

  test("opacity is whole-edge: a function of progress + index only, not position along the edge", () => {
    // (ledOpacity takes no along-edge parameter — the whole edge shares one opacity.)
    const op = ledOpacity(0.5, 6, S);
    assert.ok(op >= LED_OFF && op <= LED_ON);
  });

  test("edges light strictly in clockwise index order", () => {
    const p = 0.3; // ~3.6 edges in
    let prevLit = true;
    for (let i = 0; i < S; i++) {
      const lit = ledOpacity(p, i, S) > LED_OFF;
      if (!lit) prevLit = false;
      if (lit) assert.ok(prevLit, `edge ${i} lit only if all earlier edges are`);
    }
  });
});

describe("lie-low clock geom — handAngles (fast-forward spin)", () => {
  test("both hands start at 12 o'clock", () => {
    const { hour, minute } = handAngles(0);
    assert.equal(hour, TOP);
    assert.equal(minute, TOP);
  });

  test("minute hand completes one revolution per 1/rps seconds", () => {
    const { minute } = handAngles(1 / SPIN_RPS);
    assert.ok(Math.abs(minute - (TOP + 2 * Math.PI)) < 1e-9);
  });

  test("hour hand sweeps 12x slower than the minute hand", () => {
    const { hour, minute } = handAngles(3.7);
    assert.ok(Math.abs((minute - TOP) - 12 * (hour - TOP)) < 1e-9);
  });
});
