// @ts-check
// #288 Task B2: abortNode(nodeId, reason) unifies the two abort paths — an active
// abortable timed-action operator AND any active process on the node — behind one
// entry point. Mirrors the setup patterns in tests/timed-busy.test.js.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createGateway, createRouter } from "../js/core/node-graph/node-factories.js";
import { initGame, getState } from "../js/core/state.js";
import { on, off, E } from "../js/core/events.js";
import { abortNode } from "../js/core/node-graph/game-ctx.js";
import { A } from "../js/core/action-ids.js";
import { addProcess } from "../js/core/state/process.js";
import { registerProcess } from "../js/core/processes.js";

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

describe("abortNode unifies timed-action + process cancel (#288 B2)", () => {
  it("clears an active abortable timed action and emits cancel feedback", () => {
    initGame(() => buildRouterLAN(), "abort-node-timed");
    const graph = getState().nodeGraph;
    const nodeId = "router-a";

    graph.executeAction(nodeId, A.PROBE);
    assert.equal(graph.isNodeBusy(nodeId), true, "busy while probing");

    const cancels = [];
    const h = (p) => { if (p?.phase === "cancel") cancels.push(p); };
    on(E.ACTION_FEEDBACK, h);
    abortNode(nodeId);
    off(E.ACTION_FEEDBACK, h);

    assert.equal(graph.getNodeState(nodeId).probing, false, "probe cancelled");
    assert.equal(graph.isNodeBusy(nodeId), false, "no longer busy after abortNode");
    assert.equal(cancels.length, 1, "exactly one cancel feedback");
    assert.equal(cancels[0].nodeId, nodeId);
    assert.equal(cancels[0].action, A.PROBE);
  });

  it("does not touch an involuntary reboot", () => {
    initGame(() => buildRouterLAN(), "abort-node-reboot-guard");
    const graph = getState().nodeGraph;
    const nodeId = "router-a";

    graph.setNodeAttr(nodeId, "rebooting", true);
    graph.setNodeAttr(nodeId, "_ta_reboot_progress", 5);
    graph.setNodeAttr(nodeId, "_ta_reboot_duration", 20);

    const cancels = [];
    const h = (p) => { if (p?.phase === "cancel") cancels.push(p); };
    on(E.ACTION_FEEDBACK, h);
    abortNode(nodeId);
    off(E.ACTION_FEEDBACK, h);

    const attrs = graph.getNodeState(nodeId);
    assert.equal(attrs.rebooting, true, "rebooting untouched");
    assert.equal(attrs._ta_reboot_progress, 5, "reboot progress untouched");
    assert.equal(attrs._ta_reboot_duration, 20, "reboot duration untouched");
    assert.equal(cancels.length, 0, "no cancel feedback for a non-abortable reboot");
  });

  it("aborts an active process on the node", () => {
    const PROC_TYPE = "abort-node-test-proc";
    registerProcess(PROC_TYPE, { step: () => false, onAbort: () => {} });

    initGame(() => buildRouterLAN(), "abort-node-process");
    const s = getState();
    const nodeId = "router-a";
    addProcess({ id: 1, type: PROC_TYPE, nodeId });

    assert.equal(s.processes.some((p) => p.nodeId === nodeId), true, "process registered before abort");

    abortNode(nodeId);

    assert.equal(getState().processes.some((p) => p.nodeId === nodeId), false, "process removed by abortNode");
  });

  it("aborts both a timed action and a process on the same node in one call", () => {
    const PROC_TYPE = "abort-node-test-proc-combo";
    registerProcess(PROC_TYPE, { step: () => false, onAbort: () => {} });

    initGame(() => buildRouterLAN(), "abort-node-combo");
    const graph = getState().nodeGraph;
    const nodeId = "router-a";

    graph.executeAction(nodeId, A.PROBE);
    addProcess({ id: 1, type: PROC_TYPE, nodeId });

    abortNode(nodeId);

    assert.equal(graph.getNodeState(nodeId).probing, false, "probe cancelled");
    assert.equal(getState().processes.some((p) => p.nodeId === nodeId), false, "process removed");
  });
});
