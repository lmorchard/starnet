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
        width: 40,
        height: 40,
        "background-color": "#111",
        "border-width": 1,
        "border-color": "#334",
        "border-style": "dashed",
        label: "???",
        color: "#334",
        "font-family": "Courier New, monospace",
        "font-size": 9,
        "text-valign": "bottom",
        "text-margin-y": 4,
      },
    },
    // Accessible nodes (base style — per-node overrides via data)
    {
      selector: "node.accessible",
      style: {
        display: "element",
        width: 44,
        height: 44,
        "background-color": "#0a0a14",
        "border-width": 2,
        "border-color": "#00ffff",
        label: "data(label)",
        color: "#00ff41",
        "font-family": "Courier New, monospace",
        "font-size": 9,
        "text-valign": "bottom",
        "text-margin-y": 4,
        "text-outline-color": "#0a0a0f",
        "text-outline-width": 2,
      },
    },
    // Alert state overrides for accessible nodes
    {
      selector: "node.accessible.alert-yellow",
      style: {
        "border-color": "#ffff00",
      },
    },
    {
      selector: "node.accessible.alert-red",
      style: {
        "border-color": "#ff2020",
      },
    },
    // Access level fill overrides
    {
      selector: "node.accessible.compromised",
      style: { "background-color": "#050518" },
    },
    {
      selector: "node.accessible.owned",
      style: { "background-color": "#041408" },
    },
    // Selected node
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
    const sourceVisible = !cy.getElementById(edge.data("source")).hasClass("hidden");
    const targetVisible = !cy.getElementById(edge.data("target")).hasClass("hidden");
    if (sourceVisible && targetVisible) {
      edge.removeClass("hidden").addClass("visible");
    } else {
      edge.removeClass("visible").addClass("hidden");
    }
  });
}

export function getCy() {
  return cy;
}
