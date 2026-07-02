// @ts-check
// Phase 1 (#187): declarable `timed` block on a node-graph ActionDef synthesizes the
// existing `timed-action` operator (operators.js) at node construction, rather than
// hand-authoring the operator + "arm" effects per action (as the `encrypted` trait's
// dump action does manually today). Dispatching a `timed` action arms it (flips the
// active flag, zeroes progress, seeds a flat duration); the operator ticks progress and
// fires the action's *original* effects as onComplete.
//
// Uses the same bare-NodeGraph + mockCtx pattern as js/core/node-graph/timed-action.test.js
// (the sibling test for the operator itself) rather than the full game-state harness —
// this is pure node-graph runtime behavior, no game state layer involved.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { NodeGraph } from "../js/core/node-graph/runtime.js";
import { mockCtx } from "../js/core/node-graph/ctx.js";
import { timedActiveAttr, getTimedActionAttrNames } from "../js/core/node-graph/timed-actions.js";

/**
 * A single node carrying one inline action with a `timed` block: fixed duration of 5
 * ticks, onComplete effect sets `done` on the node itself.
 * @param {object} [overrides]
 */
function makeTimedActionNode(overrides = {}) {
  return {
    id: "test-node",
    type: "test",
    attributes: { label: "test-node", visibility: "accessible", done: false },
    actions: [
      {
        id: "test-act",
        label: "TEST",
        requires: [],
        timed: { duration: 5 },
        effects: [{ effect: "set-attr", attr: "done", value: true }],
      },
    ],
    ...overrides,
  };
}

describe("timed-action synthesis (#187)", () => {
  it("synthesizes a timed-action operator and arms the action's own effects at construction", () => {
    const graph = new NodeGraph({ nodes: [makeTimedActionNode()], edges: [] }, mockCtx());
    const node = /** @type {any} */ (graph)._nodes.get("test-node");

    const activeAttr = timedActiveAttr("test-act");
    const { progressAttr, durationAttr } = getTimedActionAttrNames("test-act");

    const op = node.operators.find((/** @type {any} */ o) => o.name === "timed-action" && o.action === "test-act");
    assert.ok(op, "expected a synthesized timed-action operator for test-act");
    assert.equal(op.activeAttr, activeAttr);
    assert.deepStrictEqual(op.onComplete, [{ effect: "set-attr", attr: "done", value: true }]);

    const action = node.actions.find((/** @type {any} */ a) => a.id === "test-act");
    assert.ok(action, "expected the test-act action to still be present after synthesis");
    assert.deepStrictEqual(action.effects, [
      { effect: "set-attr", attr: activeAttr, value: true },
      { effect: "set-attr", attr: progressAttr, value: 0 },
      { effect: "set-attr", attr: durationAttr, value: 5 },
    ]);
  });

  it("is idempotent — synthesizing twice does not double the operator or re-wrap effects", () => {
    const nodeDef = makeTimedActionNode();
    // Constructing two graphs from the *same* node-def object simulates the shared-object
    // risk with trait-supplied actions (a trait's ActionDef instance is reused, by
    // reference, across every node that composes that trait).
    new NodeGraph({ nodes: [nodeDef], edges: [] }, mockCtx());
    const graph2 = new NodeGraph({ nodes: [nodeDef], edges: [] }, mockCtx());
    const node = /** @type {any} */ (graph2)._nodes.get("test-node");

    const timedOps = node.operators.filter((/** @type {any} */ o) => o.name === "timed-action" && o.action === "test-act");
    assert.equal(timedOps.length, 1, "expected exactly one synthesized operator, not one per construction");
  });

  it("dispatching the action arms it instead of running effects immediately, then completes on tick", () => {
    const ctx = mockCtx();
    /** @type {{type: string, payload: any}[]} */
    const events = [];
    const graph = new NodeGraph(
      { nodes: [makeTimedActionNode()], edges: [] },
      ctx,
      (type, payload) => events.push({ type, payload }),
    );

    graph.executeAction("test-node", "test-act");
    assert.equal(graph.getNodeState("test-node").done, false, "effects should not run immediately on dispatch");
    assert.equal(
      graph.getNodeState("test-node")[timedActiveAttr("test-act")],
      true,
      "arm flag should be set immediately",
    );

    graph.tick(5); // flat duration:5 — no grade-table "set duration" tick needed, ticks straight to completion

    assert.equal(graph.getNodeState("test-node").done, true, "onComplete effects should fire once duration elapses");
    assert.equal(
      graph.getNodeState("test-node")[timedActiveAttr("test-act")],
      false,
      "arm flag should clear on completion",
    );

    const completes = events.filter(
      (e) => e.type === "action-feedback" && e.payload.phase === "complete" && e.payload.action === "test-act",
    );
    assert.equal(completes.length, 1, "expected exactly one complete action-feedback event for test-act");
  });
});
