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
import { A } from "./action-ids.js";
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

    if (action === A.PROBE) {
      // Probe completed → send "probe-noise" to the probed node's neighbors.
      const msg = createMessage({ type: "probe-noise", origin: nodeId, payload: { nodeId } });
      const adj = getState().adjacency[nodeId] || [];
      for (const neighborId of adj) {
        try { graph.sendMessage(neighborId, msg); } catch (_) { }
      }
    } else if (action === A.XPLOIT) {
      // Exploit attempt → send "exploit" message to the node (honeypots etc.).
      const msg = createMessage({ type: "exploit", origin: nodeId, payload: { nodeId, success } });
      try { graph.sendMessage(nodeId, msg); } catch (_) { }
      // A FAILED exploit is what the security grid notices: broadcast an "alert" to every
      // IDS. Each un-corrupted IDS relays it to its monitor (forwardingEnabled gate), which
      // accumulates and climbs the alert ladder (recordMonitorAlert). Grid-wide sensing,
      // subversion-scoped: corrupting an IDS blinds its monitor. Routine probing does NOT
      // trip the grid — only failures do (dedicated sensors like nthAlarm handle probe-noise).
      // (Detectors are type "ids"; extend if a future set-piece adds another detector type.)
      if (success === false) broadcastAlertToIds(graph, getState().nodes, nodeId);
    }
  });
}

/**
 * Send an "alert" message to every IDS node so the security grid hears it. The message
 * keeps the *triggering* node (the one whose exploit failed) as origin/payload, so the
 * alert stays attributable through the relay chain — consistent with the other bridge
 * messages.
 * @param {string} sourceNodeId  the node whose exploit failure raised the alert
 */
function broadcastAlertToIds(graph, nodes, sourceNodeId) {
  for (const id of Object.keys(nodes)) {
    if (nodes[id].type !== "ids") continue;
    const msg = createMessage({ type: "alert", origin: sourceNodeId, payload: { nodeId: sourceNodeId } });
    try { graph.sendMessage(id, msg); } catch (_) { }
  }
}
