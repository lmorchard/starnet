// @ts-check
// ═══════════════════════════════════════════════════════════════════════
// Central game state module.
//
// CONVENTION: All state mutations MUST go through the mutate() wrapper.
// No code outside js/state/ should modify the state object directly.
// Use the setter functions exported by submodules (node.js, ice.js,
// alert.js, player.js, game.js) or the orchestration functions here.
//
// mutate() increments a monotonic version counter. The tick() loop and
// action dispatcher check getVersion() before/after to emit a single
// STATE_CHANGED event per cycle — no more scattered emit() calls.
// ═══════════════════════════════════════════════════════════════════════

/** @typedef {import('../types.js').GameState} GameState */
/** @typedef {import('../types.js').NodeState} NodeState */
/** @typedef {import('../types.js').IceState} IceState */
/** @typedef {import('../types.js').ExploitCard} ExploitCard */
/** @typedef {import('../types.js').ExploitResult} ExploitResult */
/** @typedef {import('../types.js').AccessLevel} AccessLevel */
/** @typedef {import('../types.js').NodeAlertLevel} NodeAlertLevel */
/** @typedef {import('../types.js').GlobalAlertLevel} GlobalAlertLevel */

import { generateStartingHand, generateVulnerabilities, _exploitIdCounter, setExploitIdCounter } from "../exploits.js";
import { generateMacguffin, flagMissionMacguffin } from "../loot.js";
import { clearAll as clearAllTimers, scheduleEvent, serializeTimers, deserializeTimers, TIMER } from "../timers.js";
import { emitEvent, E } from "../events.js";
import { getStateFields, getBehaviors, resolveNode } from "../node-types.js";

// State submodule imports — orchestration functions use these instead of direct mutation
import { setNodeVisible, setNodeAccessLevel, setNodeProbed, setNodeAlertState,
         setNodeRead, collectMacguffins, setNodeLooted, setNodeRebooting,
         setNodeEventForwarding } from "./node.js";
import { setIceAttention, setIceActive } from "./ice.js";
import { setLastDisturbedNode } from "./ice.js";
import { setSelectedNode, setPhase, setRunOutcome } from "./game.js";
import { setCash, addCash, addCardToHand, setMissionComplete } from "./player.js";
import { setCheating as _setCheating } from "./game.js";

// ── State + version counter ──────────────────────────────

/** @type {GameState|null} */
let state = null;

let version = 0;

/**
 * Wrap all state mutations in this function. It executes the recipe,
 * increments the version counter, and returns the state.
 * @param {(s: GameState) => void} fn
 * @returns {GameState}
 */
export function mutate(fn) {
  fn(/** @type {GameState} */ (state));
  version++;
  return /** @type {GameState} */ (state);
}

/** Returns the current monotonic version counter. */
export function getVersion() {
  return version;
}

// ── Initialization ───────────────────────────────────────

export function initState(networkData) {
  /** @type {Object.<string, NodeState>} */
  const nodes = {};
  networkData.nodes.forEach((n) => {
    const vulns = generateVulnerabilities(n.grade, n.type);
    // Append any hand-crafted staged vulnerabilities defined in the network data
    if (n.stagedVulnerabilities) {
      n.stagedVulnerabilities.forEach((sv) => vulns.push(/** @type {import('../types.js').Vulnerability} */ ({
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
      cash: 1000,
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

  // WAN node is always accessible — it's the player's entry point from outside the LAN
  Object.values(state.nodes).forEach((node) => {
    if (node.type === "wan") node.visibility = "accessible";
  });

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

  version++;
  // Special case: initState emits STATE_CHANGED directly since it's outside
  // the tick/action cycle. This is the only place that calls emitEvent(STATE_CHANGED) directly.
  // @ts-ignore — dev convenience
  if (typeof window !== "undefined") window._starnetState = state;
  emitEvent(E.STATE_CHANGED, state);
  return state;
}

/** @returns {GameState} */
export function getState() {
  // state is always initialised before getState() is called
  return /** @type {GameState} */ (state);
}

// ── Node access orchestration ────────────────────────────
// These functions combine state mutations with event emission.
// They use submodule setters for all data changes.

export function accessNode(nodeId) {
  const node = state.nodes[nodeId];
  if (!node) return;
  const wasHidden = node.visibility === "hidden";
  setNodeVisible(nodeId, "accessible");
  if (wasHidden) {
    emitEvent(E.NODE_REVEALED, { nodeId, label: node.label });
  }
  revealNeighbors(nodeId);
}

export function revealNeighbors(nodeId) {
  (state.adjacency[nodeId] || []).forEach((neighborId) => {
    const neighbor = state.nodes[neighborId];
    if (neighbor && neighbor.visibility === "hidden") {
      setNodeVisible(neighborId, "revealed");
      emitEvent(E.NODE_REVEALED, { nodeId: neighborId, label: neighbor.label });
    }
  });
}

export function accessNeighbors(nodeId) {
  (state.adjacency[nodeId] || []).forEach((neighborId) => {
    const neighbor = state.nodes[neighborId];
    if (neighbor && neighbor.visibility === "revealed") {
      setNodeVisible(neighborId, "accessible");
      emitEvent(E.NODE_REVEALED, { nodeId: neighborId, label: neighbor.label, unlocked: true });
    }
  });
}

export function setAccessLevel(nodeId, level) {
  const node = state.nodes[nodeId];
  if (!node) return;

  const prev = node.accessLevel;
  setNodeAccessLevel(nodeId, level);

  if (node.visibility !== "accessible") {
    setNodeVisible(nodeId, "accessible");
    revealNeighbors(nodeId);
  }

  if (level === "owned" && prev !== "owned") {
    revealNeighbors(nodeId);
  }

  if (prev !== level) {
    emitEvent(E.NODE_ACCESSED, { nodeId, label: node.label, prev, next: level });
  }
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
    setNodeAlertState(nodeId, ALERT_ORDER[idx + 1]);
    emitEvent(E.NODE_ALERT_RAISED, { nodeId, label: node.label, prev, next: state.nodes[nodeId].alertState });
  }
}

export function endRun(outcome) {
  clearAllTimers();
  setPhase("ended");
  setRunOutcome(outcome);
  if (outcome === "caught") setCash(0);
  if (state.ice?.active) setIceActive(false);
  emitEvent(E.RUN_ENDED, { outcome });
}

// ── Probe action ─────────────────────────────────────────

export function probeNode(nodeId) {
  const node = state.nodes[nodeId];
  if (!node) return;
  if (node.probed) {
    emitEvent(E.LOG_ENTRY, { text: `${node.label}: Already probed.`, type: "info" });
    return;
  }

  setNodeProbed(nodeId);
  setLastDisturbedNode(nodeId);

  // Raise local alert (green → yellow)
  const prevAlert = node.alertState;
  const idx = ALERT_ORDER.indexOf(node.alertState);
  if (idx < ALERT_ORDER.length - 1) {
    setNodeAlertState(nodeId, ALERT_ORDER[idx + 1]);
  }

  emitEvent(E.NODE_PROBED, { nodeId, label: node.label });
  if (state.nodes[nodeId].alertState !== prevAlert) {
    emitEvent(E.NODE_ALERT_RAISED, { nodeId, label: node.label, prev: prevAlert, next: state.nodes[nodeId].alertState });
  }
}

// ── Read & Loot ───────────────────────────────────────────

export function readNode(nodeId) {
  const node = state.nodes[nodeId];
  if (!node) return;
  if (node.read) {
    emitEvent(E.LOG_ENTRY, { text: `${node.label}: Already scanned.`, type: "info" });
    return;
  }
  setNodeRead(nodeId);
  emitEvent(E.NODE_READ, { nodeId, label: node.label, macguffinCount: node.macguffins.length });
}

export function lootNode(nodeId) {
  const node = state.nodes[nodeId];
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

  if (state.mission && !state.mission.complete) {
    const gotMission = items.some((m) => m.id === state.mission.targetMacguffinId);
    if (gotMission) {
      setMissionComplete();
      emitEvent(E.MISSION_COMPLETE, { targetName: state.mission.targetName });
    }
  }
}

// ── Reconfigure ──────────────────────────────────────────

export function reconfigureNode(nodeId) {
  const node = state.nodes[nodeId];
  if (!node) return;
  setNodeEventForwarding(nodeId, true);
  emitEvent(E.NODE_RECONFIGURED, { nodeId, label: node.label });
}

// ── Cheat state mutations ─────────────────────────────────

export function setCheating() {
  _setCheating();
}

// ── ICE mutations ─────────────────────────────────────────

export function moveIceAttention(nodeId) {
  if (!state.ice || !state.ice.active) return;
  setIceAttention(nodeId);
}

export function ejectIce() {
  if (!state.ice || !state.ice.active) return;
  const fromId = state.ice.attentionNodeId;
  const neighbors = state.adjacency[fromId] || [];
  if (neighbors.length === 0) return;
  const toId = neighbors[Math.floor(Math.random() * neighbors.length)];
  setIceAttention(toId);
  emitEvent(E.ICE_EJECTED, { fromId, toId });
}

export function rebootIce() {
  if (!state.ice || !state.ice.active) return;
  setIceAttention(state.ice.residentNodeId);
}

export function disableIce() {
  if (!state.ice) return;
  setIceActive(false);
  emitEvent(E.ICE_DISABLED, {});
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
    setSelectedNode(null);
  }

  // Lock the node temporarily
  setNodeRebooting(nodeId, true);

  const durationMs = 1000 + Math.random() * 2000; // 1–3s
  scheduleEvent(TIMER.REBOOT_COMPLETE, durationMs, { nodeId }, { label: `REBOOT: ${node.label}` });

  emitEvent(E.NODE_REBOOTING, { nodeId, label: node.label, durationMs });
}

export function completeReboot(nodeId) {
  const node = state.nodes[nodeId];
  if (!node) return;
  setNodeRebooting(nodeId, false);
  emitEvent(E.NODE_REBOOTED, { nodeId, label: node.label });
}

// ── Selection ────────────────────────────────────────────

export function selectNode(nodeId) {
  const node = state.nodes[nodeId];
  if (node?.rebooting) {
    emitEvent(E.LOG_ENTRY, { text: `${node.label}: node is rebooting.`, type: "error" });
    return;
  }
  setSelectedNode(nodeId);

  // Traversal: selecting a revealed ("???") node adjacent to any accessible node makes it
  // accessible. This is how the player explores deeper into the network.
  if (node && node.visibility === "revealed") {
    const hasAccessibleNeighbor = (state.adjacency[nodeId] || []).some(
      (nid) => state.nodes[nid]?.visibility === "accessible"
    );
    if (hasAccessibleNeighbor) {
      setNodeVisible(nodeId, "accessible");
      emitEvent(E.NODE_REVEALED, { nodeId, label: node.label });
      emitEvent(E.LOG_ENTRY, { text: `[NODE] ${node.label}: signal traced. Node accessible.`, type: "info" });
    }
  }
}

export function deselectNode() {
  setSelectedNode(null);
}

// ── Visibility helpers ────────────────────────────────────

/**
 * Returns true if ICE is active and on a node the player controls.
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

// ── Store / card acquisition ──────────────────────────────

/**
 * Deducts price from wallet and adds the card to the player's hand.
 * Returns false (no-op) if the player cannot afford it.
 * @param {ExploitCard} card
 * @param {number} price
 * @returns {boolean}
 */
export function buyExploit(card, price) {
  if (state.player.cash < price) return false;
  addCash(-price);
  addCardToHand(card);
  return true;
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
