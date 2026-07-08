// @ts-check
// Tests for js/core/hoard.js — ExploitRound record, hex-ID mint, generators.
// SEED CONVENTION: always call initRng() with an explicit string before generating
// rounds. Without it, initRng defaults to a Math.random()-derived seed → silently
// flaky. See the mining.test.js pattern and the integration test comment block.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { initRng } from "../js/core/rng.js";
import { generateRound, generateHoard } from "../js/core/hoard.js";

describe("generateRound — type counts by rarity", () => {
  it("rare round has 3 types", () => {
    initRng("hoard-rare-1");
    const r = generateRound("rare");
    assert.equal(r.types.length, 3, "rare round must have exactly 3 types");
  });

  it("uncommon round has 2 types", () => {
    initRng("hoard-uncommon-1");
    const r = generateRound("uncommon");
    assert.equal(r.types.length, 2, "uncommon round must have exactly 2 types");
  });

  it("common round has 1 type", () => {
    initRng("hoard-common-1");
    const r = generateRound("common");
    assert.equal(r.types.length, 1, "common round must have exactly 1 type");
  });

  it("all rounds start disclosed:false", () => {
    initRng("hoard-disclosed-1");
    assert.equal(generateRound("common").disclosed, false);
    initRng("hoard-disclosed-2");
    assert.equal(generateRound("uncommon").disclosed, false);
    initRng("hoard-disclosed-3");
    assert.equal(generateRound("rare").disclosed, false);
  });
});

describe("generateRound — id format", () => {
  it("id matches 8-char hex pattern", () => {
    initRng("hoard-id-1");
    const r = generateRound("common");
    assert.match(r.id, /^[0-9a-f]{8}$/, "round id must be 8 lowercase hex chars");
  });

  it("id matches pattern for all rarities", () => {
    for (const rarity of /** @type {const} */ (["common", "uncommon", "rare"])) {
      initRng(`hoard-id-${rarity}`);
      const r = generateRound(rarity);
      assert.match(r.id, /^[0-9a-f]{8}$/, `${rarity} round id must be 8 lowercase hex chars`);
    }
  });
});

describe("generateHoard — bulk generation and uniqueness", () => {
  it("yields the correct total count and per-rarity counts", () => {
    initRng("hoard-bulk-1");
    const hoard = generateHoard({ common: 200, uncommon: 40, rare: 10 });
    assert.equal(hoard.length, 250, "total round count must be 250");
    const byRarity = { common: 0, uncommon: 0, rare: 0 };
    for (const r of hoard) byRarity[r.rarity]++;
    assert.equal(byRarity.common, 200, "common count");
    assert.equal(byRarity.uncommon, 40, "uncommon count");
    assert.equal(byRarity.rare, 10, "rare count");
  });

  it("all ids in a 250-round hoard are unique", () => {
    initRng("hoard-unique-1");
    const hoard = generateHoard({ common: 200, uncommon: 40, rare: 10 });
    const ids = hoard.map(r => r.id);
    const unique = new Set(ids);
    assert.equal(unique.size, ids.length, "all round ids must be unique across the hoard");
  });

  it("is deterministic — same seed → identical hoard", () => {
    const makeHoard = () => {
      initRng("hoard-determinism-seed");
      return generateHoard({ common: 20, uncommon: 5, rare: 2 });
    };
    const first = makeHoard();
    const second = makeHoard();
    assert.deepEqual(first, second, "same seed must produce identical hoard");
  });

  it("handles sparse spec (only one rarity)", () => {
    initRng("hoard-sparse-1");
    const hoard = generateHoard({ common: 5 });
    assert.equal(hoard.length, 5);
    assert.ok(hoard.every(r => r.rarity === "common"));
  });

  it("handles empty spec → empty hoard", () => {
    initRng("hoard-empty-1");
    const hoard = generateHoard({});
    assert.equal(hoard.length, 0);
  });
});
