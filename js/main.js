import { NETWORK } from "../data/network.js";
import { initGraph, updateNodeStyle } from "./graph.js";
import { initState, getState, selectNode } from "./state.js";

function init() {
  // Initialize state (sets start node accessible, reveals neighbors, emits)
  initState(NETWORK);

  // Initialize graph (renders elements; state listener will apply styles)
  const cy = initGraph(NETWORK, onNodeClick);

  // Listen for state changes and sync graph + UI
  document.addEventListener("starnet:statechange", (evt) => {
    const s = evt.detail;
    syncGraph(s);
    syncHud(s);
  });

  // Trigger initial render
  document.dispatchEvent(
    new CustomEvent("starnet:statechange", { detail: getState() })
  );
}

function onNodeClick(nodeId) {
  const s = getState();
  const node = s.nodes[nodeId];
  if (!node || node.visibility === "hidden") return;
  selectNode(nodeId);
}

function syncGraph(state) {
  Object.values(state.nodes).forEach((nodeState) => {
    updateNodeStyle(nodeState.id, nodeState);
  });

  // Fit visible nodes on first load (only when nothing selected yet)
  if (!state.selectedNodeId) {
    import("./graph.js").then(({ getCy }) => {
      const cy = getCy();
      if (cy) cy.fit(cy.nodes(".accessible, .revealed"), 40);
    });
  }
}

function syncHud(state) {
  // Wallet
  document.getElementById("wallet").textContent =
    `¥${state.player.cash.toLocaleString()}`;

  // Global alert
  const dot = document.getElementById("alert-dot");
  const levelEl = document.getElementById("alert-level");
  const level = state.globalAlert;
  dot.className = "alert-dot" + (level !== "green" ? ` ${level}` : "");
  levelEl.textContent = level.toUpperCase();
  levelEl.style.color =
    level === "green"  ? "var(--green)" :
    level === "yellow" ? "var(--yellow)" :
    /* red / trace */    "var(--red)";

  // Jack out button — enabled once game is playing
  const jackBtn = document.getElementById("jack-out-btn");
  jackBtn.disabled = state.phase !== "playing";

  // Sidebar — show selected node info or placeholder
  const sidebar = document.getElementById("sidebar");
  if (state.selectedNodeId) {
    const node = state.nodes[state.selectedNodeId];
    renderSidebarNode(sidebar, node, state);
  } else {
    sidebar.innerHTML = `<div class="sidebar-placeholder">
      &gt; SELECT A NODE<br />&gt; TO BEGIN INTRUSION
    </div>`;
  }
}

function renderExploitCard(card) {
  const rarityClass = `rarity-${card.rarity}`;
  const disclosed = card.decayState === "disclosed";
  const worn = card.decayState === "worn";
  const qualityPips = Math.round(card.quality * 5);
  const pips = "█".repeat(qualityPips) + "░".repeat(5 - qualityPips);

  return `<div class="exploit-card ${rarityClass} ${disclosed ? "disclosed" : ""}">
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

function renderSidebarNode(sidebar, node, state) {
  if (node.visibility === "revealed") {
    sidebar.innerHTML = `<div class="sidebar-placeholder">
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
        <span class="nd-val" style="color:${alertColor}">
          ● ${node.alertState.toUpperCase()}
        </span>
      </div>
      <div class="nd-divider">──────────────────</div>
      <div class="nd-actions">
        <span class="nd-dim">[actions coming in Phase 5]</span>
      </div>
      <div class="nd-divider">──────────────────</div>
      <div class="nd-section-label">EXPLOIT HAND</div>
      <div class="nd-hand">
        ${state.player.hand.map(renderExploitCard).join("")}
      </div>
    </div>`;
}

document.addEventListener("DOMContentLoaded", init);
