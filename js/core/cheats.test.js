// @ts-check
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { buildNetwork as buildCorporateExchange } from "../../data/networks/corporate-exchange.js";
import { initGame, getState } from "./state.js";
import { clearAll } from "./timers.js";
import { on, off, E } from "./events.js";
import { handleCheatCommand } from "./cheats.js";

function withEvents(type, fn) {
  const captured = [];
  const h = (p) => captured.push(p);
  on(type, h);
  fn();
  off(type, h);
  return captured;
}

beforeEach(() => {
  clearAll();
  initGame(() => buildCorporateExchange(), "cheats-test");
});

describe("cheat hurt", () => {
  it("damages health by the given amount and sets the cheat flag", () => {
    const before = getState().player.health.current;
    const ok = handleCheatCommand(["hurt", "health", "30"]);
    assert.equal(ok, true);
    assert.equal(getState().player.health.current, before - 30);
    assert.equal(getState().isCheating, true);
  });

  it("damages deck integrity (alias 'deck')", () => {
    const before = getState().player.deckIntegrity.current;
    handleCheatCommand(["hurt", "deck", "25"]);
    assert.equal(getState().player.deckIntegrity.current, before - 25);
  });

  it("emits STATE_CHANGED so the overlay/HUD refresh", () => {
    const events = withEvents(E.STATE_CHANGED, () => handleCheatCommand(["hurt", "health", "10"]));
    assert.ok(events.length >= 1);
  });

  it("depleting health ends the run as 'burned'", () => {
    handleCheatCommand(["hurt", "health", "100"]);
    assert.equal(getState().player.health.current, 0);
    assert.equal(getState().phase, "ended");
    assert.equal(getState().runOutcome, "burned");
  });

  it("rejects a missing/invalid amount without mutating", () => {
    const before = getState().player.health.current;
    assert.equal(handleCheatCommand(["hurt", "health"]), false);
    assert.equal(handleCheatCommand(["hurt", "health", "0"]), false);
    assert.equal(handleCheatCommand(["hurt", "bogus", "5"]), false);
    assert.equal(getState().player.health.current, before);
  });
});

describe("cheat heal", () => {
  it("restores to full when no amount is given", () => {
    handleCheatCommand(["hurt", "health", "50"]);
    const max = getState().player.health.max;
    handleCheatCommand(["heal", "health"]);
    assert.equal(getState().player.health.current, max);
  });

  it("restores by a given amount, clamped to max", () => {
    handleCheatCommand(["hurt", "deck", "40"]);
    const max = getState().player.deckIntegrity.max;
    handleCheatCommand(["heal", "deck", "10"]);
    assert.equal(getState().player.deckIntegrity.current, max - 30);
    handleCheatCommand(["heal", "deck", "9999"]);
    assert.equal(getState().player.deckIntegrity.current, max); // clamped
  });

  it("rejects an unknown pool", () => {
    assert.equal(handleCheatCommand(["heal", "bogus"]), false);
  });
});
