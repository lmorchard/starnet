// @ts-check
// Headless darknet broker buy logic.
// Both the DOM store modal (store.js) and the console buy command (console.js)
// delegate to this module. No DOM dependencies.

import { buyExploit } from "./state.js";
import { generateExploitForVuln, getStoreCatalog } from "./exploits.js";

/**
 * Buy an exploit card from the darknet broker by catalog index (1-based)
 * or vulnerability ID string.
 *
 * @param {number | string} indexOrVulnId — 1-based catalog index or vuln ID string
 * @returns {{ card: import('./types.js').ExploitCard, price: number, vulnId: string } | null}
 */
export function buyFromStore(indexOrVulnId) {
  const catalog = getStoreCatalog();
  let item = null;

  if (typeof indexOrVulnId === "number") {
    if (indexOrVulnId >= 1 && indexOrVulnId <= catalog.length) {
      item = catalog[indexOrVulnId - 1];
    }
  } else {
    const lower = String(indexOrVulnId).toLowerCase();
    const matches = catalog.filter((c) => c.vulnId.toLowerCase() === lower);
    if (matches.length === 1) item = matches[0];
    // If no exact match, try prefix
    if (!item) {
      const prefix = catalog.filter((c) => c.vulnId.toLowerCase().startsWith(lower));
      if (prefix.length === 1) item = prefix[0];
    }
  }

  if (!item) return null;

  const card = generateExploitForVuln(item.vulnId);
  const success = buyExploit(card, item.price);
  if (!success) return null;

  return { card, price: item.price, vulnId: item.vulnId };
}
