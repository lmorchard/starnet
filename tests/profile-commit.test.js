import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { initGame, getState } from "../js/core/state.js";
import { clearHandlers } from "../js/core/events.js";
import { buildNetwork as buildCorporateFoothold } from "../data/networks/corporate-foothold.js";
import {
  createProfile,
  buildRunHand,
  commitRun,
  findCard,
} from "../js/core/profile/index.js";

afterEach(() => clearHandlers());

/** Minimal ExploitCard-shaped object (seed-independent). */
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

describe("buildRunHand", () => {
  it("clones loadout cards (new objects) while preserving instanceId", () => {
    const p = createProfile({ inventory: [card("a")] });
    const [src] = p.inventory;
    const [clone] = buildRunHand([src]);
    assert.notEqual(clone, src, "is a distinct object");
    assert.equal(clone.instanceId, src.instanceId, "keeps instanceId for write-back");
    assert.notEqual(clone.targetVulnTypes, src.targetVulnTypes, "deep-copies the vuln array");
    clone.usesRemaining = 0;
    assert.equal(src.usesRemaining, 3, "mutating the clone does not touch the inventory card");
  });
});

describe("commitRun — success", () => {
  it("deposits run cash to the bank", () => {
    const p = createProfile({ bank: 100, inventory: [card("a")] });
    commitRun(p, { outcome: "success", finalCash: 500, finalHand: [], carriedInstanceIds: [] });
    assert.equal(p.bank, 600);
  });

  it("writes a carried card's decay back to the same inventory instance", () => {
    const p = createProfile({ bank: 0, inventory: [card("a")] });
    const src = p.inventory[0];
    const [run] = buildRunHand([src]);
    run.usesRemaining = 1;
    run.decayState = "worn";
    commitRun(p, {
      outcome: "success",
      finalCash: 0,
      finalHand: [run],
      carriedInstanceIds: [src.instanceId],
    });
    const updated = findCard(p, src.instanceId);
    assert.equal(updated.usesRemaining, 1);
    assert.equal(updated.decayState, "worn");
    assert.equal(p.inventory.length, 1, "no duplicate added");
  });

  it("adds a mid-run-acquired card (no instanceId) to inventory", () => {
    const p = createProfile({ bank: 0, inventory: [card("a")] });
    const carried = buildRunHand(p.inventory);
    const bought = card("bought"); // no instanceId — simulates store/mine acquisition
    commitRun(p, {
      outcome: "success",
      finalCash: 0,
      finalHand: [...carried, bought],
      carriedInstanceIds: p.inventory.map((c) => c.instanceId),
    });
    assert.equal(p.inventory.length, 2);
    const added = p.inventory.find((c) => c.id === "bought");
    assert.ok(added && added.instanceId, "new card got an instanceId");
  });
});

describe("commitRun — caught (Medium stakes)", () => {
  it("burns the carried loadout, deposits nothing, leaves un-carried inventory and bank intact", () => {
    const p = createProfile({ bank: 250, inventory: [card("a"), card("b")] });
    const carriedId = p.inventory[0].instanceId;
    commitRun(p, {
      outcome: "caught",
      finalCash: 0,
      finalHand: [],
      carriedInstanceIds: [carriedId],
    });
    assert.equal(p.bank, 250, "bank unchanged on capture");
    assert.equal(p.inventory.length, 1, "carried card burned");
    assert.equal(p.inventory[0].id, "b", "un-carried card survives");
  });
});

describe("initGame loadout path", () => {
  it("uses meta.startHandCards (as fresh clones) when present", () => {
    const loadout = [card("x", { instanceId: "inv-x" }), card("y", { instanceId: "inv-y" })];
    initGame(() => {
      const r = buildCorporateFoothold();
      return { graphDef: r.graphDef, meta: { ...r.meta, startHandCards: loadout } };
    }, "loadout-seed-1");
    const hand = getState().player.hand;
    assert.deepEqual(
      hand.map((c) => c.instanceId),
      ["inv-x", "inv-y"],
      "hand carries the provided loadout (by instanceId)",
    );
    // Clones, not aliases: mutating the run hand must not touch the caller's cards.
    assert.notEqual(hand[0], loadout[0], "hand card is a distinct object");
    hand[0].usesRemaining = 0;
    assert.notEqual(loadout[0].usesRemaining, 0, "loadout source is untouched by in-run mutation");
  });

  it("falls back to generating a hand when startHandCards is absent", () => {
    initGame(() => buildCorporateFoothold(), "loadout-seed-2");
    const hand = getState().player.hand;
    assert.ok(hand.length > 0);
    assert.ok(hand.every((c) => c.instanceId === undefined), "generated cards have no instanceId");
  });
});
