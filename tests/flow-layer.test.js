// @ts-check
// Tests for the pure seam of the flow layer: which flows are renderable given the set of
// nodes currently present (revealed) in the graph. The SMIL/DOM rendering itself is verified
// in the browser/preview (no DOM in node:test).

import { test } from "node:test";
import assert from "node:assert/strict";

import { renderableFlows, flowsSignature } from "../js/ui/overlays/flow-layer.js";

const flows = [
  { from: "a", to: "b", type: "money", rate: 1 },
  { from: "a", to: "c", type: "data", rate: 1 },
];

test("only flows with BOTH endpoints present are renderable", () => {
  assert.equal(renderableFlows(flows, ["a", "b"]).length, 1);
  assert.equal(renderableFlows(flows, ["a", "b", "c"]).length, 2);
  assert.equal(renderableFlows(flows, ["a"]).length, 0);
  assert.equal(renderableFlows(flows, []).length, 0);
});

test("renderableFlows preserves the flow objects unchanged", () => {
  const out = renderableFlows(flows, ["a", "b"]);
  assert.equal(out[0], flows[0]);
});

test("empty / missing flows yields empty (no throw)", () => {
  assert.deepEqual(renderableFlows([], ["a", "b"]), []);
});

// The layer rebuilds (restarting packet animations) only when this signature changes. An
// unchanged set must yield an identical signature so frequent STATE_CHANGED events during a
// timed action don't restart the animation.
test("flowsSignature is stable for an unchanged set", () => {
  const a = [{ from: "x", to: "y", type: "money", rate: 0.5 }];
  const b = [{ from: "x", to: "y", type: "money", rate: 0.5 }];
  assert.equal(flowsSignature(a), flowsSignature(b));
});

test("flowsSignature changes when any field changes", () => {
  const base = flowsSignature([{ from: "x", to: "y", type: "money", rate: 0.5 }]);
  assert.notEqual(base, flowsSignature([{ from: "x", to: "y", type: "money", rate: 0.6 }]));
  assert.notEqual(base, flowsSignature([{ from: "x", to: "y", type: "audit", rate: 0.5 }]));
  assert.notEqual(base, flowsSignature([{ from: "x", to: "y", type: "money", rate: 0.5, encrypted: true }]));
});

test("flowsSignature changes when an encrypted flow is revealed (SNIFF decrypts on the graph)", () => {
  const enc = flowsSignature([{ from: "x", to: "y", type: "credential", rate: 0.5, encrypted: true }]);
  const revealed = flowsSignature([{ from: "x", to: "y", type: "credential", rate: 0.5, encrypted: true, revealed: true }]);
  assert.notEqual(enc, revealed);
});
