// @ts-check
/**
 * Graph message bridge — injects game events into the NodeGraph as messages.
 *
 * Set-piece circuits (nthAlarm, idsRelayChain, probeBurstAlarm, noisySensor,
 * honeyPot, etc.) react to messages like "probe-noise", "alert", "exploit".
 * This bridge listens to ACTION_RESOLVED and alert events and translates them
 * into graph messages so the circuits fire correctly.
 */

import { on, E } from "./events.js";
import { getState } from "./state.js";
import { createMessage } from "./node-graph/message.js";

/**
 * Register game event → graph message bridges.
 * Call once after initGame() sets up the NodeGraph.
 */
export function initGraphBridge() {
  // ACTION_RESOLVED → graph messages for set-piece circuits
  on(E.ACTION_RESOLVED, ({ action, nodeId, success }) => {
    const graph = getState().nodeGraph;
    if (!graph) return;

    if (action === "probe") {
      // Probe completed → send "probe-noise" to the probed node's neighbors.
      const msg = createMessage({ type: "probe-noise", origin: nodeId, payload: { nodeId } });
      const adj = getState().adjacency[nodeId] || [];
      for (const neighborId of adj) {
        try { graph.sendMessage(neighborId, msg); } catch (_) { }
      }
    } else if (action === "exploit") {
      // Exploit attempt → send "exploit" message to the node.
      const msg = createMessage({ type: "exploit", origin: nodeId, payload: { nodeId, success } });
      try { graph.sendMessage(nodeId, msg); } catch (_) { }
    }
  });

  // Alert raised on a node → send "alert" message to that node.
  // IDS relay chain forwards alerts to security monitors via the relay operator.
  on(E.NODE_ALERT_RAISED, ({ nodeId }) => {
    const graph = getState().nodeGraph;
    if (!graph) return;
    const msg = createMessage({ type: "alert", origin: nodeId, payload: { nodeId } });
    try { graph.sendMessage(nodeId, msg); } catch (_) { }
  });
}
