// @ts-check
// #288 B1: one game-layer isNodeBusy(node, state) that ORs the operator-level
// (graph.isNodeBusy) and process-level (activeProcessOnNode) busy sources.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
// Side-effect import first: js/core/state.js pulls in js/core/sweep.js (which registers a
// process handler at module-load time), resolving a pre-existing state.js<->sweep.js<->
// processes.js circular-import ordering before busy.js cold-imports processes.js directly.
// Every existing test that touches processes.js follows this same import order — see
// tests/sweep.test.js, tests/autoburn.test.js, tests/timed-busy.test.js.
import "../js/core/state.js";
import { isNodeBusy } from "../js/core/busy.js";

describe("isNodeBusy game-layer contract (#288 B1)", () => {
  it("true when the graph reports an active timed-action operator", () => {
    const state = { nodeGraph: { isNodeBusy: (id) => id === "n1" }, processes: [] };
    assert.equal(isNodeBusy({ id: "n1" }, state), true);
    assert.equal(isNodeBusy({ id: "n2" }, state), false);
  });
  it("true when a process is active on the node", () => {
    const state = { nodeGraph: { isNodeBusy: () => false }, processes: [{ nodeId: "n1" }] };
    assert.equal(isNodeBusy({ id: "n1" }, state), true);
    assert.equal(isNodeBusy({ id: "n2" }, state), false);
  });
  it("false with no graph and no processes", () => {
    assert.equal(isNodeBusy({ id: "n1" }, { processes: [] }), false);
  });
});
