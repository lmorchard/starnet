// @ts-nocheck — Cytoscape.js has no bundled types; skipping type checking for this file.
// Graph rendering and Cytoscape.js management

import { isIceVisible, isObscured } from "../core/state.js";
import { CONTAINER_POLYGON_POINTS, nodeFaceDataUri } from "./node-glyphs.js";
import { iceStrikeCage } from "./ice-glyphs.js";
import { ringPoints } from "./overlays/facet.js";

// Still playing with what might be the best default here
// const DEFAULT_LAYOUT_ALGO = "breadthfirst";
// const DEFAULT_LAYOUT_ALGO = "dagre";
const DEFAULT_LAYOUT_ALGO = "cola";

// Node type → glyph/shape now lives in node-glyphs.js. Every node renders as a
// common dodecagon container (state on border/fill) + an ideographic glyph
// background-image (type identity). See issue #126.

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
// Action overlay animations (probe/mine/read/loot/exploit/ICE) now live as
// NodeOverlay custom elements driven by visual-renderer + the preview harness.
// graph.js stays ignorant of them; it only re-anchors registered overlays on
// viewport change via the listeners below.
const viewportListeners = [];
/** Register a callback fired on every pan/zoom (e.g. to re-anchor overlays). */
export function onViewport(fn) { viewportListeners.push(fn); }
// The selection reticle is a NodeOverlay element mounted by the UI layer and
// registered here, so graph.js can drive it from selection without importing it.
let _reticleOverlay = null;
/** @param {any} el */
export function setReticleOverlay(el) { _reticleOverlay = el; }
const pulsingNodes = new Set();       // nodeIds running red-alert pulse
const yellowPulsingNodes = new Set(); // nodeIds running yellow-alert pulse
const rebootingNodes = new Set();     // nodeIds running reboot opacity pulse

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

// Thin strobe blink (not a fattening breathe): a thin constant-width border that
// flickers bright→dim, so under the global bloom it reads as a vector alarm
// strobe rather than a throbbing halo. Red strobes fast (urgent).
function runRedPulse(node) {
  const id = node.id();
  if (!pulsingNodes.has(id)) return;
  node.animate(
    { style: { "border-color": "#ff3030", "border-width": 1.5 } },
    { duration: 220, complete: () => {
      if (!pulsingNodes.has(id)) return;
      node.animate(
        { style: { "border-color": "#5a1010", "border-width": 1.5 } },
        { duration: 420, complete: () => runRedPulse(node) }
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

// Yellow strobes slower/softer than red (lower urgency), same thin-blink idea.
function runYellowPulse(node) {
  const id = node.id();
  if (!yellowPulsingNodes.has(id)) return;
  node.animate(
    { style: { "border-color": "#ffcc00", "border-width": 1.5 } },
    { duration: 480, complete: () => {
      if (!yellowPulsingNodes.has(id)) return;
      node.animate(
        { style: { "border-color": "#4a3800", "border-width": 1.5 } },
        { duration: 720, complete: () => runYellowPulse(node) }
      );
    }}
  );
}

function startRebootPulse(node) {
  const id = node.id();
  if (rebootingNodes.has(id)) return;
  rebootingNodes.add(id);
  runRebootPulse(node);
}

function stopRebootPulse(node) {
  rebootingNodes.delete(node.id());
  node.stop();
  node.removeStyle("opacity");
}

function runRebootPulse(node) {
  const id = node.id();
  if (!rebootingNodes.has(id)) return;
  node.animate(
    { style: { opacity: 0.2 } },
    { duration: 1000, complete: () => {
      if (!rebootingNodes.has(id)) return;
      node.animate(
        { style: { opacity: 0.55 } },
        { duration: 1200, complete: () => runRebootPulse(node) }
      );
    }}
  );
}

// Full network topology — stored for deferred node addition.
// Nodes are only added to Cytoscape when they become visible.
let _networkNodes = new Map();  // id → { id, label, type, grade }
let _networkEdges = [];         // [{ source, target }]

// Bloom is a central, runtime-adjustable rendering property. These are the base
// blur radii (px); the wide halo (b1) is merged twice for the phosphor blowout,
// a tight inner glow (b2) sits under the crisp source. setBloomIntensity() scales
// them live — the seam for future deck-damage degradation (crank bloom toward
// illegible as the deck takes injury). When that lands, the multiplier's source
// of truth belongs in game state; this module just applies it.
const BLOOM_WIDE = 5;
const BLOOM_TIGHT = 2;
let bloomIntensity = 1;

/**
 * Inject the shared SVG bloom <filter> into the DOM once. All entrypoints call
 * initGraph(), so this covers index / preview / playground without per-file edits.
 * The filter is a two-radius Gaussian blur merged under the crisp source — a
 * blurred copy beneath the original, i.e. colored phosphor halo.
 */
function ensureBloomFilter() {
  if (document.getElementById("starnet-bloom-defs")) return;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("id", "starnet-bloom-defs");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.setAttribute("aria-hidden", "true");
  svg.style.position = "absolute";
  svg.innerHTML =
    '<filter id="starnet-bloom" x="-80%" y="-80%" width="260%" height="260%">' +
    `<feGaussianBlur in="SourceGraphic" stdDeviation="${BLOOM_WIDE * bloomIntensity}" result="b1"/>` +
    `<feGaussianBlur in="SourceGraphic" stdDeviation="${BLOOM_TIGHT * bloomIntensity}" result="b2"/>` +
    '<feMerge><feMergeNode in="b1"/><feMergeNode in="b1"/><feMergeNode in="b2"/><feMergeNode in="SourceGraphic"/></feMerge>' +
    '</filter>';
  document.body.appendChild(svg);
  // Expose for live experimentation / future deck-damage hookup.
  if (typeof window !== "undefined") window.setBloomIntensity = setBloomIntensity;
}

/**
 * Set the bloom intensity multiplier (1 = default vector-CRT bloom). Higher
 * widens the halo toward illegibility — the hook for deck-damage degradation.
 * Updates the live filter immediately; no graph re-init needed.
 * @param {number} mult
 */
export function setBloomIntensity(mult) {
  bloomIntensity = Math.max(0, mult);
  const filter = document.getElementById("starnet-bloom");
  if (!filter) return;
  const blurs = filter.querySelectorAll("feGaussianBlur");
  if (blurs[0]) blurs[0].setAttribute("stdDeviation", String(BLOOM_WIDE * bloomIntensity));
  if (blurs[1]) blurs[1].setAttribute("stdDeviation", String(BLOOM_TIGHT * bloomIntensity));
}

/** @returns {number} current bloom intensity multiplier (1 = default). */
export function getBloomIntensity() {
  return bloomIntensity;
}

export function initGraph(networkData, onNodeClick, onBackgroundTap) {
  ensureBloomFilter();
  // Store full topology for deferred node addition
  _networkNodes = new Map();
  for (const n of networkData.nodes) {
    _networkNodes.set(n.id, { id: n.id, label: n.label, type: n.type, grade: n.grade });
  }
  _networkEdges = networkData.edges;

  // Start empty — nodes are added as they become visible
  const _warn = console.warn;
  console.warn = (...args) => { if (!String(args[0]).includes("wheel sensitivity")) _warn(...args); };
  cy = window._cy = cytoscape({
    container: document.getElementById("cy"),
    elements: [],
    layout: { name: "preset" },
    style: buildStylesheet(),
    userZoomingEnabled: true,
    userPanningEnabled: true,
    boxSelectionEnabled: false,
    wheelSensitivity: 1.0,
    // Clamp so that it's not easy to lose the graph in the void on zoom
    minZoom: 0.5,
    maxZoom: 3.0,
  });
  console.warn = _warn;

  // Cytoscape 3.33 ships no `nodeShapes` registry entry for the generic
  // `polygon` shape name (custom polygons are keyed internally by their
  // points), yet the border/outline miter-bounds code looks the name up
  // directly — so a bordered `shape: "polygon"` node crashes in boundingBox
  // (`nodeShapes['polygon']` is undefined → `.hasMiterBounds`). Every node here
  // uses the same dodecagon container, so register that fixed dodecagon under
  // the `polygon` name now, before any nodes or layout exist. This touches
  // Cytoscape internals and is pinned to the bundled cytoscape@3.33.x. See #126.
  const nodeShapes = cy.renderer()?.nodeShapes;
  if (nodeShapes?.makePolygon) {
    nodeShapes.polygon = nodeShapes.makePolygon(
      CONTAINER_POLYGON_POINTS.split(/\s+/).map(Number)
    );
  }

  cy.on("tap", "node", (evt) => {
    evt.target.unselect(); // prevent Cytoscape native selection from conflicting with game state
    const nodeId = evt.target.id();
    onNodeClick(nodeId);
  });

  cy.on("tap", (evt) => {
    if (evt.target === cy && onBackgroundTap) onBackgroundTap();
  });

  // Reposition overlays when nodes are dragged
  cy.on("position", "node", () => {
    _repositionIceOverlay();
    for (const fn of viewportListeners) fn();
  });

  const graphContainer = document.getElementById("graph-container");
  const onPanZoom = () => {
    for (const fn of viewportListeners) fn();
    const pan = cy.pan();
    const zoom = cy.zoom();
    const size = 40 * zoom;
    graphContainer.style.backgroundSize = `${size}px ${size}px`;
    graphContainer.style.backgroundPosition = `${pan.x}px ${pan.y}px`;
    // Reposition ICE overlay on pan/zoom
    _repositionIceOverlay();
  };
  cy.on("pan zoom", onPanZoom);
  onPanZoom();

  // Keep the zoom-out floor pinned to "all nodes visible" as the graph grows
  // (nodes/edges added on reveal, layout settles) or the container resizes.
  cy.on("add remove layoutstop", updateZoomFloor);
  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => { cy.resize(); updateZoomFloor(); });
    ro.observe(graphContainer);
  }
  updateZoomFloor();

  _trackUserViewportInteractions();

  return cy;
}

/**
 * Add all initially visible nodes to the graph after initGame,
 * then apply full styling so edges and visual classes are correct.
 * @param {Object<string, { id: string, visibility: string }>} nodes
 */
export function syncInitialNodes(nodes) {
  for (const node of Object.values(nodes)) {
    if (node.visibility !== "hidden") {
      ensureNodeInGraph(node.id, node.visibility);
    }
  }
  // Apply full styling now that all initial nodes + edges are present
  for (const node of Object.values(nodes)) {
    if (node.visibility !== "hidden") {
      updateNodeStyle(node.id, node);
    }
  }
}

/**
 * Reset the graph to empty and re-point it at a (possibly different) topology.
 * Reuses the existing cy instance — clears all elements rather than destroying
 * cy, so there's no teardown/leak. Call before syncInitialNodes when starting a
 * fresh run (first boot, run-again, hub launch); a no-op if cy isn't built yet.
 * @param {{ nodes: {id:string,label:string,type:string,grade:string}[], edges: {source:string,target:string}[] }} networkData
 */
export function resetGraph(networkData) {
  if (!cy) return;
  cy.elements().remove();
  _networkNodes = new Map();
  for (const n of networkData.nodes) {
    _networkNodes.set(n.id, { id: n.id, label: n.label, type: n.type, grade: n.grade });
  }
  _networkEdges = networkData.edges;
}

/**
 * Add a node to the Cytoscape graph when it becomes visible.
 * Also adds edges to any already-present neighbors.
 * @param {string} nodeId
 * @param {string} visibilityClass - "revealed" or "accessible"
 */
export function ensureNodeInGraph(nodeId, visibilityClass) {
  if (!cy) return;
  // Already in graph?
  if (cy.getElementById(nodeId).length > 0) return;
  // Known node?
  const ndata = _networkNodes.get(nodeId);
  if (!ndata) return;

  // Find an already-present neighbor to spawn near
  let spawnPos = { x: cy.width() / 2, y: cy.height() / 2 };
  for (const e of _networkEdges) {
    const neighborId = e.source === nodeId ? e.target : e.target === nodeId ? e.source : null;
    if (!neighborId) continue;
    const neighborCy = cy.getElementById(neighborId);
    if (neighborCy.length > 0) {
      const np = neighborCy.position();
      // Offset slightly with jitter so overlapping reveals don't pile up
      spawnPos = { x: np.x + (Math.random() - 0.5) * 60, y: np.y + 50 + Math.random() * 30 };
      break;
    }
  }

  // Add the node near its neighbor
  cy.add({
    data: { id: ndata.id, label: ndata.label, type: ndata.type, grade: ndata.grade },
    position: spawnPos,
    classes: [visibilityClass],
  });

  // Add edges to any already-present neighbors
  _networkEdges.forEach((e, i) => {
    const src = e.source;
    const tgt = e.target;
    const edgeId = `edge-${src}-${tgt}`;
    if (cy.getElementById(edgeId).length > 0) return; // already added
    if ((src === nodeId && cy.getElementById(tgt).length > 0) ||
        (tgt === nodeId && cy.getElementById(src).length > 0)) {
      cy.add({
        data: { id: edgeId, source: src, target: tgt },
        classes: ["visible"],
      });
    }
  });
}

function buildStylesheet() {
  return [
    // Revealed but not accessible
    {
      selector: "node.revealed",
      style: {
        display: "element",
        shape: "polygon",
        "shape-polygon-points": CONTAINER_POLYGON_POINTS,
        width: 36,
        height: 36,
        "background-color": "transparent",
        "border-width": 1,
        "border-color": "#223333",
        "border-style": "dashed",
        label: "data(sigAlias)",
        color: "#224422",
        "font-family": "Hershey Futura Duplex, Courier New, monospace",
        "font-size": 11,
        "text-valign": "bottom",
        "text-margin-y": 5,
      },
    },
    // Accessible nodes — base (locked = dark fill, readable against bg #0a0a0f)
    {
      selector: "node.accessible",
      style: {
        display: "element",
        shape: "polygon",
        "shape-polygon-points": CONTAINER_POLYGON_POINTS,
        "background-image-opacity": 1,
        "background-fit": "none",
        "background-width": "100%",
        "background-height": "100%",
        "background-position-x": "50%",
        "background-position-y": "50%",
        "background-clip": "none",
        width: 46,
        height: 46,
        "background-color": "transparent",
        "border-width": 1,
        "border-color": "#1a3333",
        label: "data(id)",
        color: "#00ff41",
        "font-family": "Hershey Futura Duplex, Courier New, monospace",
        "font-size": 12,
        "font-weight": "bold",
        "text-valign": "bottom",
        "text-margin-y": 6,
        "text-outline-color": "#0a0a0f",
        "text-outline-width": 2,
      },
    },
    // Alert state: yellow — thin amber border (strobe-blinked by JS animation)
    {
      selector: "node.accessible.alert-yellow",
      style: {
        "border-color": "#996600",
        "border-width": 1.5,
      },
    },
    // Alert state: red — thin red border (strobe-blinked by JS animation)
    {
      selector: "node.accessible.alert-red",
      style: {
        "border-color": "#cc1100",
        "border-width": 1.5,
      },
    },
    // Obscured — identity hidden behind sig-N alias until probed. Keeps the
    // accessible styling (so reachability reads) but shows the alias, not the id.
    // Placed after node.accessible so this label rule wins. The glyph
    // background-image is cleared in updateNodeStyle() so the node type isn't
    // telegraphed (the dodecagon container shows, but no identifying glyph).
    {
      selector: "node.obscured",
      style: {
        label: "data(sigAlias)",
      },
    },
    // (ICE is now an HTML overlay, not a Cytoscape node)
    // Trace-back waypoint nodes (hidden nodes revealed as part of ICE trace)
    {
      selector: "node.ice-traced",
      style: {
        display: "element",
        shape: "polygon",
        "shape-polygon-points": CONTAINER_POLYGON_POINTS,
        width: 20,
        height: 20,
        "background-color": "transparent",
        "border-color": "#aa0066",
        "border-width": 1,
        "border-style": "dashed",
        label: "???",
        color: "#440022",
        "font-family": "Hershey Futura Duplex, Courier New, monospace",
        "font-size": 10,
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
    // Rebooting node — dashed border; opacity animated by JS reboot pulse
    {
      selector: "node.rebooting",
      style: {
        "border-color": "#888800",
        "border-style": "dashed",
      },
    },
    // Edges between revealed-only nodes — very dim
    {
      selector: "edge.hidden",
      style: {
        "line-color": "#112222",
        "target-arrow-shape": "none",
        "curve-style": "straight",
        width: 1,
        opacity: 0.2,
      },
    },
    // Edges visible
    {
      selector: "edge.visible",
      style: {
        display: "element",
        "line-color": "#0a4433",
        "target-arrow-shape": "none",
        "curve-style": "straight",
        width: 1.5,
        opacity: 0.7,
      },
    },
    // Edges between owned nodes — brighter
    {
      selector: "edge.owned-path",
      style: {
        "line-color": "#00ff41",
        opacity: 0.5,
        width: 2,
      },
    },
    // ICE trace-back path edges
    {
      selector: "edge.ice-trace",
      style: {
        display: "element",
        "line-color": "#cc0077",
        "line-style": "dashed",
        "target-arrow-shape": "none",
        width: 1.5,
        opacity: 0.8,
      },
    },
  ];
}

// Update a single node's visual classes based on its state
export function updateNodeStyle(nodeId, nodeState) {
  if (!cy) return;

  // If the node just became visible, add it to the Cytoscape graph
  if (nodeState.visibility !== "hidden") {
    ensureNodeInGraph(nodeId, nodeState.visibility);
  }

  const node = cy.getElementById(nodeId);
  if (!node || node.length === 0) return;

  // Rebooting state
  if (nodeState.rebooting) {
    node.addClass("rebooting");
    startRebootPulse(node);
  } else {
    node.removeClass("rebooting");
    stopRebootPulse(node);
  }

  // Visibility class
  node.removeClass("hidden revealed accessible");
  node.addClass(nodeState.visibility);

  // Obscured: identity (id/label/type) hidden behind the sig-N alias until probed.
  // The node.obscured stylesheet rule swaps the label to data(sigAlias); the
  // glyph background-image is cleared below to keep the type from being telegraphed.
  const obscured = isObscured(nodeState);
  node.toggleClass("obscured", obscured);
  // Populate the alias label for any node whose label is driven by data(sigAlias):
  // obscured nodes (sig-N), and `revealed` nodes that lack an alias (e.g. set-piece
  // reveals via revealNode) which fall back to "???".
  if (obscured || nodeState.visibility === "revealed") {
    node.data("sigAlias", nodeState.sigAlias ?? "???");
  }

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

    // Glyph by node type — but an obscured node shows the bare dodecagon (no
    // glyph) so its type isn't telegraphed before it's probed. The container
    // shape itself is the dodecagon for all nodes (set in the stylesheet);
    // type identity rides on this glyph image, state stays on border/fill.
    const type = node.data("type");
    node.style("background-image", obscured ? "none" : nodeFaceDataUri(type, nodeState.accessLevel));
  }

  // Show/hide connected edges when a node becomes accessible
  updateEdgeVisibility();
}

function updateEdgeVisibility() {
  if (!cy) return;
  cy.edges().forEach((edge) => {
    const src = cy.getElementById(edge.data("source"));
    const tgt = cy.getElementById(edge.data("target"));
    if (src.length === 0 || tgt.length === 0) return;
    const srcAccessible = src.hasClass("accessible");
    const tgtAccessible = tgt.hasClass("accessible");
    // Only show edge if at least one endpoint is accessible
    if (srcAccessible || tgtAccessible) {
      edge.removeClass("hidden").addClass("visible");
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

/** Debounce timer for select-and-fit. */
let _selectFitTimer = null;

/** Timestamp of last user-initiated pan/zoom (mouse drag, scroll wheel, pinch). */
let _lastUserViewportInteraction = 0;
const USER_VIEWPORT_COOLDOWN_MS = 1000;

/** Call once after cy is created to track user viewport interactions. */
function _trackUserViewportInteractions() {
  const container = document.getElementById("cy");
  if (!container) return;
  const mark = () => { _lastUserViewportInteraction = Date.now(); };
  // Wheel = scroll zoom (clear viewport intent)
  container.addEventListener("wheel", mark, { passive: true });
  // Track drag (pan) via pointermove with distance threshold — plain clicks
  // involve tiny sub-pixel movement that should NOT suppress auto-fit.
  let dragStart = null;
  const DRAG_THRESHOLD = 5; // px — must move at least this far to count as a drag
  container.addEventListener("pointerdown", (e) => { dragStart = { x: e.clientX, y: e.clientY }; });
  container.addEventListener("pointermove", (e) => {
    if (!dragStart) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    if (dx * dx + dy * dy > DRAG_THRESHOLD * DRAG_THRESHOLD) mark();
  });
  container.addEventListener("pointerup", () => { dragStart = null; });
  container.addEventListener("pointercancel", () => { dragStart = null; });
  // Pinch zoom on touch
  container.addEventListener("touchmove", mark, { passive: true });
}

/**
 * @param {string|null} nodeId
 * @param {boolean} [forceRefit] - re-run fit even if selection hasn't changed (e.g. after node reveal)
 */
export function syncSelection(nodeId, forceRefit = false) {
  if (!cy) return;
  const prevSelected = currentSelectedNodeId;
  currentSelectedNodeId = nodeId || null;
  if (_reticleOverlay) {
    if (currentSelectedNodeId) _reticleOverlay.sync(currentSelectedNodeId, 0);
    else _reticleOverlay.clear();
  }

  // Select-and-fit: pan + zoom to fit selected node + 2-hop neighborhood.
  // Yields to manual control — skips if user panned/zoomed within cooldown.
  // Only clear/set the timer when selection actually changes to a new node,
  // unless forceRefit is set (e.g. after new nodes settle from a reveal).
  const selectionChanged = nodeId && nodeId !== prevSelected;
  if ((selectionChanged || forceRefit) && nodeId && cy.getElementById(nodeId).length > 0) {
    if (_selectFitTimer) clearTimeout(_selectFitTimer);
    _selectFitTimer = setTimeout(() => {
      _selectFitTimer = null;
      if (!cy || currentSelectedNodeId !== nodeId) return;
      // Respect manual viewport control
      if (Date.now() - _lastUserViewportInteraction < USER_VIEWPORT_COOLDOWN_MS) return;
      const node = cy.getElementById(nodeId);
      if (!node || node.length === 0) return;
      // Collect selected node + 2 hops of visible neighbors for context
      const visible = "node.accessible, node.revealed";
      let neighborhood = node.neighborhood(visible).add(node);
      const hop2 = neighborhood.neighborhood(visible);
      neighborhood = neighborhood.add(hop2);
      if (neighborhood.length > 0) {
        cy.stop();
        cy.animate({
          fit: { eles: neighborhood, padding: 50 },
          duration: 400,
          easing: "ease-in-out-cubic",
        });
      }
    }, 150);
  }
}

/** @type {HTMLElement|null} */
let _iceOverlay = null;

/** Reposition and scale ICE overlay to track its attention node (no animation). */
function _repositionIceOverlay() {
  if (!_iceOverlay || !cy || !prevIceNodeId) return;
  if (_iceOverlay.style.opacity === "0") return;
  const node = cy.getElementById(prevIceNodeId);
  if (node.length === 0) return;
  const rp = node.renderedPosition();
  _iceOverlay.style.left = `${rp.x}px`;
  _iceOverlay.style.top = `${rp.y}px`;
  _iceOverlay.style.transform = `scale(${cy.zoom()})`;
}

/**
 * ICE is rendered as an HTML overlay positioned over the Cytoscape canvas.
 * Not a Cytoscape node — avoids layout interference and shape rendering bugs.
 */
export function addIceNode() {
  prevIceNodeId = null;
  if (_iceOverlay) return;

  const container = document.getElementById("cy");
  if (!container) return;

  const el = document.createElement("div");
  el.id = "ice-overlay";
  el.classList.add("ice-presence");   // hook for the menace-pulse animation
  el.style.cssText = `
    position: absolute; pointer-events: none; z-index: 10;
    width: 35px; height: 35px; margin-left: -17.5px; margin-top: -28px;
    overflow: visible;
    transition: opacity 0.3s ease;
    opacity: 0;
  `;
  // Angular "Strike Cage" predator form (red), crouched over the node. Stroke-only
  // vector glyph — see ice-glyphs.js and the no-curves design principle.
  el.innerHTML = iceStrikeCage();
  container.style.position = "relative";
  container.appendChild(el);
  _iceOverlay = el;
}

export function syncIceGraph(iceState, nodeStates, selectedNodeId = null) {
  if (!cy || !iceState || !_iceOverlay) return;

  if (!iceState.active) {
    _iceOverlay.style.opacity = "0";
    clearIceTrace();
    prevIceNodeId = null;
    return;
  }

  const moved = prevIceNodeId !== null && prevIceNodeId !== iceState.attentionNodeId;
  const fromId = prevIceNodeId;
  prevIceNodeId = iceState.attentionNodeId;

  const atNodeState = nodeStates[iceState.attentionNodeId];
  const isVisible = isIceVisible(iceState, nodeStates, selectedNodeId);

  if (isVisible) {
    const attentionCyNode = cy.getElementById(iceState.attentionNodeId);
    if (attentionCyNode && attentionCyNode.length > 0) {
      const rp = attentionCyNode.renderedPosition();
      const zoom = cy.zoom();
      if (moved) {
        // Animate movement between nodes
        _iceOverlay.style.transition = "left 0.4s ease, top 0.4s ease, opacity 0.3s ease, transform 0.1s ease";
        _iceOverlay.style.left = `${rp.x}px`;
        _iceOverlay.style.top = `${rp.y}px`;
        _iceOverlay.style.transform = `scale(${zoom})`;
        // Remove position transition after animation completes
        setTimeout(() => {
          if (_iceOverlay) _iceOverlay.style.transition = "opacity 0.3s ease";
        }, 450);
      } else {
        // Snap (initial placement or reposition)
        _iceOverlay.style.left = `${rp.x}px`;
        _iceOverlay.style.top = `${rp.y}px`;
        _iceOverlay.style.transform = `scale(${zoom})`;
      }
      _iceOverlay.style.opacity = "1";
    }
  } else {
    _iceOverlay.style.opacity = "0";
  }

  // Flash movement path along edges
  if (moved && fromId) {
    flashIcePath(fromId, iceState.attentionNodeId);
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

  // Flash each edge in sequence; skip edges not in player-controlled territory.
  // Requires at least one endpoint to be compromised or owned (not just visible).
  pathEdges.forEach((edge, i) => {
    if (edge.hasClass("hidden")) return;
    const src = cy.getElementById(edge.data("source"));
    const tgt = cy.getElementById(edge.data("target"));
    const srcControlled = src.hasClass("compromised") || src.hasClass("owned");
    const tgtControlled = tgt.hasClass("compromised") || tgt.hasClass("owned");
    if (!srcControlled && !tgtControlled) return;
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

const MAX_FIT_ZOOM = 1.5;

// Zoom-out floor: never let the user zoom out past the level where all visible
// nodes just fill the viewport — a quick pinch/scroll-out lands on a tight
// overview of the whole graph instead of flinging it off into empty void.
// Recomputed by updateZoomFloor() as the graph grows or the container resizes.
// Deliberately uncapped (beyond maxZoom): a sparse starting LAN has a high
// fit-all zoom, and clamping it lower just reintroduces the empty-space problem.
const ZOOM_FLOOR_PADDING = 50;

/**
 * Pin the minimum zoom (most zoomed-out level) to the "fit everything" zoom so
 * zooming out stops once all visible nodes are on screen. The floor tracks the
 * graph's bounding box, clamped only by maxZoom so it stays a valid value.
 */
function updateZoomFloor() {
  if (!cy) return;
  const nodes = cy.nodes();
  if (nodes.length === 0) return;
  const bb = nodes.boundingBox();
  if (bb.w === 0 || bb.h === 0) return;
  const w = cy.width();
  const h = cy.height();
  if (w === 0 || h === 0) return;
  // Zoom that fits the bounding box (with padding) inside the viewport — the
  // same math Cytoscape's fit() uses. Computed directly rather than via
  // cy.getFitViewport(), which crops its result by the current minZoom and
  // would feed back on us (once raised, the floor could never drop again).
  const fitZoom = Math.min(
    (w - 2 * ZOOM_FLOOR_PADDING) / bb.w,
    (h - 2 * ZOOM_FLOOR_PADDING) / bb.h
  );
  if (!(fitZoom > 0)) return;
  cy.minZoom(Math.min(fitZoom, cy.maxZoom()));
}

const LAYOUTS = {
  cola: (animate) => ({
    name: "cola",
    animate,
    randomize: true,
    nodeSpacing: 30,
    edgeLength: 120,
    padding: 50,
    maxSimulationTime: 4000,
    fit: false,
  }),
  dagre: (animate) => ({
    name: "dagre",
    animate,
    rankDir: "TB",
    nodeSep: 60,
    rankSep: 100,
    padding: 50,
    fit: true,
  }),
  euler: (animate) => ({
    name: "euler",
    animate,
    randomize: true,
    springLength: 150,
    springCoeff: 0.0003,
    gravity: -2,
    padding: 50,
    maxIterations: 1000,
    fit: true,
  }),
  breadthfirst: (animate) => ({
    name: "breadthfirst",
    animate,
    roots: "#gateway",
    directed: false,
    spacingFactor: 1.5,
    padding: 50,
    fit: true,
  }),
  klay: (animate) => ({
    name: "klay",
    animate,
    klay: {
      direction: "DOWN",
      spacing: 60,
      edgeSpacingFactor: 0.3,
    },
    padding: 50,
    fit: true,
  }),
  spread: (animate) => ({
    name: "spread",
    animate,
    minDist: 60,
    padding: 50,
    fit: true,
  }),
  "cose-bilkent": (animate) => ({
    name: "cose-bilkent",
    animate: animate ? "end" : false,
    randomize: true,
    nodeRepulsion: 8000,
    idealEdgeLength: 150,
    gravity: 0.2,
    padding: 50,
    fit: true,
  }),
  fcose: (animate) => ({
    name: "fcose",
    animate,
    randomize: true,
    quality: "proof",
    nodeRepulsion: 8000,
    idealEdgeLength: 150,
    gravity: 0.15,
    padding: 50,
    fit: true,
  }),
  cose: (animate) => ({
    name: "cose",
    animate,
    randomize: true,
    nodeRepulsion: () => 80000,
    idealEdgeLength: () => 200,
    nodeOverlap: 40,
    gravity: 0.05,
    padding: 50,
    numIter: 1000,
    fit: true,
  }),
};

let currentLayout = DEFAULT_LAYOUT_ALGO;

/** Re-run the layout algorithm. Pass a name to switch algorithms. */
export function relayout(name) {
  if (!cy) return;
  if (name && LAYOUTS[name]) currentLayout = name;
  if (cy.nodes().length > 0) {
    cy.layout(LAYOUTS[currentLayout](true)).run();
  }
  return currentLayout;
}

/** Returns the list of available layout names. */
export function getLayoutNames() {
  return Object.keys(LAYOUTS);
}

export function fitGraph(theCy) {
  if (!theCy) return;
  // All nodes in the graph are visible (hidden nodes aren't added).
  // Run layout on everything.
  if (theCy.nodes().length > 0) {
    theCy.layout(LAYOUTS[currentLayout](false)).run();
  }

  const visible = theCy.nodes();
  if (visible.length === 0) return;
  theCy.fit(visible, 50);
  if (theCy.zoom() > MAX_FIT_ZOOM) {
    // Clamp zoom then re-center on visible nodes so they don't drift off-screen
    const bb = visible.boundingBox();
    const cx = (bb.x1 + bb.x2) / 2;
    const cy2 = (bb.y1 + bb.y2) / 2;
    theCy.zoom({ level: MAX_FIT_ZOOM, position: { x: cx, y: cy2 } });
  }
}

// Flash a node with an expanding faceted "ripple" — a sonar ping in the overlay
// layer (which blooms), rather than a border glow. Fire-and-forget: two staggered
// rings expand from inside the node out past its rim, fading, then self-remove.
// type: 'success' (cyan-green), 'failure' (red), 'reveal' (dim cyan).
const FLASH_RGB = {
  success: "0,255,200",
  failure: "255,64,64",
  reveal: "127,208,255",
};

export function flashNode(nodeId, type) {
  if (!cy) return;
  const node = cy.getElementById(nodeId);
  if (!node || node.length === 0) return;
  const rgb = FLASH_RGB[type];
  if (!rgb) return;
  const layer = document.getElementById("overlay-layer");
  if (!layer) return;
  spawnFlashRipple(layer, node.renderedPosition(), node.renderedWidth() / 2, rgb);
}

/**
 * Append a transient ripple SVG (two staggered faceted rings) to the overlay
 * layer, anchored at a node's rendered position. Self-removes when done.
 */
function spawnFlashRipple(layer, pos, r, rgb) {
  const PAD = 18;
  const half = r + PAD;
  const cx = half, cy = half;
  const startR = r * 0.6;
  const maxR = half - 1;
  const DUR = 420;
  const STAGGER = 120;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.style.position = "absolute";
  svg.style.left = `${pos.x - half}px`;
  svg.style.top = `${pos.y - half}px`;
  svg.style.width = `${half * 2}px`;
  svg.style.height = `${half * 2}px`;
  svg.style.overflow = "visible";
  svg.style.pointerEvents = "none";

  const rings = [0, 1].map((i) => {
    const p = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    p.setAttribute("fill", "none");
    p.setAttribute("stroke-width", "2");
    p.setAttribute("stroke-linejoin", "round");
    p.setAttribute("points", ringPoints(cx, cy, startR));
    svg.appendChild(p);
    return { el: p, delay: i * STAGGER };
  });
  layer.appendChild(svg);

  const start = performance.now();
  function animate(now) {
    let alive = false;
    for (const { el, delay } of rings) {
      const t = (now - start - delay) / DUR;
      if (t < 0) { alive = true; continue; }
      if (t >= 1) { el.setAttribute("points", ""); continue; }
      alive = true;
      const cur = startR + t * (maxR - startR);
      el.setAttribute("points", ringPoints(cx, cy, cur));
      el.setAttribute("stroke", `rgba(${rgb},${(0.85 * (1 - t)).toFixed(3)})`);
    }
    if (alive) requestAnimationFrame(animate);
    else svg.remove();
  }
  requestAnimationFrame(animate);
}
