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
  ];
}

// Update a single node's visual classes based on its state
export function updateNodeStyle(nodeId, nodeState) {
  if (!cy) return;
  const node = cy.getElementById(nodeId);
  if (!node) return;

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
