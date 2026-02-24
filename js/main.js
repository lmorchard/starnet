import { NETWORK } from "../data/network.js";
import { initGraph, updateNodeStyle } from "./graph.js";
import { initState, getState, selectNode, probeNode, launchExploit } from "./state.js";

// Current UI mode for the sidebar: 'node' | 'exploit-select'
let sidebarMode = "node";

function init() {
  initState(NETWORK);
  const cy = initGraph(NETWORK, onNodeClick);

  document.addEventListener("starnet:statechange", (evt) => {
    syncGraph(evt.detail);
    syncHud(evt.detail);
  });

  // Wire HUD buttons
  document.getElementById("jack-out-btn").addEventListener("click", () => {
    document.dispatchEvent(new CustomEvent("starnet:action:jackout"));
  });

  // Action event listeners (dispatched from sidebar buttons)
  document.addEventListener("starnet:action:probe", (evt) => {
    probeNode(evt.detail.nodeId);
    sidebarMode = "node";
  });
  document.addEventListener("starnet:action:exploit", () => {
    sidebarMode = "exploit-select";
    const s = getState();
    if (s.selectedNodeId) {
      renderSidebarNode(document.getElementById("sidebar"), s.nodes[s.selectedNodeId], s);
    }
  });

  document.addEventListener("starnet:action:escalate", () => {
    sidebarMode = "exploit-select";
    const s = getState();
    if (s.selectedNodeId) {
      renderSidebarNode(document.getElementById("sidebar"), s.nodes[s.selectedNodeId], s);
    }
  });
  document.addEventListener("starnet:action:cancel", () => {
    sidebarMode = "node";
    const s = getState();
    if (s.selectedNodeId) {
      renderSidebarNode(document.getElementById("sidebar"), s.nodes[s.selectedNodeId], s);
    }
  });

  document.addEventListener("starnet:action:launch-exploit", (evt) => {
    const { nodeId, exploitId } = evt.detail;
    launchExploit(nodeId, exploitId);
    sidebarMode = "node";
  });

  document.dispatchEvent(
    new CustomEvent("starnet:statechange", { detail: getState() })
  );
}

function onNodeClick(nodeId) {
  const s = getState();
  const node = s.nodes[nodeId];
  if (!node || node.visibility === "hidden") return;
  sidebarMode = "node";
  selectNode(nodeId);
}

// ── Graph sync ────────────────────────────────────────────

function syncGraph(state) {
  Object.values(state.nodes).forEach((n) => updateNodeStyle(n.id, n));
  if (!state.selectedNodeId) {
    import("./graph.js").then(({ getCy }) => {
      const cy = getCy();
      if (cy) cy.fit(cy.nodes(".accessible, .revealed"), 40);
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

  document.getElementById("jack-out-btn").disabled = state.phase !== "playing";

  const sidebar = document.getElementById("sidebar");
  if (state.selectedNodeId) {
    renderSidebarNode(sidebar, state.nodes[state.selectedNodeId], state);
  } else {
    sidebar.innerHTML = `<div class="sidebar-placeholder">
      &gt; SELECT A NODE<br />&gt; TO BEGIN INTRUSION
    </div>`;
  }
}

// ── Sidebar rendering ─────────────────────────────────────

function renderSidebarNode(sidebar, node, state) {
  if (node.visibility === "revealed") {
    sidebar.innerHTML = `<div class="sidebar-placeholder">
      [???] UNKNOWN NODE<br /><br />
      Signal detected on network.<br />
      Gain access to a connected node<br />to probe further.
    </div>`;
    return;
  }

  if (sidebarMode === "exploit-select") {
    renderExploitSelect(sidebar, node, state);
    return;
  }

  const alertColor =
    node.alertState === "green"  ? "var(--green)" :
    node.alertState === "yellow" ? "var(--yellow)" :
                                   "var(--red)";

  const vulnSection = node.probed
    ? `<div class="nd-section-label">VULNERABILITIES</div>
       <div class="nd-vulns">
         ${node.vulnerabilities.map((v) =>
           `<div class="nd-vuln ${v.patched ? "patched" : ""}">
              <span class="vuln-name">${v.name}</span>
              <span class="vuln-rarity rarity-${v.rarity}">[${v.rarity.toUpperCase()}]</span>
            </div>`
         ).join("")}
       </div>`
    : `<div class="nd-dim nd-indent">Run PROBE to reveal vulnerabilities.</div>`;

  sidebar.innerHTML = `
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
      <div class="nd-divider">──────────────────</div>
      <div class="nd-section-label">ACTIONS</div>
      <div class="nd-actions">
        ${renderActions(node)}
      </div>
      <div class="nd-divider">──────────────────</div>
      <div class="nd-section-label">EXPLOIT HAND</div>
      <div class="nd-hand">
        ${state.player.hand.map(renderExploitCard).join("")}
      </div>
      ${renderLog(state.log)}
    </div>`;

  // Wire action buttons after DOM insertion
  wireActionButtons(node);
}

function renderLog(log) {
  if (!log || log.length === 0) return "";
  return `
    <div class="nd-divider">──────────────────</div>
    <div class="nd-section-label">LOG</div>
    <div class="nd-log">
      ${log.map((entry) =>
        `<div class="log-entry log-${entry.type}">&gt; ${entry.text}</div>`
      ).join("")}
    </div>`;
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
    btns.push(actionBtn("read", "READ", "Scan node contents for loot or connections.", true));
    btns.push(actionBtn("reconfigure", "RECONFIGURE", "Modify node event forwarding.", true));
  }

  if (node.accessLevel === "owned") {
    btns.push(actionBtn("loot", "LOOT", "Collect macguffins for cash.", true));
    btns.push(actionBtn("subvert", "SUBVERT", "Deceive connected security monitors.", true));
    btns.push(actionBtn("escalate", "ESCALATE", "Attempt full ownership via another exploit.", true));
    btns.push(actionBtn("read", "READ", "Scan node contents.", true));
    btns.push(actionBtn("reconfigure", "RECONFIGURE", "Modify node event forwarding.", true));
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

function renderExploitSelect(sidebar, node, state) {
  const usableCards = state.player.hand.filter(
    (c) => c.decayState !== "disclosed"
  );

  sidebar.innerHTML = `
    <div class="node-detail">
      <div class="nd-header">
        <span class="nd-type">[SELECT EXPLOIT]</span>
        <span class="nd-label">${node.label}</span>
      </div>
      <div class="nd-dim nd-indent">
        Choose an exploit to launch against this node.
        ${node.probed ? "Known vulnerabilities are highlighted." : "Probe the node first for better odds."}
      </div>
      <div class="nd-divider">──────────────────</div>
      <div class="nd-hand selectable">
        ${usableCards.map((card) => renderExploitCard(card, node)).join("")}
        ${usableCards.length === 0 ? '<span class="nd-dim">No usable exploits.</span>' : ""}
      </div>
      <div class="nd-divider">──────────────────</div>
      <button class="action-btn" data-action="cancel">[ CANCEL ]</button>
    </div>`;

  // Wire exploit card clicks
  sidebar.querySelectorAll(".exploit-card.selectable-card").forEach((el) => {
    el.addEventListener("click", () => {
      const exploitId = el.dataset.exploitId;
      document.dispatchEvent(
        new CustomEvent("starnet:action:launch-exploit", {
          detail: { nodeId: node.id, exploitId },
        })
      );
      sidebarMode = "node";
    });
  });

  sidebar.querySelector("[data-action='cancel']")?.addEventListener("click", () => {
    document.dispatchEvent(new CustomEvent("starnet:action:cancel"));
  });
}

function renderExploitCard(card, targetNode = null) {
  const rarityClass = `rarity-${card.rarity}`;
  const disclosed = card.decayState === "disclosed";
  const worn = card.decayState === "worn";
  const qualityPips = Math.round(card.quality * 5);
  const pips = "█".repeat(qualityPips) + "░".repeat(5 - qualityPips);

  // Highlight if card matches a known vulnerability on the target node
  let matchClass = "";
  if (targetNode?.probed) {
    const knownVulnIds = targetNode.vulnerabilities
      .filter((v) => !v.patched)
      .map((v) => v.id);
    const hasMatch = card.targetVulnTypes.some((t) => knownVulnIds.includes(t));
    matchClass = hasMatch ? "match" : "no-match";
  }

  const isSelectable = targetNode !== null && !disclosed;

  return `<div class="exploit-card ${rarityClass} ${disclosed ? "disclosed" : ""} ${matchClass} ${isSelectable ? "selectable-card" : ""}"
              data-exploit-id="${card.id}">
    <div class="ec-header">
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
