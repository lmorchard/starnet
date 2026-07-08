// @ts-check
// Tests for store-logic.js — Phase 6 rewrite: store now sells research packs → hoard rounds.
// Old vuln-card tests removed; see tests/store-logic.test.js for the canonical new suite.

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { buyFromStore, buyFromStoreToProfile } from "./store-logic.js";
import { getPackCatalog, PACKS } from "./packs.js";
import { initGame, getState } from "./state.js";
import { initRng } from "./rng.js";
import { createProfile } from "./profile/index.js";
import { createGateway, createRouter } from "./node-graph/node-factories.js";

function buildStoreLAN() {
  return {
    graphDef: {
      nodes: [
        createGateway("gateway", { attributes: { visibility: "accessible" } }),
        createRouter("router-a"),
      ],
      edges: [["gateway", "router-a"]],
      triggers: [],
    },
    meta: { startNode: "gateway", startCash: 5000, moneyCost: "C", ice: null },
  };
}

describe("buyFromStore (in-run, pack-based)", () => {
  beforeEach(() => {
    initRng("store-logic-core-test");
    initGame(() => buildStoreLAN());
  });

  it("buys by catalog index (1-based) and grows player.hoard", () => {
    const catalog = getPackCatalog();
    const before = getState().player.hoard.length;
    const cashBefore = getState().player.cash;
    const result = buyFromStore(1);
    assert.ok(result, "expected successful purchase");
    assert.equal(result.pack.id, catalog[0].id);
    assert.equal(result.price, catalog[0].price);
    assert.equal(getState().player.cash, cashBefore - result.price);
    assert.equal(getState().player.hoard.length, before + catalog[0].size);
  });

  it("buys by pack ID string", () => {
    const pack = PACKS[0];
    const result = buyFromStore(pack.id);
    assert.ok(result, "expected successful purchase");
    assert.equal(result.pack.id, pack.id);
  });

  it("returns null for invalid index", () => {
    assert.equal(buyFromStore(999), null);
    assert.equal(buyFromStore(0), null);
  });

  it("returns null for unknown pack ID", () => {
    assert.equal(buyFromStore("nonexistent-pack"), null);
  });

  it("returns null when player can't afford", () => {
    const s = getState();
    s.player.cash = 0;
    const result = buyFromStore(1);
    assert.equal(result, null);
  });
});

describe("buyFromStoreToProfile (hub darknet, pack-based)", () => {
  beforeEach(() => initRng("store-logic-profile-test"));

  it("spends bank and adds rounds to profile hoard", () => {
    const catalog = getPackCatalog();
    const p = createProfile({ bank: 99999 });
    const before = p.hoard.length;
    const result = buyFromStoreToProfile(p, 1);
    assert.ok(result, "expected successful purchase");
    assert.equal(result.price, catalog[0].price);
    assert.equal(p.bank, 99999 - catalog[0].price);
    assert.equal(p.hoard.length, before + catalog[0].size);
  });

  it("refuses when the bank can't cover the price (no debit, no rounds)", () => {
    const p = createProfile({ bank: 0 });
    assert.equal(buyFromStoreToProfile(p, 1), null);
    assert.equal(p.bank, 0);
    assert.equal(p.hoard.length, 0);
  });

  it("returns null for an out-of-range index", () => {
    const p = createProfile({ bank: 99999 });
    assert.equal(buyFromStoreToProfile(p, 999), null);
    assert.equal(p.bank, 99999);
  });
});
