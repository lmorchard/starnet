// @ts-check
// ICE AI — movement tick logic, detection, and dwell timer handling.
// Imported by main.js; uses timer system for all timed events.

/** @typedef {import('../types.js').GameState} GameState */
/** @typedef {import('../types.js').IceState} IceState */
/** @typedef {import('../types.js').NodeState} NodeState */

import { getState } from "../state.js";
import { activeIceInstances, setIceAttention, setIceDetectedAt, setIceDwellTimer, setIceMoveTimer, setIceActive, setLastDisturbedNode } from "../state/ice.js";
import { recordIceDetection } from "../alert.js";
import { scheduleEvent, scheduleRepeating, cancelAllByType, cancelEvent, TIMER } from "../timers.js";
import { emitEvent, on, E } from "../events.js";
import { A } from "../action-ids.js";
import { RNG, randomPick } from "../rng.js";
import { getType, getEffect } from "./index.js";
import { damagePlayerHealth, damagePlayerDeck } from "../player-orchestration.js";
import { MOVE_INTERVALS, DWELL_TIMES, ICE_NOISE_THRESHOLD, ARRIVAL_DELAY_MS } from "../balance.js";

// Called whenever an ICE instance vacates a node for any reason: normal movement,
// eject, or reboot. Cancels that instance's pending detection dwell and releases
// its detection lock so it can re-detect on its next visit.
function handleIceDeparture(iceId) {
  if (!iceId) return;
  const s = getState();
  const instance = s.ice?.instances?.[iceId];
  if (instance?.dwellTimerId != null) cancelEvent(instance.dwellTimerId);
  setIceDetectedAt(null, iceId);
}

// ICE movement intervals, dwell times, noise thresholds, and the arrival delay
// are tuning knobs — see js/core/balance.js (#169).

export function startIce() {
  const s = getState();
  // Idempotent: drop any move timers from a prior call before scheduling fresh
  // ones, so repeated startIce() calls re-schedule cleanly instead of stacking
  // orphaned timers (which would accelerate ICE cadence over a run).
  cancelAllByType(TIMER.ICE_MOVE);
  // Each active instance gets its own repeating ICE_MOVE timer at its grade's
  // interval, carrying its iceId so handleIceTick moves only that instance.
  for (const ice of activeIceInstances(s)) {
    const interval = MOVE_INTERVALS[ice.grade] ?? 6000;
    const id = scheduleRepeating(TIMER.ICE_MOVE, interval, { iceId: ice.id });
    setIceMoveTimer(id, ice.id);
  }
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
    // Reset every active instance's dwell + detection lock so each can re-detect
    // on the node the player just entered (or simply clear on deselect).
    for (const ice of activeIceInstances(s)) {
      if (ice.dwellTimerId != null) cancelEvent(ice.dwellTimerId);
      setIceDetectedAt(null, ice.id);
    }
    if (nodeId !== null) {
      for (const ice of activeIceInstances(getState())) {
        if (ice.attentionNodeId === nodeId) {
          checkIceDetection(ice, nodeId);
        }
      }
    }
  });

  // Eject and reboot forcibly move an instance off its current node — treat as a
  // departure for that specific instance (both events carry iceId).
  on(E.ICE_EJECTED,  ({ iceId }) => handleIceDeparture(iceId));
  on(E.ICE_REBOOTED, ({ iceId }) => handleIceDeparture(iceId));

  // Respond to exploit execution noise via ACTION_FEEDBACK progress events.
  // The timed-action operator emits progress at every tick. We convert the progress
  // fraction to a noise tick count (10 milestones over duration) and compare
  // against the ICE grade threshold.
  on(E.ACTION_FEEDBACK, ({ nodeId, action, phase, progress }) => {
    if (action !== A.XPLOIT || phase !== "progress") return;
    const s = getState();
    if (s.phase !== "playing") return;
    if (s.lastDisturbedNodeId === nodeId) return;
    const noiseTick = Math.floor(progress * 10);
    // Disturbance is a single global signal. If ANY active instance is sensitive
    // enough at this noise level, record it once.
    const disturbed = activeIceInstances(s).some(
      (ice) => noiseTick >= (ICE_NOISE_THRESHOLD[ice.grade] ?? 5)
    );
    if (disturbed) setLastDisturbedNode(nodeId);
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

export function handleIceTick(payload) {
  const s = getState();
  if (s.phase !== "playing") return;
  // Per-instance timer: payload carries the iceId of the single instance to move.
  if (payload?.iceId) {
    const ice = s.ice?.instances?.[payload.iceId];
    if (ice?.active) moveInstance(ice, s);
    return;
  }
  // No iceId in payload: move all active instances. No production caller forwards
  // an empty payload — retained as a defensive fallback / for direct test invocation.
  const instances = Object.values(s.ice?.instances ?? {});
  for (const instance of instances) {
    if (!instance.active) continue;
    moveInstance(instance, s);
  }
}

function moveInstance(ice, s) {
  const { grade, attentionNodeId } = ice;
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
    const alreadyDetectedTarget = ice.detectedAtNode === target;
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
  setIceAttention(nextNode, ice.id);

  // Emit movement event (log-renderer formats based on visibility)
  const fromVisible = isPlayerVisible(s.nodes[fromId]);
  const toVisible = isPlayerVisible(s.nodes[nextNode]);
  const fromLabel = fromVisible ? (s.nodes[fromId]?.label ?? fromId) : "???";
  const toLabel = toVisible ? (s.nodes[nextNode]?.label ?? nextNode) : "???";
  emitEvent(E.ICE_MOVED, { iceId: ice.id, fromId, toId: nextNode, fromLabel, toLabel, fromVisible, toVisible });

  // Each instance drives its own per-id dwell timer on arrival.
  checkIceDetection(ice, nextNode, { justArrived: true });
}

function checkIceDetection(ice, nodeId, { justArrived = false } = {}) {
  const s = getState();
  if (!ice) return;
  if (s.selectedNodeId !== nodeId) {
    // This instance moved away from the player's node — clear its own dwell/lock.
    handleIceDeparture(ice.id);
    return;
  }
  if (ice.detectedAtNode === nodeId) return; // already detected here; player must move first

  const dwellMs = DWELL_TIMES[ice.grade];
  // Cancel only THIS instance's prior dwell — never the whole type.
  if (ice.dwellTimerId != null) cancelEvent(ice.dwellTimerId);

  if (dwellMs === null) {
    // Instant detection — no escape possible
    triggerDetection(ice, nodeId);
  } else {
    const totalMs = dwellMs + (justArrived ? ARRIVAL_DELAY_MS : 0);
    const timerId = scheduleEvent(TIMER.ICE_DETECT, totalMs, { iceId: ice.id, nodeId }, { label: "ICE DETECTION" });
    setIceDwellTimer(timerId, ice.id);
    emitEvent(E.ICE_DETECT_PENDING, { iceId: ice.id, nodeId, label: s.nodes[nodeId]?.label ?? nodeId, dwellMs: totalMs });
  }
}

export function handleIceDetect({ iceId, nodeId }) {
  const s = getState();
  // Resolve by id when present; fall back to the primary instance for legacy
  // timer payloads serialized before per-instance iceId keying (snapshot parity).
  const ice = iceId ? s.ice?.instances?.[iceId] : activeIceInstances(s)[0];
  if (!ice || !ice.active) return;
  // Only fire if player is still on the detected node
  if (s.selectedNodeId === nodeId) {
    triggerDetection(ice, nodeId);
    setIceDwellTimer(null, ice.id);
  }
}

function triggerDetection(ice, nodeId) {
  const s = getState();
  emitEvent(E.ICE_DETECTED, { iceId: ice?.id ?? null, nodeId, label: s.nodes[nodeId]?.label ?? nodeId });
  if (!ice) return;
  // Detection lock — applies to ALL ICE regardless of effects, so the same node
  // doesn't re-detect until the player moves. Per-instance: lock THIS instance.
  setIceDetectedAt(nodeId, ice.id);
  applyIceEffects(ice, s, nodeId);
}

/**
 * Apply the detecting instance type's effect atoms. raise-alert routes through
 * the existing alert/trace path (recordIceDetection); damage atoms route through
 * the player-orchestration wrappers (which end the run on depletion) and log a
 * readout. Untyped/legacy instances fall back to raise-alert — preserving
 * pre-dispatch behavior for fixtures like 'standard-ice'.
 *
 * Multi-instance: each detecting instance dispatches ITS OWN type's effects with
 * its own id — a sentinel and a spike on the same run drain HEALTH and DECK
 * independently, and a classic instance steps the shared alert via its own iceId.
 * @param {import('../types.js').IceInstance} ice
 * @param {import('../types.js').GameState} state
 * @param {string} nodeId
 */
function applyIceEffects(ice, state, nodeId) {
  const type = getType(ice.typeId);
  const effects = type?.effects ?? [{ atom: "raise-alert", params: {} }];
  const ctx = {
    propagateAlertEvent: (nid) => recordIceDetection(nid, ice.id),
    damagePlayerHealth,
    damagePlayerDeck,
  };
  // hostNodeId = the ICE's install node (real instance field); nodeId = where it
  // activated (the detection node, == attentionNodeId at detection time).
  emitEvent(E.ICE_ACTIVATED, { iceId: ice.id, trigger: "on-dwell-grade", hostNodeId: ice.hostNodeId, nodeId });
  for (const eff of effects) {
    const atom = getEffect(eff.atom);
    if (!atom) continue;
    atom.apply(ice, state, ctx, eff.params ?? {});
    logIceEffect(ice, eff, nodeId);
    emitEvent(E.ICE_EFFECT_APPLIED, { iceId: ice.id, effect: eff.atom, result: { ...(eff.params ?? {}) } });
    // Stop if a depletion ended the run mid-list (single-effect presets won't hit this).
    if (getState().phase !== "playing") break;
  }
}

/** Emit a log readout for damage effects (raise-alert is logged by the alert layer). */
function logIceEffect(ice, eff, nodeId) {
  const s = getState();
  const label = (s.nodes[nodeId]?.label ?? nodeId);
  if (eff.atom === "damage-health") {
    const h = s.player.health;
    const dead = h.current === 0;
    emitEvent(E.LOG_ENTRY, {
      text: `${dead ? "!! " : ""}[ICE] ${label} neural feedback: −${eff.params.amount} HEALTH (${h.current} left)`,
      type: dead ? "error" : "warning",
    });
  } else if (eff.atom === "damage-deck") {
    const d = s.player.deckIntegrity;
    const dead = d.current === 0;
    emitEvent(E.LOG_ENTRY, {
      text: `${dead ? "!! " : ""}[ICE] ${label} deck corruption: −${eff.params.amount} DECK (${d.current} left)`,
      type: dead ? "error" : "warning",
    });
  }
}

export function cancelIceDwell() {
  cancelAllByType(TIMER.ICE_DETECT);
}

// Teleport ICE directly to a node (cheat / playtesting use only).
// Resets detectedAtNode so the detection dwell fires immediately on arrival.
export function teleportIce(nodeId) {
  const s = getState();
  const ice = activeIceInstances(s)[0];
  if (!ice) return;
  if (!s.nodes[nodeId]) return;
  setIceDetectedAt(null);
  // Reschedule only THIS instance's ICE_MOVE from now so it doesn't fire mid-dwell
  // and cancel detection — leave other instances' move timers untouched.
  if (ice.moveTimerId != null) cancelEvent(ice.moveTimerId);
  const interval = MOVE_INTERVALS[ice.grade] ?? 6000;
  const id = scheduleRepeating(TIMER.ICE_MOVE, interval, { iceId: ice.id });
  setIceMoveTimer(id, ice.id);
  const fromId = ice.attentionNodeId;
  if (fromId !== nodeId) {
    setIceAttention(nodeId);
    const fromVisible = isPlayerVisible(s.nodes[fromId]);
    const toVisible   = isPlayerVisible(s.nodes[nodeId]);
    const fromLabel = fromVisible ? (s.nodes[fromId]?.label ?? fromId) : "???";
    const toLabel   = toVisible   ? (s.nodes[nodeId]?.label  ?? nodeId) : "???";
    emitEvent(E.ICE_MOVED, { iceId: ice.id, fromId, toId: nodeId, fromLabel, toLabel, fromVisible, toVisible });
  }
  checkIceDetection(ice, nodeId);
}

// ── ICE orchestration (moved from state/index.js) ────────

// Eject the ICE instance present at a node. The EJECT action is node-targeted,
// so `target` is normally a nodeId — we eject the active instance whose attention
// is on that node (multi-instance correctness: a co-active instance elsewhere is
// left alone). `target` may also be an explicit iceId (programmatic/test callers),
// and a missing arg falls back to the first active instance (single-instance legacy).
export function ejectIce(target) {
  const s = getState();
  const active = activeIceInstances(s);
  let ice;
  if (target && s.ice?.instances?.[target]?.active) {
    ice = s.ice.instances[target]; // explicit iceId
  } else if (target) {
    ice = active.find((i) => i.attentionNodeId === target); // nodeId
  } else {
    ice = active[0]; // legacy no-arg fallback
  }
  if (!ice) return;
  const fromId = ice.attentionNodeId;
  const neighbors = s.adjacency[fromId] || [];
  if (neighbors.length === 0) return;
  const toId = randomPick(RNG.ICE, neighbors);
  setIceAttention(toId, ice.id);
  emitEvent(E.ICE_EJECTED, { iceId: ice.id, fromId, toId });
}

// Trigger-driven (IDS subversion of the ICE host monitor). Operates on the first
// active instance — a single-instance assumption. No generated multi-ICE network
// currently wires a disable trigger (only the legacy single-ICE corporate-exchange).
// Revisit when multi-ICE networks gain disable triggers.
export function disableIce() {
  const ice = activeIceInstances(getState())[0];
  if (!ice) return;
  setIceActive(false);
  emitEvent(E.ICE_DISABLED, { iceId: ice.id });
}

// Send the ICE instance present at `nodeId` back to its host node. Reboot is a
// node-targeted action, so we resolve the instance whose attention is on the
// rebooted node — leaving any co-active instance elsewhere untouched. A missing
// arg falls back to the first active instance (single-instance legacy).
export function rebootIce(nodeId) {
  const active = activeIceInstances(getState());
  const ice = nodeId
    ? active.find((i) => i.attentionNodeId === nodeId)
    : active[0];
  if (!ice) return;
  setIceAttention(ice.hostNodeId, ice.id);
}
