import { test } from "node:test";
import assert from "node:assert/strict";
import { SIGNAL_REGISTRY, signalNames, computeSignals } from "../js/audio/signal-registry.js";

function stateWith({ owned = 0, total = 2, alert = "green", health = 1, deck = 1 } = {}) {
  const nodes = {};
  for (let i = 0; i < total; i++) nodes["n" + i] = { accessLevel: i < owned ? "owned" : "locked", visibility: "revealed" };
  return {
    nodes,
    globalAlert: alert,
    player: { health: { current: health, max: 1 }, deckIntegrity: { current: deck, max: 1 } },
  };
}

test("signalNames lists the registered signals (gameProgress + gameThreat to start)", () => {
  assert.deepEqual(signalNames().sort(), ["gameProgress", "gameThreat"]);
});

test("computeSignals derives gameProgress and gameThreat from state", () => {
  const s = stateWith({ owned: 1, total: 2, alert: "green" });
  const v = computeSignals(s);
  assert.equal(v.gameProgress, 0.5);
  assert.equal(v.gameThreat, 0);
});

test("gameThreat tracks the alert ladder", () => {
  assert.ok(Math.abs(computeSignals(stateWith({ alert: "red" })).gameThreat - 2 / 3) < 1e-9);
  assert.equal(computeSignals(stateWith({ alert: "trace" })).gameThreat, 1);
});

test("computeSignals returns 0 for every signal when state is null", () => {
  const v = computeSignals(null);
  assert.deepEqual(v, { gameProgress: 0, gameThreat: 0 });
});

test("all computed values are clamped to 0..1", () => {
  const v = computeSignals(stateWith({ owned: 2, total: 2, alert: "trace", health: 0, deck: 0 }));
  for (const k of signalNames()) assert.ok(v[k] >= 0 && v[k] <= 1, `${k} in range`);
});

test("the registry is a plain name→derive map (expandable by one entry)", () => {
  for (const [name, derive] of Object.entries(SIGNAL_REGISTRY)) {
    assert.equal(typeof name, "string");
    assert.equal(typeof derive, "function");
  }
});
