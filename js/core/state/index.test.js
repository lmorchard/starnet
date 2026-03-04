// @ts-check
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { buildNetwork as buildCorporateFoothold } from "../../../data/networks/corporate-foothold.js";
import { initGame, getState, mutate, getVersion } from "./index.js";
import { clearAll } from "../timers.js";

describe("state/index — core infrastructure", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildCorporateFoothold());
  });

  it("initState creates state with nodes", () => {
    const s = getState();
    assert.ok(s.nodes);
    assert.ok(Object.keys(s.nodes).length > 0);
  });

  it("initState creates state with adjacency", () => {
    const s = getState();
    assert.ok(s.adjacency);
    assert.ok(Object.keys(s.adjacency).length > 0);
  });

  it("initState creates state with player", () => {
    const s = getState();
    assert.ok(s.player);
    assert.equal(typeof s.player.cash, "number");
    assert.ok(Array.isArray(s.player.hand));
    assert.ok(s.player.hand.length > 0);
  });

  it("getState returns the initialized state", () => {
    const s = getState();
    assert.equal(s.phase, "playing");
    assert.equal(s.globalAlert, "green");
    assert.equal(s.selectedNodeId, null);
  });

  it("getVersion returns a number", () => {
    const v = getVersion();
    assert.equal(typeof v, "number");
  });

  it("mutate increments version counter", () => {
    const before = getVersion();
    mutate((s) => { s.selectedNodeId = "gateway"; });
    assert.equal(getVersion(), before + 1);
  });

  it("mutate returns the state", () => {
    const result = mutate((s) => { s.selectedNodeId = "gateway"; });
    assert.equal(result, getState());
    assert.equal(result.selectedNodeId, "gateway");
  });

  it("multiple mutate calls increment monotonically", () => {
    const v0 = getVersion();
    mutate((s) => { s.selectedNodeId = "gateway"; });
    mutate((s) => { s.selectedNodeId = null; });
    mutate((s) => { s.globalAlert = "yellow"; });
    assert.equal(getVersion(), v0 + 3);
  });

  it("initGame increments version", () => {
    const before = getVersion();
    initGame(() => buildCorporateFoothold());
    assert.ok(getVersion() > before);
  });
});
