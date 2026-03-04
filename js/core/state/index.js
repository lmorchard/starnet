// @ts-check
// ═══════════════════════════════════════════════════════════════════════
// Central game state module.
//
// CONVENTION: All state mutations MUST go through the mutate() wrapper.
// No code outside js/state/ should modify the state object directly.
// Use the setter functions exported by submodules (node.js, ice.js,
// alert.js, player.js, game.js).
//
// Orchestration functions (combining mutations + event emission) live in
// their natural caller modules: navigation.js, probe-exec.js, ice.js,
// node-orchestration.js, alert.js, combat.js.
//
// mutate() increments a monotonic version counter. The tick() loop and
// action dispatcher check getVersion() before/after to emit a single
// STATE_CHANGED event per cycle — no scattered emit() calls.
// ═══════════════════════════════════════════════════════════════════════

/** @typedef {import('../types.js').GameState} GameState */
/** @typedef {import('../types.js').NodeState} NodeState */
/** @typedef {import('../types.js').IceState} IceState */
/** @typedef {import('../types.js').ExploitCard} ExploitCard */
/** @typedef {import('../types.js').NodeAlertLevel} NodeAlertLevel */
/** @typedef {import('../types.js').GlobalAlertLevel} GlobalAlertLevel */

import { RNG, initRng, getSeed, serializeRng, deserializeRng, randomPick, randomInt } from "../rng.js";
import { generateStartingHand, generateVulnerabilities, _exploitIdCounter, setExploitIdCounter } from "../exploits.js";
import { generateMacguffin, flagMissionMacguffin } from "../loot.js";
import { clearAll as clearAllTimers, serializeTimers, deserializeTimers, setGraphForTick } from "../timers.js";
import { emitEvent, E } from "../events.js";
// Legacy initState still uses node-types for old network format.
// TODO: remove once all callers migrate to initGame.
import { getStateFields, getBehaviors, resolveNode, getGateAccess } from "../actions/node-types.js";

import { setNodeVisible, setNodeSigAlias, setNodeGraph, isSyncingToGraph } from "./node.js";
import { setIceActive } from "./ice.js";
import { setPhase, setRunOutcome } from "./game.js";
import { setCash, addCash, addCardToHand } from "./player.js";

import { NodeGraph } from "../node-graph/runtime.js";
import { buildGameCtx } from "../node-graph/game-ctx.js";

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

export function initState(networkData, seedString) {
  initRng(seedString);

  /** @type {Object.<string, NodeState>} */
  const nodes = {};
  networkData.nodes.forEach((n) => {
    const vulns = generateVulnerabilities(n.grade, n.type);
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
      visibility: "hidden",
      accessLevel: "locked",
      alertState: "green",
      probed: false,
      vulnerabilities: vulns,
      macguffins: [],
      read: false,
      looted: false,
      rebooting: false,
      gateAccess: getGateAccess(n),
      ...getStateFields(n),
    };
  });

  /** @type {Object.<string, string[]>} */
  const adjacency = {};
  networkData.nodes.forEach((n) => { adjacency[n.id] = []; });
  networkData.edges.forEach((e) => {
    adjacency[e.source].push(e.target);
    adjacency[e.target].push(e.source);
  });

  state = {
    seed: getSeed(),
    moneyCost: networkData.moneyCost ?? "F",
    nodes,
    adjacency,
    player: { cash: networkData.startCash ?? 1000, hand: generateStartingHand(networkData.startHandSpec) },
    globalAlert: "green",
    traceSecondsRemaining: null,
    traceTimerId: null,
    selectedNodeId: null,
    phase: "playing",
    runOutcome: null,
    isCheating: false,
    ice: null,
    lastDisturbedNodeId: null,
    executingExploit: null,
    activeProbe: null,
    activeRead: null,
    activeLoot: null,
    mission: null,
  };

  // Dispatch onInit to behavior atoms — lootable assigns macguffins here
  const moneyCostGrade = state.moneyCost;
  Object.values(nodes).forEach((node) => {
    const typeDef = resolveNode(node);
    const ctx = { typeDef, generateMacguffin: () => generateMacguffin(moneyCostGrade) };
    getBehaviors(node).forEach((atom) => atom.onInit?.(node, state, ctx));
  });

  // Flag one macguffin as the mission target (10x value)
  const missionTarget = flagMissionMacguffin(Object.values(nodes));
  state.mission = missionTarget
    ? { targetMacguffinId: missionTarget.id, targetName: missionTarget.name, complete: false }
    : null;

  // WAN node is always accessible
  Object.values(state.nodes).forEach((node) => {
    if (node.type === "wan") node.visibility = "accessible";
  });

  // Make start node accessible
  state.nodes[networkData.startNode].visibility = "accessible";
  emitEvent(E.NODE_REVEALED, { nodeId: networkData.startNode, label: state.nodes[networkData.startNode].label });

  // Spawn ICE if defined in network data
  if (networkData.ice) {
    const nodeIds = Object.keys(nodes);
    const residentNodeId = networkData.ice.startNode
      ?? randomPick(RNG.WORLD, nodeIds);
    state.ice = {
      grade: networkData.ice.grade,
      residentNodeId,
      attentionNodeId: residentNodeId,
      active: true,
      dwellTimerId: null,
      detectedAtNode: null,
      detectionCount: 0,
    };
  }

  if (state.mission) {
    emitEvent(E.MISSION_STARTED, { targetName: state.mission.targetName });
  }
  emitEvent(E.RUN_STARTED, { state });

  version++;
  // @ts-ignore — dev convenience
  if (typeof window !== "undefined") window._starnetState = state;
  emitEvent(E.STATE_CHANGED, state);
  return state;
}

// ── NodeGraph-based initialization ────────────────────────

/**
 * Initialize the game from a NodeGraph-based network definition.
 * Replaces initState() for the new network format.
 *
 * @param {() => { graphDef: import('../node-graph/runtime.js').NodeGraphDef, meta: any }} buildNetworkFn
 * @param {string} [seedString]
 * @param {{ openDarknetsStore?: (state: any) => void }} [opts]
 * @returns {GameState}
 */
export function initGame(buildNetworkFn, seedString, opts = {}) {
  initRng(seedString);

  const { graphDef, meta } = buildNetworkFn();

  // Build game ctx with late-bound graph reference
  const ctx = buildGameCtx({ openDarknetsStore: opts.openDarknetsStore });

  // Build the onEvent bridge: graph → state.nodes sync + game event bus
  const onEvent = (type, payload) => {
    if (type === "node-state-changed") {
      // Sync graph attribute changes to state.nodes (skip if change came from a setter)
      if (!isSyncingToGraph() && state?.nodes[payload.nodeId]) {
        mutate(s => { s.nodes[payload.nodeId][payload.attr] = payload.value; });
      }
      emitEvent(E.NODE_STATE_CHANGED, payload);
    } else if (type === "message-delivered") {
      emitEvent(E.MESSAGE_PROPAGATED, payload);
    } else if (type === "quality-changed") {
      emitEvent(E.QUALITY_CHANGED, payload);
    }
  };

  // Construct the NodeGraph
  const graph = new NodeGraph(graphDef, ctx, onEvent);
  ctx._graph = graph;

  // Run init lifecycle — operators react to { type: 'init' } messages
  graph.init();

  // Generate vulnerabilities for each node (seeded RNG)
  for (const nodeId of graph.getNodeIds()) {
    const nodeData = graph.getNode(nodeId);
    const vulns = generateVulnerabilities(nodeData.grade, nodeData.type);
    graph.setNodeAttr(nodeId, "vulnerabilities", vulns);
  }

  // Generate macguffins for lootable nodes
  const moneyCostGrade = meta.moneyCost ?? "F";
  for (const nodeId of graph.getNodeIds()) {
    const nodeData = graph.getNode(nodeId);
    const lootCount = nodeData.lootCount;
    if (lootCount) {
      const [min, max] = lootCount;
      const count = randomInt(RNG.LOOT, min, max);
      const macguffins = [];
      for (let i = 0; i < count; i++) {
        macguffins.push(generateMacguffin(moneyCostGrade));
      }
      graph.setNodeAttr(nodeId, "macguffins", macguffins);
    }
  }

  // Build state.nodes from graph (backward-compat cache)
  /** @type {Object.<string, NodeState>} */
  const nodes = {};
  for (const nodeId of graph.getNodeIds()) {
    nodes[nodeId] = /** @type {NodeState} */ (graph.getNode(nodeId));
  }

  // Build adjacency from graph edges
  /** @type {Object.<string, string[]>} */
  const adjacency = {};
  for (const nodeId of graph.getNodeIds()) adjacency[nodeId] = [];
  for (const [a, b] of graph.getEdges()) {
    if (adjacency[a]) adjacency[a].push(b);
    if (adjacency[b]) adjacency[b].push(a);
  }

  // Create the state object
  state = {
    seed: getSeed(),
    moneyCost: meta.moneyCost ?? "F",
    nodes,
    adjacency,
    nodeGraph: graph,
    player: { cash: meta.startCash ?? 1000, hand: generateStartingHand(meta.startHand) },
    globalAlert: "green",
    traceSecondsRemaining: null,
    traceTimerId: null,
    selectedNodeId: null,
    phase: "playing",
    runOutcome: null,
    isCheating: false,
    ice: null,
    lastDisturbedNodeId: null,
    executingExploit: null,
    activeProbe: null,
    activeRead: null,
    activeLoot: null,
    mission: null,
  };

  // Register graph sync on the node setter module
  setNodeGraph(graph);

  // Register graph tick in the timer system
  setGraphForTick(graph);

  // Flag one macguffin as the mission target (10x value)
  const missionTarget = flagMissionMacguffin(Object.values(nodes));
  state.mission = missionTarget
    ? { targetMacguffinId: missionTarget.id, targetName: missionTarget.name, complete: false }
    : null;

  // Spawn ICE if defined in meta
  if (meta.ice) {
    const nodeIds = Object.keys(nodes);
    const residentNodeId = meta.ice.startNode ?? randomPick(RNG.WORLD, nodeIds);
    state.ice = {
      grade: meta.ice.grade,
      residentNodeId,
      attentionNodeId: residentNodeId,
      active: true,
      dwellTimerId: null,
      detectedAtNode: null,
      detectionCount: 0,
    };
  }

  if (state.mission) {
    emitEvent(E.MISSION_STARTED, { targetName: state.mission.targetName });
  }
  emitEvent(E.RUN_STARTED, { state });

  version++;
  // @ts-ignore — dev convenience
  if (typeof window !== "undefined") window._starnetState = state;
  emitEvent(E.STATE_CHANGED, state);
  return state;
}

/** @returns {GameState} */
export function getState() {
  return /** @type {GameState} */ (state);
}

// ── Graph traversal utilities ────────────────────────────
// Used by combat.js, cheats.js — reveal/access neighbor nodes.

export function revealNeighbors(nodeId) {
  (state.adjacency[nodeId] || []).forEach((neighborId) => {
    const neighbor = state.nodes[neighborId];
    if (neighbor && neighbor.visibility === "hidden") {
      const usedAliases = new Set(Object.values(state.nodes).map(n => n.sigAlias).filter(Boolean));
      let i = 1;
      while (usedAliases.has(`sig-${i}`)) i++;
      setNodeSigAlias(neighborId, `sig-${i}`);
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

// ── Alert constants ──────────────────────────────────────

/** @type {NodeAlertLevel[]} */
export const ALERT_ORDER = ["green", "yellow", "red"];

// ── End run ──────────────────────────────────────────────

export function endRun(outcome) {
  clearAllTimers();
  setPhase("ended");
  setRunOutcome(outcome);
  if (outcome === "caught") setCash(0);
  if (state.ice?.active) setIceActive(false);
  emitEvent(E.RUN_ENDED, { outcome });
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
  const { nodeGraph, ...rest } = /** @type {any} */ (state);
  return {
    ...rest,
    _timers: serializeTimers(),
    _rng: serializeRng(),
    _exploitIdCounter,
    _nodeGraph: nodeGraph ? nodeGraph.snapshot() : null,
  };
}

export function deserializeState(snapshot) {
  const { _timers, _rng, _exploitIdCounter: exploitId, _nodeGraph, ...gameState } = snapshot;
  state = gameState;
  deserializeTimers(_timers);
  if (_rng) deserializeRng(_rng);
  else initRng(gameState.seed ?? undefined);
  if (exploitId != null) setExploitIdCounter(exploitId);

  // Restore NodeGraph from snapshot
  if (_nodeGraph) {
    const ctx = buildGameCtx();
    const onEvent = (type, payload) => {
      if (type === "node-state-changed") {
        if (!isSyncingToGraph() && state?.nodes[payload.nodeId]) {
          mutate(s => { s.nodes[payload.nodeId][payload.attr] = payload.value; });
        }
        emitEvent(E.NODE_STATE_CHANGED, payload);
      } else if (type === "message-delivered") {
        emitEvent(E.MESSAGE_PROPAGATED, payload);
      } else if (type === "quality-changed") {
        emitEvent(E.QUALITY_CHANGED, payload);
      }
    };
    const graph = NodeGraph.fromSnapshot(_nodeGraph, ctx, onEvent);
    ctx._graph = graph;
    state.nodeGraph = graph;
    setNodeGraph(graph);
    setGraphForTick(graph);
  }
}
