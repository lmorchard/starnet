// ICE AI — movement tick logic, detection, and dwell timer handling.
// Imported by main.js; uses timer system for all timed events.

import { getState, moveIceAttention, addLogEntry } from "./state.js";
import { propagateAlertEvent } from "./state.js";
import { scheduleEvent, scheduleRepeating, cancelAllByType } from "./timers.js";

// Grade → movement interval (ms)
const MOVE_INTERVALS = { S: 2500, A: 3000, B: 4500, C: 5000, D: 7000, F: 8000 };

// Grade → dwell time before detection (ms); null = instant detection
const DWELL_TIMES = { S: null, A: null, B: 3500, C: 4500, D: 9000, F: 10000 };

export function startIce() {
  const s = getState();
  if (!s.ice || !s.ice.active) return;
  const interval = MOVE_INTERVALS[s.ice.grade] ?? 6000;
  scheduleRepeating("ice-move", interval);
}

export function stopIce() {
  cancelAllByType("ice-move");
  cancelAllByType("ice-detect");
}

// BFS: returns the first hop on the shortest path from src toward dst.
// Returns null if src === dst or no path exists.
function nextHopToward(src, dst, adjacency) {
  if (src === dst) return null;
  const visited = new Set([src]);
  const queue = [[src, null]]; // [node, firstHop]
  while (queue.length) {
    const [node, firstHop] = queue.shift();
    for (const neighbor of (adjacency[node] || [])) {
      const hop = firstHop ?? neighbor;
      if (neighbor === dst) return hop;
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([neighbor, hop]);
      }
    }
  }
  return null;
}

export function handleIceTick() {
  const s = getState();
  if (!s.ice || !s.ice.active || s.phase !== "playing") return;

  const { grade, attentionNodeId } = s.ice;
  const neighbors = s.adjacency[attentionNodeId] || [];
  if (neighbors.length === 0) return;

  let nextNode;

  if (grade === "D" || grade === "F") {
    // Random walk
    nextNode = neighbors[Math.floor(Math.random() * neighbors.length)];
  } else if (grade === "C" || grade === "B") {
    // Move toward last disturbed node, fall back to random
    const target = s.lastDisturbedNodeId;
    if (target && target !== attentionNodeId) {
      nextNode = nextHopToward(attentionNodeId, target, s.adjacency)
        ?? neighbors[Math.floor(Math.random() * neighbors.length)];
    } else {
      nextNode = neighbors[Math.floor(Math.random() * neighbors.length)];
    }
  } else {
    // A/S: pathfind directly to player's selected node, fall back to random
    const target = s.selectedNodeId;
    if (target && target !== attentionNodeId) {
      nextNode = nextHopToward(attentionNodeId, target, s.adjacency)
        ?? neighbors[Math.floor(Math.random() * neighbors.length)];
    } else {
      nextNode = neighbors[Math.floor(Math.random() * neighbors.length)];
    }
  }

  // Don't move ICE to a rebooting node — pick a non-rebooting neighbor instead
  if (s.nodes[nextNode]?.rebooting) {
    const nonRebooting = neighbors.filter((n) => !s.nodes[n]?.rebooting);
    nextNode = nonRebooting.length > 0
      ? nonRebooting[Math.floor(Math.random() * nonRebooting.length)]
      : null;
    if (!nextNode) return;
  }

  moveIceAttention(nextNode);
  checkIceDetection(nextNode);
}

function checkIceDetection(nodeId) {
  const s = getState();
  if (!s.ice || !s.ice.active) return;
  if (s.selectedNodeId !== nodeId) return;

  const dwellMs = DWELL_TIMES[s.ice.grade];
  cancelAllByType("ice-detect");

  if (dwellMs === null) {
    // Instant detection — no escape possible
    triggerDetection(nodeId);
  } else {
    const label = `ICE DETECTION`;
    addLogEntry(`// ICE AT ${s.nodes[nodeId]?.label ?? nodeId} — DISENGAGE OR EJECT`, "error");
    const timerId = scheduleEvent("ice-detect", dwellMs, { nodeId }, { label });
    s.ice.dwellTimerId = timerId;
  }
}

export function handleIceDetect({ nodeId }) {
  const s = getState();
  if (!s.ice?.active) return;
  // Only fire if player is still on the detected node
  if (s.selectedNodeId === nodeId) {
    triggerDetection(nodeId);
  }
}

function triggerDetection(nodeId) {
  addLogEntry("// DETECTED — ICE has locked your signal.", "error");
  propagateAlertEvent(nodeId);
}

export function cancelIceDwell() {
  cancelAllByType("ice-detect");
}
