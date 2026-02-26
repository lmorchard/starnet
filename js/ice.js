// @ts-check
// ICE AI — movement tick logic, detection, and dwell timer handling.
// Imported by main.js; uses timer system for all timed events.

/** @typedef {import('./types.js').GameState} GameState */
/** @typedef {import('./types.js').IceState} IceState */
/** @typedef {import('./types.js').NodeState} NodeState */

import { getState, moveIceAttention, disableIce } from "./state.js";
import { propagateAlertEvent, recordIceDetection } from "./alert.js";
import { scheduleEvent, scheduleRepeating, cancelAllByType, TIMER } from "./timers.js";
import { emitEvent, on, E } from "./events.js";

// Grade → movement interval (ms)
const MOVE_INTERVALS = { S: 2500, A: 3000, B: 4500, C: 5000, D: 7000, F: 8000 };

// Grade → dwell time before detection (ms); null = instant detection
const DWELL_TIMES = { S: null, A: null, B: 3500, C: 4500, D: 9000, F: 10000 };

export function startIce() {
  const s = getState();
  if (!s.ice || !s.ice.active) return;
  const interval = MOVE_INTERVALS[s.ice.grade] ?? 6000;
  scheduleRepeating(TIMER.ICE_MOVE, interval);
}

export function stopIce() {
  cancelAllByType(TIMER.ICE_MOVE);
  cancelAllByType(TIMER.ICE_DETECT);
}

// Cancel pending dwell detection when the player actually changes selection.
// Re-selecting the same node must not reset the timer — check before mutating.
on("starnet:action:select",  ({ nodeId }) => { if (getState().selectedNodeId !== nodeId) cancelIceDwell(); });
on("starnet:action:deselect", cancelIceDwell);

// Owning the ICE resident node shuts ICE down.
on(E.NODE_ACCESSED, ({ nodeId, next }) => {
  const s = getState();
  if (next === "owned" && s.ice?.active && s.ice.residentNodeId === nodeId) {
    stopIce();
    disableIce();
  }
});

function isPlayerVisible(nodeState) {
  return nodeState?.accessLevel === "compromised" || nodeState?.accessLevel === "owned";
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
    // Move toward last disturbed node, fall back to random.
    // Skip pathfinding if ICE already detected at that node — prevents oscillation.
    const target = s.lastDisturbedNodeId;
    const alreadyDetectedTarget = s.ice.detectedAtNode === target;
    if (target && target !== attentionNodeId && !alreadyDetectedTarget) {
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

  const fromId = attentionNodeId; // capture before move
  moveIceAttention(nextNode);

  // Emit movement event (log-renderer formats based on visibility)
  const fromVisible = isPlayerVisible(s.nodes[fromId]);
  const toVisible = isPlayerVisible(s.nodes[nextNode]);
  const fromLabel = fromVisible ? (s.nodes[fromId]?.label ?? fromId) : "???";
  const toLabel = toVisible ? (s.nodes[nextNode]?.label ?? nextNode) : "???";
  emitEvent(E.ICE_MOVED, { fromId, toId: nextNode, fromLabel, toLabel, fromVisible, toVisible });

  checkIceDetection(nextNode);
}

function checkIceDetection(nodeId) {
  const s = getState();
  if (!s.ice || !s.ice.active) return;
  if (s.selectedNodeId !== nodeId) {
    // ICE moved away from player's node — cancel any pending dwell timer
    cancelAllByType(TIMER.ICE_DETECT);
    return;
  }
  if (s.ice.detectedAtNode === nodeId) return; // already detected here; player must move first

  const dwellMs = DWELL_TIMES[s.ice.grade];
  cancelAllByType(TIMER.ICE_DETECT);

  if (dwellMs === null) {
    // Instant detection — no escape possible
    triggerDetection(nodeId);
  } else {
    // Schedule timer first so it's in the Map before the event triggers a re-render
    const timerId = scheduleEvent(TIMER.ICE_DETECT, dwellMs, { nodeId }, { label: "ICE DETECTION" });
    s.ice.dwellTimerId = timerId;
    emitEvent(E.ICE_DETECT_PENDING, { nodeId, label: s.nodes[nodeId]?.label ?? nodeId, dwellMs });
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
  const s = getState();
  emitEvent(E.ICE_DETECTED, { nodeId, label: s.nodes[nodeId]?.label ?? nodeId });
  propagateAlertEvent(nodeId);
  recordIceDetection(nodeId); // tracks count and may start trace
}

export function cancelIceDwell() {
  cancelAllByType(TIMER.ICE_DETECT);
}
