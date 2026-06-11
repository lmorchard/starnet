// @ts-check
// Headless darknet broker buy logic.
// Both the DOM store modal (store.js) and the console buy command (console.js)
// delegate to this module. No DOM dependencies.

import { buyExploit } from "./state.js";
import { generateExploitForVuln, getStoreCatalog } from "./exploits.js";
import { withdraw, addCardToInventory } from "./profile/index.js";

/**
 * Resolve a catalog item from a 1-based index or a vuln ID string (exact match,
 * then unique prefix). Returns null if unresolved/ambiguous.
 * @param {number | string} indexOrVulnId
 * @returns {{ vulnId: string, name: string, rarity: string, price: number } | null}
 */
function findCatalogItem(indexOrVulnId) {
  const catalog = getStoreCatalog();
  if (typeof indexOrVulnId === "number") {
    return indexOrVulnId >= 1 && indexOrVulnId <= catalog.length ? catalog[indexOrVulnId - 1] : null;
  }
  const lower = String(indexOrVulnId).toLowerCase();
  const exact = catalog.filter((c) => c.vulnId.toLowerCase() === lower);
  if (exact.length === 1) return exact[0];
  const prefix = catalog.filter((c) => c.vulnId.toLowerCase().startsWith(lower));
  return prefix.length === 1 ? prefix[0] : null;
}

/**
 * Buy an exploit from the broker into the in-run hand (spends in-run cash).
 * @param {number | string} indexOrVulnId — 1-based catalog index or vuln ID string
 * @returns {{ card: import('./types.js').ExploitCard, price: number, vulnId: string } | null}
 */
export function buyFromStore(indexOrVulnId) {
  const item = findCatalogItem(indexOrVulnId);
  if (!item) return null;
  const card = generateExploitForVuln(item.vulnId);
  const success = buyExploit(card, item.price);
  if (!success) return null;
  return { card, price: item.price, vulnId: item.vulnId };
}

/**
 * Buy an exploit from the broker into a persistent profile (spends bank cash,
 * adds to the inventory). Used by the overworld hub's darknet store.
 * @param {import('./types.js').StarnetProfile} profile
 * @param {number | string} indexOrVulnId
 * @returns {{ card: import('./types.js').ExploitCard, price: number, vulnId: string } | null}
 */
export function buyFromStoreToProfile(profile, indexOrVulnId) {
  const item = findCatalogItem(indexOrVulnId);
  if (!item) return null;
  if (profile.bank < item.price) return null;
  const card = generateExploitForVuln(item.vulnId);
  withdraw(profile, item.price);
  addCardToInventory(profile, card);
  return { card, price: item.price, vulnId: item.vulnId };
}
