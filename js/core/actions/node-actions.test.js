// @ts-check
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getAvailableActions } from "./node-actions.js";
import { initGame, getState } from "../state.js";
import { buildNetwork as buildCorporateFoothold } from "../../../data/networks/corporate-foothold.js";
import { A } from "../action-ids.js";

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
