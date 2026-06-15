// @ts-check
// Score registry + seeded selection within a biome. A biome owns a pool of full
// scores (variety); one is chosen per run by an INDEPENDENT seeded RNG (derived from the
// run seed, never a gameplay RNG stream — audio must not perturb game determinism).
import { makeSeededRng, getSeed } from "../../core/rng.js";
import { CORPORATE_SCORE } from "./corporate.js";
import { CORPORATE_COLD } from "./corporate-cold.js";
import { CORPORATE_NOIR } from "./corporate-noir.js";
import { CORPORATE_VAST } from "./corporate-vast.js";
import { CORPORATE_NEON } from "./corporate-neon.js";
import { CORPORATE_INDUSTRIAL } from "./corporate-industrial.js";
import { CORPORATE_PULSE } from "./corporate-pulse.js";
import { CORPORATE_HAZE } from "./corporate-haze.js";

/** Scores available per biome (index 0 is the default fallback). */
const BIOME_SCORES = {
  corporate: [
    CORPORATE_SCORE, CORPORATE_COLD, CORPORATE_NOIR, CORPORATE_VAST,
    CORPORATE_NEON, CORPORATE_INDUSTRIAL, CORPORATE_PULSE, CORPORATE_HAZE,
  ],
};

/** Flat list of every score, for the tuning harness. */
export const ALL_SCORES = Object.values(BIOME_SCORES).flat();

/**
 * Pick a score for a biome using an independent seeded RNG (deterministic per run seed,
 * consumes no gameplay RNG stream). Unknown biome → corporate.
 * @param {string} biome
 * @returns {object}
 */
export function selectScore(biome) {
  const pool = BIOME_SCORES[biome] ?? BIOME_SCORES.corporate;
  // Independent seeded RNG: deterministic per run seed WITHOUT consuming any gameplay
  // RNG stream — audio must never perturb game determinism.
  const rng = makeSeededRng((getSeed() || "audio") + ":score");
  const idx = Math.floor(rng() * pool.length);
  return pool[idx] ?? pool[0];
}
