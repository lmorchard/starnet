// Central game state — all mutations go through these functions.
// After each mutation, a 'starnet:statechange' event is dispatched.

import { generateStartingHand, generateVulnerabilities } from "./exploits.js";

let state = null;

export function initState(networkData) {
  const nodes = {};
  networkData.nodes.forEach((n) => {
    nodes[n.id] = {
      id: n.id,
      type: n.type,
      label: n.label,
      grade: n.grade,
      visibility: "hidden",       // 'hidden' | 'revealed' | 'accessible'
      accessLevel: "locked",      // 'locked' | 'compromised' | 'owned'
      alertState: "green",        // 'green' | 'yellow' | 'red'
      probed: false,
      vulnerabilities: generateVulnerabilities(n.grade),
      macguffins: [],             // populated in Phase 8
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
  };

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

export function revealNeighbors(nodeId) {
  (state.adjacency[nodeId] || []).forEach((neighborId) => {
    const neighbor = state.nodes[neighborId];
    if (neighbor && neighbor.visibility === "hidden") {
      neighbor.visibility = "revealed";
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

export function raiseGlobalAlert() {
  const order = ["green", "yellow", "red", "trace"];
  const idx = order.indexOf(state.globalAlert);
  if (idx < order.length - 1) {
    state.globalAlert = order[idx + 1];
  }
  emit();
}

// ── Probe action ─────────────────────────────────────────

// Detection node types that forward events to security monitors
const DETECTION_TYPES = new Set(["ids"]);
const MONITOR_TYPES   = new Set(["security-monitor"]);

export function probeNode(nodeId) {
  const node = state.nodes[nodeId];
  if (!node || node.probed) return;

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
    }
  });
}

// ── Selection ────────────────────────────────────────────

export function selectNode(nodeId) {
  state.selectedNodeId = nodeId;
  emit();
}

// ── Event dispatch ───────────────────────────────────────

function emit() {
  document.dispatchEvent(
    new CustomEvent("starnet:statechange", { detail: state })
  );
}
