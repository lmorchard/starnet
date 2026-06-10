// @ts-check
// Execute layer — dispatches actions and ticks the game forward.

/** @typedef {import('./types.js').ScoredAction} ScoredAction */
/** @typedef {import('./types.js').WorldModel} WorldModel */

import { emitEvent, on, off, E, tick, getState } from "../lib/headless-engine.js";
import { buyFromStore } from "../../js/core/store-logic.js";
import { A } from "../../js/core/action-ids.js";

/** Actions that start a timed process and need tick-forward */
const TIMED_ACTIONS = new Set([A.PROBE, A.XPLOIT, A.DUMP, A.FETCH, A.REBOOT, A.MINE]);

/** Actions that are instant (no ticking needed) */
const INSTANT_ACTIONS = new Set([
  A.TARGET, A.UNTARGET, A.JACKOUT, A.CORRUPT, A.CANCEL_TRACE,
  A.ABORT, A.EJECT, A.ACCESS_DARKNET,
  // Set-piece puzzle actions
  "activate", "scan-lock", "scan-vault", "crack-vault",
  "unlock-vault", "extract-token", "extract-key", "decrypt-loot",
]);

/**
 * Check if an action is instant. Handles dynamic action IDs (disarm-*) that
 * aren't in the static sets.
 * @param {string} actionId
 * @returns {boolean}
 */
function isInstant(actionId) {
  if (INSTANT_ACTIONS.has(actionId)) return true;
  if (actionId.startsWith("disarm")) return true;
  if (!TIMED_ACTIONS.has(actionId)) return true; // unknown actions default to instant
  return false;
}

/**
 * Execute a scored action: dispatch it and tick forward if needed.
 *
 * @param {ScoredAction} choice
 * @param {WorldModel} world
 * @param {{ tickBudgetPerAction?: number }} [opts]
 * @returns {{ completed: boolean, interrupted: boolean, ticksUsed: number }}
 */
export function execute(choice, world, opts = {}) {
  const tickBudget = opts.tickBudgetPerAction ?? 500;
  const state = getState();

  // If we need to select a different node first
  if (choice.nodeId && choice.nodeId !== state.selectedNodeId && choice.action !== A.TARGET) {
    emitEvent("starnet:action", { actionId: A.TARGET, nodeId: choice.nodeId });
  }

  // Bot-only action: buy a card directly from the store (headless)
  if (choice.action === "buy-card") {
    const vulnId = choice.payload?.vulnId;
    if (vulnId) {
      const result = buyFromStore(vulnId);
      if (result) {
        emitEvent(E.STATE_CHANGED, getState());
      }
    }
    return { completed: true, interrupted: false, ticksUsed: 0 };
  }

  // Build the action payload
  const payload = {
    actionId: choice.action,
    ...(choice.nodeId ? { nodeId: choice.nodeId } : {}),
    ...(choice.payload ?? {}),
  };

  // Dispatch the action
  emitEvent("starnet:action", payload);

  // Instant actions are done immediately
  if (isInstant(choice.action)) {
    return { completed: true, interrupted: false, ticksUsed: 0 };
  }

  // Timed action: tick forward until resolution or interruption
  return tickUntilResolved(choice, tickBudget);
}

/**
 * Tick forward until the timed action resolves, ICE actually DETECTS the player
 * (E.ICE_DETECTED — not mere ICE arrival), the run ends, or the budget expires.
 * `interrupted` in the return reflects a real mid-action detection.
 * @param {ScoredAction} choice
 * @param {number} budget
 * @returns {{ completed: boolean, interrupted: boolean, ticksUsed: number }}
 */
function tickUntilResolved(choice, budget) {
  let resolved = false;
  let detected = false;   // ICE completed a dwell and detected us mid-action
  let runEnded = false;
  let ticksUsed = 0;

  const targetNodeId = choice.nodeId;

  // Temporary event listeners
  const onResolved = ({ action, nodeId }) => {
    if (nodeId === targetNodeId && action === choice.action) {
      resolved = true;
    }
  };

  const onFeedback = ({ action, nodeId, phase }) => {
    if (nodeId === targetNodeId && action === choice.action && phase === "cancel") {
      resolved = true; // Externally cancelled (e.g. navigate away)
    }
  };

  // ICE arriving on our node does NOT auto-abort the action. Detection requires
  // ICE to dwell (grade-scaled), so the hack and the dwell race — a focused
  // decker keeps working and only bails if the trace actually lands. On an OWNED
  // node, eject is free, so push ICE off and keep going. (Previously the bot
  // panic-aborted on mere arrival: ICE never actually detected — so it was
  // toothless — yet the bot abandoned and restarted actions, the source of the
  // evasion thrash and exchange tick-cap. #114 WS2.)
  const onIceMoved = ({ toId }) => {
    const s = getState();
    if (toId !== s.selectedNodeId || toId !== targetNodeId) return;
    const node = s.nodes[targetNodeId];
    if (node && node.accessLevel === "owned" && s.ice?.active && s.ice.attentionNodeId === targetNodeId) {
      emitEvent("starnet:action", { actionId: A.EJECT, nodeId: targetNodeId });
    }
  };

  const onDetected = ({ nodeId }) => {
    if (nodeId === targetNodeId) detected = true;
  };

  const onRunEnded = () => { runEnded = true; };

  on(E.ACTION_RESOLVED, onResolved);
  on(E.ACTION_FEEDBACK, onFeedback);
  on(E.ICE_MOVED, onIceMoved);
  on(E.ICE_DETECTED, onDetected);
  on(E.RUN_ENDED, onRunEnded);

  try {
    for (let i = 0; i < budget && !resolved && !detected && !runEnded; i++) {
      tick(1);
      ticksUsed++;
    }
  } finally {
    off(E.ACTION_RESOLVED, onResolved);
    off(E.ACTION_FEEDBACK, onFeedback);
    off(E.ICE_MOVED, onIceMoved);
    off(E.ICE_DETECTED, onDetected);
    off(E.RUN_ENDED, onRunEnded);
  }

  // Caught mid-action: abort and untarget to hide. Alert has already escalated;
  // the between-action heuristics (evasion/security) handle trace from here.
  if (detected && !resolved && !runEnded) {
    emitEvent("starnet:action", { actionId: A.ABORT, nodeId: targetNodeId });
    emitEvent("starnet:action", { actionId: A.UNTARGET });
  }

  return { completed: resolved || runEnded, interrupted: detected, ticksUsed };
}
