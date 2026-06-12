// @ts-check
// Dev-only FPS / frame-time meter (toggled via `cheat fps`). See #190.
//
// There is no single render loop to instrument — the game is many independent rAF
// loops (overlays, waveform, graph-degradation) + Cytoscape's on-demand renderer +
// CSS-composited animations + a 10fps state tick. But they share ONE main thread,
// compositor, and display refresh, so a standalone rAF that times the gap between its
// own callbacks measures the effective frame cadence and catches main-thread stalls
// from any source (the stats.js approach). It does force continuous painting while on,
// so it only runs while toggled.
//
// Ephemeral diagnostic — intentionally NOT part of the serializable game state, and it
// does not set isCheating (observation only, changes no outcome).

import { FrameStats, frameSparkline } from "./frame-stats.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const HISTORY = 90;                 // frame samples shown in the sparkline
const SPARK_W = 96, SPARK_H = 24;   // sparkline viewport (px)
const SPARK_MAX_MS = 50;            // full-scale frame time (20fps at the top)
const TARGET_MS = 1000 / 60;        // 60fps reference line

let el = null;
let numEl = null, worstEl = null, traceEl = null, refEl = null;
let rafId = 0;
let last = 0;
/** @type {FrameStats|null} */
let stats = null;
/** @type {number[]} */
let history = [];

export function isFpsMeterRunning() {
  return rafId !== 0;
}

/** Toggle the meter; returns the new running state. */
export function toggleFpsMeter() {
  if (isFpsMeterRunning()) {
    stopFpsMeter();
    return false;
  }
  startFpsMeter();
  return true;
}

export function startFpsMeter() {
  if (isFpsMeterRunning() || typeof document === "undefined") return;
  stats = new FrameStats(500);
  history = [];
  el = buildEl();
  document.body.appendChild(el);
  last = performance.now();
  rafId = requestAnimationFrame(frame);
}

export function stopFpsMeter() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  if (el && el.parentNode) el.parentNode.removeChild(el);
  el = numEl = worstEl = traceEl = refEl = null;
  stats = null;
  history = [];
}

function frame(now) {
  const dt = now - last;
  last = now;
  history.push(dt);
  if (history.length > HISTORY) history.shift();
  if (stats && stats.record(dt)) updateReadout();
  updateSparkline();
  rafId = requestAnimationFrame(frame);
}

/** green ≥55 → amber ≥30 → red, by FPS. */
function colorFor(fps) {
  if (fps >= 55) return "#39ff14";
  if (fps >= 30) return "#ffcc00";
  return "#ff2a2a";
}

function updateReadout() {
  if (!stats || !numEl) return;
  const c = colorFor(stats.fps);
  numEl.textContent = String(stats.fps);
  numEl.style.color = c;
  numEl.style.textShadow = `0 0 6px ${c}`;
  if (worstEl) worstEl.textContent = `worst ${stats.worstMs}ms`;
  if (traceEl) {
    traceEl.setAttribute("stroke", c);
    traceEl.style.filter = `drop-shadow(0 0 2px ${c})`;
  }
}

function updateSparkline() {
  if (!traceEl) return;
  const pts = frameSparkline(history, SPARK_W, SPARK_H, SPARK_MAX_MS);
  traceEl.setAttribute("points", pts.map((p) => `${p.x},${p.y}`).join(" "));
}

function buildEl() {
  const panel = document.createElement("div");
  panel.id = "fps-meter";
  Object.assign(panel.style, {
    position: "fixed", top: "8px", right: "8px", zIndex: "9999",
    padding: "6px 8px", font: "11px / 1.3 monospace", color: "#39ff14",
    background: "rgba(10,10,15,0.72)", border: "1px solid rgba(57,255,20,0.4)",
    pointerEvents: "none", letterSpacing: "0.5px",
  });

  const line = document.createElement("div");
  numEl = document.createElement("span");
  numEl.textContent = "--";
  Object.assign(numEl.style, { fontSize: "18px", fontWeight: "bold", color: "#39ff14", textShadow: "0 0 6px #39ff14" });
  line.appendChild(numEl);
  const fpsLabel = document.createElement("span");
  fpsLabel.textContent = " FPS";
  fpsLabel.style.opacity = "0.7";
  line.appendChild(fpsLabel);
  panel.appendChild(line);

  worstEl = document.createElement("div");
  worstEl.textContent = "worst --ms";
  worstEl.style.opacity = "0.7";
  panel.appendChild(worstEl);

  // Stroke-only frame-time sparkline (vector-CRT): a faint 60fps reference line + the trace.
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", String(SPARK_W));
  svg.setAttribute("height", String(SPARK_H));
  svg.style.display = "block";
  svg.style.marginTop = "3px";
  svg.style.overflow = "visible";

  const refY = SPARK_H - (TARGET_MS / SPARK_MAX_MS) * SPARK_H;
  refEl = document.createElementNS(SVG_NS, "line");
  refEl.setAttribute("x1", "0"); refEl.setAttribute("x2", String(SPARK_W));
  refEl.setAttribute("y1", String(refY.toFixed(2))); refEl.setAttribute("y2", String(refY.toFixed(2)));
  refEl.setAttribute("stroke", "rgba(57,255,20,0.25)");
  refEl.setAttribute("stroke-width", "1");
  refEl.setAttribute("stroke-dasharray", "3 3");
  svg.appendChild(refEl);

  traceEl = document.createElementNS(SVG_NS, "polyline");
  traceEl.setAttribute("fill", "none");
  traceEl.setAttribute("stroke", "#39ff14");
  traceEl.setAttribute("stroke-width", "1.5");
  traceEl.setAttribute("stroke-linejoin", "round");
  traceEl.style.filter = "drop-shadow(0 0 2px #39ff14)";
  svg.appendChild(traceEl);

  panel.appendChild(svg);
  return panel;
}
