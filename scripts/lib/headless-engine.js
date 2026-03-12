// @ts-check
// Shared headless game engine — common init plumbing for bot, playtest
// harness, and any future headless tools.
//
// Extracts the timer wiring, action context, and game init sequence that
// was previously duplicated across entry points.

import { initGame, getState, serializeState, deserializeState } from "../../js/core/state.js";
import { buildActionContext, initActionDispatcher } from "../../js/core/actions/action-context.js";
import { startIce, handleIceTick, handleIceDetect } from "../../js/core/ice.js";
import { on, off, emitEvent, E } from "../../js/core/events.js";
import { tick, TIMER } from "../../js/core/timers.js";
import { handleTraceTick } from "../../js/core/alert.js";
import { initLog } from "../../js/core/log.js";
import { initGraphBridge } from "../../js/core/graph-bridge.js";
import { initDynamicActions } from "../../js/core/console-commands/dynamic-actions.js";

// Importing alert.js registers NODE_ALERT_RAISED listeners at module load.
// Importing ice.js registers PLAYER_NAVIGATED / ACTION_FEEDBACK listeners.
// These side effects are needed for correct game behavior.

/**
 * Wire timer handlers and action dispatcher. Call once per process.
 * Returns the action context for callers that need to extend it.
 *
 * @param {{ openDarknetsStore?: (state: any) => void }} [opts]
 * @returns {{ ctx: import('../../js/core/types.js').ActionContext }}
 */
export function initHeadlessEngine(opts = {}) {
  // Timer → handler wiring
  on(TIMER.ICE_MOVE,   () => handleIceTick());
  on(TIMER.ICE_DETECT, (payload) => handleIceDetect(payload));
  on(TIMER.TRACE_TICK, () => handleTraceTick());

  // Action dispatcher
  const ctx = buildActionContext(opts.openDarknetsStore);
  initActionDispatcher(ctx);

  // Log buffer (needed for getRecentLog / log command)
  initLog();

  return { ctx };
}

/**
 * Initialize a fresh game from a network builder function.
 * Sets up graph bridge, dynamic actions, and ICE.
 *
 * @param {() => { graphDef: any, meta: any }} buildNetworkFn
 * @param {string} [seed]
 * @returns {import('../../js/core/types.js').GameState}
 */
export function resetGame(buildNetworkFn, seed) {
  const state = initGame(buildNetworkFn, seed);
  initGraphBridge();
  initDynamicActions();
  startIce();
  return state;
}

// Re-export commonly needed functions so callers don't need extra imports
export { getState, serializeState, deserializeState, tick, on, off, emitEvent, E, TIMER };
