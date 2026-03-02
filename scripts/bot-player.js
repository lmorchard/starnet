// @ts-check
// Bot player — automated greedy strategy for balance testing.
// Plays a single game from init to jackout and returns stats.
// No DOM dependencies. Uses the same action context as playtest.js.

import { initState, getState, getVersion } from "../js/state.js";
import { startIce, handleIceTick, handleIceDetect } from "../js/ice.js";
import { handleTraceTick } from "../js/alert.js";
import { completeReboot } from "../js/node-orchestration.js";
import { handleExploitExecTimer, handleExploitNoiseTimer } from "../js/exploit-exec.js";
import { handleProbeScanTimer } from "../js/probe-exec.js";
import { handleReadScanTimer } from "../js/read-exec.js";
import { handleLootExtractTimer } from "../js/loot-exec.js";
import { on, off, emitEvent, E, clearHandlers } from "../js/events.js";
import { tick, TIMER } from "../js/timers.js";
import { initLog } from "../js/log.js";
import { initNodeLifecycle } from "../js/node-lifecycle.js";
import { buildActionContext, initActionDispatcher } from "../js/action-context.js";
import { buyFromStore } from "../js/store-logic.js";

/** Default tick increment for tick-until-event loops. */
const DEFAULT_TICK_INCREMENT = 1;

/** Default maximum ticks before forcing a run to end. */
const DEFAULT_MAX_TICKS = 5000;

/** Node types that are lootable targets. */
const LOOTABLE_TYPES = new Set(["fileserver", "cryptovault"]);

/** Node types to skip in exploration (security infrastructure). */
const SECURITY_TYPES = new Set(["ids", "security-monitor"]);

/**
 * @typedef {{
 *   missionSuccess: boolean,
 *   fullClear: boolean,
 *   failReason: null | "trace" | "no-cards" | "stuck" | "tick-cap",
 *   cardUsesConsumed: number,
 *   cardsBurned: number,
 *   storeVisits: number,
 *   cashSpent: number,
 *   cashRemaining: number,
 *   totalTicks: number,
 *   peakAlert: string,
 *   traceFired: boolean,
 *   iceDetections: number,
 *   nodesOwned: number,
 *   nodesTotal: number,
 *   tickFirstNodeOwned: number,
 *   tickFirstDetection: number,
 *   tickTraceStarted: number,
 *   tickMissionComplete: number,
 * }} BotRunStats
 */

/**
 * Run one automated game from init to completion.
 * @param {object} network — return value of generateNetwork()
 * @param {string} seed
 * @param {{ tickIncrement?: number, maxTicks?: number, evasion?: boolean }} [options]
 * @returns {BotRunStats}
 */
export function runBot(network, seed, options = {}) {
  const { tickIncrement = DEFAULT_TICK_INCREMENT, maxTicks = DEFAULT_MAX_TICKS, evasion = false } = options;

  // ── Setup ────────────────────────────────────────────────
  clearHandlers();
  initLog();
  initNodeLifecycle();
  initState(network, seed);
  startIce();

  // Timer wiring (same as playtest.js)
  on(TIMER.ICE_MOVE,        ()        => handleIceTick());
  on(TIMER.ICE_DETECT,      (payload) => handleIceDetect(payload));
  on(TIMER.TRACE_TICK,      ()        => handleTraceTick());
  on(TIMER.REBOOT_COMPLETE, (payload) => completeReboot(payload.nodeId));
  on(TIMER.EXPLOIT_EXEC,    (payload) => handleExploitExecTimer(payload));
  on(TIMER.EXPLOIT_NOISE,   (payload) => handleExploitNoiseTimer(payload));
  on(TIMER.PROBE_SCAN,      (payload) => handleProbeScanTimer(payload));
  on(TIMER.READ_SCAN,       (payload) => handleReadScanTimer(payload));
  on(TIMER.LOOT_EXTRACT,    (payload) => handleLootExtractTimer(payload));

  // Action dispatcher
  const ctx = {
    ...buildActionContext(),
    openDarknetsStore: () => {},  // bot uses buyFromStore directly
  };
  initActionDispatcher(ctx);

  // ── Stat tracking via events ─────────────────────────────
  let traceFired = false;
  let peakAlert = "green";
  let iceDetections = 0;
  let cardUsesConsumed = 0;
  let cardsBurned = 0;
  let startingCash = getState().player.cash;
  let storeVisitCount = 0;

  // Timing breakpoints (tick at which event first occurs)
  let tickFirstNodeOwned = -1;   // first non-gateway node owned
  let tickFirstDetection = -1;   // first ICE detection
  let tickTraceStarted = -1;     // trace countdown started
  let tickMissionComplete = -1;  // mission target looted
  let gatewayOwnedCount = 0;     // track when we're past gateway

  const alertOrder = ["green", "yellow", "red"];

  function onAlertRaised({ next }) {
    if (alertOrder.indexOf(next) > alertOrder.indexOf(peakAlert)) peakAlert = next;
  }
  function onTraceStarted() {
    traceFired = true;
    if (tickTraceStarted < 0) tickTraceStarted = totalTicks;
  }
  function onIceDetected() {
    iceDetections++;
    if (tickFirstDetection < 0) tickFirstDetection = totalTicks;
  }
  function onExploitStarted() { cardUsesConsumed++; }
  function onExploitDisclosed() { cardsBurned++; }
  function onNodeAccessed({ nodeId }) {
    const n = getState().nodes[nodeId];
    if (n?.accessLevel === "owned" && n.type !== "gateway") {
      gatewayOwnedCount++;
      if (tickFirstNodeOwned < 0) tickFirstNodeOwned = totalTicks;
    }
  }
  function onMissionComplete() {
    if (tickMissionComplete < 0) tickMissionComplete = totalTicks;
  }

  on(E.ALERT_GLOBAL_RAISED, onAlertRaised);
  on(E.ALERT_TRACE_STARTED, onTraceStarted);
  on(E.ICE_DETECTED, onIceDetected);
  on(E.EXPLOIT_STARTED, onExploitStarted);
  on(E.EXPLOIT_DISCLOSED, onExploitDisclosed);
  on(E.NODE_ACCESSED, onNodeAccessed);
  on(E.MISSION_COMPLETE, onMissionComplete);

  // ── Tick-until-event helper ──────────────────────────────
  let totalTicks = 0;
  /** @type {Set<string>} */
  let firedEvents = new Set();

  function onEventFired(type) {
    return (/** @type {any} */ _payload) => { firedEvents.add(type); };
  }

  /**
   * Tick until one of the given event types fires, or budget exceeded.
   * @param {string | string[]} eventTypes
   * @param {number} budget — max ticks to spend
   * @returns {number} ticks consumed
   */
  function tickUntilEvent(eventTypes, budget) {
    const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
    firedEvents = new Set();
    const handlers = types.map(t => {
      const h = onEventFired(t);
      on(t, h);
      return { type: t, handler: h };
    });

    let spent = 0;
    while (spent < budget && !types.some(t => firedEvents.has(t))) {
      tick(tickIncrement);
      spent += tickIncrement;
      totalTicks += tickIncrement;
      // Check if trace fired during ticking
      if (traceFired) break;
      if (getState().phase !== "playing") break;
    }

    for (const { type, handler } of handlers) off(type, handler);
    return spent;
  }

  // ── ICE proximity tracking (for evasion) ────────────────
  let iceAtPlayerNode = false;

  if (evasion) {
    on(E.ICE_MOVED, ({ toId }) => {
      const s = getState();
      iceAtPlayerNode = (s.selectedNodeId && toId === s.selectedNodeId);
    });
    // Also detect when ICE is already at node when we select it
    on(E.ICE_DETECT_PENDING, () => {
      iceAtPlayerNode = true;
    });
  }

  /**
   * Tick until one of the given event types fires, ICE arrives (if evading),
   * or budget exceeded. Returns { spent, interrupted }.
   * @param {string | string[]} eventTypes
   * @param {number} budget
   * @returns {{ spent: number, interrupted: boolean }}
   */
  function tickUntilEventOrIce(eventTypes, budget) {
    const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
    firedEvents = new Set();
    iceAtPlayerNode = false;
    const handlers = types.map(t => {
      const h = onEventFired(t);
      on(t, h);
      return { type: t, handler: h };
    });

    let spent = 0;
    let interrupted = false;
    while (spent < budget && !types.some(t => firedEvents.has(t))) {
      tick(tickIncrement);
      spent += tickIncrement;
      totalTicks += tickIncrement;
      if (traceFired) break;
      if (getState().phase !== "playing") break;
      if (evasion && iceAtPlayerNode) { interrupted = true; break; }
    }

    for (const { type, handler } of handlers) off(type, handler);
    return { spent, interrupted };
  }

  // ── Action dispatch helpers ──────────────────────────────

  function dispatchAction(actionId, payload = {}) {
    emitEvent("starnet:action", { actionId, fromConsole: false, ...payload });
  }

  /**
   * Cancel current action, deselect, and wait for ICE to leave.
   * @param {string} cancelAction — "cancel-exploit", "cancel-probe", etc.
   */
  function evadeIce(cancelAction) {
    dispatchAction(cancelAction);
    dispatchAction("deselect");
    // Tick until ICE moves away (ICE_MOVED fires) or budget runs out
    iceAtPlayerNode = false;
    tickUntilEvent(E.ICE_MOVED, Math.min(500, maxTicks - totalTicks));
  }

  // ── Bot strategy ─────────────────────────────────────────
  let missionDone = false;
  /** @type {null | string} */
  let failReason = null;

  /**
   * Find the next node to target.
   * Priority: adjacent lootable > nearest unowned > null (stuck)
   * Only considers visible, non-security nodes.
   * @returns {{ id: string } | null}
   */
  function pickNextNode() {
    const state = getState();
    const currentId = state.selectedNodeId || network.startNode;

    // First check: is the current node (gateway at start) itself unowned?
    const currentNode = state.nodes[currentId];
    if (currentNode && currentNode.accessLevel !== "owned" &&
        currentNode.visibility !== "hidden" && currentNode.type !== "wan" &&
        !SECURITY_TYPES.has(currentNode.type)) {
      return { id: currentId };
    }

    // BFS from currentId through owned nodes to find nearest unowned visible node
    /** @type {Map<string, string|null>} */
    const parent = new Map();
    parent.set(currentId, null);
    const queue = [currentId];
    /** @type {string | null} */
    let bestLootable = null;
    /** @type {string | null} */
    let bestAny = null;

    while (queue.length > 0) {
      const cur = /** @type {string} */ (queue.shift());

      for (const neighbor of (state.adjacency[cur] ?? [])) {
        if (parent.has(neighbor)) continue;
        const nNode = state.nodes[neighbor];
        if (!nNode || nNode.visibility === "hidden") continue;
        parent.set(neighbor, cur);

        // Is this neighbor a valid target?
        if (nNode.accessLevel !== "owned" && !SECURITY_TYPES.has(nNode.type) &&
            nNode.type !== "wan") {
          if (!bestLootable && LOOTABLE_TYPES.has(nNode.type)) bestLootable = neighbor;
          if (!bestAny) bestAny = neighbor;
          if (bestLootable) break;
          // Don't expand through unowned nodes — bot can't see their neighbors
          continue;
        }

        // Expand through owned nodes
        if (nNode.accessLevel === "owned") {
          queue.push(neighbor);
        }
      }
      if (bestLootable) break;
    }

    const targetId = bestLootable ?? bestAny;
    return targetId ? { id: targetId } : null;
  }

  /**
   * Pick the best exploit card for a node.
   * Prefers matching vuln, then highest quality, then most uses.
   * @param {object} node — state node
   * @returns {{ id: string, name: string } | null}
   */
  function pickBestCard(node) {
    const state = getState();
    const hand = state.player.hand;
    const usable = hand.filter(c => c.usesRemaining > 0 && c.status !== "disclosed");
    if (usable.length === 0) return null;

    // Known vulns on this node (non-patched, non-hidden)
    const knownVulns = new Set(
      (node.vulnerabilities ?? [])
        .filter(v => !v.patched && !v.hidden)
        .map(v => v.id)
    );

    // Partition into matching and non-matching
    const matching = usable.filter(c =>
      c.targetVulnTypes?.some(t => knownVulns.has(t))
    );
    const pool = matching.length > 0 ? matching : usable;

    // Sort: highest quality first, then most uses
    pool.sort((a, b) => (b.quality - a.quality) || (b.usesRemaining - a.usesRemaining));
    return pool[0];
  }

  /**
   * Try to buy a card from the darknet store matching a vuln on the given node.
   * @param {object} node
   * @returns {boolean}
   */
  function tryBuyCard(node) {
    const knownVulns = (node.vulnerabilities ?? [])
      .filter(v => !v.patched && !v.hidden)
      .map(v => v.id);

    for (const vulnId of knownVulns) {
      const result = buyFromStore(vulnId);
      if (result) { storeVisitCount++; return true; }
    }
    return false;
  }

  // ── Main loop ────────────────────────────────────────────

  // Select starting node (gateway)
  dispatchAction("select", { nodeId: network.startNode });

  outer:
  while (totalTicks < maxTicks && getState().phase === "playing") {
    if (traceFired) {
      failReason = "trace";
      dispatchAction("jackout");
      break;
    }

    const target = pickNextNode();
    if (!target) {
      // Nothing left to do
      if (!missionDone) failReason = "stuck";
      break;
    }

    const state = getState();
    const targetNode = state.nodes[target.id];
    if (!targetNode) break;

    // Navigate to target
    dispatchAction("select", { nodeId: target.id });

    // Probe if needed (with retry on ICE interruption)
    while (!getState().nodes[target.id]?.probed && totalTicks < maxTicks) {
      dispatchAction("select", { nodeId: target.id });
      dispatchAction("probe", { nodeId: target.id });
      if (evasion) {
        const { interrupted } = tickUntilEventOrIce(E.NODE_PROBED, maxTicks - totalTicks);
        if (interrupted && !traceFired && getState().phase === "playing") {
          evadeIce("cancel-probe");
          continue; // retry probe
        }
        dispatchAction("deselect");
      } else {
        tickUntilEvent(E.NODE_PROBED, maxTicks - totalTicks);
      }
      break;
    }
    if (traceFired || getState().phase !== "playing") {
      if (traceFired) { failReason = "trace"; dispatchAction("jackout"); }
      break;
    }

    // Exploit until owned
    while (totalTicks < maxTicks && getState().phase === "playing") {
      const freshNode = getState().nodes[target.id];
      if (!freshNode || freshNode.accessLevel === "owned") break;
      if (traceFired) { failReason = "trace"; dispatchAction("jackout"); break outer; }

      const card = pickBestCard(freshNode);
      if (!card) {
        // Try darknet store
        if (!tryBuyCard(freshNode)) {
          // Can't buy either — try next node, or fail
          failReason = "no-cards";
          break;
        }
        continue;  // retry with new card
      }

      dispatchAction("select", { nodeId: target.id }); // re-select for exploit (may have deselected)
      dispatchAction("exploit", { nodeId: target.id, exploitId: card.id });

      if (evasion) {
        const { interrupted } = tickUntilEventOrIce(
          [E.EXPLOIT_SUCCESS, E.EXPLOIT_FAILURE], maxTicks - totalTicks
        );
        if (interrupted && !traceFired && getState().phase === "playing") {
          // ICE arrived — cancel exploit and hide
          evadeIce("cancel-exploit");
          continue; // retry the exploit loop (pick card again, re-select, etc.)
        }
        dispatchAction("deselect");
      } else {
        tickUntilEvent([E.EXPLOIT_SUCCESS, E.EXPLOIT_FAILURE], maxTicks - totalTicks);
      }
      if (traceFired) { failReason = "trace"; dispatchAction("jackout"); break outer; }
      if (getState().phase !== "playing") break outer;
    }

    // If we broke out of exploit loop due to no-cards, try next node
    if (failReason === "no-cards") {
      // Check if there are other approachable nodes
      failReason = null;  // reset — will be set again if truly stuck
      continue;
    }

    // Read + loot any owned node (macguffins can be on any type, including workstations)
    const ownedNode = getState().nodes[target.id];
    if (ownedNode?.accessLevel === "owned" && !ownedNode.read) {
      dispatchAction("select", { nodeId: target.id });
      dispatchAction("read", { nodeId: target.id });
      tickUntilEvent(E.NODE_READ, maxTicks - totalTicks);
      if (evasion) dispatchAction("deselect");
      if (traceFired) { failReason = "trace"; dispatchAction("jackout"); break; }
      if (getState().phase !== "playing") break;
    }

    const readNode = getState().nodes[target.id];
    const hasLoot = readNode?.macguffins?.some(m => !m.collected);
    if (readNode?.accessLevel === "owned" && readNode.read && hasLoot && !readNode.looted) {
      dispatchAction("select", { nodeId: target.id });
      dispatchAction("loot", { nodeId: target.id });
      tickUntilEvent(E.NODE_LOOTED, maxTicks - totalTicks);
      if (evasion) dispatchAction("deselect");
      if (traceFired) { failReason = "trace"; dispatchAction("jackout"); break; }
      if (getState().phase !== "playing") break;
    }

    // Check if mission is complete
    const ms = getState().mission;
    if (ms?.complete) missionDone = true;
  }

  // Ensure run ends
  const finalState = getState();
  if (finalState.phase === "playing") {
    if (totalTicks >= maxTicks && !failReason) failReason = "tick-cap";
    dispatchAction("jackout");
  }

  // ── Collect stats ────────────────────────────────────────
  const endState = getState();

  // Count owned nodes (excluding wan which is pre-accessible)
  let nodesOwned = 0;
  let nodesTotal = 0;
  for (const [, node] of Object.entries(endState.nodes)) {
    if (node.type === "wan") continue;
    nodesTotal++;
    if (node.accessLevel === "owned") nodesOwned++;
  }

  // Full clear = all non-security, non-wan nodes owned
  let clearableTotal = 0;
  let clearableOwned = 0;
  for (const [, node] of Object.entries(endState.nodes)) {
    if (node.type === "wan" || SECURITY_TYPES.has(node.type)) continue;
    clearableTotal++;
    if (node.accessLevel === "owned") clearableOwned++;
  }
  const fullClear = clearableOwned === clearableTotal;

  const cashSpent = startingCash - endState.player.cash;

  return {
    missionSuccess: missionDone,
    fullClear,
    failReason: missionDone ? failReason : (failReason ?? "no-cards"),
    cardUsesConsumed,
    cardsBurned,
    storeVisits: storeVisitCount,
    cashSpent: Math.max(0, cashSpent),
    cashRemaining: endState.player.cash,
    totalTicks,
    peakAlert,
    traceFired,
    iceDetections,
    nodesOwned,
    nodesTotal,
    tickFirstNodeOwned,
    tickFirstDetection,
    tickTraceStarted,
    tickMissionComplete,
  };
}
