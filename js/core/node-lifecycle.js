// @ts-check
// Node lifecycle dispatcher — listens for node state transitions and dispatches
// type-specific side-effects when nodes change ownership.

/** @typedef {import('./types.js').GameState} GameState */
/** @typedef {import('./types.js').NodeState} NodeState */

import { on, E } from "./events.js";
import { getState } from "./state.js";
import { stopIce, disableIce } from "./ice.js";
import { cancelTraceCountdown } from "./alert.js";

export function initNodeLifecycle() {
  on(E.NODE_ACCESSED, ({ nodeId, next }) => {
    if (next !== "owned") return;
    const s = getState();
    const node = s.nodes[nodeId];
    if (!node) return;

    // Security monitor owned → cancel trace
    if (node.type === "security-monitor") {
      cancelTraceCountdown();
    }

    // ICE resident node owned → disable ICE
    if (s.ice?.active && s.ice.residentNodeId === nodeId) {
      stopIce();
      disableIce();
    }
  });
}
