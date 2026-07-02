// @ts-check
// Hardening fix, final review of #187 Phase 1/2: the `volatile` trait
// (js/core/node-graph/traits.js) defines a hand-authored `timed-action` operator
// that is NOT in the TIMED_ACTIONS registry and (before this fix) carried no
// `_abortable` field. isOperatorAbortable() in runtime.js defaults an
// unregistered `timed-action` operator to abortable — fine for synthesized
// `timed` actions (#187 Phase 1), wrong for `volatile`: it self-arms on an
// owned node and detonates involuntarily, like `reboot` (the one
// TIMED_ACTIONS entry with `abortable:false`). ABORT must not be able to
// disarm it.
//
// This is currently LATENT — no shipping node/biome composes the `volatile`
// trait — but it's a trap for the next author of a volatile node.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { NodeGraph } from "../js/core/node-graph/runtime.js";
import { getTimedActionAttrNames } from "../js/core/node-graph/timed-actions.js";
import { A } from "../js/core/action-ids.js";

// `hackable` supplies ABORT (and PROBE/EXPLOIT/MINE); `volatile` is the trait
// under test. Composing both mirrors how a real volatile node would be built.
function buildVolatileGraph() {
  return new NodeGraph({
    nodes: [
      { id: "vault", type: "cryptovault", traits: ["hackable", "volatile"], attributes: {} },
    ],
    edges: [],
  });
}

describe("volatile timed-action is not ABORT-cancellable (involuntary, like reboot)", () => {
  it("arms busy but hides ABORT and reports no active abortable timed action", () => {
    const graph = buildVolatileGraph();
    const nodeId = "vault";
    const { progressAttr, durationAttr } = getTimedActionAttrNames("volatile");

    // Arm volatile directly (bypassing the owned-access trigger), the same way
    // the reboot-guard test in tests/timed-busy.test.js arms reboot: set the
    // activeAttr plus progress/duration.
    graph.setNodeAttr(nodeId, "_volatile_armed", true);
    graph.setNodeAttr(nodeId, progressAttr, 5);
    graph.setNodeAttr(nodeId, durationAttr, 30);

    assert.equal(graph.isNodeBusy(nodeId), true, "an armed volatile node is busy");
    assert.equal(
      graph.getActiveAbortableTimedAction(nodeId),
      null,
      "volatile must not be reported as an abortable timed action"
    );

    const available = graph.getAvailableActions(nodeId).map((a) => a.id);
    assert.ok(!available.includes(A.ABORT), "ABORT is NOT offered while volatile is armed");
  });
});
