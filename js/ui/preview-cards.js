// @ts-check
// Mock exploit-card data for the preview harness card gallery. Deterministic
// (no RNG) so the full design space — rarity × quality × wear × match — is
// always visible at once for tuning card visuals (supports #117). The pure
// builders (cardGalleryGroups, MOCK_SELECTED_NODE) are node-testable; only
// mountCardGallery touches the DOM.

/** @typedef {import('../core/types.js').ExploitCard} ExploitCard */

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

const RARITIES = /** @type {const} */ (["common", "uncommon", "rare"]);
const WEARS = /** @type {const} */ (["fresh", "worn", "disclosed"]);
const QUALITY = { low: 0.2, mid: 0.55, high: 0.9 };
const USES = { common: 3, uncommon: 5, rare: 8 };

/**
 * @param {string} id
 * @param {{ rarity?: string, quality?: number, wear?: string, vuln?: string, name?: string }} [opts]
 * @returns {ExploitCard}
 */
function mockCard(id, { rarity = "common", quality = 0.55, wear = "fresh", vuln = "unpatched-ssh", name } = {}) {
  return {
    id,
    name: name ?? `${rarity} exploit`,
    rarity: /** @type {any} */ (rarity),
    quality,
    targetVulnTypes: [vuln],
    decayState: /** @type {any} */ (wear),
    usesRemaining: wear === "disclosed" ? 0 : USES[/** @type {keyof typeof USES} */ (rarity)],
  };
}

// Mock probed node the match group compares against (knows two vulns).
export const MOCK_SELECTED_NODE = {
  probed: true,
  vulnerabilities: [
    { id: "unpatched-ssh", patched: false, hidden: false },
    { id: "weak-auth", patched: false, hidden: false },
  ],
};

/**
 * Card groups, each rendered as one <starnet-hand>. Spans the full state space:
 * rarity × quality, wear states, and match/no-match vs a probed node.
 * @returns {Array<{ title: string, selectedNode: object|null, cards: ExploitCard[] }>}
 */
export function cardGalleryGroups() {
  // Call-local counter → ids are deterministic per call (mock-0..N every time),
  // with no module-global state to drift across repeated calls.
  let n = 0;
  const card = (opts) => mockCard(`mock-${n++}`, opts);
  return [
    {
      title: "Rarity × Quality",
      selectedNode: null,
      cards: RARITIES.flatMap((r) =>
        Object.entries(QUALITY).map(([q, v]) => card({ rarity: r, quality: v, name: `${r} ${q}` }))),
    },
    {
      title: "Wear states",
      selectedNode: null,
      cards: WEARS.map((w) => card({ rarity: "uncommon", wear: w, name: `uncommon ${w}` })),
    },
    {
      title: "Match vs node",
      selectedNode: MOCK_SELECTED_NODE,
      cards: [
        card({ rarity: "rare", vuln: "unpatched-ssh", name: "match (ssh)" }),
        card({ rarity: "common", vuln: "kernel-exploit", name: "no-match (kernel)" }),
      ],
    },
  ];
}

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
  for (const level of ["locked", "open", "owned"]) {
    container.appendChild(cell(accessGlyphDataUri(level), level));
  }
}

/**
 * Mount the gallery: one labeled <starnet-hand> per group, fed mock props.
 * @param {HTMLElement} container
 */
export function mountCardGallery(container) {
  for (const g of cardGalleryGroups()) {
    const h = document.createElement("h3");
    h.textContent = g.title;
    container.appendChild(h);
    const hand = /** @type {any} */ (document.createElement("starnet-hand"));
    hand.cards = g.cards;
    hand.selectedNode = g.selectedNode;
    hand.selectedNodeId = g.selectedNode ? "mock-node" : "";
    container.appendChild(hand);
  }
}
