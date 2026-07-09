// @ts-check
// TDD tests for js/core/burn-select.js — nextRound selection strategies (E2-P2).
// Tests the "best-match" strategy: matched rounds first, then by rarity punch.
// SEED CONVENTION: call initRng() with an explicit string when RNG is consumed.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { initRng } from "../js/core/rng.js";
import { nextRound } from "../js/core/burn-select.js";
import { RARITY_PUNCH } from "../js/core/balance.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal probed NodeState with known vulnerabilities.
 * @param {string[]} vulnIds
 * @returns {import('../js/core/types.js').NodeState}
 */
function makeNode(vulnIds = []) {
  return {
    id: "test-node",
    type: "router",
    label: "test-router",
    visibility: "accessible",
    grade: "C",
    probed: vulnIds.length > 0,
    vulnerabilities: vulnIds.map((id) => ({
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
 * @param {string} [id]
 * @returns {import('../js/core/types.js').ExploitRound}
 */
function makeRound(rarity, types, id = "r-" + rarity) {
  return { id, rarity, types, disclosed: false };
}

// ── Blind (E1 baseline) ───────────────────────────────────────────────────────

describe("nextRound — blind strategy (E1 baseline)", () => {
  it("returns null when all rounds are disclosed", () => {
    initRng("bs-blind-null-1");
    const hoard = [
      { ...makeRound("common", ["ssh"]), disclosed: true },
      { ...makeRound("rare",   ["ssh"]), disclosed: true },
    ];
    const node = makeNode(["ssh"]);
    const result = nextRound(hoard, node, {});
    assert.equal(result, null, "all-disclosed hoard → null");
  });

  it("returns null for empty hoard", () => {
    initRng("bs-blind-empty-1");
    const result = nextRound([], makeNode(), {});
    assert.equal(result, null);
  });

  it("blind (no params.selection) picks from undisclosed rounds", () => {
    initRng("bs-blind-pick-1");
    const hoard = [
      makeRound("common", ["other"], "c1"),
      makeRound("common", ["other"], "c2"),
      makeRound("common", ["other"], "c3"),
    ];
    const node = makeNode(); // no vulns
    const result = nextRound(hoard, node, {});
    assert.ok(result !== null, "picks a round from undisclosed hoard");
    assert.ok(!result.disclosed, "picked round is not disclosed");
  });
});

// ── Best-match: matched rounds fire first ─────────────────────────────────────

describe("nextRound — best-match: matched round selected first", () => {
  it("selects the matched round over unmatched commons", () => {
    // Node has vuln "unpatched-ssh"; hoard is mostly unmatched commons + one matched rare.
    // With best-match, the matched rare must be selected (not a random common).
    initRng("bs-bestmatch-1");
    const node = makeNode(["unpatched-ssh"]);
    const hoard = [
      makeRound("common", ["buffer-overflow"], "c1"),
      makeRound("common", ["buffer-overflow"], "c2"),
      makeRound("common", ["buffer-overflow"], "c3"),
      makeRound("rare",   ["unpatched-ssh"],   "matched-rare"),
      makeRound("common", ["buffer-overflow"], "c4"),
    ];

    const result = nextRound(hoard, node, { selection: "best-match" });
    assert.ok(result !== null, "best-match picks a round");
    assert.equal(result.id, "matched-rare", "best-match selects the matched rare, not a random common");
  });

  it("with matched rounds only (no unmatched), picks the highest-rarity one", () => {
    initRng("bs-bestmatch-rarity-1");
    const node = makeNode(["unpatched-ssh"]);
    const hoard = [
      makeRound("common",   ["unpatched-ssh"], "m-common"),
      makeRound("uncommon", ["unpatched-ssh"], "m-uncommon"),
      makeRound("rare",     ["unpatched-ssh"], "m-rare"),
    ];

    const result = nextRound(hoard, node, { selection: "best-match" });
    assert.ok(result !== null);
    assert.equal(result.id, "m-rare", "among matched rounds, picks highest rarity");
  });

  it("tiebreak: among matched/same-rarity, picks first in hoard order (deterministic)", () => {
    initRng("bs-bestmatch-tiebreak-1");
    const node = makeNode(["unpatched-ssh"]);
    const hoard = [
      makeRound("rare", ["unpatched-ssh"], "m-rare-first"),
      makeRound("rare", ["unpatched-ssh"], "m-rare-second"),
    ];

    const result = nextRound(hoard, node, { selection: "best-match" });
    assert.ok(result !== null);
    assert.equal(result.id, "m-rare-first", "on exact tie, picks first in hoard (deterministic)");
  });

  it("falls back to highest-rarity unmatched if no matched rounds exist", () => {
    initRng("bs-bestmatch-nomatch-1");
    const node = makeNode(["unpatched-ssh"]);
    const hoard = [
      makeRound("common", ["buffer-overflow"], "c1"),
      makeRound("rare",   ["buffer-overflow"], "rare-no-match"),
      makeRound("common", ["buffer-overflow"], "c2"),
    ];

    const result = nextRound(hoard, node, { selection: "best-match" });
    assert.ok(result !== null);
    assert.equal(result.id, "rare-no-match", "best-match: no match → still picks best rarity");
  });

  it("skips disclosed rounds even in best-match", () => {
    initRng("bs-bestmatch-disclosed-1");
    const node = makeNode(["unpatched-ssh"]);
    const hoard = [
      { ...makeRound("rare", ["unpatched-ssh"], "disclosed-rare"), disclosed: true },
      makeRound("common", ["buffer-overflow"], "c1"),
    ];

    const result = nextRound(hoard, node, { selection: "best-match" });
    assert.ok(result !== null, "has usable rounds");
    assert.equal(result.id, "c1", "disclosed rounds excluded even in best-match");
  });

  it("returns null when all rounds are disclosed in best-match mode", () => {
    initRng("bs-bestmatch-alldisclosed-1");
    const node = makeNode(["unpatched-ssh"]);
    const hoard = [
      { ...makeRound("rare", ["unpatched-ssh"], "r1"), disclosed: true },
      { ...makeRound("common", ["ssh"], "c1"), disclosed: true },
    ];

    const result = nextRound(hoard, node, { selection: "best-match" });
    assert.equal(result, null, "all disclosed → null in best-match too");
  });
});

// ── Empty loadout = E1 baseline (structural guard) ────────────────────────────

describe("nextRound — empty/undefined params = E1 baseline", () => {
  it("undefined params behaves as blind (no crash, returns a round)", () => {
    initRng("bs-empty-params-1");
    const hoard = [makeRound("common", ["ssh"], "c1"), makeRound("rare", ["ssh"], "r1")];
    const node = makeNode(["ssh"]);
    // Should not throw, should return a round (blind random pick)
    const result = nextRound(hoard, node, undefined);
    assert.ok(result !== null);
  });

  it("params.selection=undefined behaves as blind (no crash)", () => {
    initRng("bs-blind-undefined-1");
    const hoard = [makeRound("common", ["ssh"], "c1")];
    const node = makeNode();
    const result = nextRound(hoard, node, { selection: undefined });
    assert.ok(result !== null);
    assert.equal(result.id, "c1");
  });
});
