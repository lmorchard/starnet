// @ts-check
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { skipToOwnedChance, resolveCombat } from "./combat.js";
import { RNG, initRng, _forceNext } from "./rng.js";
import { on, off, E } from "./events.js";

/** Minimal exploit card — only the fields skipToOwnedChance reads. */
function card(quality, rarity = "common") {
  return /** @type {any} */ ({ quality, rarity });
}

describe("skipToOwnedChance", () => {
  // The skip-to-owned chance is driven primarily by card QUALITY, with a modest
  // floor so even low cards occasionally jump locked → owned. Formula:
  //   0.08 + quality * 0.55
  // Rarity is no longer a hard gate — rare cards skip more only because they
  // carry higher quality. See the balance-skip-to-owned session.

  test("is a floor (0.08) plus a quality-scaled term", () => {
    assert.ok(Math.abs(skipToOwnedChance(card(0)) - 0.08) < 1e-9);
    assert.ok(Math.abs(skipToOwnedChance(card(1)) - 0.63) < 1e-9);
    assert.ok(Math.abs(skipToOwnedChance(card(0.5)) - 0.355) < 1e-9);
  });

  test("rises monotonically with quality regardless of rarity", () => {
    const qualities = [0.1, 0.3, 0.5, 0.7, 0.9];
    for (const rarity of ["common", "uncommon", "rare"]) {
      const chances = qualities.map((q) => skipToOwnedChance(card(q, rarity)));
      for (let i = 1; i < chances.length; i++) {
        assert.ok(chances[i] > chances[i - 1], `quality must drive skip chance (${rarity})`);
      }
    }
  });

  test("two cards of equal quality skip equally often regardless of rarity", () => {
    // Quality is the lever; rarity is not a separate multiplier anymore.
    assert.equal(skipToOwnedChance(card(0.5, "common")), skipToOwnedChance(card(0.5, "rare")));
  });

  test("lifts the common floor well above the old ~2-6% range", () => {
    // A typical fresh common (quality 0.2–0.55) now skips ~19–38% of the time.
    assert.ok(skipToOwnedChance(card(0.2, "common")) > 0.15);
    assert.ok(skipToOwnedChance(card(0.55, "common")) > 0.35);
  });

  test("never exceeds a sane ceiling for the best cards", () => {
    // Best possible rare (quality 0.95) tops out around 0.60, never near certainty.
    assert.ok(skipToOwnedChance(card(0.95, "rare")) < 0.65);
  });
});

// resolveCombat is the pure half of the launchExploit split (#168): it consumes
// RNG and decides the full effect plan, but must NOT mutate node state or emit
// events — applyCombatResult does that. These tests pin that purity.

/** Minimal node fixture — resolveCombat only reads these fields. */
function lockedNode() {
  return /** @type {any} */ ({
    accessLevel: "locked",
    alertState: "green",
    gateAccess: "probed",
    grade: "C",
    vulnerabilities: [{ id: "AuthBypass", name: "Auth Bypass", patched: false, hidden: false }],
  });
}
function matchingExploit() {
  return /** @type {any} */ ({ name: "TestKit", quality: 0.8, targetVulnTypes: ["AuthBypass"] });
}

describe("resolveCombat (pure resolution)", () => {
  test("decides the locked→open plan without mutating the node or emitting", () => {
    initRng("combat-test-1");
    // From-locked success consumes three RNG.COMBAT rolls: success, flavor, skip.
    _forceNext(RNG.COMBAT, 0);     // success
    _forceNext(RNG.COMBAT, 0);     // flavor pick
    _forceNext(RNG.COMBAT, 0.99);  // skip-to-owned bypass → stay at open

    const node = lockedNode();
    const before = { accessLevel: node.accessLevel, alertState: node.alertState };

    let emitted = 0;
    const bump = () => { emitted++; };
    on(E.ACTION_RESOLVED, bump);
    on(E.NODE_ACCESSED, bump);

    const result = resolveCombat(matchingExploit(), node);

    off(E.ACTION_RESOLVED, bump);
    off(E.NODE_ACCESSED, bump);

    // Plan is fully decided…
    assert.equal(result.success, true);
    assert.equal(result.prevAccess, "locked");
    assert.equal(result.nextAccess, "open");
    assert.equal(result.levelChanged, true);
    assert.equal(result.revealNeighbors, true); // gateAccess "probed" !== "owned"
    assert.ok(Array.isArray(result.vulnsToSurface));

    // …but nothing was applied: node untouched, no events fired.
    assert.equal(node.accessLevel, before.accessLevel, "node access not mutated");
    assert.equal(node.alertState, before.alertState, "node alert not mutated");
    assert.equal(emitted, 0, "no events emitted during resolution");
  });

  test("a from-locked success that wins the skip roll plans owned + skippedToOwned", () => {
    initRng("combat-test-2");
    _forceNext(RNG.COMBAT, 0);    // success
    _forceNext(RNG.COMBAT, 0);    // flavor pick
    _forceNext(RNG.COMBAT, 0);    // skip-to-owned wins

    const result = resolveCombat(matchingExploit(), lockedNode());
    assert.equal(result.nextAccess, "owned");
    assert.equal(result.skippedToOwned, true);
    assert.equal(result.revealNeighbors, true);
  });

  test("a failure plans the alert raise without mutating or emitting", () => {
    initRng("combat-test-3");
    _forceNext(RNG.COMBAT, 0.99); // success roll fails (above any chance)
    _forceNext(RNG.COMBAT, 0.99); // disclosure roll
    _forceNext(RNG.COMBAT, 0);    // fail-flavor pick

    const node = lockedNode();
    let emitted = 0;
    const bump = () => { emitted++; };
    on(E.NODE_ALERT_RAISED, bump);

    const result = resolveCombat(
      /** @type {any} */ ({ name: "Dud", quality: 0.01, targetVulnTypes: [] }),
      node,
    );

    off(E.NODE_ALERT_RAISED, bump);

    assert.equal(result.success, false);
    assert.equal(result.prevAlert, "green");
    assert.equal(result.nextAlert, "yellow"); // green → yellow
    assert.equal(node.alertState, "green", "node alert not mutated");
    assert.equal(emitted, 0, "no events emitted during resolution");
  });
});
