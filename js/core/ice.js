// @ts-check
// ICE AI — movement tick logic, detection, and dwell timer handling.
// Imported by main.js; uses timer system for all timed events.

/** @typedef {import('./types.js').GameState} GameState */
/** @typedef {import('./types.js').IceState} IceState */
/** @typedef {import('./types.js').NodeState} NodeState */

import { getState } from "./state.js";
import { setIceAttention, setIceDetectedAt, setIceDwellTimer, setIceActive, setLastDisturbedNode } from "./state/ice.js";
import { propagateAlertEvent, recordIceDetection } from "./alert.js";
import { scheduleEvent, scheduleRepeating, cancelAllByType, TIMER } from "./timers.js";
import { emitEvent, on, E } from "./events.js";
import { RNG, randomPick } from "./rng.js";

// Called whenever ICE vacates a node for any reason: normal movement, eject, or reboot.
// Cancels any pending detection dwell and releases the detection lock so ICE can
// re-detect on its next visit.
function handleIceDeparture() {
  cancelAllByType(TIMER.ICE_DETECT);
  setIceDetectedAt(null);
}

// Grade → movement interval (ms); must be longer than the corresponding DWELL_TIMES entry.
// A/S slowed from 2500/3000 to give players a narrow window for exploit completion.
const MOVE_INTERVALS = { S: 4000, A: 5000, B: 6000, C: 7000, D: 12000, F: 14000 };

// Grade → dwell time before detection (ms).
// S/A get very short dwells — tight but evadable with fast reactions.
// C/B bumped from 4500/3500 to give players a window to complete exploits.
const DWELL_TIMES = { S: 800, A: 1500, B: 4500, C: 5500, D: 9000, F: 10000 };

// Grade → noise tick at which ICE first responds to an executing exploit.
// Exploit emits ticks 1–9 at 10%–90% of duration; 10% intervals.
const ICE_NOISE_THRESHOLD = { S: 1, A: 2, B: 3, C: 5, D: 7, F: 9 };

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

/**
 * Register ICE event handlers. Called at module load and can be re-called
 * after clearHandlers() (e.g. in the bot census loop).
 */
export function initIceHandlers() {
  // React to player navigation: cancel pending detection dwell, reset the detection
  // lock so ICE can re-detect on a revisit, and start a new dwell if ICE is already
  // at the node the player just entered. nodeId is null on deselect.
  on(E.PLAYER_NAVIGATED, ({ nodeId }) => {
    const s = getState();
    cancelAllByType(TIMER.ICE_DETECT);
    if (nodeId !== null) {
      setIceDetectedAt(null);
      if (s.ice?.active && s.ice.attentionNodeId === nodeId) {
        checkIceDetection(nodeId);
      }
    }
  });

  // Eject and reboot forcibly move ICE off its current node — treat as a departure.
  on(E.ICE_EJECTED,  handleIceDeparture);
  on(E.ICE_REBOOTED, handleIceDeparture);

  // Respond to exploit execution noise via ACTION_FEEDBACK progress events.
  // The timed-action operator emits progress at every tick. We convert the progress
  // fraction to a noise tick count (10 milestones over duration) and compare
  // against the ICE grade threshold.
  on(E.ACTION_FEEDBACK, ({ nodeId, action, phase, progress }) => {
    if (action !== "exploit" || phase !== "progress") return;
    const s = getState();
    if (!s.ice?.active || s.phase !== "playing") return;
    const noiseTick = Math.floor(progress * 10);
    const threshold = ICE_NOISE_THRESHOLD[s.ice.grade] ?? 5;
    if (noiseTick < threshold) return;
    if (s.lastDisturbedNodeId === nodeId) return;
    setLastDisturbedNode(nodeId);
  });
}

// Register on first import
initIceHandlers();


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
  // WAN is outside the LAN — ICE never moves there
  const neighbors = (s.adjacency[attentionNodeId] || [])
    .filter((n) => s.nodes[n]?.type !== "wan");
  if (neighbors.length === 0) return;

  let nextNode;

  if (grade === "D" || grade === "F") {
    // Random walk
    nextNode = randomPick(RNG.ICE, neighbors);
  } else {
    // C/B/A/S: move toward last disturbed node, fall back to random.
    // All grades above D use disturbance tracking — higher grades just move
    // faster (via MOVE_INTERVALS) and detect sooner (via DWELL_TIMES).
    // Skip pathfinding if ICE already detected at that node — prevents oscillation.
    const target = s.lastDisturbedNodeId;
    const alreadyDetectedTarget = s.ice.detectedAtNode === target;
    if (target && target !== attentionNodeId && !alreadyDetectedTarget) {
      nextNode = nextHopToward(attentionNodeId, target, s.adjacency)
        ?? randomPick(RNG.ICE, neighbors);
    } else {
      // Arrived at the disturbance target (or no target) — clear signal, resume random walk.
      if (target && target === attentionNodeId) {
        setLastDisturbedNode(null);
        if (isPlayerVisible(s.nodes[attentionNodeId])) {
          emitEvent(E.LOG_ENTRY, {
            text: `[ICE] Grade-${grade} ICE found no activity at ${s.nodes[attentionNodeId]?.label ?? attentionNodeId} — resuming patrol.`,
            type: "info",
          });
        }
      }
      nextNode = randomPick(RNG.ICE, neighbors);
    }
  }

  // Don't move ICE to a rebooting node — pick a non-rebooting neighbor instead
  if (s.nodes[nextNode]?.rebooting) {
    const nonRebooting = neighbors.filter((n) => !s.nodes[n]?.rebooting);
    nextNode = nonRebooting.length > 0
      ? randomPick(RNG.ICE, nonRebooting)
      : null;
    if (!nextNode) return;
  }

  const fromId = attentionNodeId; // capture before move
  setIceAttention(nextNode);

  // Emit movement event (log-renderer formats based on visibility)
  const fromVisible = isPlayerVisible(s.nodes[fromId]);
  const toVisible = isPlayerVisible(s.nodes[nextNode]);
  const fromLabel = fromVisible ? (s.nodes[fromId]?.label ?? fromId) : "???";
  const toLabel = toVisible ? (s.nodes[nextNode]?.label ?? nextNode) : "???";
  emitEvent(E.ICE_MOVED, { fromId, toId: nextNode, fromLabel, toLabel, fromVisible, toVisible });

  checkIceDetection(nextNode, { justArrived: true });
}

// Delay before detection starts when ICE arrives via movement (ms).
// Matches the ICE movement animation duration so the visual and the
// detection timer stay in sync — player sees ICE arrive, then countdown starts.
const ARRIVAL_DELAY_MS = 400;

function checkIceDetection(nodeId, { justArrived = false } = {}) {
  const s = getState();
  if (!s.ice || !s.ice.active) return;
  if (s.selectedNodeId !== nodeId) {
    // ICE moved away from player's node — use shared departure handler.
    handleIceDeparture();
    return;
  }
  if (s.ice.detectedAtNode === nodeId) return; // already detected here; player must move first

  const dwellMs = DWELL_TIMES[s.ice.grade];
  cancelAllByType(TIMER.ICE_DETECT);

  if (dwellMs === null) {
    // Instant detection — no escape possible
    triggerDetection(nodeId);
  } else {
    const totalMs = dwellMs + (justArrived ? ARRIVAL_DELAY_MS : 0);
    const timerId = scheduleEvent(TIMER.ICE_DETECT, totalMs, { nodeId }, { label: "ICE DETECTION" });
    setIceDwellTimer(timerId);
    emitEvent(E.ICE_DETECT_PENDING, { nodeId, label: s.nodes[nodeId]?.label ?? nodeId, dwellMs: totalMs });
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

// Teleport ICE directly to a node (cheat / playtesting use only).
// Resets detectedAtNode so the detection dwell fires immediately on arrival.
export function teleportIce(nodeId) {
  const s = getState();
  if (!s.ice || !s.ice.active) return;
  if (!s.nodes[nodeId]) return;
  setIceDetectedAt(null);
  // Reschedule ICE_MOVE from now so it doesn't fire mid-dwell and cancel detection.
  const interval = MOVE_INTERVALS[s.ice.grade] ?? 6000;
  cancelAllByType(TIMER.ICE_MOVE);
  scheduleRepeating(TIMER.ICE_MOVE, interval);
  const fromId = s.ice.attentionNodeId;
  if (fromId !== nodeId) {
    setIceAttention(nodeId);
    const fromVisible = isPlayerVisible(s.nodes[fromId]);
    const toVisible   = isPlayerVisible(s.nodes[nodeId]);
    const fromLabel = fromVisible ? (s.nodes[fromId]?.label ?? fromId) : "???";
    const toLabel   = toVisible   ? (s.nodes[nodeId]?.label  ?? nodeId) : "???";
    emitEvent(E.ICE_MOVED, { fromId, toId: nodeId, fromLabel, toLabel, fromVisible, toVisible });
  }
  checkIceDetection(nodeId);
}

// ── ICE orchestration (moved from state/index.js) ────────

export function ejectIce() {
  const s = getState();
  if (!s.ice || !s.ice.active) return;
  const fromId = s.ice.attentionNodeId;
  const neighbors = s.adjacency[fromId] || [];
  if (neighbors.length === 0) return;
  const toId = randomPick(RNG.ICE, neighbors);
  setIceAttention(toId);
  emitEvent(E.ICE_EJECTED, { fromId, toId });
}

export function disableIce() {
  const s = getState();
  if (!s.ice) return;
  setIceActive(false);
  emitEvent(E.ICE_DISABLED, {});
}

export function rebootIce() {
  const s = getState();
  if (!s.ice || !s.ice.active) return;
  setIceAttention(s.ice.residentNodeId);
}
