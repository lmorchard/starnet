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
 * Adds program noise heat to the shared alert ladder's accumulator.
 * @param {number} amount
 * @returns {number} the new accumulated programNoise total
 */
export function addProgramNoise(amount) {
  mutate((s) => {
    s.programNoise += amount;
  });
  return getState().programNoise;
}
