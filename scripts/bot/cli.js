// @ts-check
// Bot CLI — run a single bot game and print stats.
//
// Usage:
//   node scripts/bot/cli.js --network corporate-foothold --seed test-1
//   node scripts/bot/cli.js --network research-station --verbose

import { runBot } from "./run.js";
import { buildNetwork as buildCorporateFoothold } from "../../data/networks/corporate-foothold.js";
import { buildNetwork as buildResearchStation } from "../../data/networks/research-station.js";
import { buildNetwork as buildCorporateExchange } from "../../data/networks/corporate-exchange.js";

const NETWORKS = {
  "corporate-foothold": buildCorporateFoothold,
  "research-station": buildResearchStation,
  "corporate-exchange": buildCorporateExchange,
};

// Parse args
let networkName = "corporate-foothold";
let seed = undefined;
let verbose = false;

const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--network" && argv[i + 1]) networkName = argv[++i];
  else if (argv[i] === "--seed" && argv[i + 1]) seed = argv[++i];
  else if (argv[i] === "--verbose" || argv[i] === "-v") verbose = true;
}

const buildNetwork = NETWORKS[networkName];
if (!buildNetwork) {
  console.error(`Unknown network: ${networkName}. Available: ${Object.keys(NETWORKS).join(", ")}`);
  process.exit(1);
}

const stats = runBot(() => buildNetwork(), { seed, verbose });

console.log(JSON.stringify(stats, null, 2));
