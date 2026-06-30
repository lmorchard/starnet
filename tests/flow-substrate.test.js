// @ts-check
// Tests for state.flows — the serializable flow substrate (Session 0, flow-subversion pillar).
// Flows are first-class state authored in meta.flows; edges themselves are not serializable.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createGateway, createRouter } from "../js/core/node-graph/node-factories.js";
import { initGame, getState, serializeState, deserializeState } from "../js/core/state.js";

function buildLAN(extraMeta = {}) {
  return {
    graphDef: {
      nodes: [
        createGateway("gateway", { attributes: { visibility: "accessible" } }),
        createRouter("router-a"),
      ],
      edges: [["gateway", "router-a"]],
      triggers: [],
    },
    meta: { startNode: "gateway", startCash: 0, moneyCost: "F", ...extraMeta },
  };
}

const FLOWS = [
  { from: "gateway", to: "router-a", type: "money", rate: 0.8 },
  { from: "gateway", to: "router-a", type: "audit", rate: 0.3, encrypted: true },
];

test("state.flows is populated from meta.flows", () => {
  initGame(() => buildLAN({ flows: FLOWS }), "flow-1");
  const flows = getState().flows;
  assert.equal(flows.length, 2);
  assert.equal(flows[0].type, "money");
  assert.equal(flows[0].from, "gateway");
  assert.equal(flows[0].to, "router-a");
});

test("flows survive a serialize → JSON → deserialize round-trip", () => {
  initGame(() => buildLAN({ flows: FLOWS }), "flow-2");
  const snap = JSON.parse(JSON.stringify(serializeState()));
  assert.equal(snap.flows.length, 2);
  deserializeState(snap);
  assert.equal(getState().flows[1].encrypted, true);
});

test("a network with no meta.flows yields an empty array (no crash)", () => {
  initGame(() => buildLAN(), "flow-3");
  assert.deepEqual(getState().flows, []);
});

test("state.flows is cloned from meta.flows (in-run mutation can't leak to the source)", () => {
  const source = [{ from: "gateway", to: "router-a", type: "money", rate: 0.8 }];
  initGame(() => buildLAN({ flows: source }), "flow-4");
  const flow = getState().flows[0];
  assert.notEqual(flow, source[0]); // a distinct object, not the same reference
  flow.rate = 0.1;                  // simulate an in-run mutation
  assert.equal(source[0].rate, 0.8); // source network definition is untouched
});

test("deserializing a save that predates state.flows heals it to []", () => {
  initGame(() => buildLAN({ flows: FLOWS }), "flow-5");
  const snap = JSON.parse(JSON.stringify(serializeState()));
  delete snap.flows; // simulate an older save with no flows field
  deserializeState(snap);
  assert.deepEqual(getState().flows, []);
});
