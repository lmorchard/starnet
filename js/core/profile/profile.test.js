import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createProfile,
  addCardToInventory,
  findCard,
  removeCardsByInstanceId,
  removeDisclosedCards,
  addRoundToHoard,
  removeDisclosedRounds,
  buildRunHoard,
  commitRun,
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

/** Minimal ExploitRound-shaped object for hoard tests (seed-independent). */
function round(id, over = {}) {
  return {
    id,
    rarity: "common",
    types: ["card"],
    disclosed: false,
    ...over,
  };
}

describe("createProfile", () => {
  it("sets version and bank, and carries a hoard", () => {
    const p = createProfile({ bank: 1000, hoard: [round("a"), round("b")] });
    assert.equal(p.version, PROFILE_VERSION);
    assert.equal(p.version, 2, "profile is version 2 after the hoard cutover");
    assert.equal(p.bank, 1000);
    assert.equal(p.hoard.length, 2);
    assert.deepEqual(p.hoard.map((r) => r.id).sort(), ["a", "b"]);
  });

  it("defaults to empty bank, hoard, and inventory", () => {
    const p = createProfile();
    assert.equal(p.bank, 0);
    assert.deepEqual(p.hoard, []);
    assert.deepEqual(p.inventory, []);
  });

  it("still bootstraps inventory cards with instanceIds (vestigial card path)", () => {
    const p = createProfile({ inventory: [card("a"), card("b")] });
    assert.equal(p.inventory.length, 2);
    assert.ok(p.inventory.every((c) => typeof c.instanceId === "string"));
  });
});

describe("addRoundToHoard", () => {
  it("pushes a round onto the hoard (no instanceId ceremony)", () => {
    const p = createProfile();
    addRoundToHoard(p, round("a"));
    addRoundToHoard(p, round("b"));
    assert.equal(p.hoard.length, 2);
    assert.deepEqual(p.hoard.map((r) => r.id), ["a", "b"]);
  });
});

describe("removeDisclosedRounds", () => {
  it("removes only disclosed rounds and returns them", () => {
    const p = createProfile({
      hoard: [
        round("a", { disclosed: false }),
        round("b", { disclosed: true }),
        round("c", { disclosed: false }),
        round("d", { disclosed: true }),
      ],
    });
    const removed = removeDisclosedRounds(p);
    assert.equal(removed.length, 2);
    assert.deepEqual(p.hoard.map((r) => r.id).sort(), ["a", "c"]);
  });

  it("is a no-op when nothing is disclosed", () => {
    const p = createProfile({ hoard: [round("a"), round("b")] });
    const removed = removeDisclosedRounds(p);
    assert.equal(removed.length, 0);
    assert.equal(p.hoard.length, 2);
  });
});

describe("buildRunHoard (carry-all clone)", () => {
  it("clones every round (new objects) so in-run mutation doesn't touch the stored hoard", () => {
    const p = createProfile({ hoard: [round("a"), round("b")] });
    const clones = buildRunHoard(p.hoard);
    assert.equal(clones.length, 2, "carries the ENTIRE hoard, no loadout limit");
    clones.forEach((c, i) => {
      assert.notEqual(c, p.hoard[i], "each round is a distinct object");
      assert.notEqual(c.types, p.hoard[i].types, "the types array is deep-copied");
    });
    // Mutate the clones (disclose + drop) — the stored hoard is untouched.
    clones[0].disclosed = true;
    clones.pop();
    assert.equal(p.hoard.length, 2, "stored hoard length unchanged");
    assert.equal(p.hoard[0].disclosed, false, "stored round not disclosed by clone mutation");
  });
});

describe("commitRun — clean (success)", () => {
  it("deposits run cash and persists the carried hoard (disclosed rounds already burned/absent)", () => {
    const p = createProfile({ bank: 100, hoard: [round("a"), round("b"), round("c")] });
    // Simulate a run that spent (disclosed → removed) round "b"; the final hoard omits it.
    const finalHoard = [round("a"), round("c")];
    commitRun(p, { outcome: "success", finalCash: 500, finalHoard });
    assert.equal(p.bank, 600, "run cash deposited");
    assert.equal(p.hoard, finalHoard, "hoard replaced with the final carried hoard");
    assert.deepEqual(p.hoard.map((r) => r.id), ["a", "c"], "burned round is absent");
  });
});

describe("commitRun — caught (E1: no hoard loss)", () => {
  it("keeps the hoard unchanged and deposits nothing (run cash already forfeit upstream)", () => {
    const p = createProfile({ bank: 250, hoard: [round("a"), round("b")] });
    const storedRef = p.hoard; // caught must NOT replace the stored array
    commitRun(p, { outcome: "caught", finalCash: 0, finalHoard: [round("a")] });
    assert.equal(p.bank, 250, "bank unchanged on capture");
    assert.equal(p.hoard, storedRef, "the stored hoard array is not replaced by the run's final hoard");
    assert.deepEqual(p.hoard.map((r) => r.id), ["a", "b"], "no rounds lost when caught");
  });
});

// ── Vestigial card machinery (kept defined until the Phase 9 sweep) ──────────

describe("addCardToInventory (vestigial)", () => {
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

describe("findCard / removeCardsByInstanceId (vestigial)", () => {
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

describe("removeDisclosedCards (vestigial)", () => {
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
