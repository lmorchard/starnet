// @ts-check
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { buildNetwork as buildCorporateExchange } from "../../data/networks/corporate-exchange.js";
import { on, off, E } from "./events.js";
import { initGame, getState } from "./state.js";
import { clearAll } from "./timers.js";
import {
  damagePlayerHealth, damagePlayerDeck,
  setPlayerHealth, setPlayerDeckIntegrity,
} from "./player-orchestration.js";

describe("player-orchestration — resource depletion ends run", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildCorporateExchange());
  });

  it("draining health to 0 ends the run with outcome 'burned'", () => {
    damagePlayerHealth(999);
    assert.equal(getState().phase, "ended");
    assert.equal(getState().runOutcome, "burned");
  });

  it("draining deck integrity to 0 ends the run with outcome 'bricked'", () => {
    damagePlayerDeck(999);
    assert.equal(getState().phase, "ended");
    assert.equal(getState().runOutcome, "bricked");
  });

  it("setPlayerHealth(0) also ends the run with 'burned'", () => {
    setPlayerHealth(0);
    assert.equal(getState().runOutcome, "burned");
  });

  it("setPlayerDeckIntegrity(0) also ends the run with 'bricked'", () => {
    setPlayerDeckIntegrity(0);
    assert.equal(getState().runOutcome, "bricked");
  });

  it("subsequent damage after run ended does not re-trigger endRun", () => {
    let runEndedCount = 0;
    const handler = () => runEndedCount++;
    on(E.RUN_ENDED, handler);
    try {
      damagePlayerHealth(999);            // run ends, RUN_ENDED fires once
      getState().player.health.current = 50; // simulate "still alive" while phase remains ended
      damagePlayerHealth(999);            // guard must prevent a second endRun
      assert.equal(runEndedCount, 1);
    } finally {
      off(E.RUN_ENDED, handler);
    }
  });
});
