// @ts-check
// Execute layer — dispatches actions and ticks the game forward.

/** @typedef {import('./types.js').ScoredAction} ScoredAction */
/** @typedef {import('./types.js').WorldModel} WorldModel */

import { emitEvent, on, off, E, tick, getState } from "../lib/headless-engine.js";

/** Actions that start a timed process and need tick-forward */
const TIMED_ACTIONS = new Set(["probe", "exploit", "read", "loot", "reboot"]);

/** Actions that are instant (no ticking needed) */
const INSTANT_ACTIONS = new Set([
  "select", "deselect", "jackout", "reconfigure", "cancel-trace",
  "cancel-probe", "cancel-exploit", "cancel-read", "cancel-loot",
  "eject", "access-darknet",
]);

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
  if (choice.nodeId && choice.nodeId !== state.selectedNodeId && choice.action !== "select") {
    emitEvent("starnet:action", { actionId: "select", nodeId: choice.nodeId });
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
  if (!TIMED_ACTIONS.has(choice.action)) {
    return { completed: true, interrupted: false, ticksUsed: 0 };
  }

  // Timed action: tick forward until resolution or interruption
  return tickUntilResolved(choice, tickBudget);
}

/**
 * Tick forward until the timed action resolves, ICE interrupts, or budget expires.
 * @param {ScoredAction} choice
 * @param {number} budget
 * @returns {{ completed: boolean, interrupted: boolean, ticksUsed: number }}
 */
function tickUntilResolved(choice, budget) {
  let resolved = false;
  let interrupted = false;
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

  const onIceMoved = ({ toId }) => {
    const s = getState();
    if (s.selectedNodeId && toId === s.selectedNodeId) {
      interrupted = true;
    }
  };

  const onRunEnded = () => { runEnded = true; };

  on(E.ACTION_RESOLVED, onResolved);
  on(E.ACTION_FEEDBACK, onFeedback);
  on(E.ICE_MOVED, onIceMoved);
  on(E.RUN_ENDED, onRunEnded);

  try {
    for (let i = 0; i < budget && !resolved && !interrupted && !runEnded; i++) {
      tick(1);
      ticksUsed++;
    }
  } finally {
    off(E.ACTION_RESOLVED, onResolved);
    off(E.ACTION_FEEDBACK, onFeedback);
    off(E.ICE_MOVED, onIceMoved);
    off(E.RUN_ENDED, onRunEnded);
  }

  // If interrupted by ICE, cancel the current action and deselect
  if (interrupted && !resolved && !runEnded) {
    const cancelAction = `cancel-${choice.action}`;
    emitEvent("starnet:action", { actionId: cancelAction, nodeId: targetNodeId });
    emitEvent("starnet:action", { actionId: "deselect" });
  }

  return { completed: resolved || runEnded, interrupted, ticksUsed };
}
