// @ts-check
// Wires the three layout splitters (sidebar width, log height, hand height).
// Each divider drags one CSS var on #app; the var drives a flex-basis (see
// css/style.css). Sizes load from / save to layout-store (localStorage).
//
// Pointer Events cover mouse + touch with one code path. The numeric clamp is
// clampSize() in layout-store (unit-tested); live viewport-relative maxima are
// computed here at drag time.

import { loadLayout, saveLayout, clampSize, DEFAULT_LAYOUT, SIZE_BOUNDS } from "./layout-store.js";

/**
 * Per-axis config. `cssVar` is set on #app; `sizeFrom()` converts a pointer
 * position into a new size (the resized pane is below/right of the divider, so
 * moving toward it shrinks, away grows); `liveMax()` is the viewport-relative
 * ceiling enforced during drag.
 */
function axisConfig() {
  return {
    sidebarW: {
      cssVar: "--sidebar-w",
      vertical: false, // drag along X
      // sidebar is the RIGHT pane: moving left (smaller clientX) grows it
      sizeFrom: (startSize, startPos, pos) => startSize + (startPos - pos),
      liveMin: () => SIZE_BOUNDS.sidebarW.min,
      liveMax: () => Math.max(SIZE_BOUNDS.sidebarW.min, window.innerWidth * 0.5),
    },
    logH: {
      cssVar: "--log-h",
      vertical: true, // drag along Y
      // log-pane is the BOTTOM pane: moving up (smaller clientY) grows it
      sizeFrom: (startSize, startPos, pos) => startSize + (startPos - pos),
      liveMin: () => SIZE_BOUNDS.logH.min,
      liveMax: () => Math.max(SIZE_BOUNDS.logH.min, window.innerHeight * 0.6),
    },
    handH: {
      cssVar: "--hand-h",
      vertical: true,
      // hand is the BOTTOM pane: moving up grows it
      sizeFrom: (startSize, startPos, pos) => startSize + (startPos - pos),
      liveMin: () => SIZE_BOUNDS.handH.min,
      liveMax: () => {
        const el = document.getElementById("sidebar");
        const h = el ? el.clientHeight : window.innerHeight;
        return Math.max(SIZE_BOUNDS.handH.min, h * 0.6);
      },
    },
  };
}

/** Read the current px size for an axis from the applied CSS var (fallback to default). */
function currentSize(app, cssVar, fallback) {
  const raw = getComputedStyle(app).getPropertyValue(cssVar).trim();
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** Apply a full layout object to the #app CSS vars. */
function applyLayout(app, layout) {
  app.style.setProperty("--sidebar-w", `${layout.sidebarW}px`);
  app.style.setProperty("--log-h", `${layout.logH}px`);
  app.style.setProperty("--hand-h", `${layout.handH}px`);
}

/**
 * Initialize the resizers: apply the saved layout, then wire each splitter.
 * Safe to call once from main.js init().
 */
export function initResizers() {
  const app = document.getElementById("app");
  if (!app) return;

  const layout = loadLayout();
  applyLayout(app, layout);

  const cfg = axisConfig();
  let saveTimer = null;
  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveLayout({
        sidebarW: currentSize(app, "--sidebar-w", DEFAULT_LAYOUT.sidebarW),
        logH: currentSize(app, "--log-h", DEFAULT_LAYOUT.logH),
        handH: currentSize(app, "--hand-h", DEFAULT_LAYOUT.handH),
      });
    }, 250);
  };

  for (const el of document.querySelectorAll(".splitter")) {
    const axis = /** @type {HTMLElement} */ (el).dataset.resize;
    const c = axis && cfg[axis];
    if (!c) continue;

    el.addEventListener("pointerdown", (/** @type {PointerEvent} */ ev) => {
      ev.preventDefault();
      const startPos = c.vertical ? ev.clientY : ev.clientX;
      const startSize = currentSize(app, c.cssVar, DEFAULT_LAYOUT[axis]);
      el.classList.add("dragging");
      el.setPointerCapture(ev.pointerId);

      const onMove = (/** @type {PointerEvent} */ mv) => {
        const pos = c.vertical ? mv.clientY : mv.clientX;
        const next = clampSize(c.sizeFrom(startSize, startPos, pos), c.liveMin(), c.liveMax());
        app.style.setProperty(c.cssVar, `${next}px`);
      };
      const cleanup = () => {
        el.classList.remove("dragging");
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        el.removeEventListener("lostpointercapture", onLost);
        scheduleSave();
      };
      const onUp = (/** @type {PointerEvent} */ up) => {
        el.releasePointerCapture(up.pointerId);
        cleanup();
      };
      // lostpointercapture fires on pointercancel / OS interruption (capture is
      // auto-released by the browser); without this the splitter stays stuck in
      // .dragging on touch. Guard against the explicit-release path double-firing.
      const onLost = () => { if (el.classList.contains("dragging")) cleanup(); };
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
      el.addEventListener("lostpointercapture", onLost);
    });

    // Double-click resets just this axis to its default.
    el.addEventListener("dblclick", () => {
      app.style.setProperty(c.cssVar, `${DEFAULT_LAYOUT[axis]}px`);
      scheduleSave();
    });
  }
}
