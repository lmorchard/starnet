// Tests for quickStartRun — the "canned hub start" used by ?network= deep-links and
// other fast-start scenarios. Like run-control.test, startRun touches DOM/Cytoscape but
// every graph fn guards on a null `cy`, so with a document stub it runs in node. hub.js
// also reaches the profile via localStorage, so we stub that too (in-memory).

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

globalThis.document = globalThis.document ?? { getElementById: () => null };
const _store = new Map();
globalThis.localStorage = globalThis.localStorage ?? {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null),
  setItem: (k, v) => _store.set(k, String(v)),
  removeItem: (k) => _store.delete(k),
};

const { quickStartRun } = await import("./hub.js");
const { initProfileRunCommit } = await import("./profile-store.js");
const { getState } = await import("../core/state.js");
const { buildNetwork } = await import("../../data/networks/generated.js");
const { initRng } = await import("../core/rng.js");
const { emitEvent, E } = await import("../core/events.js");

const PROFILE_KEY = "starnet:profile"; // mirror profile-store.js

describe("quickStartRun — canned hub start (fast-start / deep-link)", () => {
  // Reset the profile through the localStorage API (not the stub's internals) so this stays
  // correct under any localStorage implementation / test ordering. main.js inits the RNG
  // streams before either boot branch; mirror that (the profile bootstrap needs RNG).
  beforeEach(() => { localStorage.removeItem(PROFILE_KEY); initRng("hub-test"); });

  test("launches the given network directly into an active run", () => {
    assert.equal(quickStartRun(buildNetwork({ seed: "qs-1" })), true, "should report a launch");
    assert.ok(getState(), "a run should be active after a quick start");
    assert.ok(Object.keys(getState().nodes).length > 0, "the run's network should be loaded");
  });

  test("always seeds a fresh, playable hoard (no profile needed)", () => {
    quickStartRun(buildNetwork({ seed: "qs-2" }));
    assert.ok(getState().player.hoard.length > 0,
      "fast-start must always seed a fresh hoard, never launch empty-handed");
  });

  test("ignores the stored profile and does not commit back to it", () => {
    // Give the profile a distinctive v2 hoard. Fast-start should seed a FRESH generated
    // hoard (not the profile's) and must not draw from or write to the profile — the
    // stored hoard is unchanged afterward.
    const stored = { version: 2, bank: 1000, _hubVisits: 0, inventory: [],
      hoard: [{ id: "solo-relic", rarity: "common", types: [], disclosed: false }] };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(stored));
    quickStartRun(buildNetwork({ seed: "qs-3" }));
    assert.ok(getState().player.hoard.length > 1,
      "the seeded hoard is a fresh generated set, not the single stored round");
    const after = JSON.parse(localStorage.getItem(PROFILE_KEY));
    assert.equal(after.hoard.length, 1, "fast-start must not mutate the profile hoard");
    assert.equal(after.hoard[0].id, "solo-relic");
  });

  test("a fast-start run does not commit back to the profile on RUN_ENDED", () => {
    // Throwaway test session: ending a fast-start run must not deposit cash or alter the
    // hoard. prepareFastStartLaunch clears activeRun, so the commit subscriber no-ops.
    initProfileRunCommit();
    const before = { version: 2, bank: 1000, _hubVisits: 0, inventory: [],
      hoard: [{ id: "solo-relic", rarity: "common", types: [], disclosed: false }] };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(before));
    quickStartRun(buildNetwork({ seed: "qs-4" }));
    emitEvent(E.RUN_ENDED, { outcome: "success" });
    const after = JSON.parse(localStorage.getItem(PROFILE_KEY));
    assert.deepEqual(after, before, "a fast-start run must leave the profile untouched");
  });
});
