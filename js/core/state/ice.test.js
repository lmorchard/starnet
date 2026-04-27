// @ts-check
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { buildNetwork as buildCorporateExchange } from "../../../data/networks/corporate-exchange.js";
import { initGame, getState, getVersion } from "./index.js";
import { clearAll } from "../timers.js";
import {
  setIceAttention, setIceDetectedAt, setIceDwellTimer,
  incrementIceDetectionCount, setIceActive, setLastDisturbedNode,
  getPrimaryIce,
} from "./ice.js";

describe("state/ice — ICE mutations", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildCorporateExchange());
  });

  it("setIceAttention changes attentionNodeId", () => {
    const v = getVersion();
    setIceAttention("gateway");
    assert.equal(getPrimaryIce().attentionNodeId, "gateway");
    assert.equal(getVersion(), v + 1);
  });

  it("setIceDetectedAt sets detectedAtNode", () => {
    setIceDetectedAt("gateway");
    assert.equal(getPrimaryIce().detectedAtNode, "gateway");
  });

  it("setIceDetectedAt(null) clears detectedAtNode", () => {
    setIceDetectedAt("gateway");
    setIceDetectedAt(null);
    assert.equal(getPrimaryIce().detectedAtNode, null);
  });

  it("setIceDwellTimer sets dwellTimerId", () => {
    setIceDwellTimer(42);
    assert.equal(getPrimaryIce().dwellTimerId, 42);
  });

  it("incrementIceDetectionCount increments count", () => {
    const before = getPrimaryIce().detectionCount;
    incrementIceDetectionCount();
    assert.equal(getPrimaryIce().detectionCount, before + 1);
  });

  it("setIceActive sets active flag", () => {
    setIceActive(false);
    assert.equal(getPrimaryIce(), null);
    setIceActive(true, "ice-1");
    assert.equal(getPrimaryIce().active, true);
  });

  it("setLastDisturbedNode sets lastDisturbedNodeId", () => {
    setLastDisturbedNode("fileserver");
    assert.equal(getState().lastDisturbedNodeId, "fileserver");
  });

  it("setLastDisturbedNode(null) clears it", () => {
    setLastDisturbedNode("fileserver");
    setLastDisturbedNode(null);
    assert.equal(getState().lastDisturbedNodeId, null);
  });
});

describe("state/ice — multi-instance shape", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildCorporateExchange());
  });

  it("state.ice is a collection keyed by id", () => {
    const s = getState();
    assert.ok(s.ice);
    assert.ok(typeof s.ice.instances === "object");
    const ids = Object.keys(s.ice.instances);
    assert.equal(ids.length, 1);
  });

  it("getPrimaryIce() returns the first active instance", () => {
    const ice = getPrimaryIce();
    assert.ok(ice);
    assert.equal(ice.active, true);
    assert.equal(ice.id, "ice-1");
  });

  it("getPrimaryIce() returns null when no active instances", () => {
    setIceActive(false);
    assert.equal(getPrimaryIce(), null);
  });
});
