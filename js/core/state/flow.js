// @ts-check
// Pure flow-substrate state mutations. No event emission, no orchestration.
// Flows are first-class serializable state (state.flows); see js/core/types.js Flow.

import { mutate, getState } from "./index.js";

/**
 * Stable per-run address for a flow. The ONE definition of the scheme — every
 * program, picker, and console command addresses flows through this.
 * @param {{ from: string, to: string, type: string }} f
 * @returns {string}
 */
export const flowId = (f) => `${f.from}>${f.to}#${f.type}`;

/**
 * Marks the flow with this id as revealed (decrypts its render, persists in state).
 * @param {string} id
 */
export function setFlowRevealed(id) {
  mutate((s) => {
    const f = s.flows.find((fl) => flowId(fl) === id);
    if (f) f.revealed = true;
  });
}

/**
 * Adds heat (the decaying "notice" meter). Clamped ≥ 0.
 * @param {number} amount
 * @returns {number} the new heat total
 */
export function addHeat(amount) {
  mutate((s) => {
    s.heat = Math.max(0, s.heat + amount);
  });
  return getState().heat;
}

/**
 * Bleeds heat down by `amount`, floored at 0 (the HEAT_DECAY timer + lie-low use this).
 * @param {number} amount
 * @returns {number} the new heat total
 */
export function decayHeat(amount) {
  mutate((s) => {
    s.heat = Math.max(0, s.heat - amount);
  });
  return getState().heat;
}

/** Records the repeating HEAT_DECAY timer's id (so it serializes / can be cancelled). */
export function setHeatDecayTimerId(id) {
  mutate((s) => {
    s.heatDecayTimerId = id;
  });
}
