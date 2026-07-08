// @ts-check
// Guard tests for the live coherence-instrument overlay.
//
// The overlay is DOM/cy-guarded so it is a safe no-op headless, and its rAF draw
// loop must run ONLY during a burn (never idle). Without a Cytoscape instance
// (getCy() === null in node) startInstrument bails before any loop starts — so
// these tests assert the perf-critical invariant: the loop is never running when
// there is no live graph, and start/step/crack/stop are safe no-ops.
//
// The with-cy running/teardown path (loop starts on start, cancelAnimationFrame
// on stop) is exercised manually in the browser + preview harness (see
// port-b-report.md). Stubbing a full Cytoscape instance in node would be a fake
// integration; the headless invariant below is the honest, load-bearing one.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  startInstrument,
  stepInstrument,
  crackInstrument,
  stopInstrument,
  mountInstrumentOverlay,
  isInstrumentRunning,
} from "../js/ui/combat-instrument-overlay.js";

test("idle: instrument rAF loop is not running", () => {
  assert.equal(isInstrumentRunning(), false);
});

test("headless (no DOM / no cy): mount + full burn lifecycle is a safe no-op", () => {
  // No document/cy in node → every entry point must guard and stay idle.
  assert.doesNotThrow(() => mountInstrumentOverlay());
  assert.doesNotThrow(() => startInstrument("some-node", "C"));
  // Loop must NOT have started without a live graph.
  assert.equal(isInstrumentRunning(), false);
  assert.doesNotThrow(() => stepInstrument({ chip: 12, rarity: "rare", disclosed: true, roundId: "abcd" }));
  assert.doesNotThrow(() => crackInstrument());
  assert.doesNotThrow(() => stopInstrument());
  assert.equal(isInstrumentRunning(), false);
});
