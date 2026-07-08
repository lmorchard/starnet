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
import { mountVulnSwatches, mountIndicatorSwatches } from "./preview-cards.js";
import { ALL_GLYPH_TYPES } from "./node-glyphs.js";
import { FLOW_TYPES } from "./flow-glyphs.js";
import { iceStrikeCage } from "./ice-glyphs.js";
import { initGraphDegradation, updateFromState as updateGraphDegradation } from "./graph-degradation/index.js";
import {
  startInstrument,
  stepInstrument,
  crackInstrument,
  stopInstrument,
  setInstrumentStateReader,
  setHeatThresholds,
} from "./combat-instrument-overlay.js";
import { ALL_VULN_GLYPH_IDS } from "./vuln-glyphs.js";
import { HEAT_ALARM_THRESHOLD } from "../core/balance.js";

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

// Coherence instrument demo node — its own node so the burn can zoom/scrim
// without disturbing the other demos.
const INSTRUMENT_NODE = { id: "demo-instrument", label: "BURN", type: "fileserver", grade: "C", x: 750, y: 340 };

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

// Access-state demo nodes — show fence density across locked/open/owned
// so the vector-CRT fence treatment can be tuned in isolation.
const ACCESS_NODES = [
  { id: "acc-locked",      label: "LOCKED",      type: "fileserver", grade: "C", x: 150, y: 850 },
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

// Flow substrate demo — two owned nodes joined by one edge that the Flow Substrate
// controls fill with typed packets (single, mixed, and encrypted).
const FLOW_NODES = [
  { id: "flow-src", label: "flow-src", type: "fileserver", grade: "B", x: 1000, y: 540 },
  { id: "flow-dst", label: "flow-dst", type: "gateway",    grade: "C", x: 1320, y: 540 },
];
const FLOW_EDGE = ["flow-src", "flow-dst"];

// ── Initialize Cytoscape ─────────────────────────────────────

const allNodes = [...EFFECT_NODES, SELECT_NODE, FLASH_NODE, INSTRUMENT_NODE, ...SHAPE_NODES, ...ALERT_NODES, ...ACCESS_NODES, ...NET_NODES, ...FLOW_NODES];
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

// Neutral connection line for the flow demo (packets carry the semantics, not the line).
cy.add({ data: { id: `edge-${FLOW_EDGE[0]}-${FLOW_EDGE[1]}`, source: FLOW_EDGE[0], target: FLOW_EDGE[1] } });

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
updateNodeStyle("acc-owned",       { visibility: "accessible", accessLevel: "owned",       alertState: "green", rebooting: false });

// Fit the view to show all nodes
cy.fit(undefined, 40);
cy.userZoomingEnabled(true);
cy.userPanningEnabled(true);

// Mount the registry overlays + selection reticle and wire them to re-anchor on
// pan/zoom — shared with the game via initializeGraphOverlays (#167). The layer
// element is kept for the preview-only ICE-presence demo node mounted below.
const overlayLayer = $("overlay-layer");
const { overlays, flowLayer } = initializeGraphOverlays(overlayLayer);
const { manager } = overlays;

// Drive the probe demo through the manager (pooled, not a byKey singleton).
// Maps t=0 → start, 0<t<1 → progress, t=1 → end.
function driveProbeDemo(nodeId, t) {
  if (t <= 0) manager.start("probe-sweep", nodeId);
  else if (t >= 1) manager.end("probe-sweep", nodeId);
  else manager.progress("probe-sweep", nodeId, t);
}

// Sweep Fan-out demo — drives N nodes through the manager concurrently.
import("./preview-sweep-lab.js").then((m) => m.initSweepLab(overlayLayer, manager));

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
  // Emit t=0 synchronously so overlay managers that require a "start" phase
  // (e.g. probe's OverlayManager, which ignores "progress" with no active entry)
  // receive the initialising call before the first rAF tick arrives ~16ms later.
  syncFn(nodeId, 0);
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
// Probe is pooled (managed), so its EFFECT uses driveProbeDemo instead of byKey.
const EFFECTS = OVERLAY_DESCRIPTORS.map((d) => {
  if (d.key === "probe") {
    return {
      name: d.key,
      nodeId: `demo-${d.key}`,
      sync: driveProbeDemo,
      clear: () => manager.end("probe-sweep", `demo-${d.key}`),
    };
  }
  return {
    name: d.key,
    nodeId: `demo-${d.key}`,
    sync: (id, t) => overlays.byKey.get(d.key).sync(id, t),
    clear: () => overlays.byKey.get(d.key).clear(),
  };
});

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

// ── Flow substrate ───────────────────────────────────────────
// Build a checkbox per packet type; rebuild the demo flow set (all between flow-src and
// flow-dst) on any change. Multiple checked types = a mixed-type edge.
const flowToggles = $("flow-type-toggles");
for (const t of FLOW_TYPES) {
  flowToggles.insertAdjacentHTML(
    "beforeend",
    `<label class="flow-type-label"><input type="checkbox" class="flow-type" value="${t}"${t === "money" ? " checked" : ""}> ${t}</label>`,
  );
}
function rebuildFlows() {
  const density = parseFloat($("flow-density").value) || 0;
  $("flow-density-val").textContent = density.toFixed(2);
  const encrypted = $("flow-encrypted").checked;
  // "revealed" models a flow that was encrypted but has been SNIFFed: it renders as its true
  // type again. Only meaningful alongside ENCRYPTED (the sniff-decrypt A/B).
  const revealed = $("flow-revealed").checked;
  const types = [...document.querySelectorAll(".flow-type")]
    .map((c) => /** @type {HTMLInputElement} */ (c))
    .filter((c) => c.checked)
    .map((c) => c.value);
  const flows = types.map((type) => ({ from: "flow-src", to: "flow-dst", type, rate: density, encrypted, revealed }));
  flowLayer.refresh(flows, cy);
}
flowToggles.addEventListener("change", rebuildFlows);
$("flow-encrypted").addEventListener("change", rebuildFlows);
$("flow-revealed").addEventListener("change", rebuildFlows);
$("flow-density").addEventListener("input", rebuildFlows);
rebuildFlows();

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

// Heat scope demo — <starnet-heat-scope>. Slider is 0..100 = frac 0..1 (the HEAT_GAUGE_MAX scale).
const heatDemo = $("heat-scope-demo");
const heatSlider = $("heat-scope");
if (heatDemo && heatSlider) {
  const scope = /** @type {any} */ (document.createElement("starnet-heat-scope"));
  scope.className = "vital-strip";
  scope.style.width = "204px";
  scope.frac = +heatSlider.value / 100;
  heatDemo.append(scope);

  const heatVal = $("heat-scope-val");
  heatSlider.addEventListener("input", () => {
    scope.frac = +heatSlider.value / 100;
    if (heatVal) heatVal.textContent = String(heatSlider.value);
  });

  const bindHeat = (id, valId, prop, scale, fmt) => {
    const el = $(id);
    if (!el) return;
    const out = $(valId);
    el.addEventListener("input", () => {
      scope[prop] = scale ? +el.value / scale : +el.value;
      if (out) out.textContent = fmt ? fmt(el.value) : String(el.value);
    });
  };
  bindHeat("heat-scope-speed", "heat-scope-speed-val", "speed", 0);
  bindHeat("heat-scope-gap", "heat-scope-gap-val", "bandGap", 0, (v) => (+v).toFixed(1));
  bindHeat("heat-scope-bloom", "heat-scope-bloom-val", "bloom", 0);
}

// ── Coherence Instrument demo ─────────────────────────────────
// Drives the live overlay module with a MOCK state (no game engine here): a
// grade select, a "RUN BURN" button that erodes a mock coherence over time
// feeding stepInstrument (+ crack at the end), and a coherence slider for manual
// scrub. Mirrors the "ICE Presence" tuning surface.
{
  const INSTR_NODE = "demo-instrument";
  const RARITIES = ["common", "uncommon", "rare"];
  // Mock state the overlay reads each frame via setInstrumentStateReader.
  const mock = {
    heat: 0,
    player: { hoard: [] },
    nodes: { [INSTR_NODE]: { grade: "C", coherence: 400, coherenceMax: 400 } },
  };
  const buildHoard = (n) =>
    Array.from({ length: n }, (_, i) => ({
      id: `r${i}`,
      rarity: RARITIES[i % RARITIES.length],
      types: [ALL_VULN_GLYPH_IDS[i % ALL_VULN_GLYPH_IDS.length]],
      disclosed: false,
    }));
  mock.player.hoard = buildHoard(40);

  setInstrumentStateReader(() => mock);
  setHeatThresholds(HEAT_ALARM_THRESHOLD);

  const gradeSel = $("instr-grade");
  const runBtn = $("btn-instr-run");
  const cohSlider = $("instr-coherence");
  const cohVal = $("instr-coherence-val");

  const syncSliderFromMock = () => {
    const node = mock.nodes[INSTR_NODE];
    const pct = Math.round((node.coherence / node.coherenceMax) * 100);
    if (cohSlider) cohSlider.value = String(pct);
    if (cohVal) cohVal.textContent = `${pct}%`;
  };

  // Manual scrub: set coherence directly (only meaningful while a burn shows the
  // overlay; harmless otherwise).
  if (cohSlider) {
    cohSlider.addEventListener("input", () => {
      const node = mock.nodes[INSTR_NODE];
      node.coherence = (+cohSlider.value / 100) * node.coherenceMax;
      if (cohVal) cohVal.textContent = `${cohSlider.value}%`;
    });
  }

  let burnTimer = null;
  const stopDemoBurn = () => {
    if (burnTimer) { clearInterval(burnTimer); burnTimer = null; }
  };

  if (runBtn) {
    runBtn.addEventListener("click", () => {
      stopDemoBurn();
      const grade = gradeSel?.value || "C";
      const node = mock.nodes[INSTR_NODE];
      node.grade = grade;
      node.coherenceMax = 400;
      node.coherence = 400;
      mock.heat = 0;
      mock.player.hoard = buildHoard(40);
      syncSliderFromMock();

      startInstrument(INSTR_NODE, grade);

      // Erode coherence over ~5s, one "shot" per interval, disclosing occasionally.
      burnTimer = setInterval(() => {
        const chip = 400 / 25;
        node.coherence = Math.max(0, node.coherence - chip);
        mock.heat = Math.min(HEAT_ALARM_THRESHOLD[grade] ?? 15, mock.heat + 0.6);
        // Occasionally "disclose" (burn) a hoard round to thin the staging ring.
        const round = mock.player.hoard.find((r) => !r.disclosed);
        const disclosed = Math.random() < 0.25;
        if (disclosed && round) round.disclosed = true;
        stepInstrument({
          chip,
          rarity: round?.rarity || "common",
          types: round?.types,
          disclosed,
          roundId: round?.id || "----",
        });
        syncSliderFromMock();
        if (node.coherence <= 0) {
          stopDemoBurn();
          crackInstrument();
          stopInstrument();
        }
      }, 200);
    });
  }
}

// FPS meter toggle — dev frame-time readout (js/ui/fps-meter.js; `cheat fps` in game).
const fpsToggleBtn = document.getElementById("btn-fps-toggle");
if (fpsToggleBtn) {
  fpsToggleBtn.addEventListener("click", async () => {
    const { toggleFpsMeter } = await import("./fps-meter.js");
    fpsToggleBtn.textContent = toggleFpsMeter() ? "HIDE FPS METER" : "TOGGLE FPS METER";
  });
}
