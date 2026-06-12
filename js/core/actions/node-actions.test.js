// @ts-check
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getAvailableActions } from "./node-actions.js";
import { initGame, getState } from "../state.js";
import { buildNetwork as buildCorporateFoothold } from "../../../data/networks/corporate-foothold.js";
import { A } from "../action-ids.js";

describe("getAvailableActions — one timed action at a time per node", () => {
  test("a node mid-PROBE offers neither PROBE nor XPLOIT, only ABORT", () => {
    initGame(() => buildCorporateFoothold(), "one-at-a-time-seed");
    const state = getState();
    const node = Object.values(state.nodes).find(
      (n) => n.visibility === "accessible" && n.accessLevel === "locked" && !n.probed
    );
    assert.ok(node, "expected an accessible, locked, unprobed node");

    // Sanity: before any action, both PROBE and XPLOIT are offered.
    const before = getAvailableActions(node, state).map((a) => a.id);
    assert.ok(before.includes(A.PROBE), "PROBE should be available initially");
    assert.ok(before.includes(A.XPLOIT), "XPLOIT should be available initially");

    // Start a probe — sets the `probing` busy flag via the timed-action operator.
    state.nodeGraph.executeAction(node.id, A.PROBE);

    const during = getAvailableActions(node, state).map((a) => a.id);
    assert.ok(!during.includes(A.PROBE), "PROBE should not be re-startable mid-probe");
    assert.ok(
      !during.includes(A.XPLOIT),
      "XPLOIT must not be available while a probe is in progress"
    );
    assert.ok(during.includes(A.ABORT), "ABORT should be the escape hatch mid-probe");
  });
});

describe("getAvailableActions — XPLOIT followup passthrough", () => {
  test("XPLOIT on an accessible node carries a followup with working choices", () => {
    initGame(() => buildCorporateFoothold());
    const state = getState();
    const gw = Object.values(state.nodes).find((n) => n.visibility === "accessible");
    assert.ok(gw, "expected an accessible node");
    const actions = getAvailableActions(gw, state);
    const xploit = actions.find((a) => a.id === A.XPLOIT);
    assert.ok(xploit, "XPLOIT should be available on an accessible node");
    assert.ok(xploit.followup, "XPLOIT should carry a followup step");
    assert.equal(typeof xploit.followup.choices, "function");
    assert.equal(typeof xploit.followup.empty, "function");
    assert.equal(typeof xploit.followup.title, "function");
    assert.ok(Array.isArray(xploit.followup.choices(gw, state)));
  });
});
