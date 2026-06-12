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
const { getState } = await import("../core/state.js");
const { buildNetwork } = await import("../../data/networks/generated.js");
const { initRng } = await import("../core/rng.js");

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

  test("equips a default starter loadout so the run is playable (non-empty hand)", () => {
    quickStartRun(buildNetwork({ seed: "qs-2" }));
    assert.ok(getState().player.hand.length > 0,
      "fast-start must deal a starter hand, not launch with an empty loadout");
  });

  test("returns false (caller falls back to the hub) when the loadout can't be prepared", () => {
    // Corrupt profile: negative bank makes withdraw(_, 0) fail → prepareLaunch returns null.
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ version: 1, bank: -1, inventory: [], _instanceSeq: 0 }));
    assert.equal(quickStartRun(buildNetwork({ seed: "qs-3" })), false,
      "a failed launch prep must report false rather than start an unplayable run");
  });
});
