// @ts-nocheck — Cytoscape.js has no bundled types; skipping type checking for this file.
/**
 * Coherence auto-burn combat instrument — LIVE graph overlay.
 *
 * Node-anchored `<canvas>` over `#cy`, driven by the auto-burn events. MIRRORS the
 * ICE strike-cage overlay (graph.js `addIceNode` / `_repositionIceOverlay` + the
 * `onViewport` re-anchor hook): it tracks its node's `renderedPosition()` and
 * `scale(cy.zoom())` on every pan/zoom/drag/focus-animate.
 *
 * Perf rules (cytoscape-continuous-redraw + glow-ownership memories):
 *   - The rAF draw loop RUNS ONLY DURING A BURN. Idle = no overlay, no loop.
 *   - The canvas owns its glow via `ctx.shadowBlur`; it is NOT under the heavy
 *     `#cy` `#starnet-bloom` filter and stacks no CSS filter on top.
 *
 * On a burn: mount+show the overlay, focus the camera (zoom + center) on the
 * target and dim the rest with a scrim, run the rAF loop reading live state each
 * frame, then — after the crack bloom / fx settle — ease everything back out and
 * restore the prior viewport.
 *
 * DOM/cy-guarded throughout so headless tests (no document, no cy) are no-ops.
 */

import { getCy, onViewport, setViewportLock } from "./graph.js";
import {
  drawInstrument,
  createShieldRings,
  createStagingRing,
  createInstrumentFx,
  spawnShot,
  spawnCrackShards,
  bumpShake,
  RING_COUNT,
  aliveSegCount,
  outerIntactRadius,
} from "./combat-instrument.js";

// Instrument footprint in CSS px (the pure renderer draws within ~±108 of center).
const FOOTPRINT = 260;
const CENTER = FOOTPRINT / 2;

// Focus camera: zoom the target to about this rendered diameter (px), clamped.
const FOCUS_TARGET_PX = 140;
const FOCUS_ZOOM_MAX = 2.4;
const FOCUS_DURATION = 350;

// Scrim opacity during a burn.
const SCRIM_OPACITY = 0.55;

// How long (ms) to hold focus after the burn ends so the crack flash / shards
// resolve before we restore the viewport and tear the loop down.
const SETTLE_MS = 700;

// ── module state ────────────────────────────────────────────────────────────

/** @type {HTMLElement|null} */
let _overlayEl = null;
/** @type {HTMLCanvasElement|null} */
let _canvas = null;
/** @type {CanvasRenderingContext2D|null} */
let _ctx = null;
/** @type {HTMLElement|null} */
let _scrimEl = null;

let _rafId = 0;              // active rAF handle (0 = loop not running)
let _nodeId = null;         // node the current burn is anchored to
let _grade = "C";
let _shieldRings = null;
let _stagingRing = null;
let _fx = null;
let _cracked = false;

// Prior viewport for restore after focus.
let _savedViewport = null;  // { zoom, pan }
let _settleTimer = 0;

let _registered = false;    // onViewport registration is one-shot

// ── live-state reader (injected so the overlay stays UI-only) ────────────────
// visual-renderer passes a getState()-backed reader; default no-ops keep the
// module importable in isolation.
let _readState = () => null;
/** @param {() => any} fn */
export function setInstrumentStateReader(fn) { _readState = fn; }

// ── mount + reposition (mirror ICE overlay) ──────────────────────────────────

/**
 * Create the scrim + overlay canvas once and register the pan/zoom re-anchor.
 * No-op without a DOM / #cy container (headless).
 */
export function mountInstrumentOverlay() {
  if (_overlayEl) return;
  if (typeof document === "undefined") return;
  const container = document.getElementById("cy");
  if (!container) return;

  container.style.position = "relative";

  // Scrim — below the instrument, above the graph canvas. Dims the rest of the
  // graph during a burn so the target pops.
  const scrim = document.createElement("div");
  scrim.id = "combat-scrim";
  scrim.style.cssText = `
    position: absolute; inset: 0; pointer-events: none; z-index: 9;
    background: #070a0e; opacity: 0;
    transition: opacity 0.35s ease;
  `;
  container.appendChild(scrim);
  _scrimEl = scrim;

  // Overlay — node-anchored canvas above the ICE overlay (z 11 > ice's 10).
  const el = document.createElement("div");
  el.id = "combat-instrument-overlay";
  const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
  const canvas = document.createElement("canvas");
  canvas.width = FOOTPRINT * dpr;
  canvas.height = FOOTPRINT * dpr;
  canvas.style.width = `${FOOTPRINT}px`;
  canvas.style.height = `${FOOTPRINT}px`;
  el.appendChild(canvas);
  el.style.cssText = `
    position: absolute; pointer-events: none; z-index: 11;
    width: ${FOOTPRINT}px; height: ${FOOTPRINT}px;
    margin-left: ${-CENTER}px; margin-top: ${-CENTER}px;
    overflow: visible; opacity: 0;
    transition: opacity 0.3s ease;
  `;
  container.appendChild(el);

  _ctx = canvas.getContext("2d");
  if (_ctx) _ctx.scale(dpr, dpr);   // draw in CSS px; back buffer is dpr-scaled for crispness
  _canvas = canvas;
  _overlayEl = el;

  if (!_registered) {
    onViewport(_repositionInstrumentOverlay);
    _registered = true;
  }
}

/** Reposition + scale the overlay to track its node (no animation) — mirror ICE. */
function _repositionInstrumentOverlay() {
  if (!_overlayEl || !_nodeId) return;
  if (_overlayEl.style.opacity === "0") return;
  const cy = getCy();
  if (!cy) return;
  const node = cy.getElementById(_nodeId);
  if (!node || node.length === 0) return;
  const rp = node.renderedPosition();
  _overlayEl.style.left = `${rp.x}px`;
  _overlayEl.style.top = `${rp.y}px`;
  _overlayEl.style.transform = `scale(${cy.zoom()})`;
}

// ── burn lifecycle ───────────────────────────────────────────────────────────

/**
 * Begin the instrument for a burn on `nodeId`: build ring/fx state, focus the
 * camera + scrim, and start the rAF loop. No-op without cy/DOM.
 * @param {string} nodeId
 * @param {string} grade
 */
export function startInstrument(nodeId, grade = "C") {
  mountInstrumentOverlay();
  const cy = getCy();
  if (!cy || !_overlayEl || !_ctx) return;

  // A new burn cancels any pending tear-down from a prior burst.
  if (_settleTimer) { clearTimeout(_settleTimer); _settleTimer = 0; }

  _nodeId = nodeId;
  _grade = grade;
  _cracked = false;
  const ringCount = RING_COUNT[grade] ?? RING_COUNT.C;
  const hoard = _hoardSnapshot();
  _shieldRings = createShieldRings(ringCount);
  _stagingRing = createStagingRing(hoard.length ? hoard : [{ rarity: "common", types: [0] }]);
  _fx = createInstrumentFx();

  _focusOn(nodeId);
  if (_scrimEl) _scrimEl.style.opacity = String(SCRIM_OPACITY);
  _overlayEl.style.opacity = "1";
  _repositionInstrumentOverlay();

  if (!_rafId) _rafId = requestAnimationFrame(_frame);
}

/**
 * Fire a projectile inward for one burn step. Tinted by rarity/disclosed.
 * @param {{ rarity?: string, disclosed?: boolean, chip?: number, roundId?: string }} step
 */
export function stepInstrument(step = {}) {
  if (!_fx || !_stagingRing) return;
  const coherence01 = _coherence01();
  const ringCount = RING_COUNT[_grade] ?? RING_COUNT.C;
  const alive = aliveSegCount(coherence01, ringCount);
  const targetR = outerIntactRadius(alive, ringCount);

  // Launch from a staging slot angle at the ring radius toward the shield edge.
  const slots = _stagingRing.slots;
  const idx = Math.floor(Math.random() * slots.length);
  const a = -Math.PI / 2 + idx / slots.length * Math.PI * 2 + _stagingRing.rot;
  const fromX = CENTER + _stagingRing.r * Math.cos(a);
  const fromY = CENTER + _stagingRing.r * Math.sin(a);
  const toX = CENTER + targetR * Math.cos(a);
  const toY = CENTER + targetR * Math.sin(a);

  spawnShot(_fx, {
    fromX, fromY, toX, toY,
    id: step.roundId || "----",
    type: Math.floor(Math.random() * 5),
    rarity: step.rarity || "common",
    disclosed: !!step.disclosed,
  });

  // Flash the firing slot (green normally, red when the round was disclosed/burned).
  const slot = slots[idx];
  if (slot) { if (step.disclosed) slot.r = 6; else slot.g = 6; }

  // Shake scaled by chip magnitude (bounded inside bumpShake).
  bumpShake(_fx, 2 + Math.min(6, (step.chip || 0) / 40));
}

/** Mark the core cracked + spawn the cyan crack bloom. */
export function crackInstrument() {
  if (!_fx) return;
  _cracked = true;
  spawnCrackShards(_fx, CENTER, CENTER);
  _fx.flash = 1;
}

/**
 * End the burn: after the crack flash / shards settle, ease the overlay + scrim
 * out, restore the viewport, and tear the rAF loop down. Idempotent.
 */
export function stopInstrument() {
  if (!_overlayEl) return;
  if (_settleTimer) return;   // already winding down
  _settleTimer = setTimeout(() => {
    _settleTimer = 0;
    if (_overlayEl) _overlayEl.style.opacity = "0";
    if (_scrimEl) _scrimEl.style.opacity = "0";
    _restoreViewport();
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = 0; }
    _nodeId = null;
    _shieldRings = null;
    _stagingRing = null;
    _fx = null;
    _cracked = false;
  }, SETTLE_MS);
}

/** True while the rAF loop is live (test/observability hook). */
export function isInstrumentRunning() {
  return _rafId !== 0;
}

// ── rAF draw loop (burn-bounded) ─────────────────────────────────────────────

function _frame() {
  if (!_ctx || !_canvas || !_fx) { _rafId = 0; return; }
  _ctx.clearRect(0, 0, FOOTPRINT, FOOTPRINT);
  drawInstrument(_ctx, {
    cx: CENTER,
    cy: CENTER,
    coherence01: _coherence01(),
    ringCount: RING_COUNT[_grade] ?? RING_COUNT.C,
    hoardFrac: _hoardFrac(),
    heat01: _heat01(),
    gradeLabel: _grade,
    cracked: _cracked,
    fx: _fx,
    shieldRings: _shieldRings,
    stagingRing: _stagingRing,
  });
  _repositionInstrumentOverlay();
  _rafId = requestAnimationFrame(_frame);
}

// ── focus camera + scrim ──────────────────────────────────────────────────────

function _focusOn(nodeId) {
  const cy = getCy();
  if (!cy) return;
  const node = cy.getElementById(nodeId);
  if (!node || node.length === 0) return;
  _savedViewport = { zoom: cy.zoom(), pan: { ...cy.pan() } };
  // Lock auto viewport for the whole focus (through restore) so a reveal/selection
  // re-fit can't yank the camera off the burning node mid-barrage.
  setViewportLock(true);
  // Zoom so the target renders around FOCUS_TARGET_PX; clamp to a sane ceiling
  // and the graph's own min/max so we never fight the fit floor.
  const modelW = node.width() || 40;
  let z = FOCUS_TARGET_PX / modelW;
  z = Math.min(z, FOCUS_ZOOM_MAX, cy.maxZoom());
  z = Math.max(z, cy.minZoom());
  cy.stop();
  cy.animate({ zoom: z, center: { eles: node } }, { duration: FOCUS_DURATION, easing: "ease-in-out-cubic" });
}

function _restoreViewport() {
  const cy = getCy();
  if (!cy || !_savedViewport) { setViewportLock(false); _savedViewport = null; return; }
  cy.stop();
  cy.animate(
    { zoom: _savedViewport.zoom, pan: _savedViewport.pan },
    { duration: FOCUS_DURATION, easing: "ease-in-out-cubic", complete: () => setViewportLock(false) },
  );
  _savedViewport = null;
}

// ── live-state readers ────────────────────────────────────────────────────────

function _node() {
  const s = _readState();
  return (s && _nodeId && s.nodes && s.nodes[_nodeId]) || null;
}

function _coherence01() {
  const n = _node();
  if (!n) return 1;
  const max = n.coherenceMax || 1;
  return Math.max(0, Math.min(1, (n.coherence ?? max) / max));
}

function _hoardSnapshot() {
  const s = _readState();
  return (s && s.player && s.player.hoard) || [];
}

function _hoardFrac() {
  const hoard = _hoardSnapshot();
  if (!hoard.length) return 0;
  const usable = hoard.filter((r) => !r.disclosed).length;
  return usable / hoard.length;
}

function _heat01() {
  const s = _readState();
  if (!s) return 0;
  const ceiling = _heatCeiling(s);
  return ceiling > 0 ? Math.max(0, Math.min(1, (s.heat || 0) / ceiling)) : 0;
}

// HEAT_ALARM_THRESHOLD is grade-keyed; use the burning node's grade.
let _heatThresholds = null;
/** @param {Record<string, number>} table injected by visual-renderer to avoid a core import */
export function setHeatThresholds(table) { _heatThresholds = table; }
function _heatCeiling() {
  if (_heatThresholds) return _heatThresholds[_grade] ?? _heatThresholds.C ?? 15;
  return 15;
}
