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

import { RNG, initRng, getSeed, serializeRng, deserializeRng, randomPick, randomInt, random } from "../rng.js";
import { pickIceTypeId, getType } from "../ice/index.js";
import { generateStartingHand, generateVulnerabilities, _exploitIdCounter, setExploitIdCounter, reconcileHandIds } from "../exploits.js";
import { generateMacguffin, flagMissionMacguffin } from "../loot.js";
import { clearAll as clearAllTimers, serializeTimers, deserializeTimers, setGraphForTick } from "../timers.js";
import { emitEvent, E } from "../events.js";
import { createRunContext, getActiveRun, setActiveRun, requireActiveRun } from "../run-context.js";

import { setNodeVisible, setNodeSigAlias, setNodeGraph, isSyncingToGraph } from "./node.js";
import { setIceActive } from "./ice.js";
import { setPhase, setRunOutcome } from "./game.js";
import { setCash, addCash, addCardToHand } from "./player.js";

import { NodeGraph } from "../node-graph/runtime.js";
import { buildGameCtx } from "../node-graph/game-ctx.js";

// ── State + version counter ──────────────────────────────

// The per-run GameState lives on the active RunContext (see run-context.js).
// `version` is a render-gating counter, not run state, so it stays module-level.
let version = 0;

/**
 * Wrap all state mutations in this function. It executes the recipe,
 * increments the version counter, and returns the state.
 * @param {(s: GameState) => void} fn
 * @returns {GameState}
 */
export function mutate(fn) {
  const state = /** @type {GameState} */ (requireActiveRun("mutate").state);
  fn(state);
  version++;
  return state;
}

/** Returns the current monotonic version counter. */
export function getVersion() {
  return version;
}

// ── Initialization ───────────────────────────────────────

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

  // A new run is a brand-new context — fresh timers, fresh state. The previous
  // run's context (and any of its timers) is dropped here, so nothing leaks in.
  const ctx = createRunContext();
  setActiveRun(ctx);

  const { graphDef, meta } = buildNetworkFn();

  // Build game ctx with late-bound graph reference
  const gameCtx = buildGameCtx({ openDarknetsStore: opts.openDarknetsStore });

  // Build the onEvent bridge: graph → state.nodes sync + game event bus
  const onEvent = (type, payload) => {
    if (type === "node-state-changed") {
      // Sync graph attribute changes to state.nodes (skip if change came from a setter)
      if (!isSyncingToGraph() && getState()?.nodes?.[payload.nodeId]) {
        mutate(s => { s.nodes[payload.nodeId][payload.attr] = payload.value; });
      }
      emitEvent(E.NODE_STATE_CHANGED, payload);
    } else if (type === "message-delivered") {
      emitEvent(E.MESSAGE_PROPAGATED, payload);
    } else if (type === "quality-changed") {
      emitEvent(E.QUALITY_CHANGED, payload);
    } else if (type === "action-feedback") {
      emitEvent(E.ACTION_FEEDBACK, payload);
    }
  };

  // Construct the NodeGraph
  const graph = new NodeGraph(graphDef, gameCtx, onEvent);
  gameCtx._graph = graph;
  ctx.nodeGraph = graph;   // register the run's graph on the run context

  // Run init lifecycle — operators react to { type: 'init' } messages
  graph.init();

  // Generate vulnerabilities for each node (seeded RNG)
  for (const nodeId of graph.getNodeIds()) {
    const nodeData = graph.getNode(nodeId);
    const vulns = generateVulnerabilities(nodeData.grade);
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

  // Create the state object (owned by the active run context)
  ctx.state = {
    seed: getSeed(),
    spec: meta.spec ?? null,
    moneyCost: meta.moneyCost ?? "F",
    nodes,
    adjacency,
    nodeGraph: graph,
    player: {
      cash: meta.startCash ?? 1000,
      // Clone startHandCards so in-run decay never mutates the caller's objects
      // (e.g. profile inventory) — matches generateStartingHand's fresh-objects
      // contract. instanceId is preserved for commit write-back.
      hand: meta.startHandCards
        ? meta.startHandCards.map((c) => ({ ...c, targetVulnTypes: [...c.targetVulnTypes] }))
        : generateStartingHand(meta.startHand),
      health:        { current: meta.startHealth        ?? 100, max: meta.startHealth        ?? 100 },
      deckIntegrity: { current: meta.startDeckIntegrity ?? 100, max: meta.startDeckIntegrity ?? 100 },
    },
    globalAlert: "green",
    traceSecondsRemaining: null,
    traceTimerId: null,
    selectedNodeId: null,
    phase: "playing",
    runOutcome: null,
    isCheating: false,
    ice: null,
    lastDisturbedNodeId: null,
    mission: null,
    ui: { menuOpen: false, handCollapsed: false },
  };
  const state = ctx.state;   // local alias so the rest of initGame reads unchanged

  // Guarantee per-card-unique ids: carried profile cards may bring ids that
  // collide with freshly-generated ones (the counter resets per session). The
  // exploit pipeline keys off `id`, so duplicates make cards un-selectable.
  reconcileHandIds(state.player.hand);

  // Register graph sync on the node setter module
  setNodeGraph(graph);

  // Register graph tick in the timer system
  setGraphForTick(graph);

  // Flag one macguffin as the mission target (10x value)
  const missionTarget = flagMissionMacguffin(Object.values(nodes));
  state.mission = missionTarget
    ? { targetMacguffinId: missionTarget.id, targetName: missionTarget.name, complete: false }
    : null;

  // Spawn ICE if defined in meta.
  // Two meta.ice shapes are supported:
  //   - { instances: [{ startNode, grade }, ...] }  — generated networks (multi-ICE)
  //   - { startNode, grade }                         — legacy hand-crafted networks (single ICE)
  state.ice = { instances: {} };
  if (meta.ice) {
    const nodeIds = Object.keys(nodes);
    // One config per monitor for generated networks; a single legacy config
    // otherwise. Each instance rolls its OWN registry-driven type (#133):
    // damaging presets (sentinel→health, spike→deck) appear at B+, so a
    // multi-monitor network can field a mix. An explicit typeId (cheats/tests)
    // overrides the seeded roll.
    // NOTE: each config does a conditional hostNodeId draw (skipped when startNode
    // is pinned, which it always is for generated per-monitor configs) followed by
    // one WORLD-stream type roll — N instances consume N type rolls.
    const configs = meta.ice.instances
      ?? [{ startNode: meta.ice.startNode, grade: meta.ice.grade, typeId: meta.ice.typeId }];
    configs.forEach((cfg, i) => {
      const id = `ice-${i + 1}`;
      const hostNodeId = cfg.startNode ?? randomPick(RNG.WORLD, nodeIds);
      const grade = cfg.grade;
      const typeId = cfg.typeId ?? pickIceTypeId(grade, random(RNG.WORLD));
      const typeDef = getType(typeId);
      /** @type {import('../types.js').IceInstance} */
      const instance = {
        id,
        typeId,
        hostNodeId,
        residentNodeId: hostNodeId, // deprecated, kept for migration; remove when callers stop reading it
        attentionNodeId: hostNodeId,
        active: true,
        enabled: true,
        grade,
        // Derive from the registry type so the serialized instance stays honest
        // (sentinel/spike are 'disturbance-tracker', not the old 'standard' default).
        focus: typeDef?.focus ?? 'roaming',
        behaviorPattern: typeDef?.behaviorPattern ?? 'standard',
        dwellTimerId: null,
        moveTimerId: null,
        detectedAtNode: null,
        detectionCount: 0,
      };
      state.ice.instances[id] = instance;
    });
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
  return /** @type {GameState} */ (getActiveRun()?.state ?? null);
}

// ── Graph traversal utilities ────────────────────────────
// Used by combat.js, cheats.js — reveal/access neighbor nodes.

export function revealNeighbors(nodeId) {
  const state = getState();
  (state.adjacency[nodeId] || []).forEach((neighborId) => {
    const neighbor = state.nodes[neighborId];
    if (neighbor && neighbor.visibility === "hidden" && !neighbor.concealed) {
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
  const state = getState();
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

/**
 * The next node alert level up from `level`, or `level` unchanged if it's already
 * at the top or not a recognized level. Pure — does not mutate state.
 * @param {NodeAlertLevel} level
 * @returns {NodeAlertLevel}
 */
export function nextAlertLevel(level) {
  const idx = ALERT_ORDER.indexOf(level);
  if (idx < 0 || idx >= ALERT_ORDER.length - 1) return level;
  return ALERT_ORDER[idx + 1];
}

// ── End run ──────────────────────────────────────────────

export function endRun(outcome) {
  const state = getState();
  clearAllTimers();
  setPhase("ended");
  setRunOutcome(outcome);
  if (outcome === "caught") setCash(0);
  Object.values(state.ice?.instances ?? {}).forEach((i) => {
    if (i?.active) setIceActive(false, i.id);
  });
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
  return atAccess === "open" || atAccess === "owned";
}

// ── Store / card acquisition ──────────────────────────────

/**
 * @param {ExploitCard} card
 * @param {number} price
 * @returns {boolean}
 */
export function buyExploit(card, price) {
  const state = getState();
  if (state.player.cash < price) return false;
  addCash(-price);
  addCardToHand(card);
  return true;
}

// ── Serialization ─────────────────────────────────────────

export function serializeState() {
  const state = /** @type {any} */ (requireActiveRun("serializeState").state);
  const { nodeGraph, ...rest } = state;
  return {
    ...rest,
    _timers: serializeTimers(),       // active context's timer set
    _rng: serializeRng(),             // shared service (overworld + run)
    _exploitIdCounter,                // shared service (overworld + run)
    _nodeGraph: nodeGraph ? nodeGraph.snapshot() : null,
  };
}

export function deserializeState(snapshot, opts = {}) {
  const { _timers, _rng, _exploitIdCounter: exploitId, _nodeGraph, ...gameState } = snapshot;

  // A restored run is also a fresh context swapped in — same as initGame.
  const ctx = createRunContext();
  setActiveRun(ctx);
  ctx.state = gameState;
  // Heal saves that predate state.ui (the persisted UI toggles). Reads are
  // ?.-guarded, but the toggle setters write s.ui.x — without this they'd throw
  // on the first hamburger/hand toggle after loading an older save.
  if (!ctx.state.ui) ctx.state.ui = { menuOpen: false, handCollapsed: false };
  deserializeTimers(_timers);   // writes into ctx.timers
  if (_rng) deserializeRng(_rng);
  else initRng(gameState.seed ?? undefined);
  if (exploitId != null) setExploitIdCounter(exploitId);

  // Heal saves whose hand carries colliding card ids (see initGame). Runs after
  // the counter is restored so re-mints continue above the snapshot's id space.
  if (ctx.state?.player?.hand) reconcileHandIds(ctx.state.player.hand);

  // Restore NodeGraph from snapshot
  if (_nodeGraph) {
    const gameCtx = buildGameCtx(opts);
    const onEvent = (type, payload) => {
      if (type === "node-state-changed") {
        if (!isSyncingToGraph() && getState()?.nodes?.[payload.nodeId]) {
          mutate(s => { s.nodes[payload.nodeId][payload.attr] = payload.value; });
        }
        emitEvent(E.NODE_STATE_CHANGED, payload);
      } else if (type === "message-delivered") {
        emitEvent(E.MESSAGE_PROPAGATED, payload);
      } else if (type === "quality-changed") {
        emitEvent(E.QUALITY_CHANGED, payload);
      }
    };
    const graph = NodeGraph.fromSnapshot(_nodeGraph, gameCtx, onEvent);
    gameCtx._graph = graph;
    ctx.state.nodeGraph = graph;
    ctx.nodeGraph = graph;
    setNodeGraph(graph);
    setGraphForTick(graph);
  }
}
