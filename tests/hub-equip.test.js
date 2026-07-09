// @ts-check
// TDD tests for E2-P4: hub equip UI (forced-choice loadout).
// Tests: equipGear cap (≤GEAR_SLOTS, (N+1)th rejected, owned-only, dedupe),
//        unequipGear frees a slot, prepareLaunch carries startLoadout,
//        and integration: launched loadout seeds player.loadout + burn honors it.
//
// RED phase: written before implementation.

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// ── DOM + localStorage stubs (for profile-store imports) ──────────────────────
globalThis.document = globalThis.document ?? { getElementById: () => null };
const _store = new Map();
globalThis.localStorage = globalThis.localStorage ?? {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null),
  setItem: (k, v) => _store.set(k, String(v)),
  removeItem: (k) => _store.delete(k),
};

// Dynamic imports (profile-store is a browser module; dynamic import lets us
// stub globals before it executes).
const { createProfile } = await import("../js/core/profile/index.js");
const {
  loadProfile, saveProfile, prepareLaunch, prepareFastStartLaunch,
  _resetCommitWiringForTest,
} = await import("../js/ui/profile-store.js");
const {
  equipGear, unequipGear, getHub, resetLoadoutSelection,
} = await import("../js/ui/hub.js");
const { GEAR_SLOTS } = await import("../js/core/balance.js");

const PROFILE_KEY = "starnet:profile";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Build + save a profile that owns the given gear ids. */
function profileWithGear(gearIds = []) {
  const p = createProfile({ bank: 9999, gear: gearIds });
  saveProfile(p);
  return p;
}

// ── Unit tests: equipGear / unequipGear ───────────────────────────────────────

describe("equipGear — cap enforcement", () => {
  beforeEach(() => {
    _store.clear();
    profileWithGear(["analyzer", "dampener", "recon-rig"]); // owns all three
    resetLoadoutSelection();
  });

  it("equips the first owned gear id — returns true", () => {
    const ok = equipGear("analyzer");
    assert.equal(ok, true, "equipGear must return true on success");
  });

  it("equips up to GEAR_SLOTS items", () => {
    for (let i = 0; i < GEAR_SLOTS; i++) {
      const ids = ["analyzer", "dampener", "recon-rig"];
      equipGear(ids[i]);
    }
    const { loadout } = getHub();
    assert.equal(loadout.length, GEAR_SLOTS, `loadout must be capped at GEAR_SLOTS (${GEAR_SLOTS})`);
  });

  it("(N+1)th equip is rejected — returns false, loadout unchanged", () => {
    equipGear("analyzer");
    equipGear("dampener"); // fills up GEAR_SLOTS (2)
    const before = getHub().loadout.slice();
    const ok = equipGear("recon-rig");
    assert.equal(ok, false, "(N+1)th equip must return false");
    assert.deepEqual(getHub().loadout, before, "loadout must be unchanged after cap-exceeded equip");
  });

  it("equipping same gear twice is a no-op (dedupe) — returns false", () => {
    equipGear("analyzer");
    const ok = equipGear("analyzer"); // duplicate
    assert.equal(ok, false, "duplicate equip must return false");
    assert.equal(
      getHub().loadout.filter((id) => id === "analyzer").length,
      1,
      "no duplicate ids in loadout"
    );
  });

  it("equipping unowned gear is rejected — returns false", () => {
    profileWithGear([]); // owns nothing
    resetLoadoutSelection();
    const ok = equipGear("analyzer");
    assert.equal(ok, false, "must reject unowned gear");
    assert.deepEqual(getHub().loadout, [], "loadout unchanged when gear not owned");
  });

  it("equipping unknown gear id is rejected — returns false", () => {
    const ok = equipGear("phantom-9000");
    assert.equal(ok, false, "must reject unknown gear id");
    assert.deepEqual(getHub().loadout, [], "loadout unchanged for unknown gear");
  });
});

describe("unequipGear — frees a slot", () => {
  beforeEach(() => {
    _store.clear();
    profileWithGear(["analyzer", "dampener", "recon-rig"]);
    resetLoadoutSelection();
  });

  it("unequips an equipped gear — removes it from loadout", () => {
    equipGear("analyzer");
    equipGear("dampener");
    assert.equal(getHub().loadout.length, 2);

    unequipGear("analyzer");
    const { loadout } = getHub();
    assert.equal(loadout.length, 1, "loadout must shrink after unequip");
    assert.ok(!loadout.includes("analyzer"), "unequipped id must not appear in loadout");
    assert.ok(loadout.includes("dampener"), "other gear must remain");
  });

  it("after unequip a new slot is free — the (N+1)th equip succeeds", () => {
    equipGear("analyzer");
    equipGear("dampener"); // full
    unequipGear("analyzer"); // free a slot
    const ok = equipGear("recon-rig");
    assert.equal(ok, true, "after unequip, a new equip must succeed");
    assert.ok(getHub().loadout.includes("recon-rig"), "recon-rig must be in loadout");
  });

  it("unequipping gear not in loadout is a no-op — does not throw", () => {
    equipGear("analyzer");
    assert.doesNotThrow(() => unequipGear("dampener"), "unequip of non-equipped gear must not throw");
    assert.deepEqual(getHub().loadout, ["analyzer"], "loadout unchanged after no-op unequip");
  });
});

// ── Unit tests: prepareLaunch carries startLoadout ────────────────────────────

describe("prepareLaunch — startLoadout in launch meta", () => {
  beforeEach(() => {
    _store.clear();
    _resetCommitWiringForTest();
    profileWithGear(["analyzer", "dampener"]);
    resetLoadoutSelection();
  });

  it("prepareLaunch with loadoutGearIds → meta.startLoadout carries those ids", () => {
    const meta = prepareLaunch({ withdrawAmount: 0, loadoutGearIds: ["analyzer"] });
    assert.ok(meta, "prepareLaunch must return a meta object");
    assert.ok(Array.isArray(meta.startLoadout), "startLoadout must be an array");
    assert.deepEqual(meta.startLoadout, ["analyzer"], "startLoadout must contain the equipped ids");
  });

  it("prepareLaunch with empty loadoutGearIds → startLoadout is []", () => {
    const meta = prepareLaunch({ withdrawAmount: 0, loadoutGearIds: [] });
    assert.ok(meta, "prepareLaunch must return a meta object");
    assert.deepEqual(meta.startLoadout, [], "startLoadout must be empty when no gear equipped");
  });

  it("prepareLaunch with no loadoutGearIds → startLoadout defaults to []", () => {
    const meta = prepareLaunch({ withdrawAmount: 0 });
    assert.ok(meta, "prepareLaunch must return a meta object");
    assert.deepEqual(meta.startLoadout, [], "startLoadout must default to []");
  });

  it("prepareLaunch filters unowned ids (defensive belt-and-suspenders)", () => {
    profileWithGear(["analyzer"]); // only owns analyzer
    const meta = prepareLaunch({
      withdrawAmount: 0,
      loadoutGearIds: ["analyzer", "dampener"], // dampener not owned
    });
    assert.ok(meta, "prepareLaunch must return a meta object");
    // dampener is not in profile.gear — defensive filter removes it
    assert.ok(!meta.startLoadout.includes("dampener"),
      "unowned gear must be filtered from startLoadout");
    assert.ok(meta.startLoadout.includes("analyzer"),
      "owned gear must remain in startLoadout");
  });

  it("prepareLaunch caps at GEAR_SLOTS even if caller sends more (defensive)", () => {
    profileWithGear(["analyzer", "dampener", "recon-rig"]);
    const meta = prepareLaunch({
      withdrawAmount: 0,
      loadoutGearIds: ["analyzer", "dampener", "recon-rig"], // 3 > GEAR_SLOTS(2)
    });
    assert.ok(meta, "prepareLaunch must return a meta object");
    assert.ok(meta.startLoadout.length <= GEAR_SLOTS,
      `startLoadout must be capped at GEAR_SLOTS (${GEAR_SLOTS}); got ${meta.startLoadout.length}`);
  });

  it("prepareFastStartLaunch → startLoadout is []", async () => {
    const { initRng } = await import("../js/core/rng.js");
    initRng("fast-start-test-seed");
    const meta = prepareFastStartLaunch();
    assert.ok(meta, "prepareFastStartLaunch must return a meta object");
    assert.deepEqual(meta.startLoadout, [], "fast-start must have empty startLoadout");
  });
});

// ── Integration: loadout carried into run + burn honors it ────────────────────

describe("hub equip integration — loadout seeds player.loadout at run-start", () => {
  beforeEach(() => {
    _store.clear();
    _resetCommitWiringForTest();
  });

  it("a launched loadout seeds player.loadout in the run", async () => {
    const { initGame, getState } = await import("../js/core/state.js");
    const { buildNetwork: buildCorporateExchange } = await import("../data/networks/corporate-exchange.js");

    profileWithGear(["dampener"]);
    resetLoadoutSelection();
    equipGear("dampener");

    const { loadout: hubLoadout } = getHub();
    assert.deepEqual(hubLoadout, ["dampener"], "precondition: dampener in hub loadout");

    const meta = prepareLaunch({ withdrawAmount: 0, loadoutGearIds: hubLoadout });
    assert.ok(meta, "prepareLaunch must succeed");
    assert.deepEqual(meta.startLoadout, ["dampener"], "startLoadout carries dampener");

    initGame(() => buildCorporateExchange(), "p4-loadout-seed-1");
    // Manually seed loadout from meta (mirrors what startRun does via initGame)
    const { setLoadout } = await import("../js/core/state/player.js");
    setLoadout(meta.startLoadout);

    assert.deepEqual(
      getState().player.loadout,
      ["dampener"],
      "player.loadout seeded from startLoadout"
    );
  });

  it("dampener in loadout: burn heat per shot is scaled down (end-to-end)", async () => {
    // Mirrors the autoburn E2-P2 test structure — confirms P4 → P2 end-to-end.
    const { initGame, getState } = await import("../js/core/state.js");
    const { buildNetwork: buildCorporateExchange } = await import("../data/networks/corporate-exchange.js");
    const { startAutoBurn, initAutoBurn } = await import("../js/core/autoburn.js");
    const { addRoundToHoard, setHoard, setLoadout } = await import("../js/core/state/player.js");
    const { setNodeCoherence } = await import("../js/core/state/node.js");
    const { on, clearHandlers, E } = await import("../js/core/events.js");
    const { clearAll, tick } = await import("../js/core/timers.js");
    const { COHERENCE, HEAT_COST, DAMPENER_HEAT_MULT } = await import("../js/core/balance.js");

    // Setup: equip dampener at hub, launch, seed the run
    profileWithGear(["dampener"]);
    resetLoadoutSelection();
    equipGear("dampener");
    const { loadout: hubLoadout } = getHub();

    const meta = prepareLaunch({ withdrawAmount: 0, loadoutGearIds: hubLoadout });
    assert.deepEqual(meta.startLoadout, ["dampener"], "startLoadout must contain dampener");

    initGame(() => buildCorporateExchange(), "p4-burn-honors-loadout-1");
    initAutoBurn();
    setLoadout(meta.startLoadout); // seed loadout from startLoadout (mirrors startRun)

    const nodeId = "gateway";
    for (let i = 0; i < 20; i++) {
      addRoundToHoard({ id: `p4r${i.toString(16).padStart(4, "0")}`, rarity: "common", types: ["unpatched-ssh"], disclosed: false });
    }
    setNodeCoherence(nodeId, COHERENCE["S"] ?? 2000);

    const stepEvents = [];
    on(E.PROCESS_STEP, (p) => stepEvents.push(p));

    // Ceiling = exactly 1 undampened shot. With dampener (×0.5), 2 shots fit.
    const baselineCeiling = HEAT_COST.xploit; // enough for 1 shot without dampener
    startAutoBurn(nodeId, { ceiling: baselineCeiling });
    tick(50);

    // With dampener, per-shot heat = HEAT_COST.xploit * DAMPENER_HEAT_MULT = 0.5*baseline.
    // So 2 shots fit in a 1-shot ceiling. Must see > 1 shot.
    assert.ok(
      stepEvents.length > 1,
      `dampener in loadout must allow more shots; baseline ceiling ${baselineCeiling}, got ${stepEvents.length} shot(s)`
    );

    clearHandlers();
    clearAll();
  });
});
