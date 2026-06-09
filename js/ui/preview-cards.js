// @ts-check
// Mock exploit-card data for the preview harness card gallery. Deterministic
// (no RNG) so the full design space — rarity × quality × wear × match — is
// always visible at once for tuning card visuals (supports #117). The pure
// builders (cardGalleryGroups, MOCK_SELECTED_NODE) are node-testable; only
// mountCardGallery touches the DOM.

/** @typedef {import('../core/types.js').ExploitCard} ExploitCard */

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
        card({ rarity: "common", vuln: "sql-injection", name: "no-match (sqli)" }),
      ],
    },
  ];
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
