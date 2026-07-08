// @ts-check
// Tests for js/core/store-logic.js — pack buy (in-run + hub).

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { initRng } from "../js/core/rng.js";
import { getPackCatalog, PACKS } from "../js/core/packs.js";
import { buyFromStore, buyFromStoreToProfile } from "../js/core/store-logic.js";
import { initGame, getState } from "../js/core/state.js";
import { createProfile } from "../js/core/profile/index.js";
import {
  createGateway, createRouter, createWAN,
} from "../js/core/node-graph/node-factories.js";

/** Build a minimal graphDef with gateway + router + WAN */
function makeMinNet() {
  return {
    graphDef: {
      nodes: [
        createGateway("gateway", { attributes: { visibility: "accessible" } }),
        createRouter("router-a"),
        createWAN("wan-1"),
      ],
      edges: [["gateway", "router-a"], ["router-a", "wan-1"]],
      triggers: [],
    },
    meta: { startNode: "gateway", startCash: 0, moneyCost: "C" },
  };
}

beforeEach(() => {
  initRng("store-logic-test");
  const { graphDef, meta } = makeMinNet();
  initGame(() => ({ graphDef, meta }), "store-test-seed");
});

// ── in-run buyFromStore ───────────────────────────────────────────────────────

describe("buyFromStore (in-run)", () => {
  it("1-based index resolves to the catalog item", () => {
    const s = getState();
    s.player.cash = 99999;
    initRng("store-buy-idx");
    const result = buyFromStore(1);
    assert.ok(result !== null, "result must not be null for a valid index");
    assert.ok(result.pack, "result must have pack");
    assert.ok(result.rounds, "result must have rounds");
  });

  it("returns null for out-of-range index", () => {
    const result = buyFromStore(999);
    assert.equal(result, null);
  });

  it("returns null for unknown pack id string", () => {
    const result = buyFromStore("no-such-pack");
    assert.equal(result, null);
  });

  it("spends run cash equal to pack price", () => {
    const catalog = getPackCatalog();
    const firstPack = catalog[0];
    const s = getState();
    s.player.cash = firstPack.price + 100;
    initRng("store-spend");
    buyFromStore(1);
    assert.equal(getState().player.cash, 100, "cash must be reduced by pack price");
  });

  it("returns null and spends NO cash when insufficient funds", () => {
    const catalog = getPackCatalog();
    const firstPack = catalog[0];
    const s = getState();
    s.player.cash = firstPack.price - 1;
    const before = getState().player.cash;
    const result = buyFromStore(1);
    assert.equal(result, null, "must return null when insufficient funds");
    assert.equal(getState().player.cash, before, "cash must be unchanged on failure");
  });

  it("appends the right number of rounds to player.hoard", () => {
    const catalog = getPackCatalog();
    const firstPack = catalog[0];
    const s = getState();
    s.player.cash = 99999;
    const before = getState().player.hoard.length;
    initRng("store-hoard-growth");
    const result = buyFromStore(1);
    assert.ok(result !== null);
    assert.equal(result.rounds.length, firstPack.size, "rounds array has pack size");
    assert.equal(getState().player.hoard.length, before + firstPack.size, "hoard grew by pack size");
  });

  it("result.pack has id, name, size matching the catalog item", () => {
    const catalog = getPackCatalog();
    const s = getState();
    s.player.cash = 99999;
    initRng("store-result-shape");
    const result = buyFromStore(1);
    assert.ok(result !== null);
    assert.equal(result.pack.id, catalog[0].id);
    assert.equal(result.pack.name, catalog[0].name);
    assert.equal(result.pack.size, catalog[0].size);
    assert.equal(result.price, catalog[0].price);
  });

  it("pack id string resolves correctly", () => {
    const pack = PACKS[0];
    const s = getState();
    s.player.cash = 99999;
    initRng("store-by-id");
    const result = buyFromStore(pack.id);
    assert.ok(result !== null, "pack id string must resolve");
    assert.equal(result.pack.id, pack.id);
  });
});

// ── hub buyFromStoreToProfile ─────────────────────────────────────────────────

describe("buyFromStoreToProfile (hub)", () => {
  it("spends bank cash equal to pack price", () => {
    const catalog = getPackCatalog();
    const firstPack = catalog[0];
    const profile = createProfile({ bank: firstPack.price + 500 });
    initRng("hub-spend");
    buyFromStoreToProfile(profile, 1);
    assert.equal(profile.bank, 500, "bank must be reduced by pack price");
  });

  it("returns null and spends NO bank when insufficient funds", () => {
    const catalog = getPackCatalog();
    const firstPack = catalog[0];
    const profile = createProfile({ bank: firstPack.price - 1 });
    const before = profile.bank;
    const result = buyFromStoreToProfile(profile, 1);
    assert.equal(result, null, "must return null on insufficient bank");
    assert.equal(profile.bank, before, "bank must be unchanged");
  });

  it("appends rounds to profile.hoard", () => {
    const catalog = getPackCatalog();
    const firstPack = catalog[0];
    const profile = createProfile({ bank: 99999 });
    const before = profile.hoard.length;
    initRng("hub-hoard-growth");
    const result = buyFromStoreToProfile(profile, 1);
    assert.ok(result !== null);
    assert.equal(result.rounds.length, firstPack.size, "rounds array has pack size");
    assert.equal(profile.hoard.length, before + firstPack.size, "profile hoard grew");
  });

  it("returns null for unknown pack id", () => {
    const profile = createProfile({ bank: 99999 });
    const result = buyFromStoreToProfile(profile, "zzz-bogus");
    assert.equal(result, null);
  });

  it("result shape has pack, price, rounds", () => {
    const catalog = getPackCatalog();
    const profile = createProfile({ bank: 99999 });
    initRng("hub-result-shape");
    const result = buyFromStoreToProfile(profile, 1);
    assert.ok(result !== null);
    assert.ok(result.pack);
    assert.ok(typeof result.price === "number");
    assert.ok(Array.isArray(result.rounds));
    assert.equal(result.pack.id, catalog[0].id);
  });
});
