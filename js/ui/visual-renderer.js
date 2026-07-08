// @ts-check
// Visual renderer — subscribes to game events and drives all DOM updates.
// Handles both idempotent re-renders (on state:changed) and one-shot effects.

/** @typedef {import('../core/types.js').GameState} GameState */
/** @typedef {import('../core/types.js').NodeState} NodeState */
/** @typedef {import('../core/types.js').NodeRevealedPayload} NodeRevealedPayload */
/** @typedef {import('../core/types.js').NodeAccessedPayload} NodeAccessedPayload */

import { on, E } from "../core/events.js";
import { A } from "../core/action-ids.js";
import { TIMED_ACTIONS, getTimedActionAttrNames } from "../core/node-graph/timed-actions.js";
import { getState as _getState } from "../core/state.js";
import { getAvailableActions } from "../core/actions/node-actions.js";
import { isScriptAction } from "../core/actions/scripts.js";
import { updateNodeStyle, getCy, flashNode, addIceNode, syncIceGraph, syncSelection } from "./graph.js";
import { initializeGraphOverlays } from "./overlays/index.js";
import { dispatchActionFeedback } from "./overlays/dispatch.js";
import { getVisibleTimers } from "../core/timers.js";
import { exploitSortKey } from "../core/exploits.js";
import { HEAT_GAUGE_MAX } from "./indicator-glyphs.js";
import { initGraphDegradation, updateFromState as updateGraphDegradation } from "./graph-degradation/index.js";
import { computeInspectorPosition } from "./inspector-position.js";

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
    syncVitals(state);
    updateGraphDegradation(state);
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
  // Shared with the preview harness via initializeGraphOverlays (#167): mounts
  // the registry overlays + the selection reticle (graph.js drives the latter
  // from syncSelection) and wires both to re-anchor on pan/zoom.
  const { overlays, flowLayer } = initializeGraphOverlays();

  // Flow substrate: redraw typed packet flows on any state change or node reveal (a flow
  // only renders once both endpoints are in the graph), and clear on a fresh run. Registered
  // here — after the layer exists — as its own STATE_CHANGED subscriber.
  const refreshFlows = () => flowLayer.refresh(_getState().flows, getCy());
  on(E.STATE_CHANGED, refreshFlows);
  on(E.NODE_REVEALED, refreshFlows);
  on(E.RUN_STARTED, () => flowLayer.clear());

  // action id → { nodeId, overlayName } of the in-flight animation (tracked across feedback
  // events; the overlay name is resolved once at "start" — see dispatch.js — since later
  // phases don't carry the action's feedback profile)
  const activeNodeIds = new Map();
  on(E.ACTION_FEEDBACK, (payload) =>
    dispatchActionFeedback(overlays.byName, activeNodeIds, payload, { onXploitProgress: updateExploitProgress, manager: overlays.manager }));

  // Exploit result flash — driven by ACTION_RESOLVED
  on(E.ACTION_RESOLVED, ({ action, nodeId, success }) => {
    if (action === A.XPLOIT) flashNode(nodeId, success ? "success" : "failure");
  });

  // SWEEP: pulse each node a wave touches (per-node probe feedback; the dedicated
  // outward-ripple overlay is a follow-up — see epic #279). Origin pulses at start.
  on(E.PROCESS_STARTED, ({ type, nodeId }) => { if (type === "sweep") flashNode(nodeId, "reveal"); });
  on(E.PROCESS_STEP, ({ type, nodes }) => {
    if (type === "sweep" && Array.isArray(nodes)) nodes.forEach((id) => flashNode(id, "reveal"));
  });

  on(E.RUN_STARTED, () => {
    overlays.byKey.forEach((o) => o.clear());
    overlays.manager.clearAll();
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

  initGraphDegradation();
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
  const container = cy.container();
  const { left, top } = computeInspectorPosition({
    node: { x: pos.x, y: pos.y, r: node.renderedWidth() / 2 },
    popup: { w: menu.offsetWidth, h: menu.offsetHeight },
    container: { w: container.offsetWidth, h: container.offsetHeight },
  });

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  // Always left-align: the inspector is a panel with structured rows, so the
  // right-justify that suited a bare left-side action menu reads wrong here.
  menu.style.textAlign = "left";
}

// Human label for the action band's busy indicator, keyed by timed-action id.
const IN_PROGRESS_LABELS = {
  probe: "PROBING",
  xploit: "EXECUTING",
  dump: "READING",
  fetch: "EXTRACTING",
  mine: "MINING",
  "lie-low": "LYING LOW",
  reboot: "REBOOTING",
};

// If a timed action is running on this node, return its label + 0..1 progress so
// the inspector can show a busy indicator instead of (then-empty) action buttons.
function inProgressFor(node) {
  const busy = TIMED_ACTIONS.find((t) => /** @type {any} */ (node)[t.activeAttr]);
  if (!busy) return { label: "", progress: 0 };
  const { progressAttr, durationAttr } = getTimedActionAttrNames(busy.action);
  const dur = /** @type {any} */ (node)[durationAttr];
  const prog = /** @type {any} */ (node)[progressAttr];
  return {
    label: IN_PROGRESS_LABELS[busy.action] || busy.action.toUpperCase(),
    progress: dur > 0 ? Math.min(1, (prog || 0) / dur) : 0,
  };
}

function syncContextMenu(node, state) {
  const menu = /** @type {any} */ (document.getElementById("node-context-menu"));
  if (!menu) return;

  contextMenuNodeId = node.id;

  const actions = getAvailableActions(node, state)
    .filter((a) => !a.noSidebar && a.id !== A.TARGET && a.id !== A.JACKOUT
      && a.id !== A.UNTARGET && a.id !== A.ABORT
      && !isScriptAction(a.id)); // scripts are reached via the EXEC ▸ entry

  // Keep the inspector up during a timed action even though no actions are
  // available — the action band shows a busy indicator instead.
  const busy = inProgressFor(node);

  if (!actions.length && !busy.label) {
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
  menu.node = { ...node };           // header + footer source (fresh ref for Lit)
  menu.timers = getVisibleTimers();  // initial timer snapshot for the footer
  menu.inProgressLabel = busy.label;
  menu.inProgressProgress = busy.progress;
  menu.nodeId = node.id;
  menu.visible = true;

  // Lit renders asynchronously, so the menu's buttons aren't in the DOM yet —
  // measuring offsetHeight now would read a stale (empty) height and mis-center
  // the menu vertically. Defer positioning until the render flushes, and keep
  // it hidden until then so it reveals already-centered (no visible jump).
  menu.updateComplete.then(() => {
    if (contextMenuNodeId !== node.id) return; // selection changed while awaiting
    _positionContextMenu(node.id);
    menu.style.opacity = "1";
    menu.style.pointerEvents = "auto";
  });
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
  const panel = /** @type {any} */ (document.getElementById("action-choices"));
  if (!panel || !nodeId) return;
  const cy = getCy();
  if (!cy) return;

  const container = cy.container();
  const cw = container.offsetWidth;
  const ch = container.offsetHeight;
  const pw = panel.offsetWidth;
  const ph = panel.offsetHeight;

  // Cascade off the inspector's top-left by a small offset so the picker reads as
  // a child of the inspector showing for this same node.
  const menu = /** @type {any} */ (document.getElementById("node-context-menu"));
  if (menu && contextMenuNodeId === nodeId) {
    const OFFSET = 16;
    const left = Math.max(4, Math.min(menu.offsetLeft + OFFSET, cw - pw - 4));
    const top  = Math.max(4, Math.min(menu.offsetTop + OFFSET, ch - ph - 4));
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    return;
  }

  // Fallback: node-anchored (no inspector visible for this node).
  const cyNode = cy.getElementById(nodeId);
  if (!cyNode || cyNode.length === 0) return;
  const pos = cyNode.renderedPosition();
  const r = cyNode.renderedWidth() / 2;
  const gap = 20;
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

  // Keep the inspector visible underneath — the picker (higher z-index) overlaps
  // it and dismisses itself once a choice is made (or on cancel/ESC).
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

// ── Vital waveform strips ─────────────────────────────────
// Full-width ECG / deck-pulse traces framing the graph (index.html). Driven by the
// player's health / deck-integrity fractions. Absent on preview/playground — guarded.

function syncVitals(state) {
  const ecgEl = /** @type {any} */ (document.getElementById("vital-ecg"));
  const deckEl = /** @type {any} */ (document.getElementById("vital-deck"));
  const heatEl = /** @type {any} */ (document.getElementById("vital-heat"));
  const h = state.player.health, d = state.player.deckIntegrity;
  if (ecgEl) ecgEl.frac = h.max > 0 ? h.current / h.max : 0;
  if (deckEl) deckEl.frac = d.max > 0 ? d.current / d.max : 0;
  // Heat strip shares the gauge's fixed scale (never reveals the hidden alarm threshold).
  if (heatEl) heatEl.frac = Math.max(0, Math.min(1, (state.heat || 0) / HEAT_GAUGE_MAX));
}

// ── Uplink control (floats under the vitals) ──────────────
// VISIT WAN whenever a WAN node exists (selects it); JACK OUT stacks underneath
// when alert is elevated or a trace is counting down — the escape hatch is
// surfaced exactly when needed without hiding the quick hop to the WAN.
function syncUplink(state) {
  const el = /** @type {any} */ (document.getElementById("uplink-btn"));
  if (!el) return;
  const playing = state.phase === "playing";
  const danger = state.globalAlert !== "green" || state.traceSecondsRemaining !== null;
  const wan = Object.values(state.nodes).find((n) => /** @type {any} */ (n).type === "wan");
  el.wanNodeId = wan?.id || "";
  el.danger = danger;
  el.visible = playing && (danger || !!wan);
}

// ── HUD sync ──────────────────────────────────────────────

function syncHud(state) {
  const hudEl = /** @type {any} */ (document.getElementById("hud"));
  if (hudEl) {
    hudEl.alert = state.globalAlert;
    hudEl.cash = state.player.cash;
    hudEl.heat = state.heat;
    hudEl.traceSeconds = state.traceSecondsRemaining;
    hudEl.isCheating = state.isCheating;
    hudEl.phase = state.phase;
    hudEl.menuOpen = state.ui?.menuOpen ?? false;

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
  syncUplink(state);

  // End screen
  if (state.phase === "ended") {
    closeActionChoices();
    renderEndScreen(state);
    return;
  }

  syncHoardPane(state);
}

// ── Mission pane ──────────────────────────────────────────

function syncMissionPane(state) {
  const hudEl = /** @type {any} */ (document.getElementById("hud"));
  if (!hudEl) return;
  hudEl.mission = state.mission ? { ...state.mission } : null;
}


// ── Hoard pane (Phase 7b) ─────────────────────────────────
// Phase 7b: sync the hoard strip from state.player.hoard.
// The old card-era hand strip and exec-progress callback are vestigial
// (auto-burn is a process; no per-card ACTION_FEEDBACK progress); removed
// in Phase 9 sweep alongside player.hand / starnet-hand.js.

function updateExploitProgress(_progress = null) {
  // Dead: auto-burn uses process ticks, not per-card progress. No-op.
}

function syncHoardPane(state) {
  const hoardEl = /** @type {any} */ (document.getElementById("hoard-strip"));
  if (!hoardEl) return;
  hoardEl.hoard = state.player.hoard ?? [];
}

// ── ICE timers ────────────────────────────────────────────

// Updates the inspector popup timers property.
// Called on TIMERS_UPDATED ticks.
function syncIceTimers() {
  const menu = /** @type {any} */ (document.getElementById("node-context-menu"));
  if (!menu || !menu.visible) return;
  // Timer rows appearing/disappearing changes the popup height — reposition after
  // the footer re-renders so the header+actions stay anchored.
  menu.timers = getVisibleTimers();
  menu.updateComplete.then(() => _positionContextMenu(contextMenuNodeId));
}

// ── End screen ────────────────────────────────────────────

function renderEndScreen(state) {
  const endEl = /** @type {any} */ (document.getElementById("end-screen"));
  if (!endEl) return;

  endEl.outcome = state.runOutcome;
  endEl.cash = state.player.cash;
  endEl.hasMission = !!state.mission;
  endEl.missionComplete = state.mission?.complete ?? false;
  endEl.nodesAccessed = Object.values(state.nodes).filter(
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

