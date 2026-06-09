import { test } from "node:test";
import assert from "node:assert/strict";
import { dispatchActionFeedback } from "../js/ui/overlays/dispatch.js";
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

function setup() {
  const probe = fakeOverlay();
  const xploit = fakeOverlay();
  const byAction = new Map([[A.PROBE, probe], [A.XPLOIT, xploit]]);
  const active = new Map();
  return { probe, xploit, byAction, active };
}

test("start tracks the node id without syncing", () => {
  const { probe, byAction, active } = setup();
  dispatchActionFeedback(byAction, active, { nodeId: "n1", action: A.PROBE, phase: "start", progress: 0 });
  assert.equal(active.get(A.PROBE), "n1");
  assert.equal(probe.syncs.length, 0);
});

test("progress after start syncs the tracked node", () => {
  const { probe, byAction, active } = setup();
  dispatchActionFeedback(byAction, active, { nodeId: "n1", action: A.PROBE, phase: "start", progress: 0 });
  dispatchActionFeedback(byAction, active, { nodeId: "n1", action: A.PROBE, phase: "progress", progress: 0.5 });
  assert.deepEqual(probe.syncs, [["n1", 0.5]]);
});

test("progress without a prior start does nothing", () => {
  const { probe, byAction, active } = setup();
  dispatchActionFeedback(byAction, active, { nodeId: "n1", action: A.PROBE, phase: "progress", progress: 0.5 });
  assert.equal(probe.syncs.length, 0);
});

test("complete clears the overlay and forgets the node", () => {
  const { probe, byAction, active } = setup();
  dispatchActionFeedback(byAction, active, { nodeId: "n1", action: A.PROBE, phase: "start", progress: 0 });
  dispatchActionFeedback(byAction, active, { nodeId: "n1", action: A.PROBE, phase: "complete", progress: 1 });
  assert.equal(probe.clears, 1);
  assert.equal(active.has(A.PROBE), false);
});

test("cancel clears the overlay and forgets the node", () => {
  const { probe, byAction, active } = setup();
  dispatchActionFeedback(byAction, active, { nodeId: "n1", action: A.PROBE, phase: "start", progress: 0 });
  dispatchActionFeedback(byAction, active, { nodeId: "n1", action: A.PROBE, phase: "cancel" });
  assert.equal(probe.clears, 1);
  assert.equal(active.has(A.PROBE), false);
});

test("unknown action is ignored (no throw)", () => {
  const { byAction, active } = setup();
  assert.doesNotThrow(() =>
    dispatchActionFeedback(byAction, active, { nodeId: "n1", action: A.JACKOUT, phase: "progress", progress: 0.5 }));
  assert.equal(active.size, 0);
});

test("XPLOIT progress fires the onXploitProgress hook; others don't", () => {
  const { byAction, active } = setup();
  const calls = [];
  const hooks = { onXploitProgress: (p) => calls.push(p) };
  dispatchActionFeedback(byAction, active, { nodeId: "x", action: A.XPLOIT, phase: "start", progress: 0 }, hooks);
  dispatchActionFeedback(byAction, active, { nodeId: "x", action: A.XPLOIT, phase: "progress", progress: 0.7 }, hooks);
  dispatchActionFeedback(byAction, active, { nodeId: "n1", action: A.PROBE, phase: "start", progress: 0 }, hooks);
  dispatchActionFeedback(byAction, active, { nodeId: "n1", action: A.PROBE, phase: "progress", progress: 0.3 }, hooks);
  assert.deepEqual(calls, [0.7]);
});
