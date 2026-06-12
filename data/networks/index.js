// @ts-check
// Single source of truth for the hand-crafted named-network registry.
// Imported by every entry point (browser main.js + headless scripts) so a new
// network only needs to be registered here, not in four places.

import { buildNetwork as buildCorporateFoothold } from "./corporate-foothold.js";
import { buildNetwork as buildResearchStation } from "./research-station.js";
import { buildNetwork as buildCorporateExchange } from "./corporate-exchange.js";
import { buildNetwork as buildGenerated } from "./generated.js";

/**
 * Hand-crafted networks keyed by name. Procedural generation (`buildGenerated`)
 * is intentionally not in this dict — it takes a spec and is selected separately.
 * @type {Record<string, () => any>}
 */
export const NAMED_NETWORKS = {
  "corporate-foothold": buildCorporateFoothold,
  "research-station": buildResearchStation,
  "corporate-exchange": buildCorporateExchange,
};

/** The default network name when none is specified. */
export const DEFAULT_NETWORK = "corporate-foothold";

export { buildGenerated };
