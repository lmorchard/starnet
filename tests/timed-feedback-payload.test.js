// @ts-check
// #187 Phase 3: an ActionDef's inline `feedback` ({ overlay?, drone?, completionCue? }) is
// threaded through synthesis (timed-synthesis.js copies it onto the synthesized timed-action
// operator's config) and echoed on the operator's "start" ACTION_FEEDBACK payload (operators.js),
// so overlay dispatch and the Strudel audio module can layer it over the central/DEFAULT profile.
// Additive payload field only — the "complete"/"progress"/"cancel" payloads are untouched.
//
// Same bare-NodeGraph + mockCtx harness as tests/timed-synthesis.test.js.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { NodeGraph } from "../js/core/node-graph/runtime.js";
import { mockCtx } from "../js/core/node-graph/ctx.js";

// A grade-table duration (not a flat `duration`) is required to observe the "start"
// ACTION_FEEDBACK phase: the timed-action operator only emits "start" on the first tick after
// arming when it still has to resolve the duration from `durationTable` (operators.js). A flat
// `duration` is seeded directly by the arm effects, so the first tick already has a non-zero
// duration and goes straight to "progress" — see tests/timed-synthesis.test.js, which only
// asserts "complete" for that flat-duration case.
function makeTimedActionNode(feedback) {
  return {
    id: "test-node",
    type: "test",
    attributes: { label: "test-node", grade: "D", visibility: "accessible", done: false },
    actions: [
      {
        id: "test-act",
        label: "TEST",
        requires: [],
        timed: { durationTable: { D: 5 } },
        feedback,
        effects: [{ effect: "set-attr", attr: "done", value: true }],
      },
    ],
  };
}

describe("timed-action feedback payload threading (#187 Phase 3)", () => {
  it("echoes the ActionDef's inline feedback on the 'start' ACTION_FEEDBACK payload", () => {
    /** @type {{type: string, payload: any}[]} */
    const events = [];
    const graph = new NodeGraph(
      { nodes: [makeTimedActionNode({ overlay: "x" })], edges: [] },
      mockCtx(),
      (type, payload) => events.push({ type, payload }),
    );

    graph.executeAction("test-node", "test-act");
    graph.tick(1);

    const starts = events.filter((e) => e.type === "action-feedback" && e.payload.phase === "start");
    assert.equal(starts.length, 1);
    assert.equal(starts[0].payload.feedback?.overlay, "x");
  });

  it("omits `feedback` from the start payload when the ActionDef declares none", () => {
    /** @type {{type: string, payload: any}[]} */
    const events = [];
    const graph = new NodeGraph(
      { nodes: [makeTimedActionNode(undefined)], edges: [] },
      mockCtx(),
      (type, payload) => events.push({ type, payload }),
    );

    graph.executeAction("test-node", "test-act");
    graph.tick(1);

    const starts = events.filter((e) => e.type === "action-feedback" && e.payload.phase === "start");
    assert.equal(starts.length, 1);
    assert.equal("feedback" in starts[0].payload, false);
  });

  it("does not add `feedback` to the 'complete' payload (only 'start' threads it)", () => {
    /** @type {{type: string, payload: any}[]} */
    const events = [];
    const graph = new NodeGraph(
      { nodes: [makeTimedActionNode({ overlay: "x" })], edges: [] },
      mockCtx(),
      (type, payload) => events.push({ type, payload }),
    );

    graph.executeAction("test-node", "test-act");
    graph.tick(6); // 1 tick to resolve duration from the grade table + 5 progress ticks to complete

    const completes = events.filter((e) => e.type === "action-feedback" && e.payload.phase === "complete");
    assert.equal(completes.length, 1);
    assert.equal("feedback" in completes[0].payload, false);
  });
});
