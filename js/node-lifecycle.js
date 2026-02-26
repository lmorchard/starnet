// @ts-check
// Node lifecycle dispatcher — listens for node state transitions and dispatches
// lifecycle hooks to behavior atoms. Single source for all onOwned dispatching.

/** @typedef {import('./types.js').GameState} GameState */
/** @typedef {import('./types.js').NodeState} NodeState */

import { on, E } from "./events.js";
import { getState } from "./state.js";
import { getBehaviors } from "./node-types.js";
import { stopIce } from "./ice.js";
import { disableIce } from "./state.js";
import { cancelTraceCountdown } from "./alert.js";

export function initNodeLifecycle() {
  on(E.NODE_ACCESSED, ({ nodeId, next }) => {
    if (next !== "owned") return;
    const s = getState();
    const node = s.nodes[nodeId];
    if (!node) return;
    const ctx = { stopIce, disableIce, cancelTraceCountdown };
    getBehaviors(node).forEach((atom) => atom.onOwned?.(node, s, ctx));
  });
}
