// @ts-check
// Bot CLI — run a single bot game and print stats.
//
// Usage:
//   node scripts/bot/cli.js --network corporate-foothold --seed test-1
//   node scripts/bot/cli.js --network research-station --verbose
//   node scripts/bot/cli.js --generated --seed test-1 --threat C --wealth B

import { runBot } from "./run.js";
import { buildNetwork as buildCorporateFoothold } from "../../data/networks/corporate-foothold.js";
import { buildNetwork as buildResearchStation } from "../../data/networks/research-station.js";
import { buildNetwork as buildCorporateExchange } from "../../data/networks/corporate-exchange.js";
import { buildNetwork as buildGenerated } from "../../data/networks/generated.js";

const NETWORKS = {
  "corporate-foothold": buildCorporateFoothold,
  "research-station": buildResearchStation,
  "corporate-exchange": buildCorporateExchange,
};

// Parse args
let networkName = "corporate-foothold";
let seed = undefined;
let verbose = false;
let generated = false;
let threat = "C", wealth = "B", complexity = "C", depth = "C";

const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--network" && argv[i + 1]) networkName = argv[++i];
  else if (argv[i] === "--seed" && argv[i + 1]) seed = argv[++i];
  else if (argv[i] === "--verbose" || argv[i] === "-v") verbose = true;
  else if (argv[i] === "--generated" || argv[i] === "-g") generated = true;
  else if (argv[i] === "--threat" && argv[i + 1]) threat = argv[++i];
  else if (argv[i] === "--wealth" && argv[i + 1]) wealth = argv[++i];
  else if (argv[i] === "--complexity" && argv[i + 1]) complexity = argv[++i];
  else if (argv[i] === "--depth" && argv[i + 1]) depth = argv[++i];
}

/** @returns {{ graphDef: any, meta: any }} */
function getBuildNetwork() {
  if (generated) {
    return buildGenerated({ seed: seed ?? "gen-1", spec: { threat, wealth, complexity, depth } });
  }
  const fn = NETWORKS[networkName];
  if (!fn) {
    console.error(`Unknown network: ${networkName}. Available: ${Object.keys(NETWORKS).join(", ")}, --generated`);
    process.exit(1);
  }
  return fn();
}

const networkResult = getBuildNetwork();
const stats = runBot(() => networkResult, { seed, verbose });

console.log(JSON.stringify(stats, null, 2));
