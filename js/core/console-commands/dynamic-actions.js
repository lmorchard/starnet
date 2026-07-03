// @ts-check
/**
 * Dynamic action commands — syncs NodeGraph actions into the console
 * command registry based on the currently selected node.
 *
 * When the player selects a node, its available graph actions (reconfigure,
 * unlock-vault, extract-token, activate, etc.) are registered as console
 * commands. When the selection changes, the old commands are removed and
 * new ones are added.
 *
 * Standard actions (probe, exploit, read, loot, etc.) are already
 * registered as static commands. This module handles set-piece-specific
 * actions that vary per node.
 */

import { getState } from "../state.js";
import { A } from "../action-ids.js";
import { on, E, emitEvent } from "../events.js";
import { addLogEntry } from "../log.js";
import { registry, registerCommand } from "./registry.js";
import { isScriptAction } from "../actions/scripts.js";

// Action IDs with custom argument handling that stay as static console commands.
// Everything else is dynamically discovered from the graph's available actions.
const STATIC_ACTION_IDS = new Set([
  A.XPLOIT,  // needs card argument from payload
  A.TARGET, A.UNTARGET, A.JACKOUT,  // global actions, not node-specific
  A.EXEC,    // synthetic submenu verb — never a dynamic registration
]);

/** Track which dynamic commands we've registered so we can remove them. */
let _dynamicVerbs = new Set();

/**
 * Register dynamic action commands and listen for selection changes.
 * Call once after initGame.
 */
export function initDynamicActions() {
  on(E.STATE_CHANGED, syncDynamicActions);
  on(E.PLAYER_NAVIGATED, syncDynamicActions);
}

function syncDynamicActions() {
  const s = getState();

  // Remove previously registered dynamic commands
  for (const verb of _dynamicVerbs) {
    registry.delete(verb);
  }
  _dynamicVerbs = new Set();

  // If no node selected or no graph, nothing to add
  if (!s.selectedNodeId || !s.nodeGraph) return;

  const graphActions = s.nodeGraph.getAvailableActions(s.selectedNodeId);

  for (const action of graphActions) {
    if (STATIC_ACTION_IDS.has(action.id)) continue;
    if (isScriptAction(action.id)) continue; // scripts live under `exec`

    const actionId = action.id;
    const label = action.label || actionId;
    const desc = action.desc || label;

    registerCommand({
      verb: actionId,
      execute: (args) => {
        if (args && args.length) {
          addLogEntry(`${actionId} takes no arguments — it acts on the targeted node.`, "error");
          return;
        }
        // Read current state at execution time, not registration time —
        // selection may have changed since the command was registered.
        const current = getState();
        emitEvent("starnet:action", {
          actionId,
          nodeId: current.selectedNodeId,
          fromConsole: true,
        });
      },
    });

    _dynamicVerbs.add(actionId);
  }
}
