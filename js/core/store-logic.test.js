// @ts-check
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { buyFromStore, buyFromStoreToProfile } from "./store-logic.js";
import { getStoreCatalog } from "./exploits.js";
import { initGame, getState } from "./state.js";
import { initRng } from "./rng.js";
import { createProfile } from "./profile/index.js";
import { createGateway, createRouter } from "./node-graph/game-types.js";

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

describe("buyFromStore", () => {
  beforeEach(() => {
    initGame(() => buildStoreLAN());
  });

  it("buys by catalog index (1-based)", () => {
    const catalog = getStoreCatalog();
    const before = getState().player.cash;
    const result = buyFromStore(1);
    assert.ok(result, "expected successful purchase");
    assert.equal(result.vulnId, catalog[0].vulnId);
    assert.equal(result.price, catalog[0].price);
    assert.equal(getState().player.cash, before - result.price);
    // Card should be in hand
    const hand = getState().player.hand;
    assert.ok(hand.some((c) => c.id === result.card.id));
  });

  it("buys by vuln ID string", () => {
    const catalog = getStoreCatalog();
    const vulnId = catalog[0].vulnId;
    const result = buyFromStore(vulnId);
    assert.ok(result, "expected successful purchase");
    assert.equal(result.vulnId, vulnId);
  });

  it("returns null for invalid index", () => {
    assert.equal(buyFromStore(999), null);
    assert.equal(buyFromStore(0), null);
  });

  it("returns null for unknown vuln ID", () => {
    assert.equal(buyFromStore("nonexistent-vuln"), null);
  });

  it("returns null when player can't afford", () => {
    // Drain cash
    const s = getState();
    const catalog = getStoreCatalog();
    // Buy until broke
    while (s.player.cash >= catalog[0].price) {
      const r = buyFromStore(1);
      if (!r) break;
    }
    // Now should fail
    const result = buyFromStore(1);
    assert.equal(result, null);
  });
});

describe("buyFromStoreToProfile (hub darknet)", () => {
  beforeEach(() => initRng("store-logic-profile-test"));

  it("spends bank and adds the card to inventory", () => {
    const p = createProfile({ bank: 1000 });
    const price = getStoreCatalog()[0].price;
    const result = buyFromStoreToProfile(p, 1);
    assert.ok(result, "expected successful purchase");
    assert.equal(result.price, price);
    assert.equal(p.bank, 1000 - price);
    assert.equal(p.inventory.length, 1);
    assert.ok(p.inventory[0].instanceId, "purchased card gets an instanceId");
    assert.equal(p.inventory[0].id, result.card.id);
  });

  it("refuses when the bank can't cover the price (no debit, no card)", () => {
    const p = createProfile({ bank: 0 });
    assert.equal(buyFromStoreToProfile(p, 1), null);
    assert.equal(p.bank, 0);
    assert.equal(p.inventory.length, 0);
  });

  it("returns null for an out-of-range index", () => {
    const p = createProfile({ bank: 1000 });
    assert.equal(buyFromStoreToProfile(p, 999), null);
    assert.equal(p.bank, 1000);
  });
});
