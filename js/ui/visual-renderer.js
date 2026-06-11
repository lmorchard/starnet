// @ts-check
// Visual renderer — subscribes to game events and drives all DOM updates.
// Handles both idempotent re-renders (on state:changed) and one-shot effects.

/** @typedef {import('../core/types.js').GameState} GameState */
/** @typedef {import('../core/types.js').NodeState} NodeState */
/** @typedef {import('../core/types.js').NodeRevealedPayload} NodeRevealedPayload */
/** @typedef {import('../core/types.js').NodeAccessedPayload} NodeAccessedPayload */

import { on, E } from "../core/events.js";
import { A } from "../core/action-ids.js";
import { getState as _getState } from "../core/state.js";
import { getAvailableActions } from "../core/actions/node-actions.js";
import { updateNodeStyle, getCy, flashNode, addIceNode, syncIceGraph, syncSelection, relayout, onViewport, setReticleOverlay } from "./graph.js";
import { mountOverlays } from "./overlays/index.js";
import { mountReticle } from "./overlays/selection-reticle.js";
import { dispatchActionFeedback } from "./overlays/dispatch.js";
import { getVisibleTimers } from "../core/timers.js";
import { exploitSortKey } from "../core/exploits.js";

// Debounce handle for NODE_REVEALED viewport fit.
// Multiple simultaneous reveals (e.g. exploiting a hub node) would otherwise
// queue overlapping cy.animate() calls that fight each other.
let revealFitTimer = null;

// Context menu — tracks which node the menu is anchored to for pan/zoom repositioning.
let contextMenuNodeId = null;

// Action choice picker — tracks which node the picker is anchored to.
let choicesNodeId = null;

export function initVisualRenderer() {
  // ── Event-driven node style updates from NodeGraph ──────
  // When a node attribute changes via the graph, update just that node's visual.
  // This is the primary render path when a NodeGraph is active.
  on(E.NODE_STATE_CHANGED, ({ nodeId }) => {
    const s = _getState();
    const node = s?.nodes[nodeId];
    if (node) updateNodeStyle(nodeId, node);
  });

  // ── STATE_CHANGED — HUD, selection, ICE, context menu ──
  // Node styles are driven by NODE_STATE_CHANGED above; this handler covers
  // everything else. Falls back to full node sync when no graph is present.
  on(E.STATE_CHANGED, (/** @type {GameState} */ state) => {
    // Fallback: full node sync when there's no graph (legacy initState path)
    if (!state.nodeGraph) {
      Object.values(state.nodes).forEach((n) => updateNodeStyle(n.id, n));
    }
    syncOverlays(state);
    syncHud(state);
    const node = state.selectedNodeId ? state.nodes[state.selectedNodeId] : null;
    if (node && node.visibility !== "revealed") {
      syncContextMenu(node, state);
    } else {
      clearContextMenu();
    }
  });

  on(E.RUN_STARTED, () => { clearContextMenu(); closeActionChoices(); });

  // ── ACTION_FEEDBACK — unified timed action animation dispatch ──
  // The timed-action operator emits action-feedback events with
  // { nodeId, action, phase, progress }. We dispatch to per-action
  // animation handlers. The old per-action events are no longer emitted.
  //
  // activeNodeId tracks which node has an active animation so we can
  // clear overlays correctly on completion/cancel.
  // Mount overlay animations into the graph's overlay layer and drive them from
  // the registry. visual-renderer no longer knows individual effects — it maps
  // action id → overlay element and calls the sync/clear/reposition contract.
  const layer = /** @type {HTMLElement} */ (document.getElementById("overlay-layer"));
  const overlays = mountOverlays(layer);
  onViewport(() => overlays.byKey.forEach((o) => o.reposition()));

  // Selection reticle — a NodeOverlay too, but selection-driven (graph.js calls
  // it from syncSelection) rather than action-driven.
  const reticle = mountReticle(layer);
  setReticleOverlay(reticle);
  onViewport(() => reticle.reposition());

  // action id → node id of the in-flight animation (tracked across feedback events)
  const activeNodeIds = new Map();
  on(E.ACTION_FEEDBACK, (payload) =>
    dispatchActionFeedback(overlays.byAction, activeNodeIds, payload, { onXploitProgress: updateExploitProgress }));

  // Exploit result flash — driven by ACTION_RESOLVED
  on(E.ACTION_RESOLVED, ({ action, nodeId, success }) => {
    if (action === A.XPLOIT) flashNode(nodeId, success ? "success" : "failure");
  });

  on(E.RUN_STARTED, () => {
    overlays.byKey.forEach((o) => o.clear());
    activeNodeIds.clear();
  });

  // ICE detection sweep — timer-driven sibling; clear immediately on any event
  // that ends a detection dwell.
  const iceOverlay = overlays.byKey.get("ice");
  on(E.ICE_DETECTED,     () => iceOverlay.completeAndClear());
  on(E.ICE_MOVED,        () => iceOverlay.clear());
  on(E.ICE_EJECTED,      () => iceOverlay.clear());
  on(E.ICE_REBOOTED,     () => iceOverlay.clear());
  on(E.PLAYER_NAVIGATED, () => iceOverlay.clear());

  // Timer-only tick: update countdowns and ICE detection sweep.
  // Action progress no longer driven here — ACTION_FEEDBACK handles it.
  on(E.TIMERS_UPDATED, (/** @type {GameState} */ state) => {
    syncIceTimers();
    const hudEl = /** @type {any} */ (document.getElementById("hud"));
    if (hudEl) hudEl.traceSeconds = state.traceSecondsRemaining;
    // ICE detection sweep — driven by timer presence; self-clears when timer is gone
    const iceDetect = getVisibleTimers().find((t) => t.label === "ICE DETECTION");
    if (iceDetect && state.selectedNodeId) {
      // Dwell always happens on the player's selected node (checkIceDetection only
      // arms when ice.attentionNodeId === selectedNodeId). Anchor the overlay there.
      // (Was "ice-0" — a Cytoscape node that no longer exists since ICE became an
      // HTML overlay, so the detection indicator never rendered.)
      iceOverlay.sync(state.selectedNodeId, iceDetect.progress);
    } else {
      iceOverlay.clear();
    }
  });

  // One-shot flash effects keyed to typed game events
  // (EXPLOIT_SUCCESS/FAILURE flash handled above in ACTION_FEEDBACK section)
  on(E.NODE_ACCESSED,   (/** @type {NodeAccessedPayload} */   { nodeId }) => flashNode(nodeId, "success"));
  // Track which nodes existed before this batch of reveals
  let _preRevealNodeIds = null;

  on(E.NODE_REVEALED,   (/** @type {NodeRevealedPayload} */   { nodeId }) => {
    flashNode(nodeId, "reveal");
    // Snapshot existing node positions before the first reveal in a batch
    if (!_preRevealNodeIds) {
      const cy = getCy();
      if (cy) _preRevealNodeIds = new Set(cy.nodes().map(n => n.id()));
    }
    // Debounce incremental layout — lock existing nodes, let new ones settle
    clearTimeout(revealFitTimer);
    revealFitTimer = setTimeout(() => {
      const cy = getCy();
      if (!cy || cy.nodes().length <= 1) { _preRevealNodeIds = null; return; }
      const locked = _preRevealNodeIds;
      _preRevealNodeIds = null;
      // Run layout with existing nodes locked in place
      const layout = cy.layout({
        name: "cola",
        animate: true,
        randomize: false,
        fit: false,
        padding: 50,
        nodeSpacing: 30,
        edgeLength: 120,
        maxSimulationTime: 2000,
        ungrabifyWhileSimulating: true,
        lock: (node) => locked.has(node.id()),
      });
      layout.on("layoutstop", () => {
        // Re-fit to current selection after new nodes have settled
        const st = _getState();
        if (st?.selectedNodeId) syncSelection(st.selectedNodeId, true);
      });
      layout.run();
    }, 200);
  });

  // Keep context menu and action choice picker attached to node on pan/zoom/drag
  const cy = getCy();
  if (cy) {
    cy.on("pan zoom", () => { _positionContextMenu(contextMenuNodeId); _positionActionChoices(choicesNodeId); });
    cy.on("position", "node", () => { _positionContextMenu(contextMenuNodeId); _positionActionChoices(choicesNodeId); });
  }

  // ── Action choice picker listeners (registered once) ──
  document.addEventListener("starnet:open-choices", (e) => {
    const { actionId, nodeId } = /** @type {any} */ (e).detail || {};
    if (actionId && nodeId) openActionChoices(nodeId, actionId);
  });
  document.addEventListener("starnet:choices-close", () => closeActionChoices());
}

// ── Context menu ──────────────────────────────────────────

function _positionContextMenu(nodeId) {
  const menu = document.getElementById("node-context-menu");
  if (!menu || !nodeId) return;
  const cy = getCy();
  if (!cy) return;
  const node = cy.getElementById(nodeId);
  if (!node || node.length === 0) return;

  const pos = node.renderedPosition();
  const r   = node.renderedWidth() / 2;
  const gap = 20;

  // Measure menu — valid because it's in the DOM (even at opacity 0)
  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;

  // Container bounds (node positions are relative to the cy canvas)
  const container = cy.container();
  const cw = container.offsetWidth;
  const ch = container.offsetHeight;

  // Horizontal: prefer right of node, flip left if clipped
  const onRight = pos.x + r + gap + mw <= cw;
  const x = onRight ? pos.x + r + gap : pos.x - r - gap - mw;

  // Vertical: center on node, clamp to container
  const y = Math.max(4, Math.min(pos.y - mh / 2, ch - mh - 4));

  menu.style.left      = `${x}px`;
  menu.style.top       = `${y}px`;
  menu.style.textAlign = onRight ? "left" : "right";
}

function syncContextMenu(node, state) {
  const menu = /** @type {any} */ (document.getElementById("node-context-menu"));
  if (!menu) return;

  contextMenuNodeId = node.id;

  const actions = getAvailableActions(node, state)
    .filter((a) => !a.noSidebar && a.id !== A.TARGET && a.id !== A.JACKOUT && a.id !== A.UNTARGET && a.id !== A.ABORT);

  if (!actions.length) {
    clearContextMenu();
    return;
  }

  // Pre-compute desc strings for the component (desc is a function on ActionDef).
  // For actions with a followup picker: if there are no choices, render as disabled;
  // if there are choices, render with hasFollowup: true so the menu shows a ▶ indicator.
  menu.actions = actions.map((a) => {
    if (!a.followup) {
      return { id: a.id, label: a.label, desc: a.desc(node, state) };
    }
    const choices = a.followup.choices(node, state);
    if (choices.length === 0) {
      return { id: a.id, label: a.label, disabled: true, disabledReason: a.followup.empty(node, state) };
    }
    return { id: a.id, label: a.label, desc: a.desc(node, state), hasFollowup: true };
  });
  menu.nodeId = node.id;
  menu.visible = true;

  _positionContextMenu(node.id);
  menu.style.opacity = "1";
  menu.style.pointerEvents = "auto";
}

function clearContextMenu() {
  contextMenuNodeId = null;
  const menu = /** @type {any} */ (document.getElementById("node-context-menu"));
  if (!menu) return;
  menu.visible = false;
  menu.style.opacity = "0";
  menu.style.pointerEvents = "none";
}

// ── Action choice picker ──────────────────────────────────

function _positionActionChoices(nodeId) {
  const panel = document.getElementById("action-choices");
  if (!panel || !nodeId) return;
  const cy = getCy();
  if (!cy) return;
  const cyNode = cy.getElementById(nodeId);
  if (!cyNode || cyNode.length === 0) return;

  const pos = cyNode.renderedPosition();
  const r = cyNode.renderedWidth() / 2;
  const gap = 20;
  const pw = panel.offsetWidth;
  const ph = panel.offsetHeight;
  const container = cy.container();
  const cw = container.offsetWidth;
  const ch = container.offsetHeight;

  const onRight = pos.x + r + gap + pw <= cw;
  const x = onRight ? pos.x + r + gap : pos.x - r - gap - pw;
  const y = Math.max(4, Math.min(pos.y - ph / 2, ch - ph - 4));

  panel.style.left = `${x}px`;
  panel.style.top = `${y}px`;
}

function openActionChoices(nodeId, actionId) {
  const state = _getState();
  const node = state?.nodes?.[nodeId];
  if (!node) return;
  const action = getAvailableActions(node, state).find((a) => a.id === actionId);
  if (!action?.followup) return;
  const choices = action.followup.choices(node, state);
  if (choices.length === 0) return;

  clearContextMenu();

  const panel = /** @type {any} */ (document.getElementById("action-choices"));
  if (!panel) return;
  choicesNodeId = nodeId;
  panel.title = action.followup.title(node, state);
  panel.actionId = actionId;
  panel.nodeId = nodeId;
  panel.choices = choices;
  panel.visible = true;
  // The panel uses display:none while hidden, so offsetWidth/offsetHeight are
  // zero until after the component's updated() hook fires (async after visible=true).
  // Use requestAnimationFrame to measure after the first paint.
  requestAnimationFrame(() => _positionActionChoices(nodeId));
}

function closeActionChoices() {
  choicesNodeId = null;
  const panel = /** @type {any} */ (document.getElementById("action-choices"));
  if (!panel) return;
  panel.visible = false;
}

// ── Graph sync ────────────────────────────────────────────

/** Sync selection highlight and ICE position — not per-node styles. */
function syncOverlays(state) {
  const cy = getCy();
  if (!cy) return;

  // Close the choice picker if the player navigated away from its anchor node.
  if (choicesNodeId && state.selectedNodeId !== choicesNodeId) closeActionChoices();

  syncSelection(state.selectedNodeId);

  // Session 1: render only the single primary active instance.
  // Multi-instance rendering (iterating all) would overwrite the shared
  // ICE overlay state — that's a later-session concern.
  const primaryIce = Object.values(state.ice?.instances ?? {}).find(i => i?.active);
  if (primaryIce) {
    syncIceGraph(primaryIce, state.nodes, state.selectedNodeId);
  }
}

// ── HUD sync ──────────────────────────────────────────────

function syncHud(state) {
  const hudEl = /** @type {any} */ (document.getElementById("hud"));
  if (hudEl) {
    hudEl.alert = state.globalAlert;
    hudEl.cash = state.player.cash;
    hudEl.traceSeconds = state.traceSecondsRemaining;
    hudEl.isCheating = state.isCheating;
    hudEl.phase = state.phase;
    hudEl.health = state.player.health.current;
    hudEl.healthMax = state.player.health.max;
    hudEl.deck = state.player.deckIntegrity.current;
    hudEl.deckMax = state.player.deckIntegrity.max;

    // Connection status
    const detecting = getVisibleTimers().some((t) => t.label === "ICE DETECTION");
    if (detecting) {
      hudEl.connectionStatus = "detecting";
      hudEl.connectionLabel = `ACTIVE: ${state.selectedNodeId}`;
    } else if (state.selectedNodeId) {
      hudEl.connectionStatus = "active";
      hudEl.connectionLabel = `ACTIVE: ${state.selectedNodeId}`;
    } else {
      hudEl.connectionStatus = "";
      hudEl.connectionLabel = "PASSIVE SCAN";
    }
  }

  syncMissionPane(state);

  // End screen
  if (state.phase === "ended") {
    closeActionChoices();
    /** @type {any} */ (document.getElementById("sidebar-node")).node = null;
    /** @type {any} */ (document.getElementById("sidebar-node")).selectedNodeId = "";
    const handEl = /** @type {any} */ (document.getElementById("hand-strip"));
    handEl.cards = [];
    handEl.executingCardId = null;
    handEl.execProgress = 0;
    handEl.isSelecting = false;
    handEl.selectedNode = null;
    handEl.selectedNodeId = "";
    renderEndScreen(state);
    return;
  }

  // Sidebar node panel
  const nodePanelEl = /** @type {any} */ (document.getElementById("sidebar-node"));
  nodePanelEl.selectedNodeId = state.selectedNodeId || "";
  // Shallow-copy: state mutates nodes in place, so the reference doesn't change.
  // Lit needs a new reference to trigger re-render.
  nodePanelEl.node = state.selectedNodeId ? { ...state.nodes[state.selectedNodeId] } : null;

  syncHandPane(state);
}

// ── Mission pane ──────────────────────────────────────────

function syncMissionPane(state) {
  const el = document.getElementById("sidebar-mission");
  if (!el) return;
  /** @type {any} */ (el).mission = state.mission ? { ...state.mission } : null;
  /** @type {any} */ (el).phase = state.phase;
}


// ── Hand pane ─────────────────────────────────────────────

function updateExploitProgress(progress = null) {
  if (progress === null) return;
  const handEl = /** @type {any} */ (document.getElementById("hand-strip"));
  if (handEl) handEl.execProgress = progress;
}

function syncHandPane(state) {
  const handEl = /** @type {any} */ (document.getElementById("hand-strip"));
  if (!handEl) return;

  const selectedNode = state.selectedNodeId ? state.nodes[state.selectedNodeId] : null;
  const exploitingId = selectedNode?.exploiting ? selectedNode.activeExploitId : null;
  const executing = !!exploitingId;
  const isSelecting = !!state.selectedNodeId && !executing;
  const sortedHand = selectedNode
    ? [...state.player.hand].sort((a, b) => exploitSortKey(a, selectedNode) - exploitSortKey(b, selectedNode))
    : state.player.hand;

  handEl.cards = sortedHand.map(c => ({ ...c }));
  handEl.selectedNode = selectedNode ? { ...selectedNode } : null;
  handEl.executingCardId = exploitingId;
  handEl.isSelecting = isSelecting;
  handEl.selectedNodeId = state.selectedNodeId || "";
}

// ── ICE timers ────────────────────────────────────────────

// Updates the <starnet-node-panel> timers property.
// Called on TIMERS_UPDATED ticks.
function syncIceTimers() {
  const panel = /** @type {any} */ (document.getElementById("sidebar-node"));
  if (!panel) return;
  panel.timers = getVisibleTimers();
}

// ── End screen ────────────────────────────────────────────

function renderEndScreen(state) {
  const endEl = /** @type {any} */ (document.getElementById("end-screen"));
  if (!endEl) return;

  endEl.outcome = state.runOutcome;
  endEl.cash = state.player.cash;
  endEl.hasMission = !!state.mission;
  endEl.missionComplete = state.mission?.complete ?? false;
  endEl.nodesCompromised = Object.values(state.nodes).filter(
    (n) => n.accessLevel !== "locked"
  ).length;
  endEl.nodesOwned = Object.values(state.nodes).filter(
    (n) => n.accessLevel === "owned"
  ).length;
  endEl.macguffinsLooted = Object.values(state.nodes).reduce(
    (sum, n) => sum + (n.looted ? n.macguffins.length : 0), 0
  );
  endEl.isCheating = state.isCheating;
  endEl.open = true;
}

