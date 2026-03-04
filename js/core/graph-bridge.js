// @ts-check
/**
 * Graph message bridge — injects game events into the NodeGraph as messages.
 *
 * Set-piece circuits (nthAlarm, idsRelayChain, probeBurstAlarm, noisySensor,
 * honeyPot, etc.) react to messages like "probe-noise", "alert", "exploit".
 * This bridge listens to game events and translates them into graph messages
 * so the circuits fire correctly.
 */

import { on, E } from "./events.js";
import { getState } from "./state.js";
import { createMessage } from "./node-graph/message.js";

/**
 * Register game event → graph message bridges.
 * Call once after initGame() sets up the NodeGraph.
 */
export function initGraphBridge() {
  // Probe completed → send "probe-noise" to the probed node and its neighbors.
  // Set-pieces like nthAlarm and probeBurstAlarm listen for probe-noise.
  on(E.NODE_PROBED, ({ nodeId }) => {
    const graph = getState().nodeGraph;
    if (!graph) return;
    const msg = createMessage({ type: "probe-noise", origin: nodeId, payload: { nodeId } });
    // Send to the probed node's neighbors (simulates noise radiating outward)
    const adj = getState().adjacency[nodeId] || [];
    for (const neighborId of adj) {
      try { graph.sendMessage(neighborId, msg); } catch (_) { /* node might not exist in graph */ }
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

  // Exploit attempt (success or failure) → send "exploit" message to the node.
  // HoneyPot set-piece listens for exploit messages.
  on(E.EXPLOIT_SUCCESS, ({ nodeId }) => {
    const graph = getState().nodeGraph;
    if (!graph) return;
    const msg = createMessage({ type: "exploit", origin: nodeId, payload: { nodeId, success: true } });
    try { graph.sendMessage(nodeId, msg); } catch (_) { }
  });

  on(E.EXPLOIT_FAILURE, ({ nodeId }) => {
    const graph = getState().nodeGraph;
    if (!graph) return;
    const msg = createMessage({ type: "exploit", origin: nodeId, payload: { nodeId, success: false } });
    try { graph.sendMessage(nodeId, msg); } catch (_) { }
  });
}
