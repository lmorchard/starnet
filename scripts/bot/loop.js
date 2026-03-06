// @ts-check
// Bot main loop — perceive → score → execute cycle.

/** @typedef {import('./types.js').Strategy} Strategy */
/** @typedef {import('./types.js').BotRunStats} BotRunStats */

import { getState, emitEvent, on, off, E, tick } from "../lib/headless-engine.js";
import { perceive } from "./perception.js";
import { score } from "./scoring.js";
import { execute } from "./execute.js";
import { createStats, recordAction, recordEvasion, updatePeakAlert, finalizeStats } from "./stats.js";

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
  /** @type {Set<string>} */
  const failedExploits = new Set();

  // Track events for stats
  const onDetected = () => { stats.iceDetections++; };
  const onTraceStarted = () => { stats.traceFired = true; };
  const onAlertRaised = ({ next }) => { updatePeakAlert(stats, next); };
  const onRunEnded = ({ outcome }) => {
    if (outcome === "caught") stats.failReason = "trace";
  };

  on(E.ICE_DETECTED, onDetected);
  on(E.ALERT_TRACE_STARTED, onTraceStarted);
  on(E.ALERT_GLOBAL_RAISED, onAlertRaised);
  on(E.RUN_ENDED, onRunEnded);

  try {
    while (totalTicks < tickBudget) {
      const state = getState();
      if (state.phase !== "playing") break;

      const world = perceive(state, { failedExploits });

      // If mission is complete, jack out
      if (world.mission.complete) {
        emitEvent("starnet:action", { actionId: "jackout" });
        break;
      }

      const choice = score(world, strategies, { verbose });

      if (!choice) {
        // Nothing to do — jack out
        if (verbose) console.log("[BOT] No proposals — jacking out.");
        stats.failReason = "stuck";
        emitEvent("starnet:action", { actionId: "jackout" });
        break;
      }

      if (verbose) {
        console.log(`[BOT] → ${choice.action} ${choice.nodeId ?? ""} (${choice.score}) — ${choice.reason}`);
      }

      // Snapshot access level before execute for exploit tracking
      const accessBefore = choice.action === "exploit" && choice.nodeId
        ? getState().nodes[choice.nodeId]?.accessLevel
        : null;

      recordAction(stats, choice);
      const result = execute(choice, world);
      totalTicks += result.ticksUsed || 1;

      // Track failed exploits: if access level didn't change, mark this card+node as failed
      if (choice.action === "exploit" && result.completed && choice.nodeId) {
        const accessAfter = getState().nodes[choice.nodeId]?.accessLevel;
        const cardId = choice.payload?.exploitId;
        if (cardId && accessAfter === accessBefore) {
          failedExploits.add(`${choice.nodeId}:${cardId}`);
        } else if (accessAfter !== accessBefore) {
          // Progress was made — clear failures for this node so cards can be retried
          for (const key of [...failedExploits]) {
            if (key.startsWith(`${choice.nodeId}:`)) failedExploits.delete(key);
          }
        }
      }

      if (result.interrupted) {
        // ICE arrived mid-action — re-score
        recordEvasion(stats);
        if (verbose) console.log("[BOT] ICE interrupted — re-scoring.");

        const interruptWorld = perceive(getState());
        const interruptChoice = score(interruptWorld, strategies, { verbose });

        if (interruptChoice) {
          if (verbose) {
            console.log(`[BOT] interrupt → ${interruptChoice.action} ${interruptChoice.nodeId ?? ""} (${interruptChoice.score})`);
          }
          recordAction(stats, interruptChoice);
          execute(interruptChoice, interruptWorld);
        }
      }
    }

    if (totalTicks >= tickBudget && getState().phase === "playing") {
      stats.failReason = "tick-cap";
      emitEvent("starnet:action", { actionId: "jackout" });
    }
  } finally {
    off(E.ICE_DETECTED, onDetected);
    off(E.ALERT_TRACE_STARTED, onTraceStarted);
    off(E.ALERT_GLOBAL_RAISED, onAlertRaised);
    off(E.RUN_ENDED, onRunEnded);
  }

  stats.ticksElapsed = totalTicks;
  finalizeStats(stats, getState());
  return stats;
}
