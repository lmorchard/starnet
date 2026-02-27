// @ts-check
// Visual renderer — subscribes to game events and drives all DOM updates.
// Handles both idempotent re-renders (on state:changed) and one-shot effects.

/** @typedef {import('./types.js').GameState} GameState */
/** @typedef {import('./types.js').NodeState} NodeState */
/** @typedef {import('./types.js').ExploitCard} ExploitCard */
/** @typedef {import('./types.js').ExploitSuccessPayload} ExploitSuccessPayload */
/** @typedef {import('./types.js').ExploitFailurePayload} ExploitFailurePayload */
/** @typedef {import('./types.js').NodeRevealedPayload} NodeRevealedPayload */
/** @typedef {import('./types.js').NodeAccessedPayload} NodeAccessedPayload */

import { on, emitEvent, E } from "./events.js";
import { getActions } from "./node-types.js";
import { getNodeActions } from "./node-actions.js";
import { updateNodeStyle, getCy, flashNode, addIceNode, syncIceGraph, syncSelection, syncProbeSweep, clearProbeSweep, syncExploitBrackets, clearExploitBrackets } from "./graph.js";
import { getVisibleTimers } from "./timers.js";
import { exploitSortKey } from "./exploits.js";

// Debounce handle for NODE_REVEALED viewport fit.
// Multiple simultaneous reveals (e.g. exploiting a hub node) would otherwise
// queue overlapping cy.animate() calls that fight each other.
let revealFitTimer = null;

// Exploit execution timing — tracked here (not in state) for sub-tick precision.
// Set when EXPLOIT_STARTED fires; cleared on resolution or cancellation.
let execStartTime = null;
let execTotalMs = null;

// Probe scan timing — same pattern, drives the sweep overlay in the graph.
let probeStartTime = null;
let probeTotalMs = null;

export function initVisualRenderer() {
  on(E.STATE_CHANGED, (/** @type {GameState} */ state) => {
    syncGraph(state);
    syncHud(state);
  });

  // Track exploit execution start time for sub-tick progress animation precision.
  on(E.EXPLOIT_STARTED, ({ durationMs }) => { execStartTime = Date.now(); execTotalMs = durationMs; });
  on(E.EXPLOIT_INTERRUPTED, () => { execStartTime = null; execTotalMs = null; clearExploitBrackets(); });
  on(E.EXPLOIT_SUCCESS,     () => { execStartTime = null; execTotalMs = null; clearExploitBrackets(); });
  on(E.EXPLOIT_FAILURE,     () => { execStartTime = null; execTotalMs = null; clearExploitBrackets(); });
  on(E.RUN_STARTED,         () => clearExploitBrackets());

  // Track probe scan start time for the radial sweep overlay.
  on(E.PROBE_SCAN_STARTED,   ({ durationMs }) => { probeStartTime = Date.now(); probeTotalMs = durationMs; });
  on(E.PROBE_SCAN_CANCELLED, () => { probeStartTime = null; probeTotalMs = null; clearProbeSweep(); });
  on(E.NODE_PROBED,          () => { probeStartTime = null; probeTotalMs = null; clearProbeSweep(); });
  on(E.RUN_STARTED,          () => { probeStartTime = null; probeTotalMs = null; clearProbeSweep(); });

  // Timer-only tick: update countdowns in-place. Also refresh the hand if an
  // exploit is executing so the progress fill and percentage stay current.
  on(E.TIMERS_UPDATED, (/** @type {GameState} */ state) => {
    syncIceTimers();
    const countdown = document.getElementById("trace-countdown");
    if (countdown && state.traceSecondsRemaining !== null) {
      countdown.textContent = `TRACE: ${state.traceSecondsRemaining}s`;
    }
    if (state.executingExploit) syncHandPane(state);
    if (state.activeProbe && probeStartTime !== null && probeTotalMs !== null) {
      const elapsed = Math.min(Date.now() - probeStartTime, probeTotalMs);
      syncProbeSweep(state.activeProbe.nodeId, elapsed / probeTotalMs);
    }
    if (state.executingExploit && execStartTime !== null && execTotalMs !== null) {
      const elapsed = Math.min(Date.now() - execStartTime, execTotalMs);
      syncExploitBrackets(state.executingExploit.nodeId, elapsed / execTotalMs);
    }
  });

  // One-shot flash effects keyed to typed game events
  on(E.EXPLOIT_SUCCESS, (/** @type {ExploitSuccessPayload} */ { nodeId }) => flashNode(nodeId, "success"));
  on(E.EXPLOIT_FAILURE, (/** @type {ExploitFailurePayload} */ { nodeId }) => flashNode(nodeId, "failure"));
  on(E.NODE_ACCESSED,   (/** @type {NodeAccessedPayload} */   { nodeId }) => flashNode(nodeId, "success"));
  on(E.NODE_REVEALED,   (/** @type {NodeRevealedPayload} */   { nodeId }) => {
    flashNode(nodeId, "reveal");
    // Debounce fit — batch simultaneous reveals into one viewport adjustment
    clearTimeout(revealFitTimer);
    revealFitTimer = setTimeout(() => {
      const cy = getCy();
      if (!cy) return;
      const visible = cy.nodes(".accessible, .revealed");
      // Skip animated fit for a single node — it would zoom in absurdly.
      // The initial fitGraph() in main.js already positioned it correctly.
      if (visible.length <= 1) return;
      cy.animate({
        fit: { eles: visible, padding: 50 },
        duration: 500,
      });
    }, 50);
  });

}

// ── Graph sync ────────────────────────────────────────────

function syncGraph(state) {
  const cy = getCy();

  Object.values(state.nodes).forEach((n) => updateNodeStyle(n.id, n));

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
      <div class="nd-section-label">ACTIONS</div>
      <div class="nd-actions">
        ${renderActions(node, state)}
      </div>
    </div>`;

  syncIceTimers(sidebarNode);
  wireActionButtons(node);

  sidebarNode.querySelector(".deselect-btn")?.addEventListener("click", () => {
    emitEvent("starnet:action", { actionId: "deselect" });
  });
}

// ── Actions ───────────────────────────────────────────────

function renderActions(node, state) {
  const actions = [
    ...getNodeActions(node, state),
    ...getActions(node, state),
  ];
  const btns = actions.map((a) => actionBtn(a.id, a.label, a.desc(node, state)));
  return btns.join("") || `<span class="nd-dim">No actions available.</span>`;
}

function actionBtn(action, label, desc, stub = false) {
  return `<button class="action-btn ${stub ? "stub" : ""}" data-action="${action}">
    [ ${label} ]<span class="action-desc">${desc}${stub ? " (coming soon)" : ""}</span>
  </button>`;
}

function wireActionButtons(node) {
  document.querySelectorAll(".action-btn:not(.stub)").forEach((btn) => {
    btn.addEventListener("click", () => {
      const actionId = /** @type {HTMLElement} */ (btn).dataset.action;
      emitEvent("starnet:action", { actionId, nodeId: node.id });
    });
  });
}

// ── Hand pane ─────────────────────────────────────────────

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
