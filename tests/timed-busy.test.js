// @ts-check
// Phase 2 (#187): unify "is this node busy?" into a single structural predicate —
// NodeGraph#isNodeBusy / the `no-active-timed-action` condition — that spans BOTH
// the enumerated core timed-action flags (probe/xploit/… via ABORTABLE_FLAGS) AND
// any synthesized `timed` action (declarative ActionDef.timed, Phase 1, #187), and
// composes with the separate #282 process-framework busy check (activeProcessOnNode)
// at the getAvailableActions layer (node-actions.js).
//
// Additive: ABORTABLE_FLAGS / TIMED_ACTIONS / the processes.js contract are untouched.
// NOT_BUSY keeps its enumerated flags and gains the structural check alongside them;
// ABORT keeps its enumerated any-of and gains the structural check alongside it too.

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

import { createGateway, createRouter } from "../js/core/node-graph/node-factories.js";
import { initGame, getState } from "../js/core/state.js";
import { emitEvent, on, off, E, clearHandlers } from "../js/core/events.js";
import { initNavigationCancelHandler } from "../js/core/node-graph/game-ctx.js";
import { A } from "../js/core/action-ids.js";
import { addProcess } from "../js/core/state/process.js";
import { registerProcess } from "../js/core/processes.js";
import { getAvailableActions } from "../js/core/actions/node-actions.js";
import { timedActiveAttr, getTimedActionAttrNames } from "../js/core/node-graph/timed-actions.js";

const BUSY_ACTION_ID = "busy-act";

/**
 * A router carrying its normal trait actions (PROBE, ABORT, …) PLUS one inline
 * declarative `timed` action — a synthesized timed-action operator with a
 * dynamically-named activeAttr (`_ta_active_busy-act`) that isn't (and can't be)
 * named in the enumerated ABORTABLE_FLAGS list.
 * @param {string} [id]
 */
function busyRouter(id = "router-a") {
  return {
    ...createRouter(id),
    actions: [
      {
        id: BUSY_ACTION_ID,
        label: "BUSY",
        requires: [],
        timed: { duration: 5 },
        effects: [{ effect: "set-attr", attr: "done", value: true }],
      },
    ],
  };
}

function buildBusyLAN() {
  return {
    graphDef: {
      nodes: [
        createGateway("gateway", { attributes: { visibility: "accessible" } }),
        busyRouter("router-a"),
      ],
      edges: [["gateway", "router-a"]],
      triggers: [],
    },
    meta: { startNode: "gateway", startCash: 0, moneyCost: "F" },
  };
}

describe("NodeGraph#isNodeBusy (#187 Phase 2)", () => {
  it("is false when idle and true once a synthesized timed action is armed", () => {
    initGame(() => buildBusyLAN(), "busy-isbusy");
    const graph = getState().nodeGraph;

    assert.equal(graph.isNodeBusy("router-a"), false, "idle before dispatch");
    graph.executeAction("router-a", BUSY_ACTION_ID);
    assert.equal(graph.isNodeBusy("router-a"), true, "busy once armed");
  });
});

describe("NOT_BUSY / ABORT structural check for a synthesized timed action (#187 Phase 2)", () => {
  it("blocks a second startable (NOT_BUSY-gated) action while the synthesized action runs", () => {
    initGame(() => buildBusyLAN(), "busy-notbusy");
    const graph = getState().nodeGraph;
    graph.executeAction("router-a", BUSY_ACTION_ID);

    const available = graph.getAvailableActions("router-a").map((a) => a.id);
    assert.ok(!available.includes(A.PROBE), "PROBE (NOT_BUSY-gated) unavailable while busy-act runs");
  });

  it("shows ABORT while the synthesized action runs", () => {
    initGame(() => buildBusyLAN(), "busy-abort-shown");
    const graph = getState().nodeGraph;
    graph.executeAction("router-a", BUSY_ACTION_ID);

    const available = graph.getAvailableActions("router-a").map((a) => a.id);
    assert.ok(available.includes(A.ABORT), "ABORT available while a synthesized timed action runs");
  });

  it("firing ABORT clears the synthesized action's active flag + progress and fires one cancel feedback", () => {
    initGame(() => buildBusyLAN(), "busy-abort-fire");
    const graph = getState().nodeGraph;
    graph.executeAction("router-a", BUSY_ACTION_ID);

    const cancels = [];
    const h = (p) => { if (p?.phase === "cancel") cancels.push(p); };
    on(E.ACTION_FEEDBACK, h);
    graph.executeAction("router-a", A.ABORT);
    off(E.ACTION_FEEDBACK, h);

    const { progressAttr, durationAttr } = getTimedActionAttrNames(BUSY_ACTION_ID);
    const attrs = graph.getNodeState("router-a");
    assert.equal(attrs[timedActiveAttr(BUSY_ACTION_ID)], false, "active flag cleared");
    assert.equal(attrs[progressAttr], 0, "progress reset");
    assert.equal(attrs[durationAttr], 0, "duration reset");
    assert.equal(graph.isNodeBusy("router-a"), false, "no longer busy after ABORT");

    assert.equal(cancels.length, 1, "exactly one cancel feedback");
    assert.equal(cancels[0].nodeId, "router-a");
    assert.equal(cancels[0].action, BUSY_ACTION_ID);
  });
});

describe("nav-cancel generalization for a synthesized timed action (#187 Phase 2)", () => {
  before(() => { clearHandlers(); initNavigationCancelHandler(); });

  it("PLAYER_NAVIGATED cancels an in-progress synthesized timed action", () => {
    initGame(() => buildBusyLAN(), "busy-nav");
    const graph = getState().nodeGraph;
    graph.executeAction("router-a", BUSY_ACTION_ID);
    assert.equal(graph.isNodeBusy("router-a"), true, "armed before nav");

    const cancels = [];
    const h = (p) => { if (p?.phase === "cancel") cancels.push(p); };
    on(E.ACTION_FEEDBACK, h);
    emitEvent(E.PLAYER_NAVIGATED, {});
    off(E.ACTION_FEEDBACK, h);

    assert.equal(graph.isNodeBusy("router-a"), false, "cancelled by nav-away");
    assert.equal(cancels.length, 1, "exactly one cancel feedback");
    assert.equal(cancels[0].nodeId, "router-a");
    assert.equal(cancels[0].action, BUSY_ACTION_ID);
  });

  it("does not disturb a node with no active timed action", () => {
    initGame(() => buildBusyLAN(), "busy-nav-idle");
    const cancels = [];
    const h = (p) => { if (p?.phase === "cancel") cancels.push(p); };
    on(E.ACTION_FEEDBACK, h);
    emitEvent(E.PLAYER_NAVIGATED, {});
    off(E.ACTION_FEEDBACK, h);
    assert.equal(cancels.length, 0, "no cancel feedback when nothing was running");
  });
});

function buildRouterLAN() {
  return {
    graphDef: {
      nodes: [
        createGateway("gateway", { attributes: { visibility: "accessible" } }),
        createRouter("router-a"),
      ],
      edges: [["gateway", "router-a"]],
      triggers: [],
    },
    meta: { startNode: "gateway", startCash: 0, moneyCost: "F" },
  };
}

describe("ABORT must not cancel involuntary reboot (review fix, #187)", () => {
  it("does not offer ABORT while rebooting, and abortTimedAction is a no-op on reboot", () => {
    initGame(() => buildRouterLAN(), "reboot-abort-guard");
    const graph = getState().nodeGraph;
    const nodeId = "router-a";
    const { progressAttr, durationAttr } = getTimedActionAttrNames("reboot");

    // Arm the reboot the same way ctx.startReboot does, without exercising the
    // rest of the reboot side effects (ICE eviction, etc.) — this test is only
    // about the ABORT/busy plumbing.
    graph.setNodeAttr(nodeId, "rebooting", true);
    graph.setNodeAttr(nodeId, progressAttr, 5);
    graph.setNodeAttr(nodeId, durationAttr, 20);

    assert.equal(graph.isNodeBusy(nodeId), true, "node is busy while rebooting");

    const available = graph.getAvailableActions(nodeId).map((a) => a.id);
    assert.ok(!available.includes(A.ABORT), "ABORT is NOT offered during an involuntary reboot");

    // Defense in depth: even calling the ctx abort path directly must not touch reboot.
    const cancels = [];
    const h = (p) => { if (p?.phase === "cancel") cancels.push(p); };
    on(E.ACTION_FEEDBACK, h);
    graph._ctx.abortTimedAction(nodeId);
    off(E.ACTION_FEEDBACK, h);

    const attrs = graph.getNodeState(nodeId);
    assert.equal(attrs.rebooting, true, "rebooting is NOT cleared by abortTimedAction");
    assert.equal(attrs[progressAttr], 5, "reboot progress untouched");
    assert.equal(attrs[durationAttr], 20, "reboot duration untouched");
    assert.equal(cancels.length, 0, "no cancel feedback fired for a blocked reboot abort");

    // The reboot still completes normally on tick — advance progress to duration
    // (20, set above) and let the timed-action operator fire onComplete
    // (completeReboot clears rebooting).
    graph.tick(20);
    assert.equal(graph.getNodeState(nodeId).rebooting, false, "reboot completes normally on tick");
  });

  it("an abortable action (probe) still offers ABORT and cancels normally", () => {
    initGame(() => buildRouterLAN(), "reboot-abort-guard-probe-still-works");
    const graph = getState().nodeGraph;
    const nodeId = "router-a";

    graph.executeAction(nodeId, A.PROBE);
    assert.equal(graph.isNodeBusy(nodeId), true, "busy while probing");

    const available = graph.getAvailableActions(nodeId).map((a) => a.id);
    assert.ok(available.includes(A.ABORT), "ABORT is still offered for an abortable action (probe)");

    graph.executeAction(nodeId, A.ABORT);
    assert.equal(graph.getNodeState(nodeId).probing, false, "probe cancelled by ABORT");
    assert.equal(graph.isNodeBusy(nodeId), false, "no longer busy after ABORT");
  });
});

describe("process-side busy composes with the graph-side check (#282 + #187 Phase 2)", () => {
  const PROC_TYPE = "timed-busy-test-proc";
  registerProcess(PROC_TYPE, { step: () => false, onAbort: () => {} });

  it("activeProcessOnNode makes a node busy at the getAvailableActions layer, independent of the graph", () => {
    initGame(() => buildBusyLAN(), "busy-proc");
    addProcess({ id: 1, type: PROC_TYPE, nodeId: "router-a" });

    const available = getAvailableActions(getState().nodes["router-a"], getState()).map((a) => a.id);
    assert.ok(available.includes(A.ABORT), "ABORT offered while a process is active");
    assert.ok(!available.includes(A.PROBE), "no other node verbs while a process is active");

    // The two busy mechanisms are independent: the graph itself has no active
    // timed-action operator, only the process-layer check makes the node busy.
    assert.equal(getState().nodeGraph.isNodeBusy("router-a"), false, "graph-level timed action still idle");
  });
});
