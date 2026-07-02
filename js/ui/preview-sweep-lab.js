// @ts-nocheck
/**
 * SWEEP FAN-OUT LAB (session: overlay-particle-manager) — a feel + perf harness for concurrent
 * node-overlay animations. Mounts a grid of nodes and a pool of REAL probe-sweep overlays, then
 * drives N of them at once so we can judge how many simultaneous sweeps read well / stay legible,
 * and measure whether N per-element RAF loops hold framerate (decides the shared-RAF question).
 *
 * This is throwaway tuning scaffolding for the interactive-lab phase — it drives overlays directly,
 * bypassing the singleton dispatch, to SHOW the desired multi-node end state before it's built.
 * At port time this becomes (or is replaced by) a proper multi-node preview demo.
 */

import { getCy, updateNodeStyle } from "./graph.js";

const COLS = 6;
const ROWS = 4;
const MAX = COLS * ROWS;      // 24 overlay instances in the pool
const X0 = 200, Y0 = 900, DX = 150, DY = 150; // grid placement (below the existing demo nodes)

/** @param {HTMLElement} overlayLayer */
export function initSweepLab(overlayLayer) {
  const cy = getCy();

  // 1. Grid of demo nodes (real cy nodes so overlays anchor + render with real bloom).
  const nodeIds = [];
  for (let i = 0; i < MAX; i++) {
    const id = `lab-sweep-${i}`;
    nodeIds.push(id);
    cy.add({
      data: { id, label: id, type: "fileserver", grade: "C" },
      position: { x: X0 + (i % COLS) * DX, y: Y0 + Math.floor(i / COLS) * DY },
      classes: ["accessible", "owned"],
    });
    updateNodeStyle(id, { visibility: "accessible", accessLevel: "owned", alertState: "green", rebooting: false });
  }

  // 2. Pool of REAL probe-sweep overlays, one per grid node (probe-sweep-overlay is already
  //    registered via initializeGraphOverlays' imports).
  const pool = nodeIds.map(() => {
    const el = document.createElement("probe-sweep-overlay");
    overlayLayer.appendChild(el);
    return el;
  });

  // 3. Control panel (self-injected — no preview.html edits).
  // A proper sidebar section in #control-panel, matching the preview's house style.
  const panel = document.createElement("div");
  panel.className = "section";
  panel.innerHTML = `
    <h2>Sweep Fan-out Lab</h2>
    <div class="effect-row"><label>fan-out</label>
      <input id="lab-n" type="range" min="1" max="${MAX}" step="1" value="8"><span class="val" id="lab-n-val">8</span></div>
    <div class="effect-row"><label>stagger ms</label>
      <input id="lab-stag" type="range" min="0" max="400" step="10" value="150"><span class="val" id="lab-stag-val">150</span></div>
    <div class="btn-row"><label><input id="lab-rand" type="checkbox" checked> random jitter (0–stagger)</label></div>
    <div class="effect-row"><label>duration ms</label>
      <input id="lab-dur" type="range" min="600" max="6000" step="100" value="2500"><span class="val" id="lab-dur-val">2500</span></div>
    <div class="btn-row">
      <button id="lab-sweep">SWEEP</button>
      <label><input id="lab-loop" type="checkbox"> loop</label>
      <button id="lab-fps">FPS</button>
    </div>
    <div class="btn-row"><span id="lab-status">idle</span></div>`;
  const controlPanel = document.getElementById("control-panel");
  (controlPanel ?? document.body).appendChild(panel);

  const $ = (id) => panel.querySelector(id) ?? document.getElementById(id);
  const num = (id) => parseFloat(panel.querySelector(id).value);
  for (const [inp, out] of [["#lab-n", "#lab-n-val"], ["#lab-stag", "#lab-stag-val"], ["#lab-dur", "#lab-dur-val"]]) {
    panel.querySelector(inp).addEventListener("input", () => { panel.querySelector(out).textContent = panel.querySelector(inp).value; });
  }

  // 4. Drive N overlays concurrently, each ramping 0→1 over `duration`, staggered, then clearing.
  const active = new Set();
  function runOne(el, nodeId, duration, delayMs) {
    const start = performance.now() + delayMs;
    active.add(el);
    function frame(now) {
      if (now < start) { requestAnimationFrame(frame); return; }
      const t = Math.min((now - start) / duration, 1);
      el.sync(nodeId, t);
      if (t < 1) { requestAnimationFrame(frame); }
      else { el.clear(); active.delete(el); onDone(); }
    }
    requestAnimationFrame(frame);
  }
  function onDone() {
    panel.querySelector("#lab-status").textContent = active.size ? `sweeping: ${active.size}` : "idle";
    if (active.size === 0 && panel.querySelector("#lab-loop").checked) sweep();
  }
  function sweep() {
    const n = num("#lab-n"), stag = num("#lab-stag"), dur = num("#lab-dur");
    const rand = panel.querySelector("#lab-rand").checked;
    for (const el of pool) el.clear();
    active.clear();
    // random jitter: each probe delayed [0, stag); fixed: i*stag cascade.
    for (let i = 0; i < n; i++) runOne(pool[i], nodeIds[i], dur, rand ? Math.random() * stag : i * stag);
    panel.querySelector("#lab-status").textContent = `sweeping: ${n}`;
  }

  panel.querySelector("#lab-sweep").addEventListener("click", sweep);
  panel.querySelector("#lab-fps").addEventListener("click", async () => {
    const { toggleFpsMeter } = await import("./fps-meter.js");
    toggleFpsMeter();
  });

  cy.fit(undefined, 40); // include the grid in view
  console.log(`[sweep-lab] mounted ${MAX} overlays on a ${COLS}x${ROWS} grid`);
}
