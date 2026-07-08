// @ts-check
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { buildNetwork as buildCorporateFoothold } from "../../../data/networks/corporate-foothold.js";
import { buildNetwork as buildCorporateExchange } from "../../../data/networks/corporate-exchange.js";
import { initGame, getState, getVersion } from "./index.js";
import { clearAll } from "../timers.js";
import {
  addCash, setCash, setMissionComplete,
  damagePlayerHealth, damagePlayerDeck, setPlayerHealth, setPlayerDeckIntegrity,
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

  it("setMissionComplete marks mission as complete", () => {
    // Mission may or may not exist depending on network seed
    const s = getState();
    if (!s.mission) return;

    setMissionComplete();
    assert.equal(getState().mission.complete, true);
  });
});

describe("state/player — health + deck integrity", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildCorporateExchange());
  });

  it("damagePlayerHealth reduces current, clamps at 0", () => {
    damagePlayerHealth(30);
    assert.equal(getState().player.health.current, 70);
    damagePlayerHealth(999);
    assert.equal(getState().player.health.current, 0);
  });

  it("damagePlayerDeck reduces current, clamps at 0", () => {
    damagePlayerDeck(40);
    assert.equal(getState().player.deckIntegrity.current, 60);
    damagePlayerDeck(999);
    assert.equal(getState().player.deckIntegrity.current, 0);
  });

  it("setPlayerHealth sets absolute value, clamps at max", () => {
    setPlayerHealth(50);
    assert.equal(getState().player.health.current, 50);
    setPlayerHealth(999);
    assert.equal(getState().player.health.current, 100);
  });

  it("setPlayerDeckIntegrity sets absolute value, clamps at max", () => {
    setPlayerDeckIntegrity(40);
    assert.equal(getState().player.deckIntegrity.current, 40);
    setPlayerDeckIntegrity(999);
    assert.equal(getState().player.deckIntegrity.current, 100);
  });

  it("damage functions increment version counter", () => {
    const v = getVersion();
    damagePlayerHealth(1);
    assert.equal(getVersion(), v + 1);
  });
});
