// @ts-check
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// corporate-exchange spawns an ICE instance (meta.ice grade "B").
import { buildNetwork as buildCorporateExchange } from "../../../data/networks/corporate-exchange.js";
import { initGame, getState } from "../state.js";
import { setSelectedNode } from "../state/game.js";
import { clearAll } from "../timers.js";
import { on, off, E } from "../events.js";
import { handleIceDetect } from "./runtime.js";

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
  // initGame(buildNetworkFn, seedString, opts). meta.ice comes from the builder.
  initGame(() => buildCorporateExchange(), "dispatch-test");
});

// Helper: force the single spawned ICE instance to a given type, co-located with
// the player. (Overriding typeId directly bypasses the spawn roll — this test is
// about dispatch, independent of Task 4. State mutation here is test setup only.)
function placeIce(typeId) {
  const s = getState();
  const ice = Object.values(s.ice.instances)[0];
  ice.typeId = typeId;
  const node = ice.attentionNodeId;
  setSelectedNode(node);
  return { ice, node };
}

describe("detection effect dispatch", () => {
  it("sentinel detection reduces health and emits ICE_EFFECT_APPLIED", () => {
    const { node } = placeIce("sentinel");
    const before = getState().player.health.current;
    const applied = withEvents(E.ICE_EFFECT_APPLIED, () => handleIceDetect({ nodeId: node }));
    assert.equal(getState().player.health.current, before - 20);
    assert.ok(applied.some((p) => p.effect === "damage-health"));
  });

  it("spike detection reduces deck integrity", () => {
    const { node } = placeIce("spike");
    const before = getState().player.deckIntegrity.current;
    handleIceDetect({ nodeId: node });
    assert.equal(getState().player.deckIntegrity.current, before - 20);
  });

  it("sentinel detection does NOT step the global alert (no raise-alert)", () => {
    const { node } = placeIce("sentinel");
    const alertBefore = getState().globalAlert;
    handleIceDetect({ nodeId: node });
    assert.equal(getState().globalAlert, alertBefore);
  });

  it("classic detection still runs the alert path (regression)", () => {
    const { node } = placeIce("patrol-classic-B");
    // Capture both alert-path signals around the SAME detection: depending on
    // grade threshold, a fresh detection either steps the alert or starts the trace.
    const alertEvents = [];
    const onRaised = (p) => alertEvents.push(["raised", p]);
    const onTrace = (p) => alertEvents.push(["trace", p]);
    on(E.ALERT_GLOBAL_RAISED, onRaised);
    on(E.ALERT_TRACE_STARTED, onTrace);
    handleIceDetect({ nodeId: node });
    off(E.ALERT_GLOBAL_RAISED, onRaised);
    off(E.ALERT_TRACE_STARTED, onTrace);
    assert.ok(alertEvents.length >= 1, "classic ICE must still step alert or start trace");
    assert.equal(getState().player.health.current, 100, "classic ICE deals no damage");
  });

  it("damage emits a LOG_ENTRY readout", () => {
    const { node } = placeIce("sentinel");
    const logged = withEvents(E.LOG_ENTRY, () => handleIceDetect({ nodeId: node }));
    assert.ok(logged.some((p) => /HEALTH/.test(p.text)));
  });
});
