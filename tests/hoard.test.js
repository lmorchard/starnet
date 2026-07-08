// @ts-check
// Tests for js/core/hoard.js — ExploitRound record, hex-ID mint, generators.
// SEED CONVENTION: always call initRng() with an explicit string before generating
// rounds. Without it, initRng defaults to a Math.random()-derived seed → silently
// flaky. See the mining.test.js pattern and the integration test comment block.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { initRng } from "../js/core/rng.js";
import { generateRound, generateHoard, resetRoundIdCounter } from "../js/core/hoard.js";
import { openPack } from "../js/core/packs.js";

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
    // The counter must be reset explicitly (not inside generateHoard) for determinism.
    const makeHoard = () => {
      initRng("hoard-determinism-seed");
      resetRoundIdCounter();
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

  it("ids are unique across starting hoard + two packs opened mid-run (cross-generation uniqueness)", () => {
    // Regression test for #2: resetRoundIdCounter() inside generateHoard/openPack
    // caused the counter to restart on each call → id collisions across calls.
    // The fix: counter is monotonic within a session; only reset explicitly via resetRoundIdCounter().
    initRng("hoard-xgen-seed");
    resetRoundIdCounter(); // explicit reset at session start — the only legal call site
    const startingHoard = generateHoard({ common: 12, uncommon: 3, rare: 1 });
    const pack1 = openPack("cache-common");   // openPack internally calls generateHoard
    const pack2 = openPack("dump-mixed");
    const allRounds = [...startingHoard, ...pack1, ...pack2];
    const ids = allRounds.map((r) => r.id);
    const unique = new Set(ids);
    assert.equal(
      unique.size,
      ids.length,
      `all round ids must be unique across starting hoard + packs (got ${ids.length} rounds, ${unique.size} unique ids)`
    );
  });

  it("counter is monotonic across generateHoard calls — hi-nibbles never repeat (proves no reset between calls)", () => {
    // This directly detects the bug: if resetRoundIdCounter() is called inside generateHoard,
    // the hi-nibble (top 4 hex chars of the id = the counter) resets to 0000 on every call,
    // so hoard1 round ids share the same hi-nibbles as hoard2 round ids.
    // After the fix the counter is monotonic, so all hi-nibbles across both calls are distinct.
    initRng("hoard-mono-seed");
    resetRoundIdCounter();
    const hoard1 = generateHoard({ common: 4 });  // mints ids with hi = 0000..0003
    const hoard2 = generateHoard({ common: 4 });  // must continue at hi = 0004..0007 (NOT reset to 0000)
    const hi1 = hoard1.map((r) => r.id.slice(0, 4));
    const hi2 = hoard2.map((r) => r.id.slice(0, 4));
    const overlap = hi1.filter((h) => hi2.includes(h));
    assert.deepEqual(
      overlap,
      [],
      `hi-nibbles must not overlap across calls (overlap: ${JSON.stringify(overlap)}) — counter resets between calls`
    );
  });

  it("determinism: explicit resetRoundIdCounter before generateHoard yields same result each call", () => {
    // Replacing generateHoard's internal reset with an explicit caller reset keeps determinism for tests.
    const makeHoard = () => {
      initRng("hoard-determ-explicit");
      resetRoundIdCounter();
      return generateHoard({ common: 20, uncommon: 5, rare: 2 });
    };
    const first = makeHoard();
    const second = makeHoard();
    assert.deepEqual(first, second, "explicit reset + same seed must produce identical hoard");
  });
});
