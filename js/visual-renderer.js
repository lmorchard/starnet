// Visual renderer — subscribes to game events and drives all DOM updates.
// Handles both idempotent re-renders (on state:changed) and one-shot effects.

import { on, E } from "./events.js";
import { updateNodeStyle, getCy, flashNode, addIceNode, syncIceGraph, syncSelection } from "./graph.js";
import { getVisibleTimers } from "./timers.js";

// Sidebar UI mode — kept here since it affects render output.
// Updated by main.js via setSidebarMode() when action events change mode.
let sidebarMode = "node";

// Debounce handle for NODE_REVEALED viewport fit.
// Multiple simultaneous reveals (e.g. exploiting a hub node) would otherwise
// queue overlapping cy.animate() calls that fight each other.
let revealFitTimer = null;

export function setSidebarMode(mode) {
  sidebarMode = mode;
}

export function initVisualRenderer() {
  on(E.STATE_CHANGED, (state) => {
    syncGraph(state);
    syncHud(state);
  });

  // One-shot flash effects keyed to typed game events
  on(E.EXPLOIT_SUCCESS, ({ nodeId }) => flashNode(nodeId, "success"));
  on(E.EXPLOIT_FAILURE, ({ nodeId }) => flashNode(nodeId, "failure"));
  on(E.NODE_ACCESSED,   ({ nodeId }) => flashNode(nodeId, "success"));
  on(E.NODE_REVEALED,   ({ nodeId }) => {
    flashNode(nodeId, "reveal");
    // Debounce fit — batch simultaneous reveals into one viewport adjustment
    clearTimeout(revealFitTimer);
    revealFitTimer = setTimeout(() => {
      const cy = getCy();
      if (cy) {
        cy.animate({
          fit: { eles: cy.nodes(".accessible, .revealed"), padding: 50 },
          duration: 500,
        });
      }
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
    syncIceGraph(state.ice, state.nodes);
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

  syncMissionPane(state);

  // End screen
  if (state.phase === "ended") {
    document.getElementById("sidebar-node").innerHTML = "";
    document.getElementById("sidebar-hand").innerHTML = "";
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
      ${renderIceTimers()}
      <div class="nd-section-label">ACTIONS</div>
      <div class="nd-actions">
        ${renderActions(node, state)}
      </div>
    </div>`;

  wireActionButtons(node);

  sidebarNode.querySelector(".deselect-btn")?.addEventListener("click", () => {
    document.dispatchEvent(new CustomEvent("starnet:action:deselect", { detail: {} }));
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

// ── Actions ───────────────────────────────────────────────

function renderActions(node, state) {
  const btns = [];

  if (node.accessLevel === "locked") {
    if (!node.probed) {
      btns.push(actionBtn("probe", "PROBE", "Reveal vulnerabilities. Raises local alert."));
    }
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
    const icePresent = state?.ice?.active && state.ice.attentionNodeId === node.id;
    if (icePresent) {
      btns.push(actionBtn("eject", "EJECT", "Boot ICE attention to a random adjacent node."));
    }
    if (!node.rebooting) {
      btns.push(actionBtn("reboot", "REBOOT", "Force ICE home and take node offline 1–3s."));
    }

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

// ── Hand pane ─────────────────────────────────────────────

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

  const isSelecting = !!state.selectedNodeId;
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

// ── ICE timers ────────────────────────────────────────────

function renderIceTimers() {
  const timers = getVisibleTimers();
  const rows = timers.map((t) => {
    const isDetect = t.label === "ICE DETECTION";
    const cls = isDetect ? "ice-timer-detect" : "ice-timer-reboot";
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
    document.dispatchEvent(new CustomEvent("starnet:action:run-again", { detail: {} }));
  });
}
