// @ts-check
/**
 * Sweep Fan-out Demo — permanent preview for concurrent multi-node probe animations.
 * Drives N grid nodes through OverlayManager.handleFeedback (start → progress → complete)
 * with the manager's built-in random jitter destaggers simultaneous starts.
 * No direct overlay mounting — exercises the real manager path end-to-end.
 */

import { getCy, updateNodeStyle } from "./graph.js";
import { A } from "../core/action-ids.js";

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

  /**
   * Animate one node from 0→1 over `duration` ms, then fire complete.
   * @param {string} nodeId
   * @param {number} duration
   */
  function runOne(nodeId, duration) {
    active.add(nodeId);
    manager.handleFeedback({ nodeId, action: A.PROBE, phase: "start", progress: 0 });
    const start = performance.now();
    function frame(/** @type {number} */ now) {
      const t = Math.min((now - start) / duration, 1);
      if (t < 1) {
        manager.handleFeedback({ nodeId, action: A.PROBE, phase: "progress", progress: t });
        requestAnimationFrame(frame);
      } else {
        manager.handleFeedback({ nodeId, action: A.PROBE, phase: "complete", progress: 1 });
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
    // Cancel any in-flight by sending complete to all active nodes.
    for (const nodeId of active) {
      manager.handleFeedback({ nodeId, action: A.PROBE, phase: "cancel" });
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
