// @ts-check — preview harness; $() is a typed (any) element lookup so DOM/custom-element
// property access (.value, .frac, .kind, .w) needs no per-site casts. Name-resolution
// checks still apply (they caught a dropped overlayLayer ref during #172).
// Visual Preview Harness — standalone effect viewer
//
// Initializes a minimal Cytoscape graph with demo nodes and wires up
// controls to drive each visual effect independently.

import {
  initGraph, getCy,
  syncSelection,
  flashNode,
  updateNodeStyle,
  onViewport,
} from "./graph.js";
import { initializeGraphOverlays } from "./overlays/index.js";
import { OVERLAY_DESCRIPTORS } from "./overlays/registry.js";
import { mountCardGallery, mountVulnSwatches, mountIndicatorSwatches } from "./preview-cards.js";
import { ALL_GLYPH_TYPES } from "./node-glyphs.js";
import { iceStrikeCage } from "./ice-glyphs.js";
import { initGraphDegradation, updateFromState as updateGraphDegradation } from "./graph-degradation/index.js";

/** Typed element lookup for the harness — returns `any` so input `.value`,
 *  custom-element props (.frac/.kind/.w), etc. need no per-site casts.
 *  @param {string} id @returns {any} */
const $ = (id) => document.getElementById(id);

// ── Demo node definitions ────────────────────────────────────

// Effect demo nodes — generated from the overlay registry (one per effect),
// laid out in a row. Adding a new overlay effect requires no preview edits.
const EFFECT_NODES = OVERLAY_DESCRIPTORS.map((d, i) => ({
  id: `demo-${d.key}`,
  label: d.label,
  type: d.demo.type,
  grade: d.demo.grade,
  x: 150 + i * 130,
  y: 120,
}));

// Selection reticle demo node (not an overlay-registry effect)
const SELECT_NODE = { id: "demo-select", label: "SELECT", type: "gateway", grade: "C", x: 150 + OVERLAY_DESCRIPTORS.length * 130, y: 120 };

// Flash demo node
const FLASH_NODE = { id: "demo-flash", label: "FLASH", type: "router", grade: "C", x: 750, y: 200 };

// ICE presence (Strike Cage) composites onto the SAME node as the detection
// overlay ("demo-ice") so the two ICE effects can be seen together.
const ICE_PRESENCE_NODE_ID = "demo-ice";

// Glyph gallery — full vocabulary from node-glyphs, plus an unmapped node to
// demonstrate the microchip fallback. Cycles grades so border colors vary.
const SHAPE_TYPES = [...ALL_GLYPH_TYPES, "unknown-fallback-demo"];
const GRADES = ["F", "D", "C", "B", "A", "S"];
// 10 cols wraps the 19 demo nodes to 2 rows (y=440, y=550). Keep this and the
// base y in sync with ALERT_NODES' y (720) so the rows don't overlap.
const GALLERY_COLS = 10;
const SHAPE_NODES = SHAPE_TYPES.map((type, i) => ({
  id: `shape-${type}`,
  label: type,
  type,
  grade: GRADES[i % GRADES.length],
  x: 80 + (i % GALLERY_COLS) * 100,
  y: 440 + Math.floor(i / GALLERY_COLS) * 110,
}));

// Alert state demo nodes — placed below the (now two-row) glyph gallery to
// avoid overlapping its second row.
const ALERT_NODES = [
  { id: "alert-green",   label: "GREEN",    type: "router", grade: "C", x: 150, y: 720 },
  { id: "alert-yellow",  label: "YELLOW",   type: "router", grade: "C", x: 350, y: 720 },
  { id: "alert-red",     label: "RED",      type: "router", grade: "C", x: 550, y: 720 },
  { id: "alert-reboot",  label: "REBOOT",   type: "router", grade: "C", x: 750, y: 720 },
];

// Access-state demo nodes — show fence density across locked/compromised/owned
// so the vector-CRT fence treatment can be tuned in isolation.
const ACCESS_NODES = [
  { id: "acc-locked",      label: "LOCKED",      type: "fileserver", grade: "C", x: 150, y: 850 },
  { id: "acc-compromised", label: "COMPROMISED", type: "fileserver", grade: "C", x: 380, y: 850 },
  { id: "acc-owned",       label: "OWNED",       type: "fileserver", grade: "C", x: 610, y: 850 },
];

// Connected mini-network — a real edge-linked cluster so the graph-degradation deck
// chaos (nodes jitter, EDGES whip to follow) is actually legible. Placed in the open
// area right of the FLASH node.
const NET_NODES = [
  { id: "net-gw",  label: "net-gw",  type: "gateway",     grade: "D", x: 1000, y: 150 },
  { id: "net-rt",  label: "net-rt",  type: "router",      grade: "C", x: 1190, y: 170 },
  { id: "net-ws",  label: "net-ws",  type: "workstation", grade: "C", x: 1300, y: 300 },
  { id: "net-fs",  label: "net-fs",  type: "fileserver",  grade: "B", x: 1120, y: 360 },
  { id: "net-ids", label: "net-ids", type: "ids",         grade: "B", x:  960, y: 300 },
];
const NET_EDGES = [
  ["net-gw", "net-rt"], ["net-rt", "net-ws"], ["net-ws", "net-fs"],
  ["net-fs", "net-ids"], ["net-ids", "net-gw"], ["net-rt", "net-fs"],
];

// ── Initialize Cytoscape ─────────────────────────────────────

const allNodes = [...EFFECT_NODES, SELECT_NODE, FLASH_NODE, ...SHAPE_NODES, ...ALERT_NODES, ...ACCESS_NODES, ...NET_NODES];
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

// Connect the mini-network with real edges so deck chaos has lines to whip.
for (const [source, target] of NET_EDGES) {
  cy.add({ data: { id: `edge-${source}-${target}`, source, target } });
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

// Access-state demo overrides (the generic loop above set every node to "owned")
updateNodeStyle("acc-locked",      { visibility: "accessible", accessLevel: "locked",      alertState: "green", rebooting: false });
updateNodeStyle("acc-compromised", { visibility: "accessible", accessLevel: "compromised", alertState: "green", rebooting: false });
updateNodeStyle("acc-owned",       { visibility: "accessible", accessLevel: "owned",       alertState: "green", rebooting: false });

// Fit the view to show all nodes
cy.fit(undefined, 40);
cy.userZoomingEnabled(true);
cy.userPanningEnabled(true);

// Mount the registry overlays + selection reticle and wire them to re-anchor on
// pan/zoom — shared with the game via initializeGraphOverlays (#167). The layer
// element is kept for the preview-only ICE-presence demo node mounted below.
const overlayLayer = $("overlay-layer");
const { overlays } = initializeGraphOverlays(overlayLayer);

// ── Animation helpers ────────────────────────────────────────

function getSpeed() {
  return parseFloat($("speed-select").value) || 1;
}

const BASE_DURATION = 3000; // ms at 1x speed

/**
 * Animate a slider from 0→1, calling syncFn on each frame.
 * Returns an object with a cancel() method.
 */
function animateEffect(sliderId, valId, syncFn, nodeId) {
  const slider = $(sliderId);
  const valEl = $(valId);
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

// Generate a control row per overlay effect from the registry.
const overlayControls = $("overlay-controls");
for (const d of OVERLAY_DESCRIPTORS) {
  overlayControls.insertAdjacentHTML("beforeend", `
    <h3>${d.label}</h3>
    <div class="effect-row">
      <label>progress</label>
      <input type="range" id="slider-${d.key}" min="0" max="1" step="0.01" value="0">
      <span class="val" id="val-${d.key}">0.00</span>
    </div>
    <div class="btn-row">
      <button id="btn-${d.key}-play">PLAY</button>
      <button id="btn-${d.key}-reset">RESET</button>
    </div>`);
}

// Each effect drives its mounted overlay element via the sync/clear contract.
const EFFECTS = OVERLAY_DESCRIPTORS.map((d) => ({
  name: d.key,
  nodeId: `demo-${d.key}`,
  sync: (id, t) => overlays.byKey.get(d.key).sync(id, t),
  clear: () => overlays.byKey.get(d.key).clear(),
}));

for (const effect of EFFECTS) {
  const slider = $(`slider-${effect.name}`);
  const valEl = $(`val-${effect.name}`);
  const playBtn = $(`btn-${effect.name}-play`);
  const resetBtn = $(`btn-${effect.name}-reset`);

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

// ── ICE presence (Strike Cage) ───────────────────────────────
// Standalone HTML overlay mirroring graph.js's #ice-overlay, anchored to the
// ICE demo node. Show/hide + pulse toggle (the pulse is the .ice-cage animation).
const icePresenceEl = document.createElement("div");
icePresenceEl.id = "ice-overlay";
icePresenceEl.style.cssText = `
  position: absolute; pointer-events: none; z-index: 10;
  width: 35px; height: 35px; margin-left: -17.5px; margin-top: -28px;
  overflow: visible; opacity: 0;`;
icePresenceEl.innerHTML = iceStrikeCage();
overlayLayer.appendChild(icePresenceEl);

function repositionIcePresence() {
  const node = cy.getElementById(ICE_PRESENCE_NODE_ID);
  if (node.length === 0) return;
  const rp = node.renderedPosition();
  icePresenceEl.style.left = `${rp.x}px`;
  icePresenceEl.style.top = `${rp.y}px`;
  icePresenceEl.style.transform = `scale(${cy.zoom()})`;
}
onViewport(repositionIcePresence);
repositionIcePresence();

let iceOn = false;
$("btn-ice-toggle").addEventListener("click", () => {
  iceOn = !iceOn;
  icePresenceEl.style.opacity = iceOn ? "1" : "0";
  repositionIcePresence();
  $("btn-ice-toggle").textContent = iceOn ? "HIDE" : "SHOW";
  $("btn-ice-toggle").classList.toggle("active", iceOn);
});
// Pulse is on by default (the .ice-cage animation). Toggle adds .ice-pulse-off
// which disables it (rule in css/style.css).
$("btn-ice-pulse").addEventListener("click", () => {
  const off = icePresenceEl.classList.toggle("ice-pulse-off");
  $("btn-ice-pulse").classList.toggle("active", !off);
});

// Selection reticle toggle
let reticleOn = false;
$("btn-reticle-toggle").addEventListener("click", () => {
  reticleOn = !reticleOn;
  syncSelection(reticleOn ? "demo-select" : null);
  $("btn-reticle-toggle").classList.toggle("active", reticleOn);
});

// ── Node flash ───────────────────────────────────────────────

$("btn-flash-success").addEventListener("click", () => flashNode("demo-flash", "success"));
$("btn-flash-failure").addEventListener("click", () => flashNode("demo-flash", "failure"));
$("btn-flash-reveal").addEventListener("click", () => flashNode("demo-flash", "reveal"));

// ── Play All / Reset All ─────────────────────────────────────

$("btn-play-all").addEventListener("click", () => {
  for (const effect of EFFECTS) {
    if (runningAnimations[effect.name]) runningAnimations[effect.name].cancel();
    effect.clear();
    $(`slider-${effect.name}`).value = 0;
    runningAnimations[effect.name] = animateEffect(
      `slider-${effect.name}`, `val-${effect.name}`, effect.sync, effect.nodeId
    );
  }
});

$("btn-reset-all").addEventListener("click", () => {
  for (const effect of EFFECTS) {
    if (runningAnimations[effect.name]) runningAnimations[effect.name].cancel();
    effect.clear();
    const slider = $(`slider-${effect.name}`);
    slider.value = 0;
    $(`val-${effect.name}`).textContent = "0.00";
  }
  if (reticleOn) {
    reticleOn = false;
    syncSelection(null);
    $("btn-reticle-toggle").classList.remove("active");
  }
});

// ── Card gallery ─────────────────────────────────────────────

mountCardGallery($("card-gallery"));

// ── Vuln glyph swatches ──────────────────────────────────────

mountVulnSwatches($("vuln-swatches"));

// ── Indicator glyphs swatches ────────────────────────────────

mountIndicatorSwatches($("indicator-swatches"));

// ── Graph degradation overlay — driven by dummy health/deck sliders ──────────

initGraphDegradation();
const degH = $("degrade-health");
const degD = $("degrade-deck");
const degHVal = $("degrade-health-val");
const degDVal = $("degrade-deck-val");
function syncDegrade() {
  const h = +degH.value, d = +degD.value;
  degHVal.textContent = String(h);
  degDVal.textContent = String(d);
  updateGraphDegradation({ player: {
    health: { current: h, max: 100 },
    deckIntegrity: { current: d, max: 100 },
  }});
}
if (degH && degD) {
  degH.addEventListener("input", syncDegrade);
  degD.addEventListener("input", syncDegrade);
  syncDegrade();
}

// Vital waveforms demo
const wfDemo        = $("waveform-demo");
const waveHealth    = $("wave-health");
const waveDeck      = $("wave-deck");
const waveHealthVal = $("wave-health-val");
const waveDeckVal   = $("wave-deck-val");
const waveToggle    = $("wave-layout-toggle");

if (wfDemo && waveHealth && waveDeck && waveToggle) {
  const ecg = /** @type {any} */ (document.createElement("starnet-waveform"));
  ecg.kind = "ecg";
  ecg.color = "var(--green)";
  ecg.label = "HEALTH";
  ecg.frac = 1;
  const pulse = /** @type {any} */ (document.createElement("starnet-waveform"));
  pulse.kind = "pulse";
  pulse.color = "var(--violet)";
  pulse.label = "DECK";
  pulse.frac = 1;
  wfDemo.append(ecg, pulse);

  waveHealth.addEventListener("input", () => {
    ecg.frac = +waveHealth.value / 100;
    waveHealthVal.textContent = String(waveHealth.value);
  });
  waveDeck.addEventListener("input", () => {
    pulse.frac = +waveDeck.value / 100;
    waveDeckVal.textContent = String(waveDeck.value);
  });

  // Sweep/persistence/glow tuning — applies to both traces.
  const waveSpeed = $("wave-speed");
  const waveTrail = $("wave-trail");
  const waveBloom = $("wave-bloom");
  const bindBoth = (el, valId, prop, scale, fmt) => {
    if (!el) return;
    const out = $(valId);
    el.addEventListener("input", () => {
      const v = scale ? +el.value / scale : +el.value;
      ecg[prop] = v; pulse[prop] = v;
      if (out) out.textContent = fmt ? fmt(el.value) : String(el.value);
    });
  };
  bindBoth(waveSpeed, "wave-speed-val", "speed", 0);
  bindBoth(waveTrail, "wave-trail-val", "trail", 100, (v) => (v / 100).toFixed(2));
  bindBoth(waveBloom, "wave-bloom-val", "bloom", 0);

  let waveLayout = "layout-inline";
  waveToggle.addEventListener("click", () => {
    wfDemo.classList.remove(waveLayout);
    waveLayout = waveLayout === "layout-inline" ? "layout-strip" : "layout-inline";
    wfDemo.classList.add(waveLayout);
    if (waveLayout === "layout-strip") {
      ecg.w = 240;
      pulse.w = 240;
      waveToggle.textContent = "INLINE";
    } else {
      ecg.w = 120;
      pulse.w = 120;
      waveToggle.textContent = "STRIP";
    }
  });
}

// FPS meter toggle — dev frame-time readout (js/ui/fps-meter.js; `cheat fps` in game).
const fpsToggleBtn = document.getElementById("btn-fps-toggle");
if (fpsToggleBtn) {
  fpsToggleBtn.addEventListener("click", async () => {
    const { toggleFpsMeter } = await import("./fps-meter.js");
    fpsToggleBtn.textContent = toggleFpsMeter() ? "HIDE FPS METER" : "TOGGLE FPS METER";
  });
}
