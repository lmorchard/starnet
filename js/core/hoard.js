// @ts-check
// Exploit-round hoard: disposable ammunition record, hex-ID mint, and bulk generators.
// Part of the "exploit hoard + coherence auto-burn" combat rework (E1 Phase 1).
// NO game-loop wiring here — pure data generation only.

/** @typedef {import('./types.js').ExploitRound} ExploitRound */
/** @typedef {import('./types.js').Rarity} Rarity */

import { RNG, random, shuffle } from "./rng.js";
import { VULNERABILITY_TYPES, RARITY_WEIGHTS, pickTargetVulns } from "./exploits.js";

// ── Hex-ID minting ────────────────────────────────────────────────────────────

const TOTAL_WEIGHT = RARITY_WEIGHTS.reduce((s, r) => s + r.weight, 0);

// Monotonic counter mixed into IDs to guarantee uniqueness across a large hoard.
// A pure-random 8-hex string has a birthday-collision risk across 500 rounds
// (~1 in 5 000 000 per pair, but ~1 in 10 000 for 500 rounds); the counter
// eliminates the possibility entirely.
let _roundIdCounter = 0;

/** Reset the round-id counter (call before generating a fresh hoard for full determinism). */
export function resetRoundIdCounter() {
  _roundIdCounter = 0;
}

/**
 * Mint a unique 8-char lowercase hex ID using RNG.EXPLOIT.
 * Mixes a monotonic counter into the top 4 hex digits so collisions are
 * impossible across any realistically-sized hoard (max counter = 0xFFFF = 65535).
 * @returns {string}
 */
export function mintRoundId() {
  // Low 32 bits from RNG for the bottom 4 hex chars.
  const lo = Math.floor(random(RNG.EXPLOIT) * 0x10000);
  // Counter occupies the top 4 hex chars, wrapping at 16-bit boundary.
  const hi = (_roundIdCounter++) & 0xFFFF;
  return hi.toString(16).padStart(4, "0") + lo.toString(16).padStart(4, "0");
}

// ── Rarity rolling ────────────────────────────────────────────────────────────

/**
 * Roll a rarity from the global weight table via RNG.EXPLOIT.
 * @returns {Rarity}
 */
function rollRarity() {
  let roll = random(RNG.EXPLOIT) * TOTAL_WEIGHT;
  for (const { rarity, weight } of RARITY_WEIGHTS) {
    roll -= weight;
    if (roll <= 0) return /** @type {Rarity} */ (rarity);
  }
  return "common";
}

// ── Round generation ──────────────────────────────────────────────────────────

/**
 * Generate a single ExploitRound (anonymous disposable ammunition).
 * - `rarity`: if null, rolled from the global weight table.
 * - `types`: if null, picked via the rarity-count rule (rare=3, uncommon=2, common=1).
 * - `disclosed` always starts false.
 * @param {Rarity|null} [rarity]
 * @param {string[]|null} [types]
 * @returns {ExploitRound}
 */
export function generateRound(rarity = null, types = null) {
  const r = rarity ?? rollRarity();
  const t = types ?? pickTargetVulns(r);
  return {
    id: mintRoundId(),
    rarity: r,
    types: t,
    disclosed: false,
  };
}

/**
 * Bulk-mint a hoard from a spec of per-rarity counts.
 * Resets the round-id counter first so the same seed always yields the same hoard.
 * @param {{ common?: number, uncommon?: number, rare?: number }} spec
 * @returns {ExploitRound[]}
 */
export function generateHoard(spec) {
  resetRoundIdCounter();
  const out = /** @type {ExploitRound[]} */ ([]);
  for (const rarity of /** @type {Rarity[]} */ (["common", "uncommon", "rare"])) {
    const count = spec[rarity] ?? 0;
    for (let i = 0; i < count; i++) {
      out.push(generateRound(rarity));
    }
  }
  return out;
}
