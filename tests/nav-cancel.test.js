// @ts-check
// Nav-cancel handler (#225): on PLAYER_NAVIGATED, every in-progress ABORTABLE timed action is
// cancelled — its activeAttr/progress/duration reset and exactly one "cancel" ACTION_FEEDBACK
// fired. This is derived from the TIMED_ACTIONS registry (the single source of truth), so it
// covers whatever abortable set is registered — including any future 7th action, which is exactly
// the multi-site drift this handler's refactor prevents.

import { test, before } from "node:test";
import assert from "node:assert/strict";

import { createGateway, createRouter } from "../js/core/node-graph/node-factories.js";
import { initGame, getState } from "../js/core/state.js";
import { emitEvent, on, off, E, clearHandlers } from "../js/core/events.js";
import { initNavigationCancelHandler } from "../js/core/node-graph/game-ctx.js";
import { ABORTABLE_TIMED_ACTIONS, getTimedActionAttrNames } from "../js/core/node-graph/timed-actions.js";

function buildMinimalLAN() {
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

// Guarantee exactly one nav-cancel handler is registered (game-ctx registers one at module load;
// clear + re-register so the "exactly one cancel feedback" assertion is not confounded).
before(() => { clearHandlers(); initNavigationCancelHandler(); });

for (const def of ABORTABLE_TIMED_ACTIONS) {
  test(`PLAYER_NAVIGATED cancels an in-progress "${def.action}"`, () => {
    initGame(() => buildMinimalLAN(), `nav-${def.action}`);
    const graph = getState().nodeGraph;
    const nodeId = "router-a";
    const { progressAttr, durationAttr } = getTimedActionAttrNames(def.action);

    // Put the action in progress.
    graph.setNodeAttr(nodeId, def.activeAttr, true);
    graph.setNodeAttr(nodeId, progressAttr, 5);
    graph.setNodeAttr(nodeId, durationAttr, 10);
    for (const attr of def.clearOnCancel ?? []) graph.setNodeAttr(nodeId, attr, "sentinel");

    const cancels = [];
    const h = (p) => { if (p?.phase === "cancel") cancels.push(p); };
    on(E.ACTION_FEEDBACK, h);
    emitEvent(E.PLAYER_NAVIGATED, {});
    off(E.ACTION_FEEDBACK, h);

    const attrs = graph.getNodeState(nodeId);
    assert.equal(attrs[def.activeAttr], false, "activeAttr reset");
    assert.equal(attrs[progressAttr], 0, "progress reset");
    assert.equal(attrs[durationAttr], 0, "duration reset");
    for (const attr of def.clearOnCancel ?? []) {
      assert.equal(attrs[attr], null, `${attr} cleared on cancel`);
    }

    assert.equal(cancels.length, 1, "exactly one cancel feedback");
    assert.equal(cancels[0].nodeId, nodeId);
    assert.equal(cancels[0].action, def.action, "feedback action id matches the registry");
  });
}

test("PLAYER_NAVIGATED with no action in progress fires no cancel feedback", () => {
  initGame(() => buildMinimalLAN(), "nav-idle");
  const cancels = [];
  const h = (p) => { if (p?.phase === "cancel") cancels.push(p); };
  on(E.ACTION_FEEDBACK, h);
  emitEvent(E.PLAYER_NAVIGATED, {});
  off(E.ACTION_FEEDBACK, h);
  assert.equal(cancels.length, 0);
});
