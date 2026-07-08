// @ts-check
// Preview-harness swatch sheets: vuln-type glyphs and HUD indicator glyphs.
// (The exploit-card gallery was removed in the Phase 9 sweep along with the
// card model; only the glyph swatch mounts remain.)

import { ALL_VULN_GLYPH_IDS, vulnGlyphDataUri } from "./vuln-glyphs.js";
import {
  alertLampDataUri,
  connStatusDataUri,
  tickMeterDataUri,
  heatGaugeDataUri,
  heatZone,
  missionMarkDataUri,
  accessGlyphDataUri,
} from "./indicator-glyphs.js";

/**
 * Mount the vuln-glyph swatch sheet: one labeled cell per vuln type, so all 15
 * glyphs can be eyeballed for distinctness/legibility at small size.
 * @param {HTMLElement} container
 */
export function mountVulnSwatches(container) {
  for (const id of ALL_VULN_GLYPH_IDS) {
    const cell = document.createElement("div");
    cell.className = "vuln-swatch";
    const img = document.createElement("img");
    img.src = vulnGlyphDataUri(id);
    img.width = 40;
    img.height = 40;
    img.alt = id;
    const label = document.createElement("span");
    label.textContent = id;
    cell.append(img, label);
    container.appendChild(cell);
  }
}

/**
 * Mount the indicator-glyph swatch sheet: alert lamps (green/yellow/red),
 * connection status (passive/active/detecting), tick meters (100/60/30/0 %),
 * and mission marks (complete/failed). Each glyph is labeled.
 * @param {HTMLElement} container
 */
export function mountIndicatorSwatches(container) {
  /** @param {string} src @param {string} label @returns {HTMLElement} */
  function cell(src, label) {
    const el = document.createElement("div");
    el.className = "vuln-swatch";
    const img = document.createElement("img");
    img.src = src;
    img.width = 32;
    img.height = 32;
    img.alt = label;
    const span = document.createElement("span");
    span.textContent = label;
    el.append(img, span);
    return el;
  }

  /** @param {string} title */
  function row(title) {
    const h = document.createElement("h3");
    h.textContent = title;
    container.appendChild(h);
  }

  // Alert lamps
  row("Alert lamp");
  for (const level of ["green", "yellow", "red"]) {
    container.appendChild(cell(alertLampDataUri(level), level));
  }

  // Connection status
  row("Conn status");
  for (const status of ["passive", "active", "detecting"]) {
    container.appendChild(cell(connStatusDataUri(status), status));
  }

  // Tick meters at four sample fractions
  row("Tick meter");
  for (const frac of [1, 0.6, 0.3, 0]) {
    container.appendChild(cell(tickMeterDataUri(frac), `${Math.round(frac * 100)}%`));
  }

  // Heat gauge cool→hot (fixed visual scale; no number/threshold shown). Label each sample by
  // its actual tier (heatZone) so the swatch labels can't drift from the gauge's color thresholds.
  row("Heat gauge");
  for (const heat of [1, 6, 11, 12]) {
    container.appendChild(cell(heatGaugeDataUri(heat), heatZone(heat)));
  }

  // Mission marks
  row("Mission mark");
  for (const state of ["complete", "failed"]) {
    container.appendChild(cell(missionMarkDataUri(state), state));
  }

  // Access level — 3-chevron tier badge (lit bottom-up by tier)
  row("Access level");
  for (const level of ["locked", "owned"]) {
    container.appendChild(cell(accessGlyphDataUri(level), level));
  }
}
