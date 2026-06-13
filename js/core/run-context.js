// @ts-check
// RunContext — the single owner of all genuinely per-run state: the GameState
// object, the timer set, and the live NodeGraph. A run begins by swapping in a
// FRESH context (see initGame), so starting a new run can never inherit the
// previous run's timers — which is the orphan-trace-timer bug this fixes.
//
// Shared deterministic services (rng.js streams, the exploits.js id counter) are
// used by the overworld as well as runs, so they live OUTSIDE the context. See
// docs/dev-sessions/2026-06-12-1736-run-context/spec.md (Planning correction).

/** @typedef {import('./types.js').GameState} GameState */
/** @typedef {import('./node-graph/runtime.js').NodeGraph} NodeGraph */

/**
 * @typedef {Object} TimerSet
 * @property {number} currentTick
 * @property {number} nextId
 * @property {Map<number, any>} entries
 */

/**
 * @typedef {Object} RunContext
 * @property {GameState|null} state
 * @property {TimerSet} timers
 * @property {NodeGraph|null} nodeGraph
 */

/** @type {RunContext|null} */
let active = null;

/** @returns {RunContext} a fresh, empty per-run context */
export function createRunContext() {
  return {
    state: null,
    timers: { currentTick: 0, nextId: 1, entries: new Map() },
    nodeGraph: null,
  };
}

/** @returns {RunContext|null} the active run context, or null before any run */
export function getActiveRun() {
  return active;
}

/**
 * Like getActiveRun(), but throws a clear error when no run is active. Use in
 * functions that are only meaningful during a run (scheduling, serialization)
 * so a lifecycle misuse fails fast with a useful message instead of a cryptic
 * "cannot read 'timers' of null" TypeError. Contrast with the graceful no-op
 * paths (tick/cancelEvent/getVisibleTimers) that legitimately run with no
 * active run (e.g. the free-running browser tick interval while in overworld).
 * @param {string} [label] name of the calling operation, for the error message
 * @returns {RunContext}
 */
export function requireActiveRun(label = "operation") {
  if (!active) throw new Error(`${label} requires an active run, but none is active`);
  return active;
}

/**
 * Make `ctx` the active run context. Called by initGame (fresh run) and
 * deserializeState (restored run).
 * @param {RunContext} ctx
 */
export function setActiveRun(ctx) {
  active = ctx;
}
