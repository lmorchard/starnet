// @ts-check
// Bot stats — creation, recording, and finalization.

/** @typedef {import('./types.js').BotRunStats} BotRunStats */
/** @typedef {import('./types.js').ScoredAction} ScoredAction */

import { A } from "../../js/core/action-ids.js";

// Mirrors GLOBAL_ALERT_ORDER in js/core/alert.js. "trace" MUST be included —
// global alert can escalate straight to "trace", and omitting it here made
// updatePeakAlert silently drop trace-level raises to rank 0 (issue #114, WS3).
const ALERT_RANK = { green: 0, yellow: 1, red: 2, trace: 3 };

/**
 * Create a fresh stats object with zeroed counters.
 * @returns {BotRunStats}
 */
export function createStats() {
  return {
    success: false,
    failReason: null,
    ticksElapsed: 0,
    nodesOwned: 0,
    nodesTotal: 0,
    cardsUsed: 0,
    cardsBurned: 0,
    storeVisits: 0,
    cashSpent: 0,
    cashRemaining: 0,
    peakAlert: "green",
    traceFired: false,
    iceDetections: 0,
    iceEvasions: 0,
    disarmActionsUsed: 0,
    mineAttempts: 0,
    mineResolved: 0,
    mineCards: 0,
    strategyCounts: {},
  };
}

/**
 * Record a chosen action into stats.
 * @param {BotRunStats} stats
 * @param {ScoredAction} action
 */
export function recordAction(stats, action) {
  // Track which strategy produced the winning action
  const name = action.strategy ?? "unknown";
  stats.strategyCounts[name] = (stats.strategyCounts[name] ?? 0) + 1;

  if (action.action === A.XPLOIT) stats.cardsUsed++;
  if (action.action === "buy-card") stats.storeVisits++;
  if (action.action === A.MINE) stats.mineAttempts++;
  if (action.action?.startsWith("disarm")) stats.disarmActionsUsed++;
}

/**
 * Record a resolved mine attempt (called from an ACTION_RESOLVED listener).
 * @param {BotRunStats} stats
 * @param {{ outcome?: string }} detail
 */
export function recordMineResolved(stats, detail) {
  stats.mineResolved++;
  if (detail?.outcome === "card") stats.mineCards++;
}

/**
 * Record an ICE evasion (cancel + deselect due to ICE arrival).
 * @param {BotRunStats} stats
 */
export function recordEvasion(stats) {
  stats.iceEvasions++;
}

/**
 * Update peak alert level.
 * @param {BotRunStats} stats
 * @param {string} alertLevel
 */
export function updatePeakAlert(stats, alertLevel) {
  if ((ALERT_RANK[alertLevel] ?? 0) > (ALERT_RANK[stats.peakAlert] ?? 0)) {
    stats.peakAlert = alertLevel;
  }
}

/**
 * Fill in end-of-run values from final game state.
 * @param {BotRunStats} stats
 * @param {import('../../js/core/types.js').GameState} state
 */
export function finalizeStats(stats, state) {
  const nodeEntries = Object.values(state.nodes);
  stats.nodesOwned = nodeEntries.filter(n => n.accessLevel === "owned" && n.type !== "wan").length;
  stats.nodesTotal = nodeEntries.filter(n => n.type !== "wan").length;
  stats.cashRemaining = state.player.cash;
  stats.ticksElapsed = stats.ticksElapsed; // set by loop
  stats.success = state.mission?.complete ?? false;
  if (!stats.success && stats.failReason !== "tick-cap") {
    // Attribute the loss to trace pressure when a trace fired during the run —
    // the bot bailed (or was caught) under the trace rather than just running
    // out of moves. "stuck" is reserved for incomplete runs with no trace
    // (genuinely no path forward); "tick-cap" (set in the loop) is left intact.
    stats.failReason = stats.traceFired ? "trace" : (stats.failReason ?? "stuck");
  }
}
