// @ts-check
// Node action orchestration — combines state mutations with event emission
// for read, loot, reconfigure, reboot actions.
// These were previously in state/index.js; moved here to keep state/ pure.

import { getState, ALERT_ORDER } from "./state.js";
import { collectMacguffins, setNodeLooted, setNodeEventForwarding, setNodeRebooting } from "./state/node.js";
import { setIceAttention } from "./state/ice.js";
import { setSelectedNode } from "./state/game.js";
import { addCash, setMissionComplete } from "./state/player.js";
import { emitEvent, E } from "./events.js";
import { scheduleEvent, TIMER } from "./timers.js";
import { random } from "./rng.js";
import { rebootIce } from "./ice.js";

export function lootNode(nodeId) {
  const s = getState();
  const node = s.nodes[nodeId];
  if (!node || node.looted) return;

  const { items, total } = collectMacguffins(nodeId);
  if (items.length === 0) {
    setNodeLooted(nodeId);
    emitEvent(E.LOG_ENTRY, { text: `${node.label}: Nothing to loot.`, type: "info" });
    return;
  }

  setNodeLooted(nodeId);
  addCash(total);
  emitEvent(E.NODE_LOOTED, { nodeId, label: node.label, items: items.length, total });

  if (s.mission && !s.mission.complete) {
    const gotMission = items.some((m) => m.id === s.mission.targetMacguffinId);
    if (gotMission) {
      setMissionComplete();
      emitEvent(E.MISSION_COMPLETE, { targetName: s.mission.targetName });
    }
  }
}

export function reconfigureNode(nodeId) {
  const s = getState();
  const node = s.nodes[nodeId];
  if (!node) return;
  setNodeEventForwarding(nodeId, true);
  emitEvent(E.NODE_RECONFIGURED, { nodeId, label: node.label });
}

export function rebootNode(nodeId) {
  const s = getState();
  const node = s.nodes[nodeId];
  if (!node || node.rebooting) return;

  // Send ICE attention back to resident node only if ICE is currently on this node
  if (s.ice?.active && s.ice.attentionNodeId === nodeId) {
    rebootIce();
    emitEvent(E.ICE_REBOOTED, {
      residentNodeId: s.ice.residentNodeId,
      residentLabel: s.nodes[s.ice.residentNodeId]?.label ?? s.ice.residentNodeId,
    });
  }

  // Deselect the player from this node
  if (s.selectedNodeId === nodeId) {
    setSelectedNode(null);
  }

  // Lock the node temporarily
  setNodeRebooting(nodeId, true);

  const durationMs = 1000 + random("world") * 2000; // 1–3s
  scheduleEvent(TIMER.REBOOT_COMPLETE, durationMs, { nodeId }, { label: `REBOOT: ${node.label}` });

  emitEvent(E.NODE_REBOOTING, { nodeId, label: node.label, durationMs });
}

export function completeReboot(nodeId) {
  const s = getState();
  const node = s.nodes[nodeId];
  if (!node) return;
  setNodeRebooting(nodeId, false);
  emitEvent(E.NODE_REBOOTED, { nodeId, label: node.label });
}
