// @ts-check
// Bot stats — creation, recording, and finalization.

/** @typedef {import('./types.js').BotRunStats} BotRunStats */
/** @typedef {import('./types.js').ScoredAction} ScoredAction */

const ALERT_RANK = { green: 0, yellow: 1, red: 2 };

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

  if (action.action === "exploit") stats.cardsUsed++;
  if (action.action === "access-darknet") stats.storeVisits++;
  if (action.action?.startsWith("disarm")) stats.disarmActionsUsed++;
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
  if (!stats.success && !stats.failReason) {
    stats.failReason = "stuck";
  }
}
