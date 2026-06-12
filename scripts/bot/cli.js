// @ts-check
// Bot CLI — run a single bot game and print stats.
//
// Usage:
//   node scripts/bot/cli.js --network corporate-foothold --seed test-1
//   node scripts/bot/cli.js --network research-station --verbose
//   node scripts/bot/cli.js --generated --seed test-1 --threat C --wealth B

import { runBot } from "./run.js";
import { NAMED_NETWORKS, DEFAULT_NETWORK, buildGenerated } from "../../data/networks/index.js";
import { parseGradeArgs } from "../lib/grade-args.js";

// Parse args
let networkName = DEFAULT_NETWORK;
let seed = undefined;
let verbose = false;
let generated = false;

const argv = process.argv.slice(2);
const spec = parseGradeArgs(argv);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--network" && argv[i + 1]) networkName = argv[++i];
  else if (argv[i] === "--seed" && argv[i + 1]) seed = argv[++i];
  else if (argv[i] === "--verbose" || argv[i] === "-v") verbose = true;
  else if (argv[i] === "--generated" || argv[i] === "-g") generated = true;
}

/** @returns {{ graphDef: any, meta: any }} */
function getBuildNetwork() {
  if (generated) {
    return buildGenerated({ seed: seed ?? "gen-1", spec });
  }
  const fn = NAMED_NETWORKS[networkName];
  if (!fn) {
    console.error(`Unknown network: ${networkName}. Available: ${Object.keys(NAMED_NETWORKS).join(", ")}, --generated`);
    process.exit(1);
  }
  return fn();
}

const networkResult = getBuildNetwork();
const stats = runBot(() => networkResult, { seed, verbose });

console.log(JSON.stringify(stats, null, 2));
