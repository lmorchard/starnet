// @ts-check
// Tests for persisted UI flags: state.ui.menuOpen / state.ui.handCollapsed.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createGateway, createRouter } from "../js/core/node-graph/node-factories.js";
import { initGame, getState, serializeState, deserializeState } from "../js/core/state.js";
import { toggleMenuOpen, toggleHandCollapsed } from "../js/core/state/game.js";
import { setActiveRun } from "../js/core/run-context.js";

function buildMinimalLAN() {
  return {
    graphDef: {
      nodes: [
        createGateway("gateway", { attributes: { visibility: "accessible" } }),
        createRouter("router-a"),
      ],
      edges: [["gateway", "router-a"]],
      triggers: [],
    },
    meta: { startNode: "gateway", startCash: 0, moneyCost: "F" },
  };
}

test("ui flags default to closed/expanded", () => {
  initGame(() => buildMinimalLAN(), "ui-test-1");
  const s = getState();
  assert.equal(s.ui.menuOpen, false);
  assert.equal(s.ui.handCollapsed, false);
});

test("toggleMenuOpen flips menuOpen and returns the new value", () => {
  initGame(() => buildMinimalLAN(), "ui-test-2");
  const result = toggleMenuOpen();
  assert.equal(result, true);
  assert.equal(getState().ui.menuOpen, true);
  const result2 = toggleMenuOpen();
  assert.equal(result2, false);
  assert.equal(getState().ui.menuOpen, false);
});

test("toggleHandCollapsed flips handCollapsed and returns the new value", () => {
  initGame(() => buildMinimalLAN(), "ui-test-3");
  const result = toggleHandCollapsed();
  assert.equal(result, true);
  assert.equal(getState().ui.handCollapsed, true);
  const result2 = toggleHandCollapsed();
  assert.equal(result2, false);
  assert.equal(getState().ui.handCollapsed, false);
});

test("ui flags survive a JSON round-trip via serializeState", () => {
  initGame(() => buildMinimalLAN(), "ui-test-4");
  toggleMenuOpen();
  // serializeState() is the real save path (drops the nodeGraph circular ref);
  // the JSON hop proves the persisted ui flags carry no non-serializable values.
  const snapshot = JSON.parse(JSON.stringify(serializeState()));
  assert.equal(snapshot.ui.menuOpen, true);
  assert.equal(snapshot.ui.handCollapsed, false);
});

// #236 — the hub has no active run; the UI toggles must not require one.
test("toggleMenuOpen works with no active run (hub) and does not throw", () => {
  setActiveRun(null);   // simulate the overworld hub — no run in progress
  assert.equal(getState(), null);
  let open;
  assert.doesNotThrow(() => { open = toggleMenuOpen(); });
  assert.equal(open, true);
  assert.equal(toggleMenuOpen(), false);   // flips back
});

test("toggleHandCollapsed works with no active run (hub) and does not throw", () => {
  setActiveRun(null);
  let collapsed;
  assert.doesNotThrow(() => { collapsed = toggleHandCollapsed(); });
  assert.equal(collapsed, true);
  assert.equal(toggleHandCollapsed(), false);
});

test("loading a pre-ui save heals state.ui so the toggle setters don't crash", () => {
  initGame(() => buildMinimalLAN(), "ui-test-5");
  const snapshot = JSON.parse(JSON.stringify(serializeState()));
  delete snapshot.ui; // simulate a save made before state.ui existed
  deserializeState(snapshot);
  // Reads are ?.-guarded, but the toggle setters WRITE s.ui.x — without a heal
  // this throws TypeError on the first hamburger/hand toggle after loading.
  assert.doesNotThrow(() => toggleMenuOpen());
  assert.equal(getState().ui.menuOpen, true);
  assert.equal(getState().ui.handCollapsed, false);
});
