// @ts-check
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { buildNetwork as buildCorporateExchange } from "../../../data/networks/corporate-exchange.js";
import { initGame, getState, getVersion } from "./index.js";
import { clearAll } from "../timers.js";
import {
  setIceAttention, setIceDetectedAt, setIceDwellTimer,
  incrementIceDetectionCount, setIceActive, setLastDisturbedNode,
  activeIceInstances, hasActiveIce,
} from "./ice.js";

/** First active ICE instance, or null. */
const firstIce = () => activeIceInstances(getState())[0] ?? null;

describe("state/ice — ICE mutations", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildCorporateExchange());
  });

  it("setIceAttention changes attentionNodeId", () => {
    const v = getVersion();
    setIceAttention("gateway");
    assert.equal(firstIce().attentionNodeId, "gateway");
    assert.equal(getVersion(), v + 1);
  });

  it("setIceDetectedAt sets detectedAtNode", () => {
    setIceDetectedAt("gateway");
    assert.equal(firstIce().detectedAtNode, "gateway");
  });

  it("setIceDetectedAt(null) clears detectedAtNode", () => {
    setIceDetectedAt("gateway");
    setIceDetectedAt(null);
    assert.equal(firstIce().detectedAtNode, null);
  });

  it("setIceDwellTimer sets dwellTimerId", () => {
    setIceDwellTimer(42);
    assert.equal(firstIce().dwellTimerId, 42);
  });

  it("incrementIceDetectionCount increments count", () => {
    const before = firstIce().detectionCount;
    incrementIceDetectionCount();
    assert.equal(firstIce().detectionCount, before + 1);
  });

  it("setIceActive sets active flag", () => {
    setIceActive(false);
    assert.equal(firstIce(), null);
    setIceActive(true, "ice-1");
    assert.equal(firstIce().active, true);
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

  it("activeIceInstances()[0] is the first active instance", () => {
    const ice = activeIceInstances(getState())[0];
    assert.ok(ice);
    assert.equal(ice.active, true);
    assert.equal(ice.id, "ice-1");
  });

  it("hasActiveIce() is false when no active instances", () => {
    setIceActive(false);
    assert.equal(hasActiveIce(getState()), false);
    assert.equal(activeIceInstances(getState()).length, 0);
  });
});
