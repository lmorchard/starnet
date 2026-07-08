// Run-lifecycle integration for the persistent carry-all hoard (E1 Phase 5).
// startRun/initGame touch DOM/Cytoscape but every graph fn guards on a null `cy`,
// so with a document stub it runs in node. profile-store reaches localStorage, so
// we stub that too (in-memory).

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

globalThis.document = globalThis.document ?? { getElementById: () => null };
const _store = new Map();
globalThis.localStorage = globalThis.localStorage ?? {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null),
  setItem: (k, v) => _store.set(k, String(v)),
  removeItem: (k) => _store.delete(k),
};

const { initGame, getState } = await import("../js/core/state.js");
const { clearHandlers, emitEvent, E } = await import("../js/core/events.js");
const { clearAll } = await import("../js/core/timers.js");
const { initRng } = await import("../js/core/rng.js");
const { buildNetwork: buildCorporateFoothold } = await import("../data/networks/corporate-foothold.js");
const {
  loadProfile, saveProfile, prepareLaunch, initProfileRunCommit,
  _resetCommitWiringForTest,
} = await import("../js/ui/profile-store.js");

const PROFILE_KEY = "starnet:profile"; // mirror profile-store.js

/** Minimal ExploitRound-shaped object (seed-independent). */
function round(id, over = {}) {
  return { id, rarity: "common", types: ["card"], disclosed: false, ...over };
}

afterEach(() => { clearHandlers(); clearAll(); });

describe("initGame — hoard seeding at run-start", () => {
  it("seeds player.hoard from meta.startHoard (carrying the whole profile hoard in)", () => {
    const startHoard = [round("h1"), round("h2"), round("h3")];
    initGame(() => {
      const r = buildCorporateFoothold();
      return { graphDef: r.graphDef, meta: { ...r.meta, startHoard } };
    }, "hoard-seed-1");
    const hoard = getState().player.hoard;
    assert.deepEqual(hoard.map((r) => r.id), ["h1", "h2", "h3"], "hand-off carries the whole hoard");
  });
});

describe("run lifecycle — profile ↔ run hoard", () => {
  beforeEach(() => {
    localStorage.removeItem(PROFILE_KEY);
    initRng("lifecycle-test");
    _resetCommitWiringForTest(); // reset guard so each test re-registers the RUN_ENDED handler
  });

  it("launch seeds player.hoard from the profile; a clean jack-out persists the (thinned) hoard", () => {
    initProfileRunCommit();
    // A v2 profile with a known 3-round hoard.
    const profile = { version: 2, bank: 1000, hoard: [round("a"), round("b"), round("c")], inventory: [], _instanceSeq: 0, _hubVisits: 0 };
    saveProfile(profile);

    const { startHoard, startCash } = prepareLaunch({ withdrawAmount: 0 });
    assert.equal(startHoard.length, 3, "launch carries the entire hoard");

    initGame(() => {
      const r = buildCorporateFoothold();
      return { graphDef: r.graphDef, meta: { ...r.meta, startHoard, startCash } };
    }, "lifecycle-run-1");

    // Simulate spending a round in-run: drop one from the run hoard.
    getState().player.hoard.pop();
    emitEvent(E.RUN_ENDED, { outcome: "success" });

    const after = loadProfile();
    assert.equal(after.hoard.length, 2, "the thinned run hoard is persisted back to the profile");
  });

  it("a caught run leaves the profile hoard intact (E1: no loss)", () => {
    initProfileRunCommit();
    const profile = { version: 2, bank: 500, hoard: [round("a"), round("b"), round("c")], inventory: [], _instanceSeq: 0, _hubVisits: 0 };
    saveProfile(profile);

    const { startHoard, startCash } = prepareLaunch({ withdrawAmount: 0 });
    initGame(() => {
      const r = buildCorporateFoothold();
      return { graphDef: r.graphDef, meta: { ...r.meta, startHoard, startCash } };
    }, "lifecycle-run-2");

    // Even if the run burned rounds, being caught keeps the stored hoard whole.
    getState().player.hoard.pop();
    getState().player.hoard.pop();
    emitEvent(E.RUN_ENDED, { outcome: "caught" });

    const after = loadProfile();
    assert.equal(after.hoard.length, 3, "caught keeps the full hoard");
    assert.deepEqual(after.hoard.map((r) => r.id).sort(), ["a", "b", "c"]);
  });
});

describe("loadProfile — v1 reset (no migration)", () => {
  beforeEach(() => { localStorage.removeItem(PROFILE_KEY); initRng("v1-reset-test"); });

  it("discards a stored v1 (inventory-based) profile and bootstraps a fresh v2 with a generated hoard", () => {
    const v1 = {
      version: 1,
      bank: 4242,
      _instanceSeq: 3,
      inventory: [{ instanceId: "inv-0", name: "Solo Relic", rarity: "common", targetVulnTypes: [] }],
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(v1));

    const p = loadProfile();
    assert.equal(p.version, 2, "loaded profile is a fresh v2");
    assert.ok(Array.isArray(p.hoard) && p.hoard.length > 0, "fresh profile has a generated hoard");
    assert.notEqual(p.bank, 4242, "the v1 bank is discarded (fresh bootstrap), not migrated");
    // The v1 profile is not crashed on — it is simply replaced.
    assert.doesNotThrow(() => loadProfile());
  });

  it("normalizes a v2 profile without discarding (ensures a hoard array)", () => {
    const v2 = { version: 2, bank: 10, _hubVisits: 0, inventory: [] }; // missing hoard
    localStorage.setItem(PROFILE_KEY, JSON.stringify(v2));
    const p = loadProfile();
    assert.equal(p.version, 2);
    assert.equal(p.bank, 10, "a valid v2 profile is kept, not reset");
    assert.ok(Array.isArray(p.hoard), "a missing hoard is healed to an array");
  });
});
