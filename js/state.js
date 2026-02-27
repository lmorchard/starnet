// @ts-check
// Central game state — all mutations go through these functions.
// After each mutation, emitEvent(E.STATE_CHANGED, state) is called via emit().
// Game events (node, exploit, alert, ICE, mission) are emitted as typed events;
// no log formatting lives here.

/** @typedef {import('./types.js').GameState} GameState */
/** @typedef {import('./types.js').NodeState} NodeState */
/** @typedef {import('./types.js').IceState} IceState */
/** @typedef {import('./types.js').ExploitCard} ExploitCard */
/** @typedef {import('./types.js').ExploitResult} ExploitResult */
/** @typedef {import('./types.js').AccessLevel} AccessLevel */
/** @typedef {import('./types.js').NodeAlertLevel} NodeAlertLevel */
/** @typedef {import('./types.js').GlobalAlertLevel} GlobalAlertLevel */

import { generateStartingHand, generateVulnerabilities, _exploitIdCounter, setExploitIdCounter } from "./exploits.js";
import { generateMacguffin, flagMissionMacguffin } from "./loot.js";
import { clearAll as clearAllTimers, scheduleEvent, serializeTimers, deserializeTimers, TIMER } from "./timers.js";
import { emitEvent, E } from "./events.js";
import { getStateFields, getBehaviors, resolveNode } from "./node-types.js";

/** @type {GameState|null} */
let state = null;

export function initState(networkData) {
  /** @type {Object.<string, NodeState>} */
  const nodes = {};
  networkData.nodes.forEach((n) => {
    const vulns = generateVulnerabilities(n.grade, n.type);
    // Append any hand-crafted staged vulnerabilities defined in the network data
    if (n.stagedVulnerabilities) {
      n.stagedVulnerabilities.forEach((sv) => vulns.push(/** @type {import('./types.js').Vulnerability} */ ({
        ...sv,
        patched: false,
        patchTurn: null,
        hidden: true,
      })));
    }
    nodes[n.id] = {
      id: n.id,
      type: n.type,
      label: n.label,
      grade: n.grade,
      visibility: "hidden",       // 'hidden' | 'revealed' | 'accessible'
      accessLevel: "locked",      // 'locked' | 'compromised' | 'owned'
      alertState: "green",        // 'green' | 'yellow' | 'red'
      probed: false,
      vulnerabilities: vulns,
      macguffins: [],             // populated by lootable behavior onInit
      read: false,
      looted: false,
      rebooting: false,           // true while node is temporarily offline after REBOOT
      ...getStateFields(n),       // behavior-atom stateFields (e.g. eventForwardingDisabled for detection nodes)
    };
  });

  // Build adjacency list for quick neighbor lookup
  /** @type {Object.<string, string[]>} */
  const adjacency = {};
  networkData.nodes.forEach((n) => { adjacency[n.id] = []; });
  networkData.edges.forEach((e) => {
    adjacency[e.source].push(e.target);
    adjacency[e.target].push(e.source);
  });

  state = {
    nodes,
    adjacency,
    player: {
      cash: 0,
      hand: generateStartingHand(),
    },
    globalAlert: "green",   // 'green' | 'yellow' | 'red' | 'trace'
    traceSecondsRemaining: null,
    traceTimerId: null,
    selectedNodeId: null,
    phase: "playing",       // 'playing' | 'ended'
    runOutcome: null,       // 'success' | 'caught'
    isCheating: false,     // set true on first cheat command use
    ice: null,             // populated below if network defines ICE
    lastDisturbedNodeId: null,
    executingExploit: null,
    activeProbe: null,
    mission: null,         // populated below after macguffin assignment
  };

  // Dispatch onInit to behavior atoms — lootable assigns macguffins here
  Object.values(nodes).forEach((node) => {
    const typeDef = resolveNode(node);
    const ctx = { typeDef, generateMacguffin };
    getBehaviors(node).forEach((atom) => atom.onInit?.(node, state, ctx));
  });

  // Flag one macguffin as the mission target (10x value)
  const missionTarget = flagMissionMacguffin(Object.values(nodes));
  state.mission = missionTarget
    ? { targetMacguffinId: missionTarget.id, targetName: missionTarget.name, complete: false }
    : null;

  // Make start node accessible — neighbors stay hidden until compromised
  state.nodes[networkData.startNode].visibility = "accessible";
  emitEvent(E.NODE_REVEALED, { nodeId: networkData.startNode, label: state.nodes[networkData.startNode].label });

  // Spawn ICE if defined in network data
  if (networkData.ice) {
    const nodeIds = Object.keys(nodes);
    const residentNodeId = networkData.ice.startNode
      ?? nodeIds[Math.floor(Math.random() * nodeIds.length)];
    state.ice = {
      grade: networkData.ice.grade,
      residentNodeId,
      attentionNodeId: residentNodeId,
      active: true,
      dwellTimerId: null,
      detectedAtNode: null,   // suppresses re-detection at same node until player moves
      detectionCount: 0,      // cumulative; triggers trace at grade-based threshold
    };
  }

  // Emit mission start and run start after full state is ready
  if (state.mission) {
    emitEvent(E.MISSION_STARTED, { targetName: state.mission.targetName });
  }
  emitEvent(E.RUN_STARTED, { state });

  emit();
  return state;
}

/** @returns {GameState} */
export function getState() {
  // state is always initialised before getState() is called
  return /** @type {GameState} */ (state);
}

// ── Node access ──────────────────────────────────────────

export function accessNode(nodeId) {
  const node = state.nodes[nodeId];
  if (!node) return;
  const wasHidden = node.visibility === "hidden";
  node.visibility = "accessible";
  if (wasHidden) {
    emitEvent(E.NODE_REVEALED, { nodeId, label: node.label });
  }
  revealNeighbors(nodeId);
}

export function revealNeighbors(nodeId) { // also used by cheats.js
  (state.adjacency[nodeId] || []).forEach((neighborId) => {
    const neighbor = state.nodes[neighborId];
    if (neighbor && neighbor.visibility === "hidden") {
      neighbor.visibility = "revealed";
      emitEvent(E.NODE_REVEALED, { nodeId: neighborId, label: neighbor.label });
    }
  });
}

// Promote already-revealed neighbors to accessible (foothold mechanic).
// Called when a node is compromised — adjacent nodes become reachable for probe/exploit.
export function accessNeighbors(nodeId) {
  (state.adjacency[nodeId] || []).forEach((neighborId) => {
    const neighbor = state.nodes[neighborId];
    if (neighbor && neighbor.visibility === "revealed") {
      neighbor.visibility = "accessible";
      emitEvent(E.NODE_REVEALED, { nodeId: neighborId, label: neighbor.label, unlocked: true });
      // Don't cascade reveals here — deeper connections only exposed on compromise, not access.
    }
  });
}

export function setAccessLevel(nodeId, level) {
  const node = state.nodes[nodeId];
  if (!node) return;

  const prev = node.accessLevel;
  node.accessLevel = level;

  // Gaining any access makes the node accessible in graph terms
  if (node.visibility !== "accessible") {
    node.visibility = "accessible";
    revealNeighbors(nodeId);
  }

  // Owning a node also reveals neighbors more deeply (same effect here)
  if (level === "owned" && prev !== "owned") {
    revealNeighbors(nodeId);
  }

  if (prev !== level) {
    emitEvent(E.NODE_ACCESSED, { nodeId, label: node.label, prev, next: level });
  }

  emit();
}

// ── Alert system ─────────────────────────────────────────

/** @type {NodeAlertLevel[]} */
export const ALERT_ORDER = ["green", "yellow", "red"];

export function raiseNodeAlert(nodeId) {
  const node = state.nodes[nodeId];
  if (!node) return;
  const prev = node.alertState;
  const idx = ALERT_ORDER.indexOf(node.alertState);
  if (idx < ALERT_ORDER.length - 1) {
    node.alertState = ALERT_ORDER[idx + 1];
    emitEvent(E.NODE_ALERT_RAISED, { nodeId, label: node.label, prev, next: node.alertState });
  }
  emit();
}


export function endRun(outcome) {
  clearAllTimers();
  state.phase = "ended";
  state.runOutcome = outcome;
  if (outcome === "caught") state.player.cash = 0;
  if (state.ice?.active) state.ice.active = false; // timers already cleared above
  emitEvent(E.RUN_ENDED, { outcome });
  emit();
}

// ── Probe action ─────────────────────────────────────────

export function probeNode(nodeId) {
  const node = state.nodes[nodeId];
  if (!node) return;
  if (node.probed) {
    emitEvent(E.LOG_ENTRY, { text: `${node.label}: Already probed.`, type: "info" });
    emit();
    return;
  }

  node.probed = true;
  state.lastDisturbedNodeId = nodeId;

  // Raise local alert (green → yellow)
  const prevAlert = node.alertState;
  const idx = ALERT_ORDER.indexOf(node.alertState);
  if (idx < ALERT_ORDER.length - 1) {
    node.alertState = ALERT_ORDER[idx + 1];
  }

  emitEvent(E.NODE_PROBED, { nodeId, label: node.label });
  if (node.alertState !== prevAlert) {
    // alert.js listener handles propagation to monitors / global recompute
    emitEvent(E.NODE_ALERT_RAISED, { nodeId, label: node.label, prev: prevAlert, next: node.alertState });
  }

  emit();
}


// ── Read & Loot ───────────────────────────────────────────

export function readNode(nodeId) {
  const node = state.nodes[nodeId];
  if (!node) return;
  if (node.read) {
    emitEvent(E.LOG_ENTRY, { text: `${node.label}: Already scanned.`, type: "info" });
    emit();
    return;
  }
  node.read = true;
  emitEvent(E.NODE_READ, { nodeId, label: node.label, macguffinCount: node.macguffins.length });
  emit();
}

export function lootNode(nodeId) {
  const node = state.nodes[nodeId];
  if (!node || node.looted) return;

  const uncollected = node.macguffins.filter((m) => !m.collected);
  if (uncollected.length === 0) {
    node.looted = true;
    emitEvent(E.LOG_ENTRY, { text: `${node.label}: Nothing to loot.`, type: "info" });
    emit();
    return;
  }

  let total = 0;
  uncollected.forEach((m) => {
    m.collected = true;
    total += m.cashValue;
  });

  node.looted = true;
  state.player.cash += total;
  emitEvent(E.NODE_LOOTED, { nodeId, label: node.label, items: uncollected.length, total });

  if (state.mission && !state.mission.complete) {
    const gotMission = uncollected.some((m) => m.id === state.mission.targetMacguffinId);
    if (gotMission) {
      state.mission.complete = true;
      emitEvent(E.MISSION_COMPLETE, { targetName: state.mission.targetName });
    }
  }

  emit();
}

// ── Reconfigure ──────────────────────────────────────────

export function reconfigureNode(nodeId) {
  const node = state.nodes[nodeId];
  if (!node) return;
  node.eventForwardingDisabled = true;
  // alert.js listener on NODE_RECONFIGURED handles global alert recompute
  emitEvent(E.NODE_RECONFIGURED, { nodeId, label: node.label });
  emit();
}

// ── Cheat state mutations ─────────────────────────────────

export function setCheating() {
  if (!state.isCheating) {
    state.isCheating = true;
    emit();
  }
}


// ── ICE mutations ─────────────────────────────────────────

export function moveIceAttention(nodeId) {
  if (!state.ice || !state.ice.active) return;
  state.ice.attentionNodeId = nodeId;
  emit();
}

export function ejectIce() {
  if (!state.ice || !state.ice.active) return;
  const fromId = state.ice.attentionNodeId;
  const neighbors = state.adjacency[fromId] || [];
  if (neighbors.length === 0) return;
  const toId = neighbors[Math.floor(Math.random() * neighbors.length)];
  state.ice.attentionNodeId = toId;
  emitEvent(E.ICE_EJECTED, { fromId, toId });
  emit();
}

export function rebootIce() {
  if (!state.ice || !state.ice.active) return;
  state.ice.attentionNodeId = state.ice.residentNodeId;
}

export function disableIce() {
  if (!state.ice) return;
  state.ice.active = false;
  emitEvent(E.ICE_DISABLED, {});
  emit();
}


export function rebootNode(nodeId) {
  const node = state.nodes[nodeId];
  if (!node || node.rebooting) return;

  // Send ICE attention back to resident node only if ICE is currently on this node
  if (state.ice?.active && state.ice.attentionNodeId === nodeId) {
    rebootIce();
    emitEvent(E.ICE_REBOOTED, {
      residentNodeId: state.ice.residentNodeId,
      residentLabel: state.nodes[state.ice.residentNodeId]?.label ?? state.ice.residentNodeId,
    });
  }

  // Deselect the player from this node
  if (state.selectedNodeId === nodeId) {
    state.selectedNodeId = null;
  }

  // Lock the node temporarily
  node.rebooting = true;

  const durationMs = 1000 + Math.random() * 2000; // 1–3s
  scheduleEvent(TIMER.REBOOT_COMPLETE, durationMs, { nodeId }, { label: `REBOOT: ${node.label}` });

  emitEvent(E.NODE_REBOOTING, { nodeId, label: node.label, durationMs });

  emit();
}

export function completeReboot(nodeId) {
  const node = state.nodes[nodeId];
  if (!node) return;
  node.rebooting = false;
  emitEvent(E.NODE_REBOOTED, { nodeId, label: node.label });
  emit();
}

// ── Selection ────────────────────────────────────────────

export function selectNode(nodeId) {
  const node = state.nodes[nodeId];
  if (node?.rebooting) {
    emitEvent(E.LOG_ENTRY, { text: `${node.label}: node is rebooting.`, type: "error" });
    emit();
    return;
  }
  state.selectedNodeId = nodeId;

  // Traversal: selecting a revealed ("???") node adjacent to any accessible node makes it
  // accessible. This is how the player explores deeper into the network.
  if (node && node.visibility === "revealed") {
    const hasAccessibleNeighbor = (state.adjacency[nodeId] || []).some(
      (nid) => state.nodes[nid]?.visibility === "accessible"
    );
    if (hasAccessibleNeighbor) {
      node.visibility = "accessible";
      // Don't reveal neighbors yet — that only happens on compromise.
      // Traversal makes the node reachable; exploitation reveals what's beyond it.
      emitEvent(E.NODE_REVEALED, { nodeId, label: node.label });
      emitEvent(E.LOG_ENTRY, { text: `[NODE] ${node.label}: signal traced. Node accessible.`, type: "info" });
    }
  }

  emit();
}

export function deselectNode() {
  state.selectedNodeId = null;
  emit();
}

// ── Event dispatch ───────────────────────────────────────

export function emit() {
  // @ts-ignore — dev convenience; not part of the typed window interface
  if (typeof window !== "undefined") window._starnetState = state;
  emitEvent(E.STATE_CHANGED, state);
}

// ── Visibility helpers ────────────────────────────────────

/**
 * Returns true if ICE is active and on a node the player controls.
 * Used by both graph rendering and console status commands so they apply
 * identical rules — ICE location is only visible on compromised/owned nodes.
 * @param {IceState|null|undefined} ice
 * @param {Object<string, NodeState>} nodes
 * @returns {boolean}
 */
export function isIceVisible(ice, nodes, selectedNodeId = null) {
  if (!ice?.active) return false;
  if (selectedNodeId && ice.attentionNodeId === selectedNodeId) return true;
  const atAccess = nodes[ice.attentionNodeId]?.accessLevel;
  return atAccess === "compromised" || atAccess === "owned";
}

// ── Serialization ─────────────────────────────────────────

export function serializeState() {
  return { ...state, _timers: serializeTimers(), _exploitIdCounter };
}

export function deserializeState(snapshot) {
  const { _timers, _exploitIdCounter: exploitId, ...gameState } = snapshot;
  state = gameState;
  deserializeTimers(_timers);
  if (exploitId != null) setExploitIdCounter(exploitId);
}
