// Central game state — all mutations go through these functions.
// After each mutation, a 'starnet:statechange' event is dispatched.

import { generateStartingHand, generateVulnerabilities } from "./exploits.js";
import { resolveExploit } from "./combat.js";
import { assignMacguffins, flagMissionMacguffin } from "./loot.js";

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
    log: [],               // recent action messages [{text, type}]
    isCheating: false,     // set true on first cheat command use
  };

  // Assign macguffins to loot nodes
  assignMacguffins(Object.values(nodes));

  // Flag one macguffin as the mission target (10x value)
  const missionTarget = flagMissionMacguffin(Object.values(nodes));
  state.mission = missionTarget
    ? { targetMacguffinId: missionTarget.id, targetName: missionTarget.name, complete: false }
    : null;

  if (state.mission) {
    addLog(`// MISSION: Retrieve ${state.mission.targetName}`, "info");
  }

  // Make start node accessible and reveal its neighbors
  accessNode(networkData.startNode);

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
  node.visibility = "accessible";
  revealNeighbors(nodeId);
}

export function revealNeighbors(nodeId) { // also used by cheats.js
  (state.adjacency[nodeId] || []).forEach((neighborId) => {
    const neighbor = state.nodes[neighborId];
    if (neighbor && neighbor.visibility === "hidden") {
      neighbor.visibility = "revealed";
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

  emit();
}

// ── Alert system ─────────────────────────────────────────

const ALERT_ORDER = ["green", "yellow", "red"];

export function raiseNodeAlert(nodeId) {
  const node = state.nodes[nodeId];
  if (!node) return;
  const idx = ALERT_ORDER.indexOf(node.alertState);
  if (idx < ALERT_ORDER.length - 1) {
    node.alertState = ALERT_ORDER[idx + 1];
  }
  emit();
}

const GLOBAL_ALERT_ORDER = ["green", "yellow", "red", "trace"];

export function raiseGlobalAlert() {
  const idx = GLOBAL_ALERT_ORDER.indexOf(state.globalAlert);
  if (idx < GLOBAL_ALERT_ORDER.length - 1) {
    state.globalAlert = GLOBAL_ALERT_ORDER[idx + 1];
  }

  if (state.globalAlert === "trace" && state.traceSecondsRemaining === null) {
    startTraceCountdown();
  }

  emit();
}

function startTraceCountdown() {
  state.traceSecondsRemaining = 60;
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
  state.phase = "ended";
  state.runOutcome = outcome;
  if (outcome === "caught") state.player.cash = 0;
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
    addLog(`${node.label}: Already probed.`, "info");
    emit();
    return;
  }

  node.probed = true;

  // Raise local alert (green → yellow)
  const idx = ALERT_ORDER.indexOf(node.alertState);
  if (idx < ALERT_ORDER.length - 1) {
    node.alertState = ALERT_ORDER[idx + 1];
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
    state.globalAlert = newLevel;
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
    addLog(`${exploit.name}: No uses remaining.`, "error");
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
    if (node.accessLevel === "locked") {
      node.accessLevel = "compromised";
      node.visibility = "accessible";
      revealNeighbors(nodeId);
      accessNeighbors(nodeId); // foothold: adjacent revealed nodes become reachable
      result.levelChanged = true;
    } else if (node.accessLevel === "compromised") {
      node.accessLevel = "owned";
      revealNeighbors(nodeId);
      result.levelChanged = true;
    }
    addLog(result.flavor, "success");

    // Reveal any staged vulnerabilities unlocked by the exploit's target types
    const usedTypes = exploit.targetVulnTypes;
    node.vulnerabilities.forEach((v) => {
      if (v.hidden && v.unlockedBy && usedTypes.includes(v.unlockedBy)) {
        v.hidden = false;
        addLog(`${node.label}: deeper attack surface revealed.`, "success");
      }
    });
  } else {
    // Raise node alert
    const idx = ALERT_ORDER.indexOf(node.alertState);
    if (idx < ALERT_ORDER.length - 1) {
      node.alertState = ALERT_ORDER[idx + 1];
    }

    // Disclose exploit if detected
    if (result.disclosed) {
      exploit.decayState = "disclosed";
    }

    // Propagate alert if detection node, then recompute global
    if (DETECTION_TYPES.has(node.type)) {
      propagateAlertEvent(nodeId);
    } else {
      recomputeGlobalAlert();
    }

    addLog(result.flavor, "failure");
  }

  // Log success chance for transparency
  addLog(
    `${node.label} — Roll: ${result.roll} vs ${result.successChance}%${result.matchingVulns.length > 0 ? " (vuln match)" : ""}`,
    "meta"
  );

  emit();
  return result;
}

// ── Read & Loot ───────────────────────────────────────────

export function readNode(nodeId) {
  const node = state.nodes[nodeId];
  if (!node) return;
  node.read = true;
  if (node.macguffins.length > 0) {
    addLog(`${node.label}: ${node.macguffins.length} item(s) found.`, "success");
  } else {
    addLog(`${node.label}: Nothing of value found.`, "info");
  }
  emit();
}

export function lootNode(nodeId) {
  const node = state.nodes[nodeId];
  if (!node || node.looted) return;

  const uncollected = node.macguffins.filter((m) => !m.collected);
  if (uncollected.length === 0) {
    addLog(`${node.label}: Already looted.`, "info");
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
  addLog(`Looted ${uncollected.length} item(s) from ${node.label}. +¥${total.toLocaleString()}`, "success");

  if (state.mission && !state.mission.complete) {
    const gotMission = uncollected.some((m) => m.id === state.mission.targetMacguffinId);
    if (gotMission) {
      state.mission.complete = true;
      addLog(`// MISSION TARGET ACQUIRED: ${state.mission.targetName}`, "success");
    }
  }

  emit();
}

// ── Reconfigure ──────────────────────────────────────────

export function reconfigureNode(nodeId) {
  const node = state.nodes[nodeId];
  if (!node) return;
  node.eventForwardingDisabled = true;
  addLog(`${node.label}: event forwarding disabled. Detection subverted.`, "success");
  recomputeGlobalAlert();
  emit();
}

// ── Message log ──────────────────────────────────────────

const MAX_LOG = 8;

// Private: used internally by state mutations (callers must emit() themselves)
function addLog(text, type = "info") {
  state.log.push({ text, type });
  if (state.log.length > MAX_LOG) state.log.splice(0, state.log.length - MAX_LOG);
}

// Public: for external callers (console, cheats) — adds log entry and emits
export function addLogEntry(text, type = "info") {
  addLog(text, type);
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
  state.globalAlert = level;
  if (level === "trace" && state.traceSecondsRemaining === null) {
    startTraceCountdown();
  }
  emit();
}

// ── Selection ────────────────────────────────────────────

export function selectNode(nodeId) {
  state.selectedNodeId = nodeId;
  emit();
}

// ── Event dispatch ───────────────────────────────────────

function emit() {
  window._starnetState = state; // dev convenience
  document.dispatchEvent(
    new CustomEvent("starnet:statechange", { detail: state })
  );
}
