// @ts-check
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { buyFromStore } from "./store-logic.js";
import { getStoreCatalog } from "./exploits.js";
import { initState, getState } from "./state.js";
import { NETWORK } from "../data/network.js";

describe("buyFromStore", () => {
  beforeEach(() => {
    initState(NETWORK);
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
