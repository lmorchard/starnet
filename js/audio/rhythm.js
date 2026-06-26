// @ts-check
// Pure rhythm helpers behind flexible note grids + per-step modifiers. No Tone, no DOM — the
// testable layer the engine's playStep delegates to (mirrors harmony.js). See the session spec.
//
// A pattern is an array of steps; the engine clocks one step per `grid` cell. A step is a rest
// (null), a note ("A4"), a chord (["A3","C4"]), a perc token ("snare"/"hat"/"C1"), OR an object
// { note, ratchet?, prob?, vel? } adding: ratchet = N fast sub-hits in the cell (rolls/stutter),
// prob = chance the step fires this loop (glitch), vel = velocity (ghost notes/accents).

/** Steps per bar for each grid name, in 4/4. */
export const GRID_STEPS = Object.freeze({
  "1n": 1, "2n": 2, "4n": 4, "8n": 8, "16n": 16, "32n": 32, "64n": 64,
  "4t": 6, "8t": 12, "16t": 24,   // triplet grids
});

/** @param {string} grid @returns {number} steps per bar (4/4) */
export function stepsPerBar(grid) {
  const n = GRID_STEPS[grid];
  if (!n) throw new Error(`unknown grid: ${grid}`);
  return n;
}

/** @param {number} bars @param {string} grid @returns {number} expected pattern length */
export function expectedSteps(bars, grid) {
  return bars * stepsPerBar(grid);
}

/**
 * @typedef {{ value: (string|string[]), ratchet: number, prob: number, vel: (number|null) }} NormalStep
 */

/**
 * Normalize any step form to `{ value, ratchet, prob, vel }`, or `null` for a rest.
 * `value` is the note / chord array / perc token. Modifiers default to a single full-velocity hit.
 * @param {*} step @returns {NormalStep | null}
 */
export function normalizeStep(step) {
  if (step == null) return null;
  if (typeof step === "string" || Array.isArray(step)) {
    return { value: step, ratchet: 1, prob: 1, vel: null };
  }
  if (typeof step === "object") {
    const value = step.note;
    if (value == null) throw new Error(`step object needs a note: ${JSON.stringify(step)}`);
    const ratchet = step.ratchet ?? 1;
    const prob = step.prob ?? 1;
    const vel = step.vel ?? null;
    // Authoring typos fail fast here rather than producing Infinity/NaN durations downstream.
    if (!Number.isInteger(ratchet) || ratchet < 1) {
      throw new Error(`step ratchet must be a positive integer: ${JSON.stringify(step)}`);
    }
    if (typeof prob !== "number" || prob < 0 || prob > 1) {
      throw new Error(`step prob must be a number in [0,1]: ${JSON.stringify(step)}`);
    }
    if (vel !== null && (typeof vel !== "number" || vel < 0 || vel > 1)) {
      throw new Error(`step vel must be a number in [0,1] or null: ${JSON.stringify(step)}`);
    }
    return { value, ratchet, prob, vel };
  }
  throw new Error(`bad step: ${JSON.stringify(step)}`);
}

/**
 * Evenly-spaced sub-hit time offsets within a cell (ratchet/roll). `n=1` → `[0]`.
 * @param {number} cellSeconds duration of one grid cell @param {number} n sub-hit count
 * @returns {number[]}
 */
export function ratchetOffsets(cellSeconds, n) {
  if (!Number.isInteger(n) || n < 1) throw new Error(`ratchet count must be a positive integer: ${n}`);
  const out = [];
  const step = cellSeconds / n;
  for (let i = 0; i < n; i++) out.push(i * step);
  return out;
}

/**
 * Whether a step fires this loop. The deterministic extremes (`prob >= 1` always, `prob <= 0`
 * never) do NOT draw the rng, so deterministic patterns never perturb the seeded glitch stream.
 * Else fires when `rngFn() < prob`.
 * @param {number} prob @param {() => number} rngFn @returns {boolean}
 */
export function shouldFire(prob, rngFn) {
  if (prob >= 1) return true;
  if (prob <= 0) return false;
  return rngFn() < prob;
}
