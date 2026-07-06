// @ts-check
// Tests for the pure seam of the flow layer: which flows are renderable given the set of
// nodes currently present (revealed) in the graph. The SMIL/DOM rendering itself is verified
// in the browser/preview (no DOM in node:test).

import { test } from "node:test";
import assert from "node:assert/strict";

import { renderableFlows, flowsSignature, fadeAlpha } from "../js/ui/overlays/flow-layer.js";

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

// Packets fade in as they leave the source (t→0) and out as they arrive (t→1) so they don't
// pop in/out at the t=0↔1 loop wrap.
test("fadeAlpha is 0 at both endpoints and 1 across the middle", () => {
  assert.equal(fadeAlpha(0), 0, "invisible at the source rim");
  assert.equal(fadeAlpha(1), 0, "invisible at the destination rim");
  assert.equal(fadeAlpha(0.5), 1, "fully opaque mid-traversal");
});

test("fadeAlpha ramps linearly over the fade zone and clamps to [0,1]", () => {
  // Rising edge: half-way through the 0.15 fade zone → 0.5.
  assert.ok(Math.abs(fadeAlpha(0.075) - 0.5) < 1e-9);
  // Symmetric on the falling edge.
  assert.ok(Math.abs(fadeAlpha(0.925) - 0.5) < 1e-9);
  // Never exceeds 1 in the plateau, never below 0 out of range.
  assert.equal(fadeAlpha(0.3), 1);
  assert.equal(fadeAlpha(-0.2), 0);
  assert.equal(fadeAlpha(1.2), 0);
});
