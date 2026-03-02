// @ts-check
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { NETWORK } from "../../../data/network.js";
import { initState, getState, getVersion } from "./index.js";
import { clearAll } from "../timers.js";
import {
  setIceAttention, setIceDetectedAt, setIceDwellTimer,
  incrementIceDetectionCount, setIceActive, setLastDisturbedNode,
} from "./ice.js";

describe("state/ice — ICE mutations", () => {
  beforeEach(() => {
    clearAll();
    initState(NETWORK);
  });

  it("setIceAttention changes attentionNodeId", () => {
    const v = getVersion();
    setIceAttention("gateway");
    assert.equal(getState().ice.attentionNodeId, "gateway");
    assert.equal(getVersion(), v + 1);
  });

  it("setIceDetectedAt sets detectedAtNode", () => {
    setIceDetectedAt("gateway");
    assert.equal(getState().ice.detectedAtNode, "gateway");
  });

  it("setIceDetectedAt(null) clears detectedAtNode", () => {
    setIceDetectedAt("gateway");
    setIceDetectedAt(null);
    assert.equal(getState().ice.detectedAtNode, null);
  });

  it("setIceDwellTimer sets dwellTimerId", () => {
    setIceDwellTimer(42);
    assert.equal(getState().ice.dwellTimerId, 42);
  });

  it("incrementIceDetectionCount increments count", () => {
    const before = getState().ice.detectionCount;
    incrementIceDetectionCount();
    assert.equal(getState().ice.detectionCount, before + 1);
  });

  it("setIceActive sets active flag", () => {
    setIceActive(false);
    assert.equal(getState().ice.active, false);
    setIceActive(true);
    assert.equal(getState().ice.active, true);
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
