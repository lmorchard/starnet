import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createProfile,
  addCardToInventory,
  findCard,
  removeCardsByInstanceId,
  removeDisclosedCards,
  deposit,
  withdraw,
  PROFILE_VERSION,
} from "./index.js";

/** Minimal ExploitCard-shaped object for profile tests (seed-independent). */
function card(id, over = {}) {
  return {
    id,
    name: `card-${id}`,
    rarity: "common",
    quality: 1,
    targetVulnTypes: ["card"],
    decayState: "fresh",
    usesRemaining: 3,
    ...over,
  };
}

describe("createProfile", () => {
  it("sets version and bank, and bootstraps inventory with instanceIds", () => {
    const p = createProfile({ bank: 1000, inventory: [card("a"), card("b")] });
    assert.equal(p.version, PROFILE_VERSION);
    assert.equal(p.bank, 1000);
    assert.equal(p.inventory.length, 2);
    assert.ok(p.inventory.every((c) => typeof c.instanceId === "string"));
    const ids = new Set(p.inventory.map((c) => c.instanceId));
    assert.equal(ids.size, 2, "instanceIds are unique");
  });

  it("defaults to empty bank and inventory", () => {
    const p = createProfile();
    assert.equal(p.bank, 0);
    assert.deepEqual(p.inventory, []);
  });
});

describe("addCardToInventory", () => {
  it("assigns a unique instanceId when absent", () => {
    const p = createProfile();
    const a = addCardToInventory(p, card("a"));
    const b = addCardToInventory(p, card("b"));
    assert.ok(a.instanceId && b.instanceId);
    assert.notEqual(a.instanceId, b.instanceId);
    assert.equal(p.inventory.length, 2);
  });

  it("preserves an existing instanceId", () => {
    const p = createProfile();
    const c = addCardToInventory(p, card("a", { instanceId: "keep-me" }));
    assert.equal(c.instanceId, "keep-me");
  });

  it("keeps _instanceSeq ahead of an explicit inv-N id (no collision)", () => {
    const p = createProfile();
    addCardToInventory(p, card("a", { instanceId: "inv-5" }));
    const auto = addCardToInventory(p, card("b"));
    assert.equal(auto.instanceId, "inv-6");
  });
});

describe("findCard / removeCardsByInstanceId", () => {
  it("finds by instanceId", () => {
    const p = createProfile({ inventory: [card("a"), card("b")] });
    const target = p.inventory[1];
    assert.equal(findCard(p, target.instanceId), target);
    assert.equal(findCard(p, "nope"), undefined);
  });

  it("removes only matching instanceIds and returns the removed cards", () => {
    const p = createProfile({ inventory: [card("a"), card("b"), card("c")] });
    const burn = [p.inventory[0].instanceId, p.inventory[2].instanceId];
    const removed = removeCardsByInstanceId(p, burn);
    assert.equal(removed.length, 2);
    assert.equal(p.inventory.length, 1);
    assert.equal(p.inventory[0].id, "b");
  });
});

describe("deposit / withdraw", () => {
  it("deposit increases the bank", () => {
    const p = createProfile({ bank: 100 });
    deposit(p, 50);
    assert.equal(p.bank, 150);
  });

  it("withdraw debits on success and refuses when insufficient or negative", () => {
    const p = createProfile({ bank: 100 });
    assert.equal(withdraw(p, 40), true);
    assert.equal(p.bank, 60);
    assert.equal(withdraw(p, 1000), false, "refuses insufficient");
    assert.equal(p.bank, 60, "bank unchanged on failed withdraw");
    assert.equal(withdraw(p, -5), false, "refuses negative");
    assert.equal(p.bank, 60);
  });
});

describe("removeDisclosedCards", () => {
  it("removes only disclosed cards and returns them", () => {
    const p = createProfile({
      inventory: [
        card("a", { decayState: "fresh" }),
        card("b", { decayState: "disclosed" }),
        card("c", { decayState: "worn" }),
        card("d", { decayState: "disclosed" }),
      ],
    });
    const removed = removeDisclosedCards(p);
    assert.equal(removed.length, 2);
    assert.deepEqual(p.inventory.map((c) => c.id).sort(), ["a", "c"]);
  });

  it("is a no-op when nothing is disclosed", () => {
    const p = createProfile({ inventory: [card("a"), card("b")] });
    const removed = removeDisclosedCards(p);
    assert.equal(removed.length, 0);
    assert.equal(p.inventory.length, 2);
  });
});
