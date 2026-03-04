// @ts-nocheck
/**
 * Playground entry point — initializes a set-piece or network in an interactive
 * debugging environment. Reuses game systems (Cytoscape, console, state) with
 * added debug tooling.
 */

import { initGraph, getCy, fitGraph, syncInitialNodes, addIceNode } from "../ui/graph.js";
import { initGame, getState } from "../core/state.js";
import { startIce, handleIceTick, handleIceDetect } from "../core/ice.js";
import { initConsole, runCommand } from "../ui/console.js";
import { on, emitEvent, E } from "../core/events.js";
import { tick, TICK_MS, TIMER, getVisibleTimers } from "../core/timers.js";
import { handleTraceTick } from "../core/alert.js";
import { initVisualRenderer } from "../ui/visual-renderer.js";
import { initLogRenderer } from "../ui/log-renderer.js";
import { buildActionContext, initActionDispatcher, buildNodeClickHandler } from "../core/actions/action-context.js";
import { initGraphBridge } from "../core/graph-bridge.js";
import { initDynamicActions } from "../core/console-commands/dynamic-actions.js";
import { buildSetPieceMiniNetwork, buildMiniNetwork, listSetPieces } from "../core/node-graph/mini-network.js";

import { buildNetwork as buildCorporateFoothold } from "../../data/networks/corporate-foothold.js";
import { buildNetwork as buildResearchStation } from "../../data/networks/research-station.js";
import { buildNetwork as buildCorporateExchange } from "../../data/networks/corporate-exchange.js";

// ── Network registry ────────────────────────────────────────

const NETWORKS = {
  "corporate-foothold": buildCorporateFoothold,
  "research-station": buildResearchStation,
  "corporate-exchange": buildCorporateExchange,
};

// ── URL param parsing ───────────────────────────────────────

function getSourceFromUrl() {
  const p = new URLSearchParams(location.search);
  const piece = p.get("piece");
  const network = p.get("network");
  const file = p.get("file");
  return { piece, network, file };
}

// ── Network builder from source ─────────────────────────────

async function buildNetworkFromSource(source) {
  if (source.piece) {
    return buildSetPieceMiniNetwork(source.piece);
  }
  if (source.network && NETWORKS[source.network]) {
    return NETWORKS[source.network]();
  }
  if (source.file) {
    const resp = await fetch(source.file);
    const graphDef = await resp.json();
    return buildMiniNetwork(graphDef, { name: `File: ${source.file}` });
  }
  // Default: first set-piece
  return buildSetPieceMiniNetwork("idsRelayChain");
}

// ── Cytoscape format conversion ─────────────────────────────

function toCytoscapeFormat(result) {
  const { graphDef, meta } = result;
  return {
    nodes: graphDef.nodes.map(n => ({
      id: n.id,
      type: n.type,
      label: n.attributes?.label ?? n.id,
      grade: n.attributes?.grade ?? "D",
    })),
    edges: graphDef.edges.map(([a, b]) => ({ source: a, target: b })),
    startNode: meta.startNode,
    startCash: meta.startCash,
    moneyCost: meta.moneyCost,
    ice: meta.ice,
  };
}

// ── Dropdown population ─────────────────────────────────────

function populateDropdown(source) {
  const select = document.getElementById("source-select");
  if (!select) return;

  const pieces = listSetPieces();
  const networks = Object.keys(NETWORKS);

  // Set-pieces group
  const pieceGroup = document.createElement("optgroup");
  pieceGroup.label = "Set-Pieces";
  for (const name of pieces) {
    const opt = document.createElement("option");
    opt.value = `piece:${name}`;
    opt.textContent = name;
    if (source.piece === name) opt.selected = true;
    pieceGroup.appendChild(opt);
  }
  select.appendChild(pieceGroup);

  // Networks group
  const netGroup = document.createElement("optgroup");
  netGroup.label = "Networks";
  for (const name of networks) {
    const opt = document.createElement("option");
    opt.value = `network:${name}`;
    opt.textContent = name;
    if (source.network === name) opt.selected = true;
    netGroup.appendChild(opt);
  }
  select.appendChild(netGroup);

  // Change handler — navigate with URL param
  select.addEventListener("change", () => {
    const val = select.value;
    const [type, name] = val.split(":");
    location.search = `?${type}=${name}`;
  });
}

// ── Message trace log ───────────────────────────────────────

let _messagesEnabled = true;

function initMessageLog() {
  const el = document.getElementById("message-log-entries");
  if (!el) return;

  function addMsg(text, cls = "log-msg") {
    if (!_messagesEnabled) return;
    const div = document.createElement("div");
    div.className = `log-entry ${cls}`;
    div.textContent = text;
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
    // Cap entries
    while (el.children.length > 500) el.removeChild(el.firstChild);
  }

  // Subscribe to graph events via the game event bus
  on(E.NODE_STATE_CHANGED, ({ nodeId, attr, value, previous }) => {
    // Skip noisy progress attributes
    if (attr.startsWith("_ta_") && attr.includes("progress")) return;
    addMsg(`[ATTR] ${nodeId}.${attr}: ${JSON.stringify(previous)} → ${JSON.stringify(value)}`, "log-attr");
  });

  on(E.MESSAGE_PROPAGATED, ({ nodeId, message }) => {
    if (message.type === "tick") return; // too noisy
    addMsg(`[MSG] ${message.type} → ${nodeId} (origin: ${message.origin})`, "log-msg");
  });

  // Toggle
  document.getElementById("toggle-messages")?.addEventListener("change", (e) => {
    _messagesEnabled = e.target.checked;
  });
}

// ── Inspector panel ─────────────────────────────────────────

let _showInternal = true;
let _showHidden = true;

function initInspector() {
  const content = document.getElementById("inspector-content");
  if (!content) return;

  function updateInspector() {
    const s = getState();
    if (!s?.selectedNodeId || !s.nodeGraph) {
      content.textContent = "Select a node to inspect.";
      return;
    }
    const nodeId = s.selectedNodeId;
    const attrs = s.nodeGraph.getNodeState(nodeId);
    const lines = [`NODE: ${nodeId}\n`];

    // Attributes
    lines.push("── ATTRIBUTES ──");
    for (const [key, val] of Object.entries(attrs)) {
      if (!_showInternal && key.startsWith("_")) continue;
      lines.push(`  ${key}: ${JSON.stringify(val)}`);
    }

    // Node def info (operators, actions, traits)
    const snapshot = s.nodeGraph.snapshot();
    const nodeDef = snapshot.nodes.find(n => n.id === nodeId);
    if (nodeDef) {
      if (nodeDef.operators?.length) {
        lines.push("\n── OPERATORS ──");
        for (const op of nodeDef.operators) {
          const config = Object.entries(op).filter(([k]) => k !== "name").map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(" ");
          lines.push(`  ${op.name}${config ? " " + config : ""}`);
        }
      }
      if (nodeDef.actions?.length) {
        lines.push("\n── ACTIONS ──");
        const available = s.nodeGraph.getAvailableActions(nodeId);
        const availIds = new Set(available.map(a => a.id));
        for (const act of nodeDef.actions) {
          const avail = availIds.has(act.id) ? "✓" : "·";
          lines.push(`  ${avail} ${act.id} — ${act.desc ?? act.label}`);
        }
      }
    }

    content.textContent = lines.join("\n");
  }

  on(E.STATE_CHANGED, updateInspector);
  on(E.PLAYER_NAVIGATED, () => setTimeout(updateInspector, 10));
  on(E.NODE_STATE_CHANGED, updateInspector);

  // Toggles
  document.getElementById("toggle-internal")?.addEventListener("change", (e) => {
    _showInternal = e.target.checked;
    updateInspector();
  });
  document.getElementById("toggle-hidden")?.addEventListener("change", (e) => {
    _showHidden = e.target.checked;
    updateInspector();
  });
}

// ── JSON inspector ──────────────────────────────────────────

function initJsonPanel() {
  const content = document.getElementById("json-content");
  const refreshBtn = document.getElementById("json-refresh-btn");
  if (!content || !refreshBtn) return;

  function refresh() {
    const s = getState();
    if (!s?.nodeGraph) {
      content.textContent = "No graph loaded.";
      return;
    }
    const snapshot = s.nodeGraph.snapshot();
    content.textContent = JSON.stringify(snapshot, null, 2);
  }

  refreshBtn.addEventListener("click", refresh);
}

// ── Tick controls ───────────────────────────────────────────

function initTickControls() {
  let autoInterval = null;

  document.getElementById("tick-1-btn")?.addEventListener("click", () => {
    tick(1);
    emitEvent(E.STATE_CHANGED, getState());
  });
  document.getElementById("tick-10-btn")?.addEventListener("click", () => {
    tick(10);
    emitEvent(E.STATE_CHANGED, getState());
  });
  document.getElementById("tick-100-btn")?.addEventListener("click", () => {
    tick(100);
    emitEvent(E.STATE_CHANGED, getState());
  });

  const autoBtn = document.getElementById("auto-btn");
  const pauseBtn = document.getElementById("pause-btn");

  autoBtn?.addEventListener("click", () => {
    if (autoInterval) return;
    autoInterval = setInterval(() => {
      tick(1);
      if (getVisibleTimers().length > 0) emitEvent(E.TIMERS_UPDATED, getState());
    }, TICK_MS);
    autoBtn.textContent = "[ ▶ RUNNING ]";
    autoBtn.classList.add("active");
  });

  pauseBtn?.addEventListener("click", () => {
    if (autoInterval) {
      clearInterval(autoInterval);
      autoInterval = null;
      autoBtn.textContent = "[ ▶ AUTO ]";
      autoBtn.classList.remove("active");
    }
  });
}

// ── Init ────────────────────────────────────────────────────

async function init() {
  const source = getSourceFromUrl();
  populateDropdown(source);

  const networkResult = await buildNetworkFromSource(source);
  const cytoscapeNetwork = toCytoscapeFormat(networkResult);

  // Init rendering
  initLogRenderer();
  const cy = initGraph(cytoscapeNetwork, buildNodeClickHandler(), () => {
    emitEvent("starnet:action", { actionId: "deselect" });
  });
  initConsole();
  initVisualRenderer();

  // Init game state + graph
  initGame(() => networkResult, undefined, {});
  initGraphBridge();
  initDynamicActions();
  syncInitialNodes(getState().nodes);
  fitGraph(cy);

  // ICE (may not exist in mini-networks)
  const s = getState();
  if (s.ice) {
    addIceNode();
    startIce();
  }

  // Timer handlers (non-action timers still use the old system)
  on(TIMER.ICE_MOVE, () => handleIceTick());
  on(TIMER.ICE_DETECT, (payload) => handleIceDetect(payload));
  on(TIMER.TRACE_TICK, () => handleTraceTick());

  // Action dispatcher
  const ctx = buildActionContext();
  initActionDispatcher(ctx);

  // Playground-specific systems
  initMessageLog();
  initInspector();
  initJsonPanel();
  initTickControls();

  // Reload button
  document.getElementById("reload-btn")?.addEventListener("click", () => {
    location.reload();
  });

  // LLM API
  window.starnet = { cmd: runCommand, state: getState };

  console.log(`Playground loaded: ${networkResult.meta.name}`);
}

init();
