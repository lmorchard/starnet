// @ts-check
// Shared headless game engine — common init plumbing for bot, playtest
// harness, and any future headless tools.
//
// Extracts the timer wiring, action context, and game init sequence that
// was previously duplicated across entry points.
//
// IMPORTANT — cross-run isolation. The event bus and timer queue are
// process-global module state. Running multiple games in one process (the bot
// census, batch playtests) MUST start each run from a clean bus, or listeners
// registered by initGraphBridge()/initDynamicActions()/etc. stack up and the
// Nth run is driven by N copies of every handler. resetGame() therefore does a
// full bus reset + re-wire on every run. See tests/headless-run-isolation.test.js.

import { initGame, getState, serializeState, deserializeState } from "../../js/core/state.js";
import { buildActionContext, initActionDispatcher } from "../../js/core/actions/action-context.js";
import { startIce, handleIceTick, handleIceDetect, initIceHandlers } from "../../js/core/ice.js";
import { handleTraceTick, handleHeatDecay } from "../../js/core/alert.js";
import { initNavigationCancelHandler } from "../../js/core/node-graph/game-ctx.js";
import { initGraphBridge } from "../../js/core/graph-bridge.js";
import { initDynamicActions } from "../../js/core/console-commands/dynamic-actions.js";
import { initLog } from "../../js/core/log.js";
import { on, off, emitEvent, E, clearHandlers } from "../../js/core/events.js";
import { tick, TIMER } from "../../js/core/timers.js";

/** @type {import('../../js/core/types.js').ActionContext | null} */
let _ctx = null;

/**
 * Build the action context once per process. The per-run bus wiring that used
 * to live here now happens in resetGame() (see module header).
 *
 * @param {{ openDarknetsStore?: (state: any) => void }} [opts]
 * @returns {{ ctx: import('../../js/core/types.js').ActionContext }}
 */
export function initHeadlessEngine(opts = {}) {
  _ctx = buildActionContext(opts.openDarknetsStore);
  return { ctx: _ctx };
}

/**
 * Register every event-bus listener and timer handler a game run depends on.
 * Called after clearHandlers() so each run starts with exactly one copy of each.
 *
 * Exported so callers that restore a serialized game (the playtest CLI's
 * one-command-per-process load path) can wire the same handlers without going
 * through resetGame() — otherwise the action dispatcher and timer handlers are
 * never registered and dispatched actions (target, probe, …) silently no-op.
 * Requires initHeadlessEngine() to have set the action context first.
 */
export function wireRunHandlers() {
  // Timer → handler wiring
  on(TIMER.ICE_MOVE,   (payload) => handleIceTick(payload));
  on(TIMER.ICE_DETECT, (payload) => handleIceDetect(payload));
  on(TIMER.TRACE_TICK, () => handleTraceTick());
  on(TIMER.HEAT_DECAY, () => handleHeatDecay());

  // Unified action dispatcher
  if (_ctx) initActionDispatcher(_ctx);

  // Log buffer (registers a LOG_ENTRY listener)
  initLog();

  // Game-logic listeners that are normally auto-registered at module import.
  // clearHandlers() wiped those, so re-register them explicitly per run.
  initIceHandlers();
  initNavigationCancelHandler();
  initGraphBridge();
  initDynamicActions();
}

/**
 * Initialize a fresh game from a network builder function.
 *
 * Starts every run from a clean event bus + timer queue, then re-wires all
 * handlers — guaranteeing run N behaves identically whether it's the first or
 * the fiftieth game in this process.
 *
 * @param {() => { graphDef: any, meta: any }} buildNetworkFn
 * @param {string} [seed]
 * @returns {import('../../js/core/types.js').GameState}
 */
export function resetGame(buildNetworkFn, seed) {
  // Full reset: wipe all listeners from any prior run. Pending timers need no
  // explicit clear — initGame swaps in a fresh RunContext (empty timer set), so
  // the prior run's timers are dropped wholesale.
  clearHandlers();

  // Re-wire everything before building the game so init-time events are seen.
  wireRunHandlers();

  const state = initGame(buildNetworkFn, seed);
  startIce();
  return state;
}

// Re-export commonly needed functions so callers don't need extra imports
export { getState, serializeState, deserializeState, tick, on, off, emitEvent, E, TIMER };
