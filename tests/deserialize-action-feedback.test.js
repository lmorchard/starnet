// @ts-check
// Regression for #302: the graph→event `onEvent` bridge built in deserializeState
// (js/core/state/index.js) had drifted from the initGame bridge — it was missing the
// `action-feedback` branch. On a restored graph, ACTION_FEEDBACK (start/progress/cancel/
// complete) was emitted by the timed-action operator but never bridged to the event bus,
// so the log lines, the generic-process overlay ring, and the audio drones all silently
// went dead after ANY save/load round-trip. The completion *effects* still fired (separate
// operator-effect path), so the action "worked" — only the legible feedback vanished.
//
// This test arms a synthesized timed action, serializes + deserializes mid-progress, then
// ticks the RESTORED graph to completion while subscribed to E.ACTION_FEEDBACK. Before the
// fix, no feedback is heard on the bus; after it, progress + complete fire normally.

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { createGateway, createRouter } from "../js/core/node-graph/node-factories.js";
import { initGame, getState, serializeState, deserializeState } from "../js/core/state.js";
import { on, off, E, clearHandlers } from "../js/core/events.js";
import { clearAll } from "../js/core/timers.js";

const TIMED_ACTION_ID = "feedback-act";

function buildTimedLAN() {
  return {
    graphDef: {
      nodes: [
        createGateway("gateway", { attributes: { visibility: "accessible" } }),
        {
          ...createRouter("router-a"),
          actions: [
            {
              id: TIMED_ACTION_ID,
              label: "FEEDBACK",
              requires: [],
              timed: { duration: 6 },
              effects: [{ effect: "set-attr", attr: "done", value: true }],
            },
          ],
        },
      ],
      edges: [["gateway", "router-a"]],
      triggers: [],
    },
    meta: { startNode: "gateway", startCash: 0, moneyCost: "F" },
  };
}

describe("timed-action feedback survives save/load (#302)", () => {
  beforeEach(() => { clearAll(); clearHandlers(); });

  it("bridges ACTION_FEEDBACK from a restored graph to the event bus", () => {
    initGame(() => buildTimedLAN(), "deser-feedback");
    getState().nodeGraph.executeAction("router-a", TIMED_ACTION_ID);
    getState().nodeGraph.tick(2); // advance partway through the 6-tick action

    // Faithful save/load round-trip through JSON, then restore.
    const snap = JSON.parse(JSON.stringify(serializeState()));
    clearAll();
    deserializeState(snap);
    const restored = getState().nodeGraph;

    // Listen on the real event bus, then tick the restored graph to completion.
    /** @type {any[]} */ const feedback = [];
    const h = (p) => feedback.push(p);
    on(E.ACTION_FEEDBACK, h);
    restored.tick(6); // finish the remaining progress + complete
    off(E.ACTION_FEEDBACK, h);

    const phases = feedback.map((p) => p.phase);
    assert.ok(phases.includes("complete"), "complete feedback must reach the bus after restore");
    assert.ok(phases.includes("progress"), "progress feedback must reach the bus after restore");
    // The completion effect still fires via the operator-effect path either way.
    assert.equal(restored.getNodeState("router-a").done, true, "action still completes");
  });
});
