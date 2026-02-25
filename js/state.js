// Central game state — all mutations go through these functions.
// After each mutation, emitEvent(E.STATE_CHANGED, state) is called via emit().
// Game events (node, exploit, alert, ICE, mission) are emitted as typed events;
// no log formatting lives here.

import { generateStartingHand, generateVulnerabilities } from "./exploits.js";
import { resolveExploit } from "./combat.js";
import { assignMacguffins, flagMissionMacguffin } from "./loot.js";
import { clearAll as clearAllTimers, scheduleEvent } from "./timers.js";
import { emitEvent, E } from "./events.js";

let state = null;

export function initState(networkData) {
  const nodes = {};
  networkData.nodes.forEach((n) => {
    const vulns = generateVulnerabilities(n.grade);
    // Append any hand-crafted staged vulnerabilities defined in the network data
    if (n.stagedVulnerabilities) {
      n.stagedVulnerabilities.forEach((sv) => vulns.push({
        ...sv,
        patched: false,
        patchTurn: null,
        hidden: true,
      }));
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
      macguffins: [],             // populated by assignMacguffins
      read: false,
      looted: false,
      eventForwardingDisabled: false,
      rebooting: false,           // true while node is temporarily offline after REBOOT
    };
  });

  // Build adjacency list for quick neighbor lookup
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
    selectedNodeId: null,
    phase: "playing",       // 'playing' | 'ended'
    runOutcome: null,       // 'success' | 'caught'
    isCheating: false,     // set true on first cheat command use
    ice: null,             // populated below if network defines ICE
    lastDisturbedNodeId: null,
  };

  // Assign macguffins to loot nodes
  assignMacguffins(Object.values(nodes));

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

export function getState() {
  return state;
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
      revealNeighbors(neighborId); // expose the next ring
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

const ALERT_ORDER = ["green", "yellow", "red"];

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

const GLOBAL_ALERT_ORDER = ["green", "yellow", "red", "trace"];

export function raiseGlobalAlert() {
  const prev = state.globalAlert;
  const idx = GLOBAL_ALERT_ORDER.indexOf(state.globalAlert);
  if (idx < GLOBAL_ALERT_ORDER.length - 1) {
    state.globalAlert = GLOBAL_ALERT_ORDER[idx + 1];
    emitEvent(E.ALERT_GLOBAL_RAISED, { prev, next: state.globalAlert });
  }

  if (state.globalAlert === "trace" && state.traceSecondsRemaining === null) {
    startTraceCountdown();
  }

  emit();
}

function startTraceCountdown() {
  state.traceSecondsRemaining = 60;
  emitEvent(E.ALERT_TRACE_STARTED, { seconds: 60 });
  const interval = setInterval(() => {
    if (!state || state.phase !== "playing") {
      clearInterval(interval);
      return;
    }
    state.traceSecondsRemaining -= 1;
    if (state.traceSecondsRemaining <= 0) {
      clearInterval(interval);
      endRun("caught");
    } else {
      emit();
    }
  }, 1000);
}

export function endRun(outcome) {
  clearAllTimers();
  state.phase = "ended";
  state.runOutcome = outcome;
  if (outcome === "caught") state.player.cash = 0;
  emitEvent(E.RUN_ENDED, { outcome });
  emit();
}

// ── Probe action ─────────────────────────────────────────

// Detection node types that forward events to security monitors
const DETECTION_TYPES = new Set(["ids"]);
const MONITOR_TYPES   = new Set(["security-monitor"]);

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
    emitEvent(E.NODE_ALERT_RAISED, { nodeId, label: node.label, prev: prevAlert, next: node.alertState });
  }

  // If this is a detection node, propagate to connected security monitors
  if (DETECTION_TYPES.has(node.type)) {
    propagateAlertEvent(nodeId);
  }

  emit();
}

export function propagateAlertEvent(fromNodeId) {
  const fromNode = state.nodes[fromNodeId];
  if (!fromNode || fromNode.eventForwardingDisabled) return;

  (state.adjacency[fromNodeId] || []).forEach((neighborId) => {
    const neighbor = state.nodes[neighborId];
    if (neighbor && MONITOR_TYPES.has(neighbor.type)) {
      const idx = ALERT_ORDER.indexOf(neighbor.alertState);
      if (idx < ALERT_ORDER.length - 1) {
        neighbor.alertState = ALERT_ORDER[idx + 1];
      }
      emitEvent(E.ALERT_PROPAGATED, {
        fromNodeId,
        fromLabel: fromNode.label,
        toNodeId: neighborId,
        toLabel: neighbor.label,
      });
      // Recompute global alert based on monitor states
      recomputeGlobalAlert();
    }
  });
}

function recomputeGlobalAlert() {
  const monitors = Object.values(state.nodes).filter((n) =>
    MONITOR_TYPES.has(n.type)
  );
  const detectors = Object.values(state.nodes).filter((n) =>
    DETECTION_TYPES.has(n.type)
  );

  const redMonitors = monitors.filter((n) => n.alertState === "red").length;
  const redDetectors = detectors.filter((n) =>
    n.alertState === "red" && !n.eventForwardingDisabled
  ).length;
  const yellowDetectors = detectors.filter((n) =>
    n.alertState !== "green" && !n.eventForwardingDisabled
  ).length;

  let newLevel = "green";
  if (yellowDetectors >= 1)  newLevel = "yellow";
  if (redDetectors >= 1)     newLevel = "red";
  if (redDetectors >= 2 || redMonitors >= 1) newLevel = "trace";

  // Only escalate, never de-escalate
  const current = GLOBAL_ALERT_ORDER.indexOf(state.globalAlert);
  const next = GLOBAL_ALERT_ORDER.indexOf(newLevel);
  if (next > current) {
    const prev = state.globalAlert;
    state.globalAlert = newLevel;
    emitEvent(E.ALERT_GLOBAL_RAISED, { prev, next: state.globalAlert });
    if (state.globalAlert === "trace" && state.traceSecondsRemaining === null) {
      startTraceCountdown();
    }
  }
}

// ── Exploit launch ───────────────────────────────────────

export function launchExploit(nodeId, exploitId) {
  const node = state.nodes[nodeId];
  const exploit = state.player.hand.find((c) => c.id === exploitId);
  if (!node || !exploit || exploit.decayState === "disclosed") return;

  if (exploit.usesRemaining === 0) {
    emitEvent(E.LOG_ENTRY, { text: `${exploit.name}: No uses remaining.`, type: "error" });
    emit();
    return null;
  }

  const result = resolveExploit(exploit, node);

  // Consume a use
  exploit.usesRemaining = Math.max(0, exploit.usesRemaining - 1);
  if (exploit.usesRemaining === 0 && exploit.decayState === "fresh") {
    exploit.decayState = "worn";
  }

  if (result.success) {
    // Advance access level
    result.levelChanged = false;
    const prevAccess = node.accessLevel;
    if (node.accessLevel === "locked") {
      node.accessLevel = "compromised";
      node.visibility = "accessible";
      revealNeighbors(nodeId);
      result.levelChanged = true;
    } else if (node.accessLevel === "compromised") {
      node.accessLevel = "owned";
      revealNeighbors(nodeId);
      result.levelChanged = true;
      // Owning the ICE resident node disables ICE
      if (state.ice?.active && state.ice.residentNodeId === nodeId) {
        disableIce();
      }
    }

    emitEvent(E.EXPLOIT_SUCCESS, {
      nodeId,
      label: node.label,
      exploitName: exploit.name,
      flavor: result.flavor,
      roll: result.roll,
      successChance: result.successChance,
      matchingVulns: result.matchingVulns,
    });

    if (result.levelChanged) {
      emitEvent(E.NODE_ACCESSED, { nodeId, label: node.label, prev: prevAccess, next: node.accessLevel });
    }

    // Reveal any staged vulnerabilities unlocked by the exploit's target types
    const usedTypes = exploit.targetVulnTypes;
    node.vulnerabilities.forEach((v) => {
      if (v.hidden && v.unlockedBy && usedTypes.includes(v.unlockedBy)) {
        v.hidden = false;
        emitEvent(E.EXPLOIT_SURFACE, { nodeId, label: node.label });
      }
    });
  } else {
    // Raise node alert
    const prevAlert = node.alertState;
    const idx = ALERT_ORDER.indexOf(node.alertState);
    if (idx < ALERT_ORDER.length - 1) {
      node.alertState = ALERT_ORDER[idx + 1];
    }

    // Disclose exploit if detected — partial burn (extra use) or full disclose
    if (result.disclosed) {
      const partialBurn = exploit.usesRemaining > 1 && Math.random() < 0.6;
      if (partialBurn) {
        exploit.usesRemaining--;
        result.partialBurn = true;
      } else {
        exploit.decayState = "disclosed";
      }
    }

    // Track disturbance for ICE pathfinding
    state.lastDisturbedNodeId = nodeId;

    // Propagate alert if detection node, then recompute global
    if (DETECTION_TYPES.has(node.type)) {
      propagateAlertEvent(nodeId);
    } else {
      recomputeGlobalAlert();
    }

    emitEvent(E.EXPLOIT_FAILURE, {
      nodeId,
      label: node.label,
      exploitName: exploit.name,
      flavor: result.flavor,
      roll: result.roll,
      successChance: result.successChance,
      matchingVulns: result.matchingVulns,
    });

    if (node.alertState !== prevAlert) {
      emitEvent(E.NODE_ALERT_RAISED, { nodeId, label: node.label, prev: prevAlert, next: node.alertState });
    }

    if (result.disclosed && !result.partialBurn) {
      emitEvent(E.EXPLOIT_DISCLOSED, { exploitName: exploit.name });
    } else if (result.partialBurn) {
      emitEvent(E.EXPLOIT_PARTIAL_BURN, { exploitName: exploit.name, usesRemaining: exploit.usesRemaining });
    }
  }

  emit();
  return result;
}

// ── Read & Loot ───────────────────────────────────────────

export function readNode(nodeId) {
  const node = state.nodes[nodeId];
  if (!node) return;
  node.read = true;
  emitEvent(E.NODE_READ, { nodeId, label: node.label, macguffinCount: node.macguffins.length });
  emit();
}

export function lootNode(nodeId) {
  const node = state.nodes[nodeId];
  if (!node || node.looted) return;

  const uncollected = node.macguffins.filter((m) => !m.collected);
  if (uncollected.length === 0) {
    emitEvent(E.LOG_ENTRY, { text: `${node.label}: Already looted.`, type: "info" });
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
  emitEvent(E.NODE_RECONFIGURED, { nodeId, label: node.label });
  recomputeGlobalAlert();
  emit();
}

// ── Cheat state mutations ─────────────────────────────────

export function setCheating() {
  if (!state.isCheating) {
    state.isCheating = true;
    emit();
  }
}

// Bypass the escalation-only rule — for cheat use only
export function forceGlobalAlert(level) {
  const valid = GLOBAL_ALERT_ORDER.includes(level);
  if (!valid) return;
  const prev = state.globalAlert;
  state.globalAlert = level;
  if (level !== prev) {
    emitEvent(E.ALERT_GLOBAL_RAISED, { prev, next: level });
  }
  if (level === "trace" && state.traceSecondsRemaining === null) {
    startTraceCountdown();
  }
  emit();
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

// Detection thresholds: how many detections before trace starts, by grade
const DETECTION_TRACE_THRESHOLD = { S: 1, A: 1, B: 2, C: 2, D: 3, F: 3 };

export function recordIceDetection(nodeId) {
  if (!state.ice?.active) return;
  state.ice.detectedAtNode = nodeId;
  state.ice.detectionCount++;
  // Don't restart trace if already counting down
  if (state.traceSecondsRemaining !== null) return;
  const threshold = DETECTION_TRACE_THRESHOLD[state.ice.grade] ?? 2;
  if (state.ice.detectionCount >= threshold) {
    startTraceCountdown();
  }
}

export function rebootNode(nodeId) {
  const node = state.nodes[nodeId];
  if (!node || node.rebooting) return;

  // Send ICE attention back to resident node and emit ICE_REBOOTED
  if (state.ice?.active) {
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
  scheduleEvent("reboot-complete", durationMs, { nodeId }, { label: `REBOOT: ${node.label}` });

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
  // Moving to a new node resets the per-node detection flag so ICE can detect again if it follows
  if (state.ice) state.ice.detectedAtNode = null;

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

function emit() {
  window._starnetState = state; // dev convenience
  emitEvent(E.STATE_CHANGED, state);
}
