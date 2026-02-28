// @ts-check
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { NETWORK } from "../../data/network.js";
import { initState, getState, getVersion } from "./index.js";
import { clearAll } from "../timers.js";
import {
  addCash, setCash, addCardToHand, setExecutingExploit,
  incrementNoiseTick, setActiveProbe, setMissionComplete, applyCardDecay,
} from "./player.js";

describe("state/player — player mutations", () => {
  beforeEach(() => {
    clearAll();
    initState(NETWORK);
  });

  it("addCash adds to player cash", () => {
    const before = getState().player.cash;
    const v = getVersion();
    addCash(500);
    assert.equal(getState().player.cash, before + 500);
    assert.equal(getVersion(), v + 1);
  });

  it("setCash sets absolute cash value", () => {
    setCash(0);
    assert.equal(getState().player.cash, 0);
  });

  it("addCardToHand pushes card to hand", () => {
    const before = getState().player.hand.length;
    addCardToHand({ id: "test-card", name: "Test", quality: 0.5 });
    assert.equal(getState().player.hand.length, before + 1);
    assert.equal(getState().player.hand[before].id, "test-card");
  });

  it("setExecutingExploit sets and clears exploit state", () => {
    setExecutingExploit({ nodeId: "gw", exploitId: "x", timerId: 1, noiseTimerId: 2, noiseTick: 0 });
    assert.ok(getState().executingExploit);
    assert.equal(getState().executingExploit.nodeId, "gw");

    setExecutingExploit(null);
    assert.equal(getState().executingExploit, null);
  });

  it("incrementNoiseTick increments noiseTick", () => {
    setExecutingExploit({ nodeId: "gw", exploitId: "x", timerId: 1, noiseTimerId: 2, noiseTick: 0 });
    incrementNoiseTick();
    assert.equal(getState().executingExploit.noiseTick, 1);
    incrementNoiseTick();
    assert.equal(getState().executingExploit.noiseTick, 2);
  });

  it("incrementNoiseTick is no-op when not executing", () => {
    const v = getVersion();
    incrementNoiseTick();
    // Doesn't crash, version still bumps
    assert.equal(getVersion(), v + 1);
  });

  it("setActiveProbe sets and clears probe state", () => {
    setActiveProbe({ nodeId: "gw", timerId: 5 });
    assert.ok(getState().activeProbe);
    assert.equal(getState().activeProbe.nodeId, "gw");

    setActiveProbe(null);
    assert.equal(getState().activeProbe, null);
  });

  it("setMissionComplete marks mission as complete", () => {
    // Mission may or may not exist depending on network seed
    const s = getState();
    if (!s.mission) return;

    setMissionComplete();
    assert.equal(getState().mission.complete, true);
  });

  it("applyCardDecay updates card in hand", () => {
    const card = getState().player.hand[0];
    const origUses = card.usesRemaining;
    applyCardDecay(card.id, origUses - 1, "worn");
    assert.equal(getState().player.hand[0].usesRemaining, origUses - 1);
    assert.equal(getState().player.hand[0].decayState, "worn");
  });
});
