// @ts-check
/**
 * Sweep Fan-out Demo — permanent preview for concurrent multi-node probe animations.
 * Drives N grid nodes through OverlayManager.start/progress/end keyed by overlay name
 * ("probe-sweep"), with the manager's built-in random jitter destaggers simultaneous starts.
 * No direct overlay mounting — exercises the real manager path end-to-end.
 */

import { getCy, updateNodeStyle } from "./graph.js";

const COLS = 6;
const ROWS = 4;
const MAX = COLS * ROWS; // 24 nodes in the grid
const X0 = 200, Y0 = 900, DX = 150, DY = 150;

/**
 * @param {HTMLElement} _overlayLayer - unused; kept for signature compatibility
 * @param {import("./overlays/manager.js").OverlayManager} manager
 */
export function initSweepLab(_overlayLayer, manager) {
  const cy = getCy();

  // Grid of real cy nodes so overlays anchor + render with real bloom.
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

  // Control panel (self-injected into #control-panel).
  const panel = document.createElement("div");
  panel.className = "section";
  panel.innerHTML = `
    <h2>Sweep Fan-out</h2>
    <div class="effect-row"><label>fan-out</label>
      <input id="lab-n" type="range" min="1" max="${MAX}" step="1" value="8"><span class="val" id="lab-n-val">8</span></div>
    <div class="effect-row"><label>duration ms</label>
      <input id="lab-dur" type="range" min="600" max="6000" step="100" value="2500"><span class="val" id="lab-dur-val">2500</span></div>
    <div class="btn-row">
      <button id="lab-sweep">SWEEP</button>
      <label><input id="lab-loop" type="checkbox"> loop</label>
    </div>
    <div class="btn-row"><span id="lab-status">idle</span></div>`;
  const controlPanel = document.getElementById("control-panel");
  (controlPanel ?? document.body).appendChild(panel);

  // Sync slider display values.
  for (const [inp, out] of [["#lab-n", "#lab-n-val"], ["#lab-dur", "#lab-dur-val"]]) {
    const inEl = /** @type {HTMLInputElement} */ (panel.querySelector(inp));
    const outEl = /** @type {HTMLElement} */ (panel.querySelector(out));
    inEl.addEventListener("input", () => { outEl.textContent = inEl.value; });
  }

  const numVal = (/** @type {string} */ id) => parseFloat(/** @type {HTMLInputElement} */ (panel.querySelector(id)).value);
  const statusEl = /** @type {HTMLElement} */ (panel.querySelector("#lab-status"));

  // Track active animating nodes so loop knows when all are done.
  const active = new Set();

  // Generation counter: incremented by sweep() to invalidate stale rAF loops from prior runs.
  // Each runOne captures the generation at start; frame() exits early if it no longer matches.
  let generation = 0;

  /**
   * Animate one node from 0→1 over `duration` ms, then fire complete.
   * @param {string} nodeId
   * @param {number} duration
   */
  function runOne(nodeId, duration) {
    const myGen = generation;
    active.add(nodeId);
    manager.start("probe-sweep", nodeId);
    const start = performance.now();
    function frame(/** @type {number} */ now) {
      // If sweep() has been called since this runOne started, this loop is stale — exit cleanly.
      if (generation !== myGen) return;
      const t = Math.min((now - start) / duration, 1);
      if (t < 1) {
        manager.progress("probe-sweep", nodeId, t);
        requestAnimationFrame(frame);
      } else {
        manager.end("probe-sweep", nodeId);
        active.delete(nodeId);
        onOneDone();
      }
    }
    requestAnimationFrame(frame);
  }

  function onOneDone() {
    statusEl.textContent = active.size ? `sweeping: ${active.size}` : "idle";
    if (active.size === 0 && /** @type {HTMLInputElement} */ (panel.querySelector("#lab-loop")).checked) {
      sweep();
    }
  }

  function sweep() {
    // Increment generation to invalidate any in-flight rAF loops from prior runs.
    generation++;
    // Cancel any in-flight overlays (the rAF loops will exit on their next tick via generation check).
    for (const nodeId of active) {
      manager.end("probe-sweep", nodeId);
    }
    active.clear();
    const n = numVal("#lab-n");
    const dur = numVal("#lab-dur");
    for (let i = 0; i < n; i++) runOne(nodeIds[i], dur);
    statusEl.textContent = `sweeping: ${n}`;
  }

  /** @type {HTMLButtonElement} */ (panel.querySelector("#lab-sweep")).addEventListener("click", sweep);

  cy.fit(undefined, 40); // include the grid in the initial view
}
