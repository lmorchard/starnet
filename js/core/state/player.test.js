// @ts-check
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { buildNetwork as buildCorporateFoothold } from "../../../data/networks/corporate-foothold.js";
import { initGame, getState, getVersion } from "./index.js";
import { clearAll } from "../timers.js";
import {
  addCash, setCash, addCardToHand, setMissionComplete, applyCardDecay,
} from "./player.js";

describe("state/player — player mutations", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildCorporateFoothold());
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
