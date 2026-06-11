// @ts-check
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { skipToOwnedChance } from "./combat.js";

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
