import test from "node:test";
import assert from "node:assert/strict";
import { createStats, updatePeakAlert, finalizeStats, recordRoundFired, recordHeatGenerated } from "../scripts/bot/stats.js";

// Minimal GameState stub for finalizeStats (it reads nodes/player.cash/mission).
function stubState({ complete = false } = {}) {
  return {
    nodes: { a: { accessLevel: "owned", type: "router" }, b: { accessLevel: "locked", type: "router" } },
    player: { cash: 500 },
    mission: { complete },
  };
}

// Regression for the traceFired/peakAlert discrepancy (issue #114, WS3):
// global alert can escalate straight to "trace", but the census peakAlert stat
// ranked only green/yellow/red, so a trace-level raise was silently dropped to
// rank 0 — runs that fired trace reported peakAlert "green". The mechanic is
// correct; the stat undercounts. peakAlert must be able to record "trace".

test("updatePeakAlert records trace as the highest level", () => {
  const stats = createStats();
  updatePeakAlert(stats, "trace");
  assert.equal(stats.peakAlert, "trace");
});

test("trace outranks red and is not overwritten by a later lower level", () => {
  const stats = createStats();
  updatePeakAlert(stats, "red");
  updatePeakAlert(stats, "trace");
  assert.equal(stats.peakAlert, "trace");
  // Alert never de-escalates in-game; a stale lower raise must not lower the peak.
  updatePeakAlert(stats, "yellow");
  assert.equal(stats.peakAlert, "trace");
});

test("peakAlert and traceFired cannot contradict: if trace fired, peak is trace", () => {
  // Mirrors the loop.js wiring: ALERT_TRACE_STARTED sets traceFired, and the
  // accompanying ALERT_GLOBAL_RAISED{next:"trace"} feeds updatePeakAlert.
  const stats = createStats();
  stats.traceFired = true;
  updatePeakAlert(stats, "trace");
  assert.equal(stats.peakAlert, "trace");
});

// Loss attribution (issue #114): a bot that bails (jacks out) under trace
// pressure with an incomplete mission was tagged "stuck" — only the hard
// countdown-expiry "caught" path set "trace". Trace-pressure losses must be
// attributed to trace so census fail reasons honestly reflect pressure.

test("finalizeStats: incomplete run with traceFired is attributed to trace", () => {
  const stats = createStats();
  stats.traceFired = true; // trace fired during the run; bot jacked out short
  finalizeStats(stats, stubState({ complete: false }));
  assert.equal(stats.success, false);
  assert.equal(stats.failReason, "trace");
});

test("finalizeStats: incomplete run without trace stays stuck", () => {
  const stats = createStats();
  finalizeStats(stats, stubState({ complete: false }));
  assert.equal(stats.failReason, "stuck");
});

test("finalizeStats: tick-cap is not overridden by traceFired", () => {
  const stats = createStats();
  stats.failReason = "tick-cap";
  stats.traceFired = true;
  finalizeStats(stats, stubState({ complete: false }));
  assert.equal(stats.failReason, "tick-cap");
});

test("finalizeStats: completed mission is a success regardless of trace", () => {
  const stats = createStats();
  stats.traceFired = true;
  finalizeStats(stats, stubState({ complete: true }));
  assert.equal(stats.success, true);
  assert.equal(stats.failReason, null);
});

// Efficiency counters (gear-sensitivity signal)

test("createStats: roundsFired and heatGenerated start at zero", () => {
  const stats = createStats();
  assert.equal(stats.roundsFired, 0);
  assert.equal(stats.heatGenerated, 0);
});

test("recordRoundFired increments roundsFired", () => {
  const stats = createStats();
  recordRoundFired(stats);
  recordRoundFired(stats);
  assert.equal(stats.roundsFired, 2);
});

test("recordHeatGenerated accumulates positive amounts", () => {
  const stats = createStats();
  recordHeatGenerated(stats, 1.5);
  recordHeatGenerated(stats, 0.5);
  assert.equal(stats.heatGenerated, 2);
});

test("recordHeatGenerated ignores zero and negative amounts (cooldown events)", () => {
  const stats = createStats();
  recordHeatGenerated(stats, 3);
  recordHeatGenerated(stats, -1);  // heat decay / lie-low
  recordHeatGenerated(stats, 0);
  assert.equal(stats.heatGenerated, 3);
});
