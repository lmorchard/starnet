import { NETWORK } from "../data/network.js";
import { initGraph, updateNodeStyle, getCy, flashNode } from "./graph.js";
import { initState, getState, selectNode, probeNode, launchExploit, reconfigureNode, readNode, lootNode, endRun, addLogEntry } from "./state.js";
import { getVisibleTimers } from "./timers.js";
import { initConsole } from "./console.js";

// Current UI mode for the sidebar: 'node' | 'exploit-select'
let sidebarMode = "node";

function init() {
  initState(NETWORK);
  const cy = initGraph(NETWORK, onNodeClick);
  initConsole();

  document.addEventListener("starnet:statechange", (evt) => {
    syncGraph(evt.detail);
    syncHud(evt.detail);
  });

  // Wire HUD jack-out button → dispatches action event
  document.getElementById("jack-out-btn").addEventListener("click", () => {
    document.dispatchEvent(new CustomEvent("starnet:action:jackout", { detail: {} }));
  });

  // Action event listeners — handle both click-dispatched and console-dispatched events.
  // Click-sourced events (no fromConsole flag) echo their equivalent command to the log.

  document.addEventListener("starnet:action:select", (evt) => {
    if (!evt.detail.fromConsole) addLogEntry(`> select ${evt.detail.nodeId}`, "command");
    if (sidebarMode !== "node") {
      sidebarMode = "node";
      addLogEntry("Action cancelled.", "info");
    }
    selectNode(evt.detail.nodeId);
  });

  document.addEventListener("starnet:action:probe", (evt) => {
    if (!evt.detail.fromConsole) addLogEntry(`> probe ${evt.detail.nodeId}`, "command");
    probeNode(evt.detail.nodeId);
    sidebarMode = "node";
  });

  document.addEventListener("starnet:action:exploit", (evt) => {
    sidebarMode = "exploit-select";
    const s = getState();
    if (s.selectedNodeId) {
      renderSidebarNode(document.getElementById("sidebar-node"), s.nodes[s.selectedNodeId], s);
    }
    syncHandPane(getState());
  });

  document.addEventListener("starnet:action:escalate", () => {
    sidebarMode = "exploit-select";
    const s = getState();
    if (s.selectedNodeId) {
      renderSidebarNode(document.getElementById("sidebar-node"), s.nodes[s.selectedNodeId], s);
    }
    syncHandPane(getState());
  });

  document.addEventListener("starnet:action:cancel", () => {
    sidebarMode = "node";
    const s = getState();
    if (s.selectedNodeId) {
      renderSidebarNode(document.getElementById("sidebar-node"), s.nodes[s.selectedNodeId], s);
    }
    syncHandPane(getState());
  });

  document.addEventListener("starnet:action:launch-exploit", (evt) => {
    const { nodeId, exploitId } = evt.detail;
    if (!evt.detail.fromConsole) addLogEntry(`> exploit ${nodeId} ${exploitId}`, "command");

    // Click UI (exploit-select mode): stay in exploit-select on failure so the player can
    // keep trying cards. Console shots are always single-shot and exit to node view.
    const clickMode = sidebarMode === "exploit-select" && !evt.detail.fromConsole;
    if (!clickMode) sidebarMode = "node";

    const result = launchExploit(nodeId, exploitId);

    if (result) {
      flashNode(nodeId, result.success ? "success" : "failure");
    }

    if (clickMode && result?.success) {
      // Success: switch to node view. The emit inside launchExploit already rendered
      // exploit-select mode, so we need a forced re-render in node mode.
      sidebarMode = "node";
      const s = getState();
      if (s.selectedNodeId) {
        renderSidebarNode(document.getElementById("sidebar-node"), s.nodes[s.selectedNodeId], s);
      }
      syncHandPane(s);
    }
  });

  document.addEventListener("starnet:action:reconfigure", (evt) => {
    if (!evt.detail.fromConsole) addLogEntry(`> reconfigure ${evt.detail.nodeId}`, "command");
    reconfigureNode(evt.detail.nodeId);
    sidebarMode = "node";
  });

  document.addEventListener("starnet:action:read", (evt) => {
    if (!evt.detail.fromConsole) addLogEntry(`> read ${evt.detail.nodeId}`, "command");
    readNode(evt.detail.nodeId);
    sidebarMode = "node";
  });

  document.addEventListener("starnet:action:loot", (evt) => {
    if (!evt.detail.fromConsole) addLogEntry(`> loot ${evt.detail.nodeId}`, "command");
    lootNode(evt.detail.nodeId);
    sidebarMode = "node";
  });

  document.addEventListener("starnet:action:jackout", (evt) => {
    if (!evt.detail.fromConsole) addLogEntry(`> jackout`, "command");
    endRun("success");
  });

  document.dispatchEvent(
    new CustomEvent("starnet:statechange", { detail: getState() })
  );
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

// ── Log pane ──────────────────────────────────────────────

function syncLogPane(log) {
  const el = document.getElementById("log-entries");
  if (!el) return;
  el.innerHTML = (log || []).map((entry) => {
    const prefix = (entry.type === "command" || entry.type === "error") ? "" : "&gt; ";
    return `<div class="log-entry log-${entry.type}">${prefix}${entry.text}</div>`;
  }).join("");
  el.scrollTop = el.scrollHeight;
}

function onNodeClick(nodeId) {
  const s = getState();
  const node = s.nodes[nodeId];
  if (!node || node.visibility === "hidden") return;
  document.dispatchEvent(
    new CustomEvent("starnet:action:select", { detail: { nodeId } })
  );
}

// ── Graph sync ────────────────────────────────────────────

function syncGraph(state) {
  const cy = getCy();

  // Snapshot currently-hidden nodes before applying style updates
  const prevHiddenIds = cy
    ? new Set(cy.nodes(".hidden").map((n) => n.id()))
    : new Set();

  Object.values(state.nodes).forEach((n) => updateNodeStyle(n.id, n));

  if (!cy) return;

  // Detect nodes that just became visible
  const newlyVisible = cy.nodes().filter(
    (n) => prevHiddenIds.has(n.id()) && !n.hasClass("hidden")
  );

  if (newlyVisible.length > 0) {
    newlyVisible.forEach((n) => flashNode(n.id(), "reveal"));

    cy.animate({
      fit: { eles: cy.nodes(".accessible, .revealed"), padding: 80 },
      duration: 500,
    });
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

  document.getElementById("jack-out-btn").disabled = state.phase !== "playing";

  // Cheat mode indicator
  const existingCheatLabel = document.getElementById("cheat-label");
  if (state.isCheating && !existingCheatLabel) {
    const el = document.createElement("span");
    el.id = "cheat-label";
    el.className = "hud-cheat-label";
    el.textContent = "// CHEAT";
    document.getElementById("hud").appendChild(el);
  }
  syncLogPane(state.log);
  syncMissionPane(state);

  // End screen
  if (state.phase === "ended") {
    document.getElementById("sidebar-node").innerHTML = "";
    document.getElementById("sidebar-hand").innerHTML = "";
    renderEndScreen(state);
    return;
  }

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

// ── Sidebar rendering ─────────────────────────────────────

function renderSidebarNode(sidebarNode, node, state) {
  if (node.visibility === "revealed") {
    sidebarNode.innerHTML = `<div class="sidebar-placeholder">
      [???] UNKNOWN NODE<br /><br />
      Signal detected on network.<br />
      Gain access to a connected node<br />to probe further.
    </div>`;
    return;
  }

  if (sidebarMode === "exploit-select") {
    renderExploitSelect(sidebarNode, node);
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
      <div class="nd-section-label">ACTIONS</div>
      <div class="nd-actions">
        ${renderActions(node)}
      </div>
    </div>`;

  // Wire action buttons after DOM insertion
  wireActionButtons(node);
}

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

  document.getElementById("run-again-btn").addEventListener("click", () => {
    overlay.remove();
    // Re-init game state
    import("./state.js").then(({ initState }) => {
      import("../data/network.js").then(({ NETWORK }) => {
        sidebarMode = "node";
        initState(NETWORK);
      });
    });
  });
}


function renderActions(node) {
  const btns = [];

  if (node.accessLevel === "locked") {
    if (!node.probed) {
      btns.push(actionBtn("probe", "PROBE", "Reveal vulnerabilities. Raises local alert."));
    }
    btns.push(actionBtn("exploit", "EXPLOIT", "Launch an exploit against this node."));
  }

  if (node.accessLevel === "compromised") {
    btns.push(actionBtn("escalate", "ESCALATE", "Attempt full ownership via another exploit."));
    const readDone = node.read;
    btns.push(actionBtn("read", readDone ? "READ (done)" : "READ", "Scan node contents for loot or connections.", readDone));
    const isDetector = node.type === "ids";
    const reconfigStub = !isDetector || node.eventForwardingDisabled;
    const reconfigLabel = node.eventForwardingDisabled ? "RECONFIGURE (done)" : "RECONFIGURE";
    btns.push(actionBtn("reconfigure", reconfigLabel, "Disable event forwarding to security monitor.", reconfigStub));
  }

  if (node.accessLevel === "owned") {
    const hasLoot = node.macguffins.some((m) => !m.collected);
    btns.push(actionBtn("loot", node.looted ? "LOOT (done)" : "LOOT", "Collect macguffins for cash.", node.looted || !hasLoot));
    btns.push(actionBtn("subvert", "SUBVERT", "Deceive connected security monitors.", true));
    btns.push(actionBtn("escalate", "ESCALATE", "Attempt full ownership via another exploit.", true));
    const readDone = node.read;
    btns.push(actionBtn("read", readDone ? "READ (done)" : "READ", "Scan node contents.", readDone));
    const isDetector = node.type === "ids";
    const reconfigStub = !isDetector || node.eventForwardingDisabled;
    const reconfigLabel = node.eventForwardingDisabled ? "RECONFIGURE (done)" : "RECONFIGURE";
    btns.push(actionBtn("reconfigure", reconfigLabel, "Disable event forwarding to security monitor.", reconfigStub));
  }

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
      const action = btn.dataset.action;
      document.dispatchEvent(
        new CustomEvent(`starnet:action:${action}`, { detail: { nodeId: node.id } })
      );
    });
  });
}

function renderExploitSelect(sidebarNode, node) {
  sidebarNode.innerHTML = `
    <div class="node-detail">
      <div class="nd-header">
        <span class="nd-type">[SELECT EXPLOIT]</span>
        <span class="nd-label">${node.label}</span>
      </div>
      <div class="nd-dim nd-indent">
        Choose an exploit from your hand below.
        ${node.probed ? "Matching cards are highlighted." : "Probe the node first for better odds."}
      </div>
      <div class="nd-divider">──────────────────</div>
      <button class="action-btn" data-action="cancel">[ CANCEL ]</button>
    </div>`;

  sidebarNode.querySelector("[data-action='cancel']")?.addEventListener("click", () => {
    document.dispatchEvent(new CustomEvent("starnet:action:cancel"));
  });
}

function cardSortKey(card, node) {
  if (card.decayState === "disclosed") return 3;
  if (!node?.probed) return 1;
  const knownVulnIds = node.vulnerabilities
    .filter((v) => !v.patched && !v.hidden)
    .map((v) => v.id);
  return card.targetVulnTypes.some((t) => knownVulnIds.includes(t)) ? 0 : 2;
}

function syncHandPane(state) {
  const el = document.getElementById("sidebar-hand");
  if (!el) return;

  const isSelecting = sidebarMode === "exploit-select" && state.selectedNodeId;
  const targetNode = isSelecting ? state.nodes[state.selectedNodeId] : null;

  // Sort by match relevance whenever a node is selected, even outside exploit-select
  const selectedNode = state.selectedNodeId ? state.nodes[state.selectedNodeId] : null;
  const sortedHand = selectedNode
    ? [...state.player.hand].sort((a, b) => cardSortKey(a, selectedNode) - cardSortKey(b, selectedNode))
    : state.player.hand;

  el.innerHTML = `
    <div class="nd-section-label">EXPLOIT HAND</div>
    <div class="nd-hand ${isSelecting ? "selectable" : ""}">
      ${sortedHand.length === 0
        ? '<span class="nd-dim">No exploits in hand.</span>'
        : sortedHand.map((c, i) => renderExploitCard(c, selectedNode, i + 1, isSelecting)).join("")}
    </div>`;

  if (isSelecting) {
    el.querySelectorAll(".exploit-card.selectable-card").forEach((cardEl) => {
      cardEl.addEventListener("click", () => {
        const exploitId = cardEl.dataset.exploitId;
        document.dispatchEvent(
          new CustomEvent("starnet:action:launch-exploit", {
            detail: { nodeId: state.selectedNodeId, exploitId },
          })
        );
      });
    });
  }
}

function renderExploitCard(card, selectedNode = null, index = null, isSelecting = false) {
  const rarityClass = `rarity-${card.rarity}`;
  const disclosed = card.decayState === "disclosed";
  const worn = card.decayState === "worn";
  const qualityPips = Math.round(card.quality * 5);
  const pips = "█".repeat(qualityPips) + "░".repeat(5 - qualityPips);

  // Show match highlight whenever a probed node is selected
  let matchClass = "";
  if (selectedNode?.probed) {
    const knownVulnIds = selectedNode.vulnerabilities
      .filter((v) => !v.patched && !v.hidden)
      .map((v) => v.id);
    const hasMatch = card.targetVulnTypes.some((t) => knownVulnIds.includes(t));
    matchClass = hasMatch ? "match" : "no-match";
  }

  const isSelectable = isSelecting && !disclosed;

  return `<div class="exploit-card ${rarityClass} ${disclosed ? "disclosed" : ""} ${matchClass} ${isSelectable ? "selectable-card" : ""}"
              data-exploit-id="${card.id}">
    <div class="ec-header">
      ${index !== null ? `<span class="ec-index">${index}.</span>` : ""}
      <span class="ec-name">${card.name}</span>
      <span class="ec-rarity">[${card.rarity.toUpperCase()}]</span>
    </div>
    <div class="ec-row">
      <span class="ec-key">QUAL</span>
      <span class="ec-pips">${pips}</span>
    </div>
    <div class="ec-row">
      <span class="ec-key">USES</span>
      <span class="ec-val">${disclosed ? "DISCLOSED" : worn ? `${card.usesRemaining} (worn)` : card.usesRemaining}</span>
    </div>
    <div class="ec-vulns">${card.targetVulnTypes.join(" · ")}</div>
  </div>`;
}

document.addEventListener("DOMContentLoaded", init);
