// @ts-check
// Pure derivation of the two music axes from game state. No Tone, no DOM, no smoothing.

/** @typedef {import('../core/types.js').GameState} GameState */

/** Clamp x into [0,1]. @param {number} x @returns {number} */
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Alert ladder → 0..1. */
const ALERT_LEVEL = { green: 0, yellow: 1 / 3, red: 2 / 3, trace: 1 };

/** Each resource pool (health, deck) contributes at most this much to the threat signal. */
const INJURY_WEIGHT = 0.25;

/**
 * PROGRESS axis: how much of the LAN the player owns, 0..1.
 * @param {GameState} state
 * @returns {number}
 */
export function deriveProgress(state) {
  const nodes = state?.nodes;
  if (!nodes) return 0;
  const all = Object.values(nodes);
  if (all.length === 0) return 0;
  const owned = all.filter((n) => /** @type {any} */ (n).accessLevel === "owned").length;
  return clamp01(owned / all.length);
}

/**
 * THREAT axis: alert ladder blended with an injury term, 0..1.
 * @param {GameState} state
 * @returns {number}
 */
export function deriveThreat(state) {
  const alert = ALERT_LEVEL[state?.globalAlert] ?? 0;
  const p = state?.player;
  let injury = 0;
  if (p?.health?.max) injury += INJURY_WEIGHT * (1 - clamp01(p.health.current / p.health.max));
  if (p?.deckIntegrity?.max) injury += INJURY_WEIGHT * (1 - clamp01(p.deckIntegrity.current / p.deckIntegrity.max));
  return clamp01(alert + injury);
}
