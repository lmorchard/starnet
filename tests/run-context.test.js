// @ts-check
// RunContext lifecycle tests — a new run must begin from a clean slate, and the
// per-run core (state + timers + graph) must round-trip through save/load.
//
// SEED CONVENTION: every initGame() passes an explicit seed string (see
// tests/integration.test.js) so unforced RNG rolls are deterministic.

import { test } from "node:test";
import assert from "node:assert/strict";

import { initGame, getState, mutate, serializeState, deserializeState, endRun } from "../js/core/state.js";
import { scheduleRepeating, scheduleEvent, serializeTimers, deserializeTimers, TIMER } from "../js/core/timers.js";
import { setActiveRun } from "../js/core/run-context.js";
import { buildNetwork as buildGenerated } from "../data/networks/generated.js";

/** A buildNetworkFn for initGame, seeded for determinism. */
function net(seed) {
  return () => buildGenerated({ seed, spec: { threat: "C", wealth: "B", complexity: "C", depth: "C" } });
}

const traceTickCount = () =>
  serializeTimers().entries.filter((e) => e.type === TIMER.TRACE_TICK).length;

test("starting a new run does not inherit the previous run's timers", () => {
  // Run A: start a run and schedule a repeating trace-tick (as a live trace would).
  initGame(net("run-a"), "run-a");
  scheduleRepeating(TIMER.TRACE_TICK, 1000);
  assert.equal(traceTickCount(), 1, "run A should have its trace-tick timer");

  // Run B: start a new run WITHOUT ending run A (no endRun / clearAllTimers).
  initGame(net("run-b"), "run-b");

  // The orphan must NOT survive into run B.
  assert.equal(traceTickCount(), 0, "run B must start with no orphaned trace-tick timer");
});

test("a fresh run starts from a clean slate", () => {
  initGame(net("clean-a"), "clean-a");
  scheduleRepeating(TIMER.TRACE_TICK, 1000);
  endRun("success");           // leaves the dying context with stale-ish state
  initGame(net("clean-b"), "clean-b");

  const s = getState();
  assert.equal(s.globalAlert, "green");
  assert.equal(s.traceSecondsRemaining, null);
  assert.equal(s.phase, "playing");

  const t = serializeTimers();
  assert.equal(t.entries.filter((e) => e.type === TIMER.TRACE_TICK).length, 0);
  assert.equal(t.nextId, 1, "nextId resets with a fresh context");
});

test("run-only timer functions fail fast with a clear error when no run is active", () => {
  // Simulate the no-active-run state (e.g. overworld / before any run).
  setActiveRun(null);
  const wantsRun = /requires an active run/;

  // These four are only meaningful during a run; calling them with no active
  // run is a lifecycle bug and must throw a descriptive error, not a cryptic
  // "cannot read 'timers' of null" TypeError.
  assert.throws(() => scheduleEvent(TIMER.ICE_MOVE, 1000), wantsRun);
  assert.throws(() => scheduleRepeating(TIMER.TRACE_TICK, 1000), wantsRun);
  assert.throws(() => serializeTimers(), wantsRun);
  assert.throws(() => deserializeTimers({ currentTick: 0, nextId: 1, entries: [] }), wantsRun);
  // Same convention in state/index.js: state-mutating + serialize paths require a run.
  assert.throws(() => mutate((s) => { s.phase = "playing"; }), wantsRun);
  assert.throws(() => serializeState(), wantsRun);

  // Restore an active run so later tests aren't affected by the null swap.
  initGame(net("after-guard"), "after-guard");
});

test("save/load round-trips the per-run core", () => {
  initGame(net("rt"), "rt");
  scheduleEvent(TIMER.ICE_MOVE, 2000);
  const snap = serializeState();

  // Swap in a different run, then restore — the restored run must match the snapshot.
  initGame(net("other"), "other");
  deserializeState(snap);
  const after = serializeState();

  assert.equal(after.seed, snap.seed);
  assert.equal(after._timers.entries.length, snap._timers.entries.length);
  assert.deepEqual(
    after._timers.entries.map((e) => e.type),
    snap._timers.entries.map((e) => e.type),
  );
});
