// @ts-check
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { NETWORK } from "../../data/network.js";
import { initState, getState, getVersion } from "./index.js";
import { clearAll } from "../timers.js";
import { setSelectedNode, setPhase, setRunOutcome, setCheating } from "./game.js";

describe("state/game — game-level mutations", () => {
  beforeEach(() => {
    clearAll();
    initState(NETWORK);
  });

  it("setSelectedNode changes selectedNodeId", () => {
    const v = getVersion();
    setSelectedNode("gateway");
    assert.equal(getState().selectedNodeId, "gateway");
    assert.equal(getVersion(), v + 1);
  });

  it("setSelectedNode(null) clears selection", () => {
    setSelectedNode("gateway");
    setSelectedNode(null);
    assert.equal(getState().selectedNodeId, null);
  });

  it("setPhase changes phase", () => {
    setPhase("ended");
    assert.equal(getState().phase, "ended");
  });

  it("setRunOutcome changes runOutcome", () => {
    setRunOutcome("caught");
    assert.equal(getState().runOutcome, "caught");
  });

  it("setCheating sets isCheating to true", () => {
    assert.equal(getState().isCheating, false);
    setCheating();
    assert.equal(getState().isCheating, true);
  });
});
