// @ts-nocheck — Cytoscape.js has no bundled types; skipping type checking for this file.
// Graph rendering and Cytoscape.js management

import { isIceVisible } from "./state.js";

// Node type → shape mapping
const NODE_SHAPES = {
  "gateway":          "diamond",
  "router":           "ellipse",
  "firewall":         "pentagon",
  "workstation":      "ellipse",
  "ids":              "hexagon",
  "security-monitor": "octagon",
  "fileserver":       "rectangle",
  "cryptovault":      "diamond",
};

// Grade → border color intensity
const GRADE_COLORS = {
  S: "#ff2020",
  A: "#ff6600",
  B: "#ffff00",
  C: "#00ffff",
  D: "#00ff41",
  F: "#336633",
};

let cy = null;
let prevIceNodeId = null;        // tracks ICE's last position for movement flash
let currentSelectedNodeId = null; // tracks selected node for reticle positioning
const pulsingNodes = new Set();       // nodeIds running red-alert pulse
const yellowPulsingNodes = new Set(); // nodeIds running yellow-alert pulse

function startRedPulse(node) {
  const id = node.id();
  if (pulsingNodes.has(id)) return;
  pulsingNodes.add(id);
  runRedPulse(node);
}

function stopRedPulse(node) {
  pulsingNodes.delete(node.id());
  node.stop();
  node.removeStyle("border-color border-width");
}

function runRedPulse(node) {
  const id = node.id();
  if (!pulsingNodes.has(id)) return;
  node.animate(
    { style: { "border-color": "#ff4040", "border-width": 3 } },
    { duration: 400, complete: () => {
      if (!pulsingNodes.has(id)) return;
      node.animate(
        { style: { "border-color": "#cc1100", "border-width": 2 } },
        { duration: 700, complete: () => runRedPulse(node) }
      );
    }}
  );
}

function startYellowPulse(node) {
  const id = node.id();
  if (yellowPulsingNodes.has(id)) return;
  yellowPulsingNodes.add(id);
  runYellowPulse(node);
}

function stopYellowPulse(node) {
  yellowPulsingNodes.delete(node.id());
  node.stop();
  node.removeStyle("border-color border-width");
}

function runYellowPulse(node) {
  const id = node.id();
  if (!yellowPulsingNodes.has(id)) return;
  node.animate(
    { style: { "border-color": "#cc8800", "border-width": 2 } },
    { duration: 900, complete: () => {
      if (!yellowPulsingNodes.has(id)) return;
      node.animate(
        { style: { "border-color": "#553300", "border-width": 2 } },
        { duration: 1200, complete: () => runYellowPulse(node) }
      );
    }}
  );
}

export function initGraph(networkData, onNodeClick, onBackgroundTap) {
  const elements = buildElements(networkData);

  // HACK: Cytoscape warns about wheelSensitivity being non-default; suppress that one specific warning.
  const _warn = console.warn;
  console.warn = (...args) => { if (!String(args[0]).includes("wheel sensitivity")) _warn(...args); };
  cy = window._cy = cytoscape({
    container: document.getElementById("cy"),
    elements,
    layout: { name: "preset" },
    style: buildStylesheet(),
    userZoomingEnabled: true,
    userPanningEnabled: true,
    boxSelectionEnabled: false,
    wheelSensitivity: 0.3,
  });
  console.warn = _warn;

  cy.on("tap", "node", (evt) => {
    evt.target.unselect(); // prevent Cytoscape native selection from conflicting with game state
    const nodeId = evt.target.id();
    onNodeClick(nodeId);
  });

  cy.on("tap", (evt) => {
    if (evt.target === cy && onBackgroundTap) onBackgroundTap();
  });

  cy.on("pan zoom", syncReticle);

  return cy;
}

function buildElements(networkData) {
  const nodes = networkData.nodes.map((n) => ({
    data: {
      id: n.id,
      label: n.label,
      type: n.type,
      grade: n.grade,
    },
    position: { x: n.x, y: n.y },
    classes: ["hidden"],
  }));

  const edges = networkData.edges.map((e, i) => ({
    data: {
      id: `edge-${i}`,
      source: e.source,
      target: e.target,
    },
    classes: ["hidden"],
  }));

  return [...nodes, ...edges];
}

function buildStylesheet() {
  return [
    // Default hidden state
    {
      selector: "node.hidden",
      style: { display: "none" },
    },
    // Revealed but not accessible
    {
      selector: "node.revealed",
      style: {
        display: "element",
        shape: "ellipse",
        width: 36,
        height: 36,
        "background-color": "#0d0d14",
        "border-width": 1,
        "border-color": "#223333",
        "border-style": "dashed",
        label: "???",
        color: "#224422",
        "font-family": "Courier New, monospace",
        "font-size": 8,
        "text-valign": "bottom",
        "text-margin-y": 5,
      },
    },
    // Accessible nodes — base (locked = dark/absent fill, quiet border)
    {
      selector: "node.accessible",
      style: {
        display: "element",
        width: 46,
        height: 46,
        "background-color": "#080810",
        "border-width": 1,
        "border-color": "#1a3333",
        label: "data(id)",
        color: "#00ff41",
        "font-family": "Courier New, monospace",
        "font-size": 9,
        "font-weight": "bold",
        "text-valign": "bottom",
        "text-margin-y": 6,
        "text-outline-color": "#0a0a0f",
        "text-outline-width": 2,
      },
    },
    // Access level — compromised (cyan fill = foothold)
    {
      selector: "node.accessible.compromised",
      style: {
        "background-color": "#0a2035",
      },
    },
    // Access level — owned (green fill = territory)
    {
      selector: "node.accessible.owned",
      style: {
        "background-color": "#0a2510",
        "border-width": 1,
      },
    },
    // Alert state: yellow — amber border (pulse driven by JS animation)
    {
      selector: "node.accessible.alert-yellow",
      style: {
        "border-color": "#996600",
        "border-width": 2,
      },
    },
    // Alert state: red — red border (pulse driven by JS animation)
    {
      selector: "node.accessible.alert-red",
      style: {
        "border-color": "#cc1100",
        "border-width": 2,
      },
    },
    // ICE entity node
    {
      selector: "node.ice",
      style: {
        shape: "star",
        width: 28,
        height: 28,
        "background-color": "#1a0010",
        "border-color": "#ff00aa",
        "border-width": 2,
        label: "ICE",
        color: "#ff00aa",
        "font-family": "Courier New, monospace",
        "font-size": 7,
        "font-weight": "bold",
        "text-valign": "bottom",
        "text-margin-y": 4,
        "z-index": 10,
      },
    },
    // ICE pulsing when docked on player's selected node
    {
      selector: "node.ice.docked",
      style: {
        "border-color": "#ff2020",
        "border-width": 4,
      },
    },
    // Trace-back waypoint nodes (hidden nodes revealed as part of ICE trace)
    {
      selector: "node.ice-traced",
      style: {
        display: "element",
        shape: "ellipse",
        width: 20,
        height: 20,
        "background-color": "#150010",
        "border-color": "#660033",
        "border-width": 1,
        "border-style": "dashed",
        label: "???",
        color: "#440022",
        "font-family": "Courier New, monospace",
        "font-size": 7,
        "text-valign": "bottom",
        "text-margin-y": 4,
      },
    },
    // ICE resident node — distinct hostile border
    {
      selector: "node.ice-resident",
      style: {
        "border-color": "#ff00aa",
        "border-width": 3,
      },
    },
    // Rebooting node — dimmed and dashed
    {
      selector: "node.rebooting",
      style: {
        "border-color": "#888800",
        "border-style": "dashed",
        opacity: 0.5,
      },
    },
    // Edges hidden
    {
      selector: "edge.hidden",
      style: { display: "none" },
    },
    // Edges visible
    {
      selector: "edge.visible",
      style: {
        display: "element",
        "line-color": "#0a4433",
        "target-arrow-color": "#0a4433",
        "target-arrow-shape": "triangle",
        "curve-style": "bezier",
        width: 1.5,
        opacity: 0.7,
      },
    },
    // Edges between owned nodes — brighter
    {
      selector: "edge.owned-path",
      style: {
        "line-color": "#00ff41",
        "target-arrow-color": "#00ff41",
        opacity: 0.5,
        width: 2,
      },
    },
    // ICE trace-back path edges
    {
      selector: "edge.ice-trace",
      style: {
        display: "element",
        "line-color": "#440033",
        "line-style": "dashed",
        "target-arrow-shape": "none",
        width: 1,
        opacity: 0.6,
      },
    },
  ];
}

// Update a single node's visual classes based on its state
export function updateNodeStyle(nodeId, nodeState) {
  if (!cy) return;
  const node = cy.getElementById(nodeId);
  if (!node) return;

  // Rebooting state
  if (nodeState.rebooting) {
    node.addClass("rebooting");
  } else {
    node.removeClass("rebooting");
  }

  // Visibility class
  node.removeClass("hidden revealed accessible");
  node.addClass(nodeState.visibility);

  if (nodeState.visibility === "accessible") {
    // Access level
    node.removeClass("compromised owned");
    if (nodeState.accessLevel !== "locked") {
      node.addClass(nodeState.accessLevel);
    }

    // Alert state
    node.removeClass("alert-yellow alert-red");
    if (nodeState.alertState === "yellow") node.addClass("alert-yellow");
    if (nodeState.alertState === "red") node.addClass("alert-red");

    // Alert pulse animations (shadow-blur is invalid in Cytoscape; use bg/border instead)
    if (nodeState.alertState === "red") {
      if (yellowPulsingNodes.has(nodeId)) stopYellowPulse(node);
      startRedPulse(node);
    } else if (nodeState.alertState === "yellow") {
      if (pulsingNodes.has(nodeId)) stopRedPulse(node);
      startYellowPulse(node);
    } else {
      if (pulsingNodes.has(nodeId)) stopRedPulse(node);
      if (yellowPulsingNodes.has(nodeId)) stopYellowPulse(node);
    }

    // Shape by node type
    const networkNode = cy.getElementById(nodeId);
    const type = networkNode.data("type");
    const shape = NODE_SHAPES[type] || "ellipse";
    node.style("shape", shape);
  }

  // Show/hide connected edges when a node becomes accessible
  updateEdgeVisibility();
}

function updateEdgeVisibility() {
  cy.edges().forEach((edge) => {
    const src = cy.getElementById(edge.data("source"));
    const tgt = cy.getElementById(edge.data("target"));
    const srcVisible = !src.hasClass("hidden");
    const tgtVisible = !tgt.hasClass("hidden");
    // Require at least one accessible endpoint — don't reveal edges between two ??? nodes
    const srcAccessible = src.hasClass("accessible");
    const tgtAccessible = tgt.hasClass("accessible");

    if (srcVisible && tgtVisible && (srcAccessible || tgtAccessible)) {
      edge.removeClass("hidden").addClass("visible");
      // Highlight path between two owned nodes
      if (src.hasClass("owned") && tgt.hasClass("owned")) {
        edge.addClass("owned-path");
      } else {
        edge.removeClass("owned-path");
      }
    } else {
      edge.removeClass("visible owned-path").addClass("hidden");
    }
  });
}

export function getCy() {
  return cy;
}

export function syncSelection(nodeId) {
  if (!cy) return;
  currentSelectedNodeId = nodeId || null;
  syncReticle();
}

function syncReticle() {
  const svg = document.getElementById("selection-reticle");
  if (!svg) return;

  if (!currentSelectedNodeId || !cy) {
    svg.style.display = "none";
    return;
  }

  const node = cy.getElementById(currentSelectedNodeId);
  if (!node || node.length === 0) {
    svg.style.display = "none";
    return;
  }

  const pos = node.renderedPosition();
  const r = (node.renderedWidth() / 2) + 12; // node radius + gap
  const size = r * 2;

  const ring = document.getElementById("reticle-ring");
  ring.setAttribute("cx", r);
  ring.setAttribute("cy", r);
  ring.setAttribute("r", r - 2);

  svg.style.width  = `${size}px`;
  svg.style.height = `${size}px`;
  svg.style.left   = `${pos.x - r}px`;
  svg.style.top    = `${pos.y - r}px`;
  svg.style.display = "block";
}

export function addIceNode() {
  if (!cy) return;
  prevIceNodeId = null;
  if (cy.getElementById("ice-0").length > 0) return; // already added
  cy.add({
    data: { id: "ice-0", label: "ICE" },
    position: { x: 0, y: 0 },
    classes: ["ice"],
  });
  // ICE node should not respond to clicks like network nodes
  cy.getElementById("ice-0").ungrabify();
}

export function syncIceGraph(iceState, nodeStates) {
  if (!cy || !iceState) return;
  const iceNode = cy.getElementById("ice-0");
  if (!iceNode || iceNode.length === 0) return;

  if (!iceState.active) {
    iceNode.style("display", "none");
    clearIceTrace();
    prevIceNodeId = null;
    return;
  }

  // Detect movement before updating prevIceNodeId
  const moved = prevIceNodeId !== null && prevIceNodeId !== iceState.attentionNodeId;
  const fromId = prevIceNodeId;
  prevIceNodeId = iceState.attentionNodeId;

  const atNodeState = nodeStates[iceState.attentionNodeId];
  const isVisible = isIceVisible(iceState, nodeStates);

  if (isVisible) {
    const attentionCyNode = cy.getElementById(iceState.attentionNodeId);
    if (attentionCyNode && attentionCyNode.length > 0) {
      iceNode.style("display", "element");
      if (moved) {
        iceNode.animate({ position: attentionCyNode.position() }, { duration: 400 });
      }
    }
  } else {
    iceNode.style("display", "none");
  }

  // Flash movement path along edges (staggered, fog-of-war respecting)
  if (moved && fromId) {
    flashIcePath(fromId, iceState.attentionNodeId);
    // Pulse the ICE node on arrival — especially visible when materializing from dark territory
    if (isVisible) {
      setTimeout(() => {
        iceNode.animate(
          { style: { width: 42, height: 42, "border-width": 5 } },
          { duration: 120, complete: () => iceNode.animate(
            { style: { width: 28, height: 28, "border-width": 2 } },
            { duration: 300, complete: () => iceNode.removeStyle("width height border-width") }
          )}
        );
      }, 100); // slight delay so position animation starts first
    }
  }

  // Trace-back path: only when attention is on an owned node
  clearIceTrace();
  const isOwned = atNodeState?.accessLevel === "owned";
  if (isVisible && isOwned && iceState.residentNodeId !== iceState.attentionNodeId) {
    drawIceTrace(iceState.attentionNodeId, iceState.residentNodeId, nodeStates);
  }
}

function clearIceTrace() {
  cy.nodes(".ice-traced").removeClass("ice-traced");
  cy.nodes(".ice-resident").removeClass("ice-resident");
  cy.edges(".ice-trace").removeClass("ice-trace");
}

// Flash edges along the BFS path from fromId to toId, staggered per hop.
// Only flashes edges that are currently visible (respects fog of war).
function flashIcePath(fromId, toId) {
  // BFS: find shortest path, recording edge objects
  const visited = new Map([[fromId, { prev: null, edge: null }]]);
  const queue = [fromId];
  let found = false;

  outer: while (queue.length) {
    const cur = queue.shift();
    for (const edge of cy.edges()) {
      const s = edge.data("source");
      const t = edge.data("target");
      let neighbor = null;
      if (s === cur && !visited.has(t)) neighbor = t;
      else if (t === cur && !visited.has(s)) neighbor = s;
      if (neighbor !== null) {
        visited.set(neighbor, { prev: cur, edge });
        if (neighbor === toId) { found = true; break outer; }
        queue.push(neighbor);
      }
    }
  }

  if (!found) return;

  // Reconstruct ordered edge list (from → to direction)
  const pathEdges = [];
  let cur = toId;
  while (cur !== fromId) {
    const { prev, edge } = visited.get(cur);
    pathEdges.unshift(edge);
    cur = prev;
  }

  // Flash each edge in sequence; skip edges that are hidden (fog of war)
  pathEdges.forEach((edge, i) => {
    if (edge.hasClass("hidden")) return;
    setTimeout(() => {
      edge.animate(
        { style: { "line-color": "#ff00aa", width: 3, opacity: 1 } },
        { duration: 150, complete: () => edge.animate(
          { style: { "line-color": "#440033", width: 1.5, opacity: 0.4 } },
          { duration: 400, complete: () => edge.removeStyle("line-color width opacity") }
        )}
      );
    }, i * 100);
  });
}

function drawIceTrace(fromId, toId, nodeStates) {
  // BFS to find shortest path from attention focus back to resident node
  const visited = new Map([[fromId, null]]); // node → predecessor
  const queue = [fromId];
  let found = false;

  while (queue.length && !found) {
    const cur = queue.shift();
    for (const edge of cy.edges()) {
      const s = edge.data("source");
      const t = edge.data("target");
      let neighbor = null;
      if (s === cur && !visited.has(t)) neighbor = t;
      else if (t === cur && !visited.has(s)) neighbor = s;
      if (neighbor !== null) {
        visited.set(neighbor, cur);
        if (neighbor === toId) { found = true; break; }
        queue.push(neighbor);
      }
    }
  }

  if (!found) return;

  // Walk path from toId back to fromId, marking waypoints and edges
  let cur = toId;
  while (cur && cur !== fromId) {
    const cyNode = cy.getElementById(cur);
    if (cyNode.length > 0) {
      if (cyNode.hasClass("hidden")) {
        // Reveal hidden nodes along the path as traced waypoints
        cyNode.addClass("ice-traced");
      }
    }
    const prev = visited.get(cur);
    if (prev !== undefined && prev !== null) {
      cy.edges().filter((e) => {
        const s = e.data("source");
        const t = e.data("target");
        return (s === prev && t === cur) || (s === cur && t === prev);
      }).addClass("ice-trace");
    }
    cur = prev;
  }

  // Mark the resident node distinctly
  cy.getElementById(toId).addClass("ice-resident");
}

// Flash a node with a brief animated pulse.
// type: 'success' (cyan→white→cyan), 'failure' (red flash), 'reveal' (dim cyan pulse)
export function flashNode(nodeId, type) {
  if (!cy) return;
  const node = cy.getElementById(nodeId);
  if (!node || node.length === 0) return;

  if (type === "success") {
    node.animate(
      { style: { "background-color": "#0d3a3a" } },
      { duration: 150, complete: () => {
        node.animate(
          { style: { "background-color": "#041820" } },
          { duration: 350, complete: () => node.removeStyle("background-color") }
        );
      }}
    );
  } else if (type === "failure") {
    node.animate(
      { style: { "background-color": "#2a0505" } },
      { duration: 150, complete: () => {
        node.animate(
          { style: { "background-color": "#150202" } },
          { duration: 350, complete: () => node.removeStyle("background-color") }
        );
      }}
    );
  } else if (type === "reveal") {
    node.animate(
      { style: { "background-color": "#061525" } },
      { duration: 250, complete: () => {
        node.animate(
          { style: { "background-color": "#080810" } },
          { duration: 500, complete: () => node.removeStyle("background-color") }
        );
      }}
    );
  }
}
