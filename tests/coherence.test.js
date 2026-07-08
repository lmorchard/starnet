// @ts-check
// Tests for js/core/coherence.js — chip() and rollDisclosure() pure math.
// SEED CONVENTION: always call initRng() with an explicit string before any
// call that draws from the RNG (chip with rollJitter=true, rollDisclosure).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { initRng, _forceNext, RNG } from "../js/core/rng.js";
import { chip, rollDisclosure } from "../js/core/coherence.js";
import { DISCLOSURE_CHANCE } from "../js/core/balance.js";

// ── Minimal node fixtures ─────────────────────────────────────────────────────

/**
 * Build a minimal probed NodeState with known vulnerabilities.
 * @param {string} grade
 * @param {string[]} [vulnIds]
 * @returns {import('../js/core/types.js').NodeState}
 */
function makeNode(grade, vulnIds = []) {
  return {
    id: `node-${grade}`,
    type: "router",
    label: `router-${grade}`,
    visibility: "accessible",
    grade,
    probed: vulnIds.length > 0,
    vulnerabilities: vulnIds.map(id => ({
      id,
      name: id,
      description: "",
      rarity: "common",
      patched: false,
      patchTurn: null,
      hidden: false,
      unlockedBy: null,
    })),
  };
}

/**
 * Build a minimal ExploitRound.
 * @param {"common"|"uncommon"|"rare"} rarity
 * @param {string[]} types
 * @returns {import('../js/core/types.js').ExploitRound}
 */
function makeRound(rarity, types) {
  return { id: "a1b2c3d4", rarity, types, disclosed: false };
}

// ── chip() ordering by rarity ──────────────────────────────────────────────

describe("chip() — rarity ordering (no jitter)", () => {
  it("rare > uncommon > common at grade C", () => {
    const node = makeNode("C");
    const rare = chip(makeRound("rare", ["any"]), node, false);
    const uncommon = chip(makeRound("uncommon", ["any"]), node, false);
    const common = chip(makeRound("common", ["any"]), node, false);
    assert.ok(rare > uncommon, `rare (${rare}) must exceed uncommon (${uncommon})`);
    assert.ok(uncommon > common, `uncommon (${uncommon}) must exceed common (${common})`);
  });

  it("rare > uncommon > common at grade F", () => {
    const node = makeNode("F");
    const rare = chip(makeRound("rare", ["any"]), node, false);
    const uncommon = chip(makeRound("uncommon", ["any"]), node, false);
    const common = chip(makeRound("common", ["any"]), node, false);
    assert.ok(rare > uncommon);
    assert.ok(uncommon > common);
  });
});

// ── chip() type-match amplification ───────────────────────────────────────

describe("chip() — type-match amplification", () => {
  it("matching type strictly increases chip vs. no match", () => {
    // Node has vuln "unpatched-ssh"; round targets it → match
    const matchingNode = makeNode("B", ["unpatched-ssh"]);
    const noMatchNode  = makeNode("B");                          // not probed → no match
    const round = makeRound("common", ["unpatched-ssh"]);

    const withMatch    = chip(round, matchingNode, false);
    const withoutMatch = chip(round, noMatchNode,  false);
    assert.ok(
      withMatch > withoutMatch,
      `match chip (${withMatch}) must exceed no-match chip (${withoutMatch})`
    );
  });
});

// ── chip() grade ordering ─────────────────────────────────────────────────

describe("chip() — grade ordering (S ≪ F)", () => {
  it("F-grade chip is much larger than S-grade for same round", () => {
    const round = makeRound("common", ["any"]);
    const chipS = chip(round, makeNode("S"), false);
    const chipF = chip(round, makeNode("F"), false);
    assert.ok(
      chipF > chipS,
      `F-grade chip (${chipF}) must exceed S-grade chip (${chipS}) for the same round`
    );
    // The ratio should be substantial: CHIP_FACTOR F:S is 60:6 = 10×
    assert.ok(
      chipF / chipS >= 5,
      `Expected F/S ratio ≥ 5×, got ${chipF / chipS}`
    );
  });
});

// ── chip() jitter is a no-op when disabled ────────────────────────────────

describe("chip() — jitter disabled", () => {
  it("chip is deterministic when rollJitter=false (no RNG consumed)", () => {
    const round = makeRound("uncommon", ["any"]);
    const node  = makeNode("C");
    // Call twice — no initRng needed because jitter=false consumes no RNG
    const a = chip(round, node, false);
    const b = chip(round, node, false);
    assert.equal(a, b, "no-jitter chip must be deterministic");
    assert.ok(a > 0, "chip must be positive");
  });
});

// ── rollDisclosure() boundary correctness ────────────────────────────────

describe("rollDisclosure() — RNG boundary", () => {
  it("returns true when roll is exactly at DISCLOSURE_CHANCE[grade]", () => {
    const grade = "B"; // DISCLOSURE_CHANCE.B = 0.50
    initRng("disc-boundary-1");
    _forceNext(RNG.COMBAT, DISCLOSURE_CHANCE[grade]); // roll == threshold → true
    assert.equal(rollDisclosure(grade), true);
  });

  it("returns false when roll is just above DISCLOSURE_CHANCE[grade]", () => {
    const grade = "B";
    initRng("disc-boundary-2");
    _forceNext(RNG.COMBAT, DISCLOSURE_CHANCE[grade] + 0.0001); // roll > threshold → false
    assert.equal(rollDisclosure(grade), false);
  });

  it("returns true when roll is 0 (always discloses)", () => {
    const grade = "S"; // hardest grade
    initRng("disc-boundary-3");
    _forceNext(RNG.COMBAT, 0); // 0 <= any threshold → always true
    assert.equal(rollDisclosure(grade), true);
  });

  it("returns false when roll is 1 (never discloses)", () => {
    const grade = "S"; // DISCLOSURE_CHANCE.S = 0.85
    initRng("disc-boundary-4");
    _forceNext(RNG.COMBAT, 1); // 1 > 0.85 → false
    assert.equal(rollDisclosure(grade), false);
  });
});
