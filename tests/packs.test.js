// @ts-check
// Tests for js/core/packs.js — blind-box research pack catalog + openPack.

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { initRng } from "../js/core/rng.js";
import { getPackCatalog, openPack, PACKS } from "../js/core/packs.js";

beforeEach(() => {
  initRng("packs-test-seed");
});

describe("getPackCatalog", () => {
  it("returns one entry per PACK definition", () => {
    const catalog = getPackCatalog();
    assert.equal(catalog.length, PACKS.length);
  });

  it("each catalog entry has id, name, mix, price, size", () => {
    const catalog = getPackCatalog();
    for (const item of catalog) {
      assert.ok(item.id, "must have id");
      assert.ok(item.name, "must have name");
      assert.ok(typeof item.price === "number" && item.price > 0, "must have positive price");
      assert.ok(typeof item.size === "number" && item.size > 0, "must have positive size");
      assert.ok(typeof item.mix === "object", "must have mix object");
    }
  });

  it("size equals sum of mix counts", () => {
    const catalog = getPackCatalog();
    for (const item of catalog) {
      const expected = Object.values(item.mix).reduce((a, b) => a + b, 0);
      assert.equal(item.size, expected, `size for ${item.id} must equal sum of mix`);
    }
  });

  it("returns a fresh copy of mix (not the original)", () => {
    const [item] = getPackCatalog();
    const [item2] = getPackCatalog();
    assert.notEqual(item.mix, item2.mix, "mix must be a fresh object each call");
  });
});

describe("openPack", () => {
  it("unknown packId → empty array", () => {
    const rounds = openPack("no-such-pack");
    assert.deepEqual(rounds, []);
  });

  it("'cache-common' yields correct total count", () => {
    const pack = PACKS.find((p) => p.id === "cache-common");
    assert.ok(pack);
    initRng("packs-open-common");
    const rounds = openPack("cache-common");
    const expected = Object.values(pack.mix).reduce((a, b) => a + b, 0);
    assert.equal(rounds.length, expected, `cache-common must yield ${expected} rounds`);
  });

  it("'cache-common' yields only common rounds", () => {
    initRng("packs-common-rarity");
    const rounds = openPack("cache-common");
    for (const r of rounds) {
      assert.equal(r.rarity, "common", "all rounds in cache-common must be common");
    }
  });

  it("'dump-mixed' yields correct total count with mixed rarities", () => {
    const pack = PACKS.find((p) => p.id === "dump-mixed");
    assert.ok(pack);
    initRng("packs-open-mixed");
    const rounds = openPack("dump-mixed");
    const expected = Object.values(pack.mix).reduce((a, b) => a + b, 0);
    assert.equal(rounds.length, expected);
    const byRarity = { common: 0, uncommon: 0, rare: 0 };
    for (const r of rounds) byRarity[r.rarity]++;
    assert.equal(byRarity.common, pack.mix.common ?? 0);
    assert.equal(byRarity.uncommon, pack.mix.uncommon ?? 0);
    assert.equal(byRarity.rare, pack.mix.rare ?? 0);
  });

  it("'req-rare' yields a rare round", () => {
    const pack = PACKS.find((p) => p.id === "req-rare");
    assert.ok(pack);
    initRng("packs-open-rare");
    const rounds = openPack("req-rare");
    const rareCount = rounds.filter((r) => r.rarity === "rare").length;
    assert.equal(rareCount, pack.mix.rare ?? 0, "req-rare must yield the right rare count");
  });

  it("all rounds have id, rarity, types, disclosed:false", () => {
    initRng("packs-round-shape");
    const rounds = openPack("cache-common");
    assert.ok(rounds.length > 0);
    for (const r of rounds) {
      assert.ok(typeof r.id === "string" && r.id.length === 8, "id must be 8-char hex");
      assert.ok(["common", "uncommon", "rare"].includes(r.rarity), "rarity must be valid");
      assert.ok(Array.isArray(r.types), "types must be array");
      assert.equal(r.disclosed, false, "all rounds start undisclosed");
    }
  });
});
