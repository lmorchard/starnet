import { NETWORK } from "../data/network.js";
import { initGraph, updateNodeStyle } from "./graph.js";
import { initState, getState, selectNode, probeNode, launchExploit, reconfigureNode, readNode, lootNode, endRun } from "./state.js";

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

  document.addEventListener("starnet:action:reconfigure", (evt) => {
    reconfigureNode(evt.detail.nodeId);
    sidebarMode = "node";
  });

  document.addEventListener("starnet:action:read", (evt) => {
    readNode(evt.detail.nodeId);
    sidebarMode = "node";
  });

  document.addEventListener("starnet:action:loot", (evt) => {
    lootNode(evt.detail.nodeId);
    sidebarMode = "node";
  });

  document.getElementById("jack-out-btn").addEventListener("click", () => {
    endRun("success");
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

  // End screen
  if (state.phase === "ended") {
    renderEndScreen(state);
    return;
  }

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
      ${node.read && node.macguffins.length > 0 ? `
      <div class="nd-divider">──────────────────</div>
      <div class="nd-section-label">CONTENTS</div>
      <div class="nd-macguffins">
        ${node.macguffins.map((m) => `
          <div class="macguffin ${m.collected ? "collected" : ""}">
            <span class="mg-name">${m.name}</span>
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

  overlay.innerHTML = `
    <div class="end-box">
      <div class="end-title">${caught ? "▶ TRACED ◀" : "▶ RUN COMPLETE ◀"}</div>
      <div class="end-divider">════════════════════════</div>
      <div class="end-row">
        <span class="end-key">CASH EXTRACTED</span>
        <span class="end-val ${caught ? "end-zero" : ""}">¥${state.player.cash.toLocaleString()}</span>
      </div>
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
