// @ts-nocheck — preview harness, no type checking needed
// Visual Preview Harness — standalone effect viewer
//
// Initializes a minimal Cytoscape graph with demo nodes and wires up
// controls to drive each visual effect independently.

import {
  initGraph, getCy,
  syncProbeSweep, clearProbeSweep,
  syncMineScan, clearMineScan,
  syncReadSectors, clearReadSectors,
  syncLootRings, clearLootRings,
  syncExploitBrackets, clearExploitBrackets,
  syncIceDetectSweep, clearIceDetectSweep,
  syncSelection,
  flashNode,
  updateNodeStyle,
} from "./graph.js";

// ── Demo node definitions ────────────────────────────────────

// Effect demo nodes — positioned in a 2×3 grid
const EFFECT_NODES = [
  { id: "demo-probe",   label: "PROBE",   type: "router",     grade: "C", x: 150, y: 120 },
  { id: "demo-read",    label: "DUMP",    type: "fileserver", grade: "C", x: 350, y: 120 },
  { id: "demo-loot",    label: "FETCH",   type: "fileserver", grade: "B", x: 550, y: 120 },
  { id: "demo-exploit", label: "XPLOIT",  type: "firewall",  grade: "B", x: 150, y: 280 },
  { id: "demo-ice",     label: "ICE DET", type: "ids",        grade: "A", x: 350, y: 280 },
  { id: "demo-select",  label: "SELECT",  type: "gateway",    grade: "C", x: 550, y: 280 },
  { id: "demo-mine",    label: "MINE",    type: "cryptovault", grade: "A", x: 750, y: 280 },
];

// Flash demo node
const FLASH_NODE = { id: "demo-flash", label: "FLASH", type: "router", grade: "C", x: 750, y: 200 };

// Shape gallery — one per type, cycling grades
const SHAPE_TYPES = ["wan", "gateway", "router", "firewall", "workstation", "ids", "security-monitor", "fileserver", "cryptovault"];
const GRADES = ["F", "D", "C", "B", "A", "S"];
const SHAPE_NODES = SHAPE_TYPES.map((type, i) => ({
  id: `shape-${type}`,
  label: type,
  type,
  grade: GRADES[i % GRADES.length],
  x: 80 + i * 100,
  y: 440,
}));

// Alert state demo nodes
const ALERT_NODES = [
  { id: "alert-green",   label: "GREEN",    type: "router", grade: "C", x: 150, y: 580 },
  { id: "alert-yellow",  label: "YELLOW",   type: "router", grade: "C", x: 350, y: 580 },
  { id: "alert-red",     label: "RED",      type: "router", grade: "C", x: 550, y: 580 },
  { id: "alert-reboot",  label: "REBOOT",   type: "router", grade: "C", x: 750, y: 580 },
];

// ── Initialize Cytoscape ─────────────────────────────────────

const allNodes = [...EFFECT_NODES, FLASH_NODE, ...SHAPE_NODES, ...ALERT_NODES];
const networkData = {
  nodes: allNodes.map(n => ({ id: n.id, label: n.label, type: n.type, grade: n.grade })),
  edges: [],
};

initGraph(networkData, () => {}, () => {});

// Add all nodes to Cytoscape with fixed positions
const cy = getCy();
for (const n of allNodes) {
  cy.add({
    data: { id: n.id, label: n.label, type: n.type, grade: n.grade },
    position: { x: n.x, y: n.y },
    classes: ["accessible", "owned"],
  });
}

// Apply shapes and styles via updateNodeStyle
for (const n of allNodes) {
  updateNodeStyle(n.id, {
    visibility: "accessible",
    accessLevel: "owned",
    alertState: "green",
    rebooting: false,
  });
}

// Set alert states on alert demo nodes
updateNodeStyle("alert-yellow", { visibility: "accessible", accessLevel: "owned", alertState: "yellow", rebooting: false });
updateNodeStyle("alert-red", { visibility: "accessible", accessLevel: "owned", alertState: "red", rebooting: false });
updateNodeStyle("alert-reboot", { visibility: "accessible", accessLevel: "owned", alertState: "green", rebooting: true });

// Fit the view to show all nodes
cy.fit(undefined, 40);
cy.userZoomingEnabled(true);
cy.userPanningEnabled(true);

// ── Animation helpers ────────────────────────────────────────

function getSpeed() {
  return parseFloat(document.getElementById("speed-select").value) || 1;
}

const BASE_DURATION = 3000; // ms at 1x speed

/**
 * Animate a slider from 0→1, calling syncFn on each frame.
 * Returns an object with a cancel() method.
 */
function animateEffect(sliderId, valId, syncFn, nodeId) {
  const slider = document.getElementById(sliderId);
  const valEl = document.getElementById(valId);
  const duration = BASE_DURATION / getSpeed();
  const start = performance.now();
  let cancelled = false;

  function frame(now) {
    if (cancelled) return;
    const t = Math.min((now - start) / duration, 1);
    slider.value = t;
    valEl.textContent = t.toFixed(2);
    syncFn(nodeId, t);
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { cancel: () => { cancelled = true; } };
}

// Track running animations so reset can cancel them
const runningAnimations = {};

// ── Wire up effect controls ──────────────────────────────────

const EFFECTS = [
  {
    name: "probe",
    nodeId: "demo-probe",
    sync: syncProbeSweep,
    clear: clearProbeSweep,
  },
  {
    name: "mine",
    nodeId: "demo-mine",
    sync: syncMineScan,
    clear: clearMineScan,
  },
  {
    name: "read",
    nodeId: "demo-read",
    sync: syncReadSectors,
    clear: clearReadSectors,
  },
  {
    name: "loot",
    nodeId: "demo-loot",
    sync: syncLootRings,
    clear: clearLootRings,
  },
  {
    name: "exploit",
    nodeId: "demo-exploit",
    sync: syncExploitBrackets,
    clear: clearExploitBrackets,
  },
  {
    name: "ice",
    nodeId: "demo-ice",
    sync: syncIceDetectSweep,
    clear: clearIceDetectSweep,
  },
];

for (const effect of EFFECTS) {
  const slider = document.getElementById(`slider-${effect.name}`);
  const valEl = document.getElementById(`val-${effect.name}`);
  const playBtn = document.getElementById(`btn-${effect.name}-play`);
  const resetBtn = document.getElementById(`btn-${effect.name}-reset`);

  // Slider scrub
  slider.addEventListener("input", () => {
    const v = parseFloat(slider.value);
    valEl.textContent = v.toFixed(2);
    effect.sync(effect.nodeId, v);
  });

  // Play
  playBtn.addEventListener("click", () => {
    if (runningAnimations[effect.name]) runningAnimations[effect.name].cancel();
    effect.clear();
    slider.value = 0;
    runningAnimations[effect.name] = animateEffect(
      `slider-${effect.name}`, `val-${effect.name}`, effect.sync, effect.nodeId
    );
  });

  // Reset
  resetBtn.addEventListener("click", () => {
    if (runningAnimations[effect.name]) runningAnimations[effect.name].cancel();
    effect.clear();
    slider.value = 0;
    valEl.textContent = "0.00";
  });
}

// Selection reticle toggle
let reticleOn = false;
document.getElementById("btn-reticle-toggle").addEventListener("click", () => {
  reticleOn = !reticleOn;
  syncSelection(reticleOn ? "demo-select" : null);
  document.getElementById("btn-reticle-toggle").classList.toggle("active", reticleOn);
});

// ── Node flash ───────────────────────────────────────────────

document.getElementById("btn-flash-success").addEventListener("click", () => flashNode("demo-flash", "success"));
document.getElementById("btn-flash-failure").addEventListener("click", () => flashNode("demo-flash", "failure"));
document.getElementById("btn-flash-reveal").addEventListener("click", () => flashNode("demo-flash", "reveal"));

// ── Play All / Reset All ─────────────────────────────────────

document.getElementById("btn-play-all").addEventListener("click", () => {
  for (const effect of EFFECTS) {
    if (runningAnimations[effect.name]) runningAnimations[effect.name].cancel();
    effect.clear();
    document.getElementById(`slider-${effect.name}`).value = 0;
    runningAnimations[effect.name] = animateEffect(
      `slider-${effect.name}`, `val-${effect.name}`, effect.sync, effect.nodeId
    );
  }
});

document.getElementById("btn-reset-all").addEventListener("click", () => {
  for (const effect of EFFECTS) {
    if (runningAnimations[effect.name]) runningAnimations[effect.name].cancel();
    effect.clear();
    const slider = document.getElementById(`slider-${effect.name}`);
    slider.value = 0;
    document.getElementById(`val-${effect.name}`).textContent = "0.00";
  }
  if (reticleOn) {
    reticleOn = false;
    syncSelection(null);
    document.getElementById("btn-reticle-toggle").classList.remove("active");
  }
});
