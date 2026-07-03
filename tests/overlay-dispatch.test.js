import { test } from "node:test";
import assert from "node:assert/strict";
import { dispatchActionFeedback } from "../js/ui/overlays/dispatch.js";
import { resolveFeedback } from "../js/ui/feedback-profiles.js";
import { A } from "../js/core/action-ids.js";

// Fake overlay recording sync/clear calls.
function fakeOverlay() {
  return {
    syncs: [],
    clears: 0,
    sync(nodeId, progress) { this.syncs.push([nodeId, progress]); },
    clear() { this.clears++; },
  };
}

// #187 Phase 3: dispatch is name-keyed — byName maps a resolved overlay NAME (not an action id)
// to a mounted overlay. Use the real resolved names so these tests track the actual profile
// resolution instead of a parallel hardcoded mapping.
const PROBE_OVERLAY = resolveFeedback(A.PROBE).overlay;
const XPLOIT_OVERLAY = resolveFeedback(A.XPLOIT).overlay;

function setup() {
  const probe = fakeOverlay();
  const xploit = fakeOverlay();
  const byName = new Map([[PROBE_OVERLAY, probe], [XPLOIT_OVERLAY, xploit]]);
  const active = new Map();
  return { probe, xploit, byName, active };
}

test("start resolves and tracks the overlay name without syncing", () => {
  const { probe, byName, active } = setup();
  dispatchActionFeedback(byName, active, { nodeId: "n1", action: A.PROBE, phase: "start", progress: 0 });
  assert.deepEqual(active.get(A.PROBE), { nodeId: "n1", overlayName: PROBE_OVERLAY });
  assert.equal(probe.syncs.length, 0);
});

test("progress after start syncs the tracked node", () => {
  const { probe, byName, active } = setup();
  dispatchActionFeedback(byName, active, { nodeId: "n1", action: A.PROBE, phase: "start", progress: 0 });
  dispatchActionFeedback(byName, active, { nodeId: "n1", action: A.PROBE, phase: "progress", progress: 0.5 });
  assert.deepEqual(probe.syncs, [["n1", 0.5]]);
});

test("progress without a prior start does nothing", () => {
  const { probe, byName, active } = setup();
  dispatchActionFeedback(byName, active, { nodeId: "n1", action: A.PROBE, phase: "progress", progress: 0.5 });
  assert.equal(probe.syncs.length, 0);
});

test("complete clears the overlay and forgets the action", () => {
  const { probe, byName, active } = setup();
  dispatchActionFeedback(byName, active, { nodeId: "n1", action: A.PROBE, phase: "start", progress: 0 });
  dispatchActionFeedback(byName, active, { nodeId: "n1", action: A.PROBE, phase: "complete", progress: 1 });
  assert.equal(probe.clears, 1);
  assert.equal(active.has(A.PROBE), false);
});

test("cancel clears the overlay and forgets the action", () => {
  const { probe, byName, active } = setup();
  dispatchActionFeedback(byName, active, { nodeId: "n1", action: A.PROBE, phase: "start", progress: 0 });
  dispatchActionFeedback(byName, active, { nodeId: "n1", action: A.PROBE, phase: "cancel" });
  assert.equal(probe.clears, 1);
  assert.equal(active.has(A.PROBE), false);
});

test("unknown action is ignored (no throw)", () => {
  const { byName, active } = setup();
  assert.doesNotThrow(() =>
    dispatchActionFeedback(byName, active, { nodeId: "n1", action: A.JACKOUT, phase: "progress", progress: 0.5 }));
  assert.equal(active.size, 0);
});

test("XPLOIT progress fires the onXploitProgress hook; others don't", () => {
  const { byName, active } = setup();
  const calls = [];
  const hooks = { onXploitProgress: (p) => calls.push(p) };
  dispatchActionFeedback(byName, active, { nodeId: "x", action: A.XPLOIT, phase: "start", progress: 0 }, hooks);
  dispatchActionFeedback(byName, active, { nodeId: "x", action: A.XPLOIT, phase: "progress", progress: 0.7 }, hooks);
  dispatchActionFeedback(byName, active, { nodeId: "n1", action: A.PROBE, phase: "start", progress: 0 }, hooks);
  dispatchActionFeedback(byName, active, { nodeId: "n1", action: A.PROBE, phase: "progress", progress: 0.3 }, hooks);
  assert.deepEqual(calls, [0.7]);
});

// #187 Phase 3 — layered feedback resolution driving overlay dispatch.
test("an inline feedback.overlay override on 'start' picks the overridden overlay for the rest of the lifecycle", () => {
  const custom = fakeOverlay();
  const byName = new Map([[PROBE_OVERLAY, fakeOverlay()], ["custom-overlay", custom]]);
  const active = new Map();
  dispatchActionFeedback(byName, active, {
    nodeId: "n1", action: A.PROBE, phase: "start", progress: 0, feedback: { overlay: "custom-overlay" },
  });
  assert.deepEqual(active.get(A.PROBE), { nodeId: "n1", overlayName: "custom-overlay" });

  dispatchActionFeedback(byName, active, { nodeId: "n1", action: A.PROBE, phase: "progress", progress: 0.4 });
  assert.deepEqual(custom.syncs, [["n1", 0.4]]);

  dispatchActionFeedback(byName, active, { nodeId: "n1", action: A.PROBE, phase: "complete", progress: 1 });
  assert.equal(custom.clears, 1);
});

// #298 — pooled overlay dispatch: a pooled action's concurrent starts drive the manager for N nodes,
// while a non-pooled action still drives the byName singleton.
test("pooled action (probe) routes to manager; N concurrent nodes grow activeCount", () => {
  // A minimal manager stub tracking calls; activeCount returns remaining active count.
  const managerCalls = { starts: [], progresses: [], ends: [] };
  let activeNodeCount = 0;
  const manager = {
    handles: (name) => name === PROBE_OVERLAY,
    start: (name, nodeId) => { managerCalls.starts.push({ name, nodeId }); activeNodeCount++; },
    progress: (name, nodeId, p) => managerCalls.progresses.push({ name, nodeId, p }),
    end: (name, nodeId) => { managerCalls.ends.push({ name, nodeId }); activeNodeCount--; },
    activeCount: (_name) => activeNodeCount,
  };

  const probe = fakeOverlay();
  const byName = new Map([[PROBE_OVERLAY, probe]]);
  const active = new Map();
  const hooks = { manager };

  // Start 3 probes concurrently on 3 different nodes.
  dispatchActionFeedback(byName, active, { nodeId: "a", action: A.PROBE, phase: "start" }, hooks);
  dispatchActionFeedback(byName, active, { nodeId: "b", action: A.PROBE, phase: "start" }, hooks);
  dispatchActionFeedback(byName, active, { nodeId: "c", action: A.PROBE, phase: "start" }, hooks);

  assert.equal(managerCalls.starts.length, 3, "3 manager.start calls for 3 nodes");
  // Pooled entry is now stored in activeByAction with pooled:true so later phases reuse the name.
  assert.ok(active.has(A.PROBE), "pooled action stored in activeByAction (pooled:true)");
  assert.equal(active.get(A.PROBE)?.pooled, true, "stored entry has pooled:true");
  assert.equal(probe.syncs.length, 0, "singleton overlay not touched for pooled action");

  // Progress on b — uses the stored overlayName, not a re-resolve.
  dispatchActionFeedback(byName, active, { nodeId: "b", action: A.PROBE, phase: "progress", progress: 0.5 }, hooks);
  assert.equal(managerCalls.progresses.length, 1);
  assert.deepEqual(managerCalls.progresses[0], { name: PROBE_OVERLAY, nodeId: "b", p: 0.5 });

  // Complete on a — still 2 active after, so activeByAction entry is kept.
  dispatchActionFeedback(byName, active, { nodeId: "a", action: A.PROBE, phase: "complete" }, hooks);
  assert.equal(managerCalls.ends.length, 1);
  assert.deepEqual(managerCalls.ends[0], { name: PROBE_OVERLAY, nodeId: "a" });
  assert.ok(active.has(A.PROBE), "entry kept while other nodes still active");

  // Complete remaining 2 — entry removed when activeCount hits 0.
  dispatchActionFeedback(byName, active, { nodeId: "b", action: A.PROBE, phase: "complete" }, hooks);
  dispatchActionFeedback(byName, active, { nodeId: "c", action: A.PROBE, phase: "complete" }, hooks);
  assert.equal(active.has(A.PROBE), false, "entry removed once all nodes complete (activeCount=0)");
});

test("non-pooled action (xploit) still goes through byName singleton when manager present", () => {
  const manager = {
    handles: (name) => name === PROBE_OVERLAY, // only probe is pooled
    start: () => {},
    progress: () => {},
    end: () => {},
    activeCount: () => 0,
  };

  const xploit = fakeOverlay();
  const byName = new Map([[XPLOIT_OVERLAY, xploit]]);
  const active = new Map();
  const hooks = { manager };

  dispatchActionFeedback(byName, active, { nodeId: "x", action: A.XPLOIT, phase: "start" }, hooks);
  assert.ok(active.has(A.XPLOIT), "non-pooled action tracked in activeByAction");
  dispatchActionFeedback(byName, active, { nodeId: "x", action: A.XPLOIT, phase: "progress", progress: 0.6 }, hooks);
  assert.deepEqual(xploit.syncs, [["x", 0.6]], "singleton overlay synced for non-pooled action");
  dispatchActionFeedback(byName, active, { nodeId: "x", action: A.XPLOIT, phase: "complete" }, hooks);
  assert.equal(xploit.clears, 1, "singleton overlay cleared on complete");
  assert.equal(active.has(A.XPLOIT), false, "non-pooled action removed from activeByAction on complete");
});

// Safe-degrade: an action whose resolved overlay name has no registered element (e.g. an
// unmapped set-piece verb resolving to the Phase-4-pending "generic-process" default, or any
// other not-yet-built name) never throws across the whole start→progress→complete lifecycle.
test("an unregistered resolved overlay name degrades safely (no throw, no sync/clear calls)", () => {
  const byName = new Map(); // nothing registered
  const active = new Map();
  assert.doesNotThrow(() => {
    dispatchActionFeedback(byName, active, { nodeId: "n1", action: "crack-vault", phase: "start", progress: 0 });
    dispatchActionFeedback(byName, active, { nodeId: "n1", action: "crack-vault", phase: "progress", progress: 0.5 });
    dispatchActionFeedback(byName, active, { nodeId: "n1", action: "crack-vault", phase: "complete", progress: 1 });
  });
  assert.equal(active.has("crack-vault"), false, "complete should still forget the action even with no overlay element");
});

// #298 Fix 1 regression: pooled action with an inline feedback.overlay override on "start"
// must route progress/complete to the SAME (started) overlay name, not re-resolve (which
// would pick the default name and miss the started manager entry).
test("pooled action with inline feedback.overlay override routes later phases to the started name", () => {
  const customName = "custom-probe-overlay";
  const managerCalls = { starts: [], progresses: [], ends: [] };
  let activeNodeCount = 0;
  const manager = {
    // Manager handles both the default probe overlay AND the custom override name.
    handles: (name) => name === PROBE_OVERLAY || name === customName,
    start: (name, nodeId) => { managerCalls.starts.push({ name, nodeId }); activeNodeCount++; },
    progress: (name, nodeId, p) => managerCalls.progresses.push({ name, nodeId, p }),
    end: (name, nodeId) => { managerCalls.ends.push({ name, nodeId }); activeNodeCount--; },
    activeCount: (_name) => activeNodeCount,
  };

  const byName = new Map([[PROBE_OVERLAY, fakeOverlay()], [customName, fakeOverlay()]]);
  const active = new Map();
  const hooks = { manager };

  // Start probe with an inline feedback override → routes to customName.
  dispatchActionFeedback(byName, active, {
    nodeId: "n1", action: A.PROBE, phase: "start", feedback: { overlay: customName },
  }, hooks);
  assert.equal(managerCalls.starts.length, 1, "start called on manager");
  assert.deepEqual(managerCalls.starts[0], { name: customName, nodeId: "n1" }, "started with custom overlay name");
  assert.equal(active.get(A.PROBE)?.overlayName, customName, "stored overlayName is the custom name");
  assert.equal(active.get(A.PROBE)?.pooled, true, "stored entry is pooled");

  // Progress — must route to customName, NOT the default PROBE_OVERLAY (the regression this fixes).
  dispatchActionFeedback(byName, active, { nodeId: "n1", action: A.PROBE, phase: "progress", progress: 0.5 }, hooks);
  assert.equal(managerCalls.progresses.length, 1, "progress routed to manager");
  assert.deepEqual(managerCalls.progresses[0], { name: customName, nodeId: "n1", p: 0.5 },
    "progress uses the custom name from start, not a re-resolved default");

  // Complete — must route to customName.
  dispatchActionFeedback(byName, active, { nodeId: "n1", action: A.PROBE, phase: "complete" }, hooks);
  assert.equal(managerCalls.ends.length, 1, "end called on manager");
  assert.deepEqual(managerCalls.ends[0], { name: customName, nodeId: "n1" },
    "complete uses the custom name from start");
});
