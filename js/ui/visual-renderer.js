// @ts-check
// Visual renderer — subscribes to game events and drives all DOM updates.
// Handles both idempotent re-renders (on state:changed) and one-shot effects.

/** @typedef {import('../core/types.js').GameState} GameState */
/** @typedef {import('../core/types.js').NodeState} NodeState */
/** @typedef {import('../core/types.js').ExploitCard} ExploitCard */
/** @typedef {import('../core/types.js').ExploitSuccessPayload} ExploitSuccessPayload */
/** @typedef {import('../core/types.js').ExploitFailurePayload} ExploitFailurePayload */
/** @typedef {import('../core/types.js').NodeRevealedPayload} NodeRevealedPayload */
/** @typedef {import('../core/types.js').NodeAccessedPayload} NodeAccessedPayload */

import { on, emitEvent, E } from "../core/events.js";
import { getState as _getState } from "../core/state.js";
import { getAvailableActions } from "../core/actions/node-actions.js";
import { updateNodeStyle, getCy, flashNode, addIceNode, syncIceGraph, syncSelection, syncProbeSweep, clearProbeSweep, syncReadSectors, clearReadSectors, syncLootRings, clearLootRings, syncExploitBrackets, clearExploitBrackets, syncIceDetectSweep, clearIceDetectSweep, completeAndClearIceDetectSweep, relayout } from "./graph.js";
import { getVisibleTimers } from "../core/timers.js";
import { exploitSortKey } from "../core/exploits.js";

// Debounce handle for NODE_REVEALED viewport fit.
// Multiple simultaneous reveals (e.g. exploiting a hub node) would otherwise
// queue overlapping cy.animate() calls that fight each other.
let revealFitTimer = null;

// Exploit execution timing — used for card progress % display fallback.
let execStartTime = null;
let execTotalMs = null;

// Context menu — tracks which node the menu is anchored to for pan/zoom repositioning.
let contextMenuNodeId = null;

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

  on(E.RUN_STARTED, () => clearContextMenu());

  // ── ACTION_FEEDBACK — unified timed action animation dispatch ──
  // The timed-action operator emits action-feedback events with
  // { nodeId, action, phase, progress }. We dispatch to per-action
  // animation handlers. The old per-action events are no longer emitted.
  //
  // activeNodeId tracks which node has an active animation so we can
  // clear overlays correctly on completion/cancel.
  let activeProbeNodeId = null;
  let activeExploitNodeId = null;
  let activeReadNodeId = null;
  let activeLootNodeId = null;

  on(E.ACTION_FEEDBACK, ({ nodeId, action, phase, progress }) => {
    if (action === "probe") {
      if (phase === "start") {
        activeProbeNodeId = nodeId;
      } else if (phase === "progress" && activeProbeNodeId) {
        syncProbeSweep(activeProbeNodeId, progress);
      } else if (phase === "complete" || phase === "cancel") {
        clearProbeSweep();
        activeProbeNodeId = null;
      }
    } else if (action === "exploit") {
      if (phase === "start") {
        activeExploitNodeId = nodeId;
        execStartTime = Date.now();
      } else if (phase === "progress" && activeExploitNodeId) {
        syncExploitBrackets(activeExploitNodeId, progress);
        updateExploitProgress(progress);
      } else if (phase === "complete" || phase === "cancel") {
        clearExploitBrackets();
        execStartTime = null; execTotalMs = null;
        if (phase === "complete") {
          // Flash success/failure based on exploit result
          // (EXPLOIT_SUCCESS/FAILURE events are still emitted by resolveExploit → launchExploit)
        }
        activeExploitNodeId = null;
      }
    } else if (action === "read") {
      if (phase === "start") {
        activeReadNodeId = nodeId;
      } else if (phase === "progress" && activeReadNodeId) {
        syncReadSectors(activeReadNodeId, progress);
      } else if (phase === "complete" || phase === "cancel") {
        clearReadSectors();
        activeReadNodeId = null;
      }
    } else if (action === "loot") {
      if (phase === "start") {
        activeLootNodeId = nodeId;
      } else if (phase === "progress" && activeLootNodeId) {
        syncLootRings(activeLootNodeId, progress);
      } else if (phase === "complete" || phase === "cancel") {
        clearLootRings();
        activeLootNodeId = null;
      }
    }
  });

  // Exploit result flash — still driven by existing events from combat.js
  on(E.EXPLOIT_SUCCESS, (/** @type {ExploitSuccessPayload} */ { nodeId }) => flashNode(nodeId, "success"));
  on(E.EXPLOIT_FAILURE, (/** @type {ExploitFailurePayload} */ { nodeId }) => flashNode(nodeId, "failure"));

  on(E.RUN_STARTED, () => {
    clearExploitBrackets(); clearProbeSweep(); clearReadSectors(); clearLootRings();
    clearIceDetectSweep();
    activeProbeNodeId = null; activeExploitNodeId = null;
    activeReadNodeId = null; activeLootNodeId = null;
    execStartTime = null; execTotalMs = null;
  });

  // ICE detection sweep — clear immediately on any event that ends a detection dwell.
  on(E.ICE_DETECTED,     () => completeAndClearIceDetectSweep());
  on(E.ICE_MOVED,        () => clearIceDetectSweep());
  on(E.ICE_EJECTED,      () => clearIceDetectSweep());
  on(E.ICE_REBOOTED,     () => clearIceDetectSweep());
  on(E.PLAYER_NAVIGATED, () => clearIceDetectSweep());

  // Timer-only tick: update countdowns and ICE detection sweep.
  // Action progress no longer driven here — ACTION_FEEDBACK handles it.
  on(E.TIMERS_UPDATED, (/** @type {GameState} */ state) => {
    syncIceTimers();
    const countdown = document.getElementById("trace-countdown");
    if (countdown && state.traceSecondsRemaining !== null) {
      countdown.textContent = `TRACE: ${state.traceSecondsRemaining}s`;
    }
    // ICE detection sweep — driven by timer presence; self-clears when timer is gone
    const iceDetect = getVisibleTimers().find((t) => t.label === "ICE DETECTION");
    if (iceDetect) {
      syncIceDetectSweep("ice-0", iceDetect.progress);
    } else {
      clearIceDetectSweep();
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
      cy.layout({
        name: "cola",
        animate: true,
        randomize: false,
        fit: true,
        padding: 50,
        nodeSpacing: 30,
        edgeLength: 120,
        maxSimulationTime: 2000,
        ungrabifyWhileSimulating: true,
        lock: (node) => locked.has(node.id()),
      }).run();
    }, 200);
  });

  // Keep context menu attached to node on pan/zoom/drag
  const cy = getCy();
  if (cy) {
    cy.on("pan zoom", () => _positionContextMenu(contextMenuNodeId));
    cy.on("position", "node", () => _positionContextMenu(contextMenuNodeId));
  }
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
  const menu = document.getElementById("node-context-menu");
  if (!menu) return;

  contextMenuNodeId = node.id;

  const actions = getAvailableActions(node, state)
    .filter((a) => !a.noSidebar && a.id !== "select" && a.id !== "jackout" && a.id !== "deselect" && a.id !== "cancel-exploit");

  if (!actions.length) {
    clearContextMenu();
    return;
  }

  menu.innerHTML = actions.map((a) => {
    const desc = a.desc(node, state);
    return `<button class="ctx-item" data-action="${a.id}">
      [ ${a.label} ]${desc ? `<span class="ctx-item-desc">${desc}</span>` : ""}
    </button>`;
  }).join("");

  menu.querySelectorAll(".ctx-item[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const actionId = /** @type {HTMLElement} */ (btn).dataset.action;
      emitEvent("starnet:action", { actionId, nodeId: node.id });
    });
  });

  _positionContextMenu(node.id);
  menu.style.opacity = "1";
  menu.style.pointerEvents = "auto";
}

function clearContextMenu() {
  contextMenuNodeId = null;
  const menu = document.getElementById("node-context-menu");
  if (!menu) return;
  menu.style.opacity = "0";
  menu.style.pointerEvents = "none";
}

// ── Graph sync ────────────────────────────────────────────

/** Sync selection highlight and ICE position — not per-node styles. */
function syncOverlays(state) {
  const cy = getCy();
  if (!cy) return;

  syncSelection(state.selectedNodeId);

  if (state.ice) {
    syncIceGraph(state.ice, state.nodes, state.selectedNodeId);
    const iceNode = cy.getElementById("ice-0");
    if (iceNode && iceNode.length > 0) {
      const docked = state.ice.active && state.ice.attentionNodeId === state.selectedNodeId;
      docked ? iceNode.addClass("docked") : iceNode.removeClass("docked");
    }
  }
}

// ── HUD sync ──────────────────────────────────────────────

function syncHud(state) {
  document.getElementById("wallet").textContent =
    `¥${state.player.cash.toLocaleString()}`;

  const dot = document.getElementById("alert-dot");
  const levelEl = document.getElementById("alert-level");
  const level = state.globalAlert;
  dot.className = "alert-dot" + (level !== "green" ? ` ${level}` : "");
  levelEl.textContent = level.toUpperCase();
  levelEl.style.color =
    level === "green"  ? "var(--green)" :
    level === "yellow" ? "var(--yellow)" :
                         "var(--red)";

  // Trace countdown in HUD
  const existingCountdown = document.getElementById("trace-countdown");
  if (state.traceSecondsRemaining !== null && state.phase === "playing") {
    if (existingCountdown) {
      existingCountdown.textContent = `TRACE: ${state.traceSecondsRemaining}s`;
    } else {
      const el = document.createElement("span");
      el.id = "trace-countdown";
      el.className = "hud-value trace-countdown";
      el.textContent = `TRACE: ${state.traceSecondsRemaining}s`;
      document.getElementById("jack-out-btn").before(el);
    }
  } else if (existingCountdown) {
    existingCountdown.remove();
  }

  /** @type {HTMLButtonElement} */ (document.getElementById("jack-out-btn")).disabled = state.phase !== "playing";

  // Connection status indicator
  const connDot = document.getElementById("conn-dot");
  const connStatus = document.getElementById("conn-status");
  if (connDot && connStatus) {
    const detecting = getVisibleTimers().some((t) => t.label === "ICE DETECTION");
    if (detecting) {
      connDot.className = "hud-conn-dot detecting";
      connStatus.className = "detecting";
      connStatus.textContent = `ACTIVE: ${state.selectedNodeId}`;
    } else if (state.selectedNodeId) {
      connDot.className = "hud-conn-dot active";
      connStatus.className = "active";
      connStatus.textContent = `ACTIVE: ${state.selectedNodeId}`;
    } else {
      connDot.className = "hud-conn-dot";
      connStatus.className = "";
      connStatus.textContent = "PASSIVE SCAN";
    }
  }

  // Cheat mode indicator
  const existingCheatLabel = document.getElementById("cheat-label");
  if (state.isCheating && !existingCheatLabel) {
    const el = document.createElement("span");
    el.id = "cheat-label";
    el.className = "hud-cheat-label";
    el.textContent = "// CHEAT";
    document.getElementById("hud").appendChild(el);
  }

  syncMissionPane(state);

  // End screen
  if (state.phase === "ended") {
    document.getElementById("sidebar-node").innerHTML = "";
    document.getElementById("hand-strip").innerHTML = "";
    renderEndScreen(state);
    return;
  }

  // Sidebar node panel
  const sidebarNode = document.getElementById("sidebar-node");
  if (state.selectedNodeId) {
    renderSidebarNode(sidebarNode, state.nodes[state.selectedNodeId], state);
  } else {
    sidebarNode.innerHTML = `<div class="sidebar-placeholder">
      &gt; SELECT A NODE<br />&gt; TO BEGIN INTRUSION
    </div>`;
  }

  syncHandPane(state);
}

// ── Mission pane ──────────────────────────────────────────

function syncMissionPane(state) {
  const el = document.getElementById("sidebar-mission");
  if (!el || !state.mission) return;

  let statusClass, statusText;
  if (state.mission.complete) {
    statusClass = "mission-status-complete";
    statusText = "STATUS: ██ COMPLETE";
  } else if (state.phase === "ended") {
    statusClass = "mission-status-failed";
    statusText = "STATUS: ░░ FAILED";
  } else {
    statusClass = "mission-status-active";
    statusText = "STATUS: ▶ ACTIVE";
  }

  el.innerHTML = `
    <div class="mission-label">// MISSION</div>
    <div class="mission-target">⬡ ${state.mission.targetName}</div>
    <div class="${statusClass}">${statusText}</div>`;
}

// ── Sidebar node panel ────────────────────────────────────

function renderSidebarNode(sidebarNode, node, state) {
  if (node.visibility === "revealed") {
    sidebarNode.innerHTML = `<div class="sidebar-placeholder">
      [???] UNKNOWN NODE<br /><br />
      Signal detected on network.<br />
      Gain access to a connected node<br />to probe further.
    </div>`;
    return;
  }

  const alertColor =
    node.alertState === "green"  ? "var(--green)" :
    node.alertState === "yellow" ? "var(--yellow)" :
                                   "var(--red)";

  const visibleVulns = node.vulnerabilities.filter((v) => !v.hidden);
  const vulnSection = node.probed
    ? `<div class="nd-section-label">VULNERABILITIES</div>
       <div class="nd-vulns">
         ${visibleVulns.map((v) =>
           `<div class="nd-vuln ${v.patched ? "patched" : ""}">
              <span class="vuln-name">${v.name}</span>
              <span class="vuln-rarity rarity-${v.rarity}">[${v.rarity.toUpperCase()}]</span>
            </div>`
         ).join("")}
       </div>`
    : `<div class="nd-dim nd-indent">Run PROBE to reveal vulnerabilities.</div>`;

  sidebarNode.innerHTML = `
    <div class="node-detail">
      <div class="nd-header">
        <span class="nd-type">[${node.type.toUpperCase()}]</span>
        <span class="nd-label">${node.label}</span>
        <button class="deselect-btn" data-action="deselect">[ DESELECT ]</button>
      </div>
      <div class="nd-row">
        <span class="nd-key">GRADE</span>
        <span class="nd-val grade-${node.grade}">${node.grade}</span>
      </div>
      <div class="nd-row">
        <span class="nd-key">ACCESS</span>
        <span class="nd-val">${node.accessLevel.toUpperCase()}</span>
      </div>
      <div class="nd-row">
        <span class="nd-key">ALERT</span>
        <span class="nd-val" style="color:${alertColor}">● ${node.alertState.toUpperCase()}</span>
      </div>
      <div class="nd-divider">──────────────────</div>
      ${vulnSection}
      ${node.read && node.macguffins.length > 0 ? `
      <div class="nd-divider">──────────────────</div>
      <div class="nd-section-label">CONTENTS</div>
      <div class="nd-macguffins">
        ${node.macguffins.map((m) => `
          <div class="macguffin ${m.collected ? "collected" : ""} ${m.isMission ? "mission-target" : ""}">
            <span class="mg-name">${m.name}</span>
            ${m.isMission && !m.collected ? `<span class="mg-mission-tag">★ MISSION</span>` : ""}
            <span class="mg-value ${m.collected ? "mg-collected" : ""}">
              ${m.collected ? "EXTRACTED" : `¥${m.cashValue.toLocaleString()}`}
            </span>
          </div>`).join("")}
      </div>` : node.read ? `
      <div class="nd-divider">──────────────────</div>
      <div class="nd-dim nd-indent">No valuables detected.</div>` : ""}
      <div class="nd-divider">──────────────────</div>
      <div class="ice-timers-slot"></div>
    </div>`;

  syncIceTimers(sidebarNode);

  sidebarNode.querySelector(".deselect-btn")?.addEventListener("click", () => {
    emitEvent("starnet:action", { actionId: "deselect" });
  });
}

// ── Hand pane ─────────────────────────────────────────────

function updateExploitProgress(progress = null) {
  let pct;
  if (progress !== null) {
    pct = Math.min(100, Math.round(progress * 100));
  } else if (execStartTime !== null && execTotalMs !== null) {
    const elapsed = Math.min(Date.now() - execStartTime, execTotalMs);
    pct = Math.min(100, Math.round((elapsed / execTotalMs) * 100));
  } else {
    return;
  }
  const label = document.querySelector(".exploit-card.executing .ec-executing-label");
  if (label) label.textContent = `▶ EXECUTING — ${pct}%`;
}

function syncHandPane(state) {
  const el = document.getElementById("hand-strip");
  if (!el) return;

  const executing = state.executingExploit;
  const isSelecting = !!state.selectedNodeId && !executing;
  const selectedNode = state.selectedNodeId ? state.nodes[state.selectedNodeId] : null;
  const sortedHand = selectedNode
    ? [...state.player.hand].sort((a, b) => exploitSortKey(a, selectedNode) - exploitSortKey(b, selectedNode))
    : state.player.hand;

  const handClass = ["nd-hand", isSelecting ? "selectable" : "", executing ? "exploit-hand-executing" : ""]
    .filter(Boolean).join(" ");

  el.innerHTML = `
    <div class="${handClass}">
      ${sortedHand.length === 0
        ? '<span class="nd-dim">No exploits in hand.</span>'
        : sortedHand.map((c, i) => {
            const isExec = executing?.exploitId === c.id;
            const elapsedMs = (isExec && execStartTime !== null && execTotalMs !== null)
              ? Math.min(Date.now() - execStartTime, execTotalMs)
              : 0;
            return renderExploitCard(c, selectedNode, i + 1, isSelecting, isExec, elapsedMs, execTotalMs ?? 0);
          }).join("")}
    </div>`;

  if (isSelecting) {
    el.querySelectorAll(".exploit-card.selectable-card").forEach((cardEl) => {
      cardEl.addEventListener("click", () => {
        const exploitId = /** @type {HTMLElement} */ (cardEl).dataset.exploitId;
        const cardIndex = /** @type {HTMLElement} */ (cardEl).dataset.cardIndex;
        emitEvent("starnet:action", { actionId: "exploit", nodeId: state.selectedNodeId, exploitId, cardIndex });
      });
    });
  }

  if (executing) {
    el.querySelector(".ec-cancel-overlay")?.addEventListener("click", () => {
      emitEvent("starnet:action", { actionId: "cancel-exploit" });
    });
  }
}

function renderExploitCard(card, selectedNode = null, index = null, isSelecting = false, isExecuting = false, execElapsedMs = 0, execTotalMs = 0) {
  const rarityClass = `rarity-${card.rarity}`;
  const disclosed = card.decayState === "disclosed";
  const worn = card.decayState === "worn";
  const qualityPips = Math.round(card.quality * 5);
  const pips = "█".repeat(qualityPips) + "░".repeat(5 - qualityPips);

  let matchClass = "";
  if (selectedNode?.probed && !isExecuting) {
    const knownVulnIds = selectedNode.vulnerabilities
      .filter((v) => !v.patched && !v.hidden)
      .map((v) => v.id);
    const hasMatch = card.targetVulnTypes.some((t) => knownVulnIds.includes(t));
    matchClass = hasMatch ? "match" : "no-match";
  }

  const isSelectable = isSelecting && !disclosed;
  const classes = [
    "exploit-card", rarityClass,
    disclosed ? "disclosed" : "",
    matchClass,
    isSelectable ? "selectable-card" : "",
    isExecuting ? "executing" : "",
  ].filter(Boolean).join(" ");

  const execPct = (isExecuting && execTotalMs > 0)
    ? Math.min(100, Math.round((execElapsedMs / execTotalMs) * 100))
    : 0;
  const execStyle = (isExecuting && execTotalMs > 0)
    ? ` style="--exec-total: ${execTotalMs}ms; --exec-elapsed: -${Math.round(execElapsedMs)}ms"`
    : "";

  return `<div class="${classes}"${execStyle} data-exploit-id="${card.id}" data-card-index="${index}">
    <div class="ec-header">
      ${index !== null ? `<span class="ec-index">${index}.</span>` : ""}
      <span class="ec-name">${card.name}</span>
    </div>
    <div class="ec-row">
      <span class="ec-key">QUAL</span>
      <span class="ec-pips">${pips}</span>
    </div>
    <div class="ec-row">
      <span class="ec-key">USES</span>
      <span class="ec-val">${disclosed ? "DISCLOSED" : worn ? `${card.usesRemaining} (worn)` : card.usesRemaining}</span>
    </div>
    <div class="ec-vulns">${card.targetVulnTypes.map((t) => `<div class="ec-vuln">${t}</div>`).join("")}</div>
    <div class="ec-executing-label">▶ EXECUTING — ${execPct}%</div>
    ${isExecuting ? `<div class="ec-cancel-overlay"><span class="ec-cancel-x">✕</span></div>` : ""}
  </div>`;
}

// ── ICE timers ────────────────────────────────────────────

// Updates the .ice-timers-slot in the sidebar in-place (no full re-render).
// Called both after sidebar innerHTML is set and on TIMERS_UPDATED ticks.
function syncIceTimers(container = null) {
  const slot = (container ?? document.getElementById("sidebar-node"))
    ?.querySelector(".ice-timers-slot");
  if (!slot) return;
  slot.innerHTML = renderIceTimers();
}

function renderIceTimers() {
  const timers = getVisibleTimers();
  const rows = timers.map((t) => {
    const cls = t.label === "ICE DETECTION" ? "ice-timer-detect"
              : t.label === "EXECUTING"      ? "ice-timer-executing"
              : t.label === "SCANNING"       ? "ice-timer-scanning"
              : t.label === "READING"        ? "ice-timer-scanning"
              : t.label === "EXTRACTING"     ? "ice-timer-scanning"
              : "ice-timer-reboot";
    return `<div class="ice-timer ${cls}">⚠ ${t.label}: ${t.remaining}s</div>`;
  }).join("");
  return rows ? `<div class="ice-timers">${rows}</div>` : "";
}

// ── End screen ────────────────────────────────────────────

function renderEndScreen(state) {
  const caught = state.runOutcome === "caught";
  const nodesCompromised = Object.values(state.nodes).filter(
    (n) => n.accessLevel !== "locked"
  ).length;
  const nodesOwned = Object.values(state.nodes).filter(
    (n) => n.accessLevel === "owned"
  ).length;
  const macguffinsLooted = Object.values(state.nodes).reduce(
    (sum, n) => sum + (n.looted ? n.macguffins.length : 0), 0
  );

  const overlay = document.getElementById("end-screen") || (() => {
    const el = document.createElement("div");
    el.id = "end-screen";
    document.getElementById("app").appendChild(el);
    return el;
  })();

  const missionRow = state.mission ? (() => {
    const complete = state.mission.complete;
    const cls = complete ? "end-val end-mission-complete" : "end-val end-zero";
    return `<div class="end-row">
      <span class="end-key">MISSION</span>
      <span class="${cls}">${complete ? "COMPLETE" : "FAILED"}</span>
    </div>`;
  })() : "";

  overlay.innerHTML = `
    <div class="end-box">
      <div class="end-title">${caught ? "▶ TRACED ◀" : "▶ RUN COMPLETE ◀"}</div>
      <div class="end-divider">════════════════════════</div>
      <div class="end-row">
        <span class="end-key">CASH EXTRACTED</span>
        <span class="end-val ${caught ? "end-zero" : ""}">¥${state.player.cash.toLocaleString()}</span>
      </div>
      ${missionRow}
      <div class="end-row">
        <span class="end-key">NODES COMPROMISED</span>
        <span class="end-val">${nodesCompromised}</span>
      </div>
      <div class="end-row">
        <span class="end-key">NODES OWNED</span>
        <span class="end-val">${nodesOwned}</span>
      </div>
      <div class="end-row">
        <span class="end-key">MACGUFFINS LOOTED</span>
        <span class="end-val">${macguffinsLooted}</span>
      </div>
      <div class="end-divider">════════════════════════</div>
      <button class="end-btn" id="run-again-btn">[ RUN AGAIN ]</button>
    </div>`;

  // Dispatch action event — main.js handles the actual re-init
  document.getElementById("run-again-btn").addEventListener("click", () => {
    overlay.remove();
    emitEvent("starnet:action:run-again", {});
  });
}

