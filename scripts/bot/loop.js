// @ts-check
// Bot main loop — perceive → score → execute cycle.

/** @typedef {import('./types.js').Strategy} Strategy */
/** @typedef {import('./types.js').BotRunStats} BotRunStats */

import { getState, emitEvent, on, off, E, tick } from "../lib/headless-engine.js";
import { A } from "../../js/core/action-ids.js";
import { perceive } from "./perception.js";
import { score } from "./scoring.js";
import { execute } from "./execute.js";
import { createStats, recordAction, recordEvasion, recordMineResolved, updatePeakAlert, finalizeStats } from "./stats.js";

/**
 * Run the bot loop until the game ends or budget is exhausted.
 *
 * @param {Strategy[]} strategies
 * @param {{ tickBudget?: number, verbose?: boolean }} [opts]
 * @returns {BotRunStats}
 */
export function runLoop(strategies, opts = {}) {
  const tickBudget = opts.tickBudget ?? 5000;
  const verbose = opts.verbose ?? false;
  const stats = createStats();
  let totalTicks = 0;
  /** @type {Set<string>} Nodes where auto-burn stalled (ceiling/dry) without cracking */
  const failedNodes = new Set();
  /** @type {Set<string>} Track disarmed node:action pairs to avoid retrying */
  const completedActions = new Set();
  /** @type {Set<string>} Nodes where ICE recently interrupted — avoid for a cycle */
  const iceCooldown = new Set();

  // Track events for stats
  const onDetected = () => { stats.iceDetections++; };
  const onTraceStarted = () => { stats.traceFired = true; };
  const onAlertRaised = ({ next }) => { updatePeakAlert(stats, next); };
  const onRunEnded = ({ outcome }) => {
    if (outcome === "caught") stats.failReason = "trace";
  };
  const onResolved = ({ action, detail }) => {
    if (action === A.MINE) recordMineResolved(stats, detail);
  };

  on(E.ICE_DETECTED, onDetected);
  on(E.ALERT_TRACE_STARTED, onTraceStarted);
  on(E.ALERT_GLOBAL_RAISED, onAlertRaised);
  on(E.RUN_ENDED, onRunEnded);
  on(E.ACTION_RESOLVED, onResolved);

  try {
    while (totalTicks < tickBudget) {
      const state = getState();
      if (state.phase !== "playing") break;

      const world = perceive(state, { failedNodes, completedActions, iceCooldown });

      // If mission is complete, jack out
      if (world.mission.complete) {
        emitEvent("starnet:action", { actionId: A.JACKOUT });
        break;
      }

      const choice = score(world, strategies, { verbose });

      if (!choice) {
        // Nothing to do — jack out
        if (verbose) console.log("[BOT] No proposals — jacking out.");
        stats.failReason = "stuck";
        emitEvent("starnet:action", { actionId: A.JACKOUT });
        break;
      }

      if (verbose) {
        console.log(`[BOT] → ${choice.action} ${choice.nodeId ?? ""} (${choice.score}) — ${choice.reason}`);
      }

      // Snapshot access level before execute for exploit tracking
      const accessBefore = choice.action === A.XPLOIT && choice.nodeId
        ? getState().nodes[choice.nodeId]?.accessLevel
        : null;

      // Snapshot cash before buy-pack for tracking spend
      const cashBefore = choice.action === "buy-pack" ? getState().player.cash : 0;

      recordAction(stats, choice);
      const result = execute(choice, world);
      totalTicks += result.ticksUsed || 1;

      // Track buy-pack cash spent
      if (choice.action === "buy-pack") {
        stats.cashSpent += cashBefore - getState().player.cash;
      }

      // Track instant actions that shouldn't repeat (disarm, reconfigure, etc.)
      if (choice.action.startsWith("disarm") && choice.nodeId) {
        completedActions.add(`${choice.nodeId}:${choice.action}`);
      }

      // Track failed nodes: an auto-burn that completed WITHOUT reaching "owned"
      // stalled on heat-ceiling or hoard-dry. Mark the node so the bot doesn't
      // retry it forever. Cracking it (owned) leaves it off the failed set.
      if (choice.action === A.XPLOIT && result.completed && choice.nodeId) {
        const accessAfter = getState().nodes[choice.nodeId]?.accessLevel;
        if (accessAfter === "owned") {
          failedNodes.delete(choice.nodeId);
        } else if (accessAfter === accessBefore) {
          failedNodes.add(choice.nodeId);
        }
      }

      if (result.interrupted) {
        // ICE arrived mid-action — already cancelled + deselected in execute.
        // Cool down this node for ONE cycle so the bot tries something else first.
        recordEvasion(stats);
        if (choice.nodeId) iceCooldown.add(choice.nodeId);
        if (verbose) console.log("[BOT] ICE interrupted — will re-score next cycle.");
      } else {
        // Non-interrupted cycle clears all cooldowns (one-cycle penalty served)
        iceCooldown.clear();
      }
    }

    if (totalTicks >= tickBudget && getState().phase === "playing") {
      stats.failReason = "tick-cap";
      emitEvent("starnet:action", { actionId: A.JACKOUT });
    }
  } finally {
    off(E.ICE_DETECTED, onDetected);
    off(E.ALERT_TRACE_STARTED, onTraceStarted);
    off(E.ALERT_GLOBAL_RAISED, onAlertRaised);
    off(E.RUN_ENDED, onRunEnded);
    off(E.ACTION_RESOLVED, onResolved);
  }

  stats.ticksElapsed = totalTicks;
  finalizeStats(stats, getState());
  return stats;
}
