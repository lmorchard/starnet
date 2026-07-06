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
import { dispatchActionFeedback } from "../js/ui/overlays/dispatch.js";
import { DEFAULT_SCRIPT_ACTION_DURATION } from "../js/core/node-graph/timed-synthesis.js";
import { A } from "../js/core/action-ids.js";

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

/**
 * A single node carrying one inline action with a `timed` block using a `durationTable`
 * (grade-scaled duration, resolved by the operator's own grade-table branch) instead of a
 * flat `duration`. Used to confirm the flat-duration "start" fix does not also fire for
 * this path, which already emits "start" from the grade-table branch.
 * @param {object} [overrides]
 */
function makeDurationTableActionNode(overrides = {}) {
  return {
    id: "test-node",
    type: "test",
    attributes: { label: "test-node", visibility: "accessible", grade: "D", done: false },
    actions: [
      {
        id: "table-act",
        label: "TABLE",
        requires: [],
        timed: { durationTable: { D: 4 } },
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

  it("synthesizes a timed-action operator for KICK (core verb with explicit timed block)", () => {
    const node = {
      id: "test-node",
      type: "test",
      attributes: { label: "test-node", visibility: "accessible" },
      actions: [
        {
          id: A.KICK,
          label: "KICK",
          requires: [],
          effects: [{ effect: "ctx-call", method: "ejectIce", args: ["$nodeId"] }],
          timed: { duration: 5 },
        },
      ],
    };
    const graph = new NodeGraph({ nodes: [node], edges: [] }, mockCtx());
    const state = /** @type {any} */ (graph)._nodes.get("test-node");

    const activeAttr = timedActiveAttr(A.KICK);
    const { progressAttr, durationAttr } = getTimedActionAttrNames(A.KICK);

    const op = state.operators.find((/** @type {any} */ o) => o.name === "timed-action" && o.action === A.KICK);
    assert.ok(op, "kick gets a timed-action operator despite being a core verb — an explicit timed block wins");
    assert.equal(op.emitStartOnArm, true, "flat duration → emitStartOnArm");
    assert.deepStrictEqual(op.onComplete, [{ effect: "ctx-call", method: "ejectIce", args: ["$nodeId"] }]);

    const action = state.actions.find((/** @type {any} */ a) => a.id === A.KICK);
    assert.deepStrictEqual(action.effects, [
      { effect: "set-attr", attr: activeAttr, value: true },
      { effect: "set-attr", attr: progressAttr, value: 0 },
      { effect: "set-attr", attr: durationAttr, value: 5 },
    ]);
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

// #187 review fix: a flat-`duration` synthesized action (e.g. the set-piece extract-key/
// crack-vault conversion in Phase 5) never emitted a "start" ACTION_FEEDBACK — its duration
// is seeded directly by the arm effects (see timed-synthesis.js), which bypasses the
// operator's grade-table first-tick branch, the only place "start" was emitted. Without
// "start", the overlay dispatcher (js/ui/overlays/dispatch.js) never records the action in
// `activeByAction`, so its "progress" events are silently dropped and no overlay animation
// ever mounts. Fixed by emitting "start" on the first counting tick for flat-duration
// actions, scoped via `emitStartOnArm` (set only by timed-synthesis.js's flat-duration path).
describe("flat-duration 'start' feedback (#187 review fix — flatstart bug)", () => {
  it("emits a 'start' action-feedback on the first tick for a flat duration (the regression)", () => {
    /** @type {{type: string, payload: any}[]} */
    const events = [];
    const graph = new NodeGraph(
      { nodes: [makeTimedActionNode()], edges: [] },
      mockCtx(),
      (type, payload) => events.push({ type, payload }),
    );

    graph.executeAction("test-node", "test-act");
    graph.tick(1);

    const starts = events.filter((e) => e.type === "action-feedback" && e.payload.phase === "start");
    assert.equal(starts.length, 1, "expected exactly one start action-feedback for the flat-duration action");
    assert.equal(starts[0].payload.action, "test-act");
    assert.equal(starts[0].payload.nodeId, "test-node");
    assert.equal(starts[0].payload.durationTicks, 5);

    // Tick 1 must still carry its own progress event alongside the new start event — the
    // fix must not swallow or delay the tick's regular output.
    const progresses = events.filter((e) => e.type === "action-feedback" && e.payload.phase === "progress");
    assert.equal(progresses.length, 1, "tick 1 should still emit its own progress event");
  });

  it("does not shift completion timing — still completes at exactly tick(duration), not duration+1", () => {
    /** @type {{type: string, payload: any}[]} */
    const events = [];
    const graph = new NodeGraph(
      { nodes: [makeTimedActionNode()], edges: [] },
      mockCtx(),
      (type, payload) => events.push({ type, payload }),
    );

    graph.executeAction("test-node", "test-act");
    graph.tick(4);
    assert.equal(graph.getNodeState("test-node").done, false, "not yet complete at tick 4 of a 5-tick duration");

    graph.tick(1); // the 5th tick — completes
    assert.equal(graph.getNodeState("test-node").done, true, "completes at exactly tick(5), no extra setup tick");

    const completes = events.filter((e) => e.type === "action-feedback" && e.payload.phase === "complete");
    assert.equal(completes.length, 1, "exactly one complete event, still at tick(duration)");
  });

  it("the emitted 'start' payload wires the overlay dispatcher — activeByAction is populated and the next progress is not dropped", () => {
    /** @type {{type: string, payload: any}[]} */
    const events = [];
    const graph = new NodeGraph(
      { nodes: [makeTimedActionNode()], edges: [] },
      mockCtx(),
      (type, payload) => events.push({ type, payload }),
    );

    graph.executeAction("test-node", "test-act");
    graph.tick(1);

    const start = events.find((e) => e.type === "action-feedback" && e.payload.phase === "start");
    assert.ok(start, "expected a start event to feed into the overlay dispatcher");

    const activeByAction = new Map();
    const byName = new Map(); // overlay resolution itself is out of scope here
    dispatchActionFeedback(byName, activeByAction, start.payload);
    assert.ok(activeByAction.has("test-act"), "overlay dispatcher should now track the flat-duration action");

    // A subsequent progress payload must no longer be dropped (dispatch.js:42 returns early
    // when the action isn't in activeByAction — that's the observable symptom of the bug).
    events.length = 0;
    graph.tick(1);
    const progress = events.find((e) => e.type === "action-feedback" && e.payload.phase === "progress");
    assert.ok(progress, "expected a progress event on the next tick");
    dispatchActionFeedback(byName, activeByAction, progress.payload);
    assert.ok(activeByAction.has("test-act"), "progress should not have been dropped as unrecorded");
  });

  it("a durationTable-synthesized action still emits exactly ONE 'start', from the grade-table branch, not doubled", () => {
    /** @type {{type: string, payload: any}[]} */
    const events = [];
    const graph = new NodeGraph(
      { nodes: [makeDurationTableActionNode()], edges: [] },
      mockCtx(),
      (type, payload) => events.push({ type, payload }),
    );

    const op = /** @type {any} */ (graph)._nodes.get("test-node").operators
      .find((/** @type {any} */ o) => o.name === "timed-action" && o.action === "table-act");
    assert.ok(op, "expected a synthesized timed-action operator for table-act");
    assert.equal(op.emitStartOnArm, undefined, "durationTable synthesis must not set emitStartOnArm");

    graph.executeAction("test-node", "table-act");
    graph.tick(1); // grade-table branch resolves duration + emits start (no progress yet)
    graph.tick(4); // all 4 progress ticks of the grade-D duration

    const starts = events.filter((e) => e.type === "action-feedback" && e.payload.phase === "start");
    assert.equal(starts.length, 1, "exactly one start event, from the grade-table branch only");
    assert.equal(graph.getNodeState("test-node").done, true, "still completes at the grade-table duration");
  });
});

// Timed-by-default flip (#187 default-flip): a script/set-piece action with NO explicit
// `timed` block is synthesized anyway, using DEFAULT_SCRIPT_ACTION_DURATION, as long as it
// isn't a core verb, isn't marked `instant`, and doesn't already have a hand-wired
// timed-action operator for its id.
describe("timed-by-default synthesis for script actions (#187 default-flip)", () => {
  it("a plain script action with no timed/instant block is synthesized with the default duration", () => {
    const node = {
      id: "test-node",
      type: "test",
      attributes: { label: "test-node", visibility: "accessible", pressed: false },
      actions: [
        {
          id: "press-button",
          label: "PRESS",
          requires: [],
          effects: [{ effect: "set-attr", attr: "pressed", value: true }],
        },
      ],
    };
    const graph = new NodeGraph({ nodes: [node], edges: [] }, mockCtx());
    const state = /** @type {any} */ (graph)._nodes.get("test-node");

    const activeAttr = timedActiveAttr("press-button");
    const { progressAttr, durationAttr } = getTimedActionAttrNames("press-button");

    const op = state.operators.find((/** @type {any} */ o) => o.name === "timed-action" && o.action === "press-button");
    assert.ok(op, "expected a synthesized timed-action operator for the default-timed script action");
    assert.equal(op.activeAttr, activeAttr);
    assert.equal(op.emitStartOnArm, true, "flat default duration should still emit start on arm");
    assert.deepStrictEqual(op.onComplete, [{ effect: "set-attr", attr: "pressed", value: true }]);

    const action = state.actions.find((/** @type {any} */ a) => a.id === "press-button");
    assert.deepStrictEqual(action.effects, [
      { effect: "set-attr", attr: activeAttr, value: true },
      { effect: "set-attr", attr: progressAttr, value: 0 },
      { effect: "set-attr", attr: durationAttr, value: DEFAULT_SCRIPT_ACTION_DURATION },
    ]);
  });

  it("an action marked instant:true is not synthesized, even though it's a script action", () => {
    const node = {
      id: "test-node",
      type: "test",
      attributes: { label: "test-node", visibility: "accessible", pressed: false },
      actions: [
        {
          id: "press-button",
          label: "PRESS",
          instant: true,
          requires: [],
          effects: [{ effect: "set-attr", attr: "pressed", value: true }],
        },
      ],
    };
    const graph = new NodeGraph({ nodes: [node], edges: [] }, mockCtx());
    const state = /** @type {any} */ (graph)._nodes.get("test-node");

    const op = state.operators.find((/** @type {any} */ o) => o.name === "timed-action" && o.action === "press-button");
    assert.equal(op, undefined, "instant:true script action must not be synthesized");

    const action = state.actions.find((/** @type {any} */ a) => a.id === "press-button");
    assert.deepStrictEqual(action.effects, [{ effect: "set-attr", attr: "pressed", value: true }], "instant action effects run immediately, unmodified");
  });

  it("a core verb id with no explicit timed block is not auto-synthesized here", () => {
    const node = {
      id: "test-node",
      type: "test",
      attributes: { label: "test-node", visibility: "accessible" },
      actions: [
        {
          id: A.DUMP,
          label: "DUMP",
          requires: [],
          effects: [{ effect: "set-attr", attr: "read", value: true }],
        },
      ],
    };
    const graph = new NodeGraph({ nodes: [node], edges: [] }, mockCtx());
    const state = /** @type {any} */ (graph)._nodes.get("test-node");

    const op = state.operators.find((/** @type {any} */ o) => o.name === "timed-action" && o.action === A.DUMP);
    assert.equal(op, undefined, "core verb without an explicit timed block is not auto-synthesized");

    const action = state.actions.find((/** @type {any} */ a) => a.id === A.DUMP);
    assert.deepStrictEqual(action.effects, [{ effect: "set-attr", attr: "read", value: true }], "core verb effects untouched");
  });

  it("does not double-wire when the node already has a hand-wired timed-action operator for that id", () => {
    const node = {
      id: "test-node",
      type: "test",
      attributes: { label: "test-node", visibility: "accessible", lyingLow: false },
      operators: [
        { name: "timed-action", action: "lie-low", activeAttr: "lyingLow", duration: 50, onComplete: [] },
      ],
      actions: [
        {
          id: "lie-low",
          label: "LIE LOW",
          requires: [],
          effects: [{ effect: "set-attr", attr: "lyingLow", value: true }],
        },
      ],
    };
    const graph = new NodeGraph({ nodes: [node], edges: [] }, mockCtx());
    const state = /** @type {any} */ (graph)._nodes.get("test-node");

    const timedOps = state.operators.filter((/** @type {any} */ o) => o.name === "timed-action" && o.action === "lie-low");
    assert.equal(timedOps.length, 1, "must not add a second timed-action operator for an id that already has one");

    const action = state.actions.find((/** @type {any} */ a) => a.id === "lie-low");
    assert.deepStrictEqual(action.effects, [{ effect: "set-attr", attr: "lyingLow", value: true }], "action effects left as-is when an operator already handles it");
  });
});
