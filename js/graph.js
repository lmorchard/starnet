// Graph rendering and Cytoscape.js management

// Node type → shape mapping
const NODE_SHAPES = {
  "gateway":          "diamond",
  "router":           "ellipse",
  "firewall":         "pentagon",
  "workstation":      "ellipse",
  "ids":              "hexagon",
  "security-monitor": "hexagon",
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

export function initGraph(networkData, onNodeClick) {
  const elements = buildElements(networkData);

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

  cy.on("tap", "node", (evt) => {
    const nodeId = evt.target.id();
    onNodeClick(nodeId);
  });

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
    // Accessible nodes — base (cyan border)
    {
      selector: "node.accessible",
      style: {
        display: "element",
        width: 46,
        height: 46,
        "background-color": "#070710",
        "border-width": 2,
        "border-color": "#00ffff",
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
    // Alert state: yellow
    {
      selector: "node.accessible.alert-yellow",
      style: { "border-color": "#ffff00" },
    },
    // Alert state: red
    {
      selector: "node.accessible.alert-red",
      style: { "border-color": "#ff2020", "border-width": 3 },
    },
    // Access level fill
    {
      selector: "node.accessible.compromised",
      style: { "background-color": "#04041a" },
    },
    {
      selector: "node.accessible.owned",
      style: { "background-color": "#031208" },
    },
    // Selected node — magenta ring
    {
      selector: "node:selected",
      style: {
        "border-color": "#ff00ff",
        "border-width": 3,
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

    if (srcVisible && tgtVisible) {
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

export function addIceNode() {
  if (!cy) return;
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
    return;
  }

  const atNodeState = nodeStates[iceState.attentionNodeId];
  const isVisible =
    atNodeState?.accessLevel === "compromised" ||
    atNodeState?.accessLevel === "owned";

  if (isVisible) {
    const attentionCyNode = cy.getElementById(iceState.attentionNodeId);
    if (attentionCyNode && attentionCyNode.length > 0) {
      iceNode.style("display", "element");
      iceNode.animate({ position: attentionCyNode.position() }, { duration: 400 });
    }
  } else {
    iceNode.style("display", "none");
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
      { style: { "border-color": "#ffffff", "border-width": 5 } },
      { duration: 150, complete: () => {
        node.animate(
          { style: { "border-color": "#00ffff", "border-width": 2 } },
          { duration: 350, complete: () => node.removeStyle("border-color border-width") }
        );
      }}
    );
  } else if (type === "failure") {
    node.animate(
      { style: { "border-color": "#ff4040", "border-width": 5 } },
      { duration: 150, complete: () => {
        node.animate(
          { style: { "border-color": "#ff2020", "border-width": 3 } },
          { duration: 350, complete: () => node.removeStyle("border-color border-width") }
        );
      }}
    );
  } else if (type === "reveal") {
    node.animate(
      { style: { "border-color": "#00ffff", "border-width": 3, "background-color": "#0d2020" } },
      { duration: 250, complete: () => {
        node.animate(
          { style: { "border-color": "#223333", "border-width": 1, "background-color": "#0d0d14" } },
          { duration: 500, complete: () => node.removeStyle("border-color border-width background-color") }
        );
      }}
    );
  }
}
